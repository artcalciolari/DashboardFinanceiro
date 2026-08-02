#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

SOURCE_DIR="${SOURCE_DIR:-${GITHUB_WORKSPACE:-}}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/arthur/dashboard-financeiro}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-dashboard-financeiro}"
DB_CONTAINER="${DB_CONTAINER:-financeiro_db}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-financeiro_backend}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-financeiro_frontend}"

if [[ -z "$SOURCE_DIR" || ! -f "$SOURCE_DIR/docker-compose.yml" ]]; then
  echo "SOURCE_DIR must point to a checked-out DashboardFinanceiro release" >&2
  exit 1
fi

if [[ "$DEPLOY_DIR" != "/home/arthur/dashboard-financeiro" ]]; then
  echo "Refusing unexpected DEPLOY_DIR: $DEPLOY_DIR" >&2
  exit 1
fi

for command_name in docker rsync curl; do
  command -v "$command_name" >/dev/null || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done

if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
  echo "Missing production environment file: $DEPLOY_DIR/.env" >&2
  exit 1
fi

if [[ ! -s "$DEPLOY_DIR/deploy/.htpasswd" ]]; then
  echo "Missing production Basic Auth file: $DEPLOY_DIR/deploy/.htpasswd" >&2
  exit 1
fi

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "Database container $DB_CONTAINER does not exist" >&2
  exit 1
fi

mkdir -p "$DEPLOY_DIR/backups" "$DEPLOY_DIR/deploy"
chmod 600 "$DEPLOY_DIR/.env"
# The bind-mounted file keeps host ownership. Nginx workers must be able to
# read its bcrypt hashes; production credentials themselves are not stored here.
chmod 644 "$DEPLOY_DIR/deploy/.htpasswd"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
revision="${GITHUB_SHA:-manual}"
backup="$DEPLOY_DIR/backups/pre-deploy-${timestamp}-${revision:0:12}.dump"
backup_tmp="${backup}.tmp"

cleanup() {
  rm -f "$backup_tmp"
}

web_stopped=0
migration_succeeded=0
backup_verified=0

on_error() {
  exit_code=$?
  cleanup
  if [[ "$web_stopped" == "1" && "$migration_succeeded" == "0" ]]; then
    echo "Migration failed. Restarting unchanged application containers." >&2
    docker start "$BACKEND_CONTAINER" "$FRONTEND_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [[ "$backup_verified" == "1" ]]; then
    echo "Deployment failed. Verified backup: $backup" >&2
  else
    echo "Deployment failed before a backup was verified" >&2
  fi
  exit "$exit_code"
}

trap on_error ERR
trap cleanup EXIT

echo "Checking database readiness"
db_user="$(docker exec "$DB_CONTAINER" printenv POSTGRES_USER)"
db_name="$(docker exec "$DB_CONTAINER" printenv POSTGRES_DB)"
docker exec "$DB_CONTAINER" pg_isready -U "$db_user" -d "$db_name" >/dev/null

echo "Creating PostgreSQL backup: $backup"
docker exec "$DB_CONTAINER" pg_dump -U "$db_user" -d "$db_name" \
  --format=custom --no-owner --no-acl \
  > "$backup_tmp"
docker exec -i "$DB_CONTAINER" pg_restore --list < "$backup_tmp" >/dev/null
mv "$backup_tmp" "$backup"
backup_verified=1

money_migration_applied="$(docker exec "$DB_CONTAINER" psql -At -U "$db_user" -d "$db_name" -c \
  "SELECT EXISTS (SELECT 1 FROM \"_prisma_migrations\" WHERE migration_name = '1_money_integrity_and_indexes' AND finished_at IS NOT NULL AND rolled_back_at IS NULL);")"

if [[ "$money_migration_applied" == "f" ]]; then
  echo "Running integer-cent migration preflight"
  docker exec -i "$DB_CONTAINER" psql -U "$db_user" -d "$db_name" \
    < "$SOURCE_DIR/backend/prisma/preflight-money-occurrences.sql"
else
  echo "Integer-cent migration already applied; preflight not needed"
fi

row_count_query='SELECT (SELECT count(*) FROM "Account"),(SELECT count(*) FROM "Category"),(SELECT count(*) FROM "Transaction"),(SELECT count(*) FROM "InstallmentGroup"),(SELECT count(*) FROM "Subscription"),(SELECT count(*) FROM "Alert");'
row_counts_before="$(docker exec "$DB_CONTAINER" psql -At -U "$db_user" -d "$db_name" -c "$row_count_query")"

echo "Copying release into permanent deployment directory"
rsync -a \
  --exclude='.git/' \
  --exclude='.github/' \
  --exclude='.claude/' \
  --exclude='.env' \
  --exclude='backups/' \
  --exclude='deploy/.htpasswd' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  "$SOURCE_DIR/" "$DEPLOY_DIR/"

compose=(
  docker compose
  --project-name "$COMPOSE_PROJECT_NAME"
  --env-file "$DEPLOY_DIR/.env"
  -f "$DEPLOY_DIR/docker-compose.yml"
  -f "$DEPLOY_DIR/docker-compose.remote.yml"
)

echo "Validating Compose configuration"
"${compose[@]}" config --quiet

echo "Building release images before downtime"
"${compose[@]}" build --pull backend frontend

echo "Stopping web services for schema cutover"
"${compose[@]}" stop frontend backend
web_stopped=1

echo "Applying Prisma migrations"
"${compose[@]}" run --rm --no-deps backend pnpm exec prisma migrate deploy
migration_succeeded=1

row_counts_after="$(docker exec "$DB_CONTAINER" psql -At -U "$db_user" -d "$db_name" -c "$row_count_query")"

if [[ "$row_counts_before" != "$row_counts_after" ]]; then
  echo "Row counts changed during migration: $row_counts_before -> $row_counts_after" >&2
  exit 1
fi

echo "Starting release"
"${compose[@]}" up -d --remove-orphans --wait --wait-timeout 180
web_stopped=0

docker exec "$BACKEND_CONTAINER" node -e \
  "fetch('http://127.0.0.1:3001/health/ready').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
docker exec --user nginx "$FRONTEND_CONTAINER" test -r /etc/nginx/.htpasswd

http_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' http://127.0.0.1/)"
if [[ "$http_status" != "401" ]]; then
  echo "Expected authenticated frontend to return 401 without credentials; got $http_status" >&2
  exit 1
fi

"${compose[@]}" ps
echo "Deployment complete. Row counts: $row_counts_after"
echo "Backup retained at: $backup"
