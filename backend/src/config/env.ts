import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

process.env.TZ ??= process.env.BUSINESS_TIME_ZONE ?? 'America/Sao_Paulo';

if (!process.env.DATABASE_URL && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
  const user = encodeURIComponent(process.env.DB_USER);
  const password = encodeURIComponent(process.env.DB_PASSWORD);
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${process.env.DB_NAME}`;
}
