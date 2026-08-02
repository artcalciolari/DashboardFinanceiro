# AGENTS.md

## Cursor Cloud specific instructions

Full-stack personal finance dashboard. Standard commands and the overall architecture are documented in `README.md` (see "Desenvolvimento Local" and "Testes e saúde"). Notes below are the non-obvious, cloud-VM-specific caveats.

### Services

- PostgreSQL — required by the backend and by integration tests.
- Backend (`backend/`) — Express + Prisma API on port `3001` (`pnpm run dev`).
- Frontend (`frontend/`) — Vite dev server on port `5173` (`pnpm run dev`). It proxies `/api` to `http://localhost:3001` (see `frontend/vite.config.ts`), so no frontend `.env` is needed for local dev.

### PostgreSQL (installed via apt as PG 16, not Docker)

Docker is not available in this VM, so Postgres runs natively. The cluster does **not** auto-start on boot — start it each session before running the backend or integration tests:

```bash
sudo pg_ctlcluster 16 main start
```

Role and databases already exist in the persisted data dir: role `financeiro` / password `financeiro`, databases `financeiro_db` (dev) and `financeiro_test` (integration tests). Connection string: `postgresql://financeiro:financeiro@localhost:5432/<db>`.

### Running the backend

`backend/src/config/env.ts` loads `.env` from both `backend/` and the repo root (`../.env`). Provide the DB connection through the **shell environment**, e.g.:

```bash
cd backend
export DATABASE_URL="postgresql://financeiro:financeiro@localhost:5432/financeiro_db"
pnpm run dev   # serves on 127.0.0.1:3001
```

The Prisma CLI does not read the root `.env`; pass `DATABASE_URL` inline for `prisma generate` / `prisma migrate deploy`.

### Testing / lint / build caveats

- Do **not** create a repo-root `/workspace/.env` containing `DATABASE_URL` or `DB_USER`/`DB_PASSWORD`/`DB_NAME`. `config/env.ts` loads it and it breaks the `tests/env.test.ts` cases that assert a clean env (CI runs the unit jobs without any root `.env`). Provide DB vars via the shell instead.
- Backend unit tests use a mocked Prisma client and need no database: `cd backend && pnpm test` (or `pnpm run test:coverage`, 100% gate).
- Backend integration tests need a real DB. Start Postgres, migrate the test DB, then run with `TEST_DATABASE_URL`:
  ```bash
  cd backend
  DATABASE_URL="postgresql://financeiro:financeiro@localhost:5432/financeiro_test" pnpm exec prisma migrate deploy
  TEST_DATABASE_URL="postgresql://financeiro:financeiro@localhost:5432/financeiro_test" pnpm run test:integration
  ```
- Frontend tests need no services: `cd frontend && pnpm test` (or `pnpm run test:coverage`, 100% gate).
- There is no ESLint config; the effective "lint"/typecheck is `tsc`, which runs as part of `pnpm run build` in each package.
