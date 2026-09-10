#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

DB_CONTAINER="${DB_CONTAINER:-financeiro_db}"
BACKUP_DIR="${BACKUP_DIR:-/home/arthur/dashboard-financeiro/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
[[ "$BACKUP_DIR" = /* && "$BACKUP_DIR" != / && "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || exit 1
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/financeiro-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
verify_db="backup_verify_$(date +%s)_$$"
db_user="$(docker exec "$DB_CONTAINER" printenv POSTGRES_USER)"
db_name="$(docker exec "$DB_CONTAINER" printenv POSTGRES_DB)"
created_verify=0
cleanup() {
  rm -f "${backup}.tmp"
  if [[ "$created_verify" = 1 ]]; then
    docker exec "$DB_CONTAINER" dropdb -U "$db_user" --if-exists "$verify_db" >/dev/null
  fi
}
trap cleanup EXIT

docker exec "$DB_CONTAINER" pg_dump -U "$db_user" -d "$db_name" --format=custom --no-owner --no-acl > "${backup}.tmp"
docker exec "$DB_CONTAINER" createdb -U "$db_user" "$verify_db"
created_verify=1
docker exec -i "$DB_CONTAINER" pg_restore -U "$db_user" -d "$verify_db" --exit-on-error --no-owner --no-acl < "${backup}.tmp"
docker exec "$DB_CONTAINER" psql -U "$db_user" -d "$verify_db" -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "Transaction";' >/dev/null
mv "${backup}.tmp" "$backup"

# Point to a separate host over SSH. A transfer failure fails the backup job.
if [[ -n "${BACKUP_OFFSITE_DEST:-}" ]]; then
  rsync -a -- "$backup" "$BACKUP_OFFSITE_DEST"
fi
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'financeiro-*.dump' -mtime "+$BACKUP_RETENTION_DAYS" -delete
printf '%s\n' "$backup"
