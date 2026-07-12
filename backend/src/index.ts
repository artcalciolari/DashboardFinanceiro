import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'node:path';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { HttpError } from './utils/httpError';

// Prefer a backend-local .env, but also support the repository-root .env used
// by docker-compose when running the backend directly with npm run dev.
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

if (!process.env.DATABASE_URL && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
  const user = encodeURIComponent(process.env.DB_USER);
  const password = encodeURIComponent(process.env.DB_PASSWORD);
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${process.env.DB_NAME}`;
}

const app = express();
const PORT = process.env.PORT || 3001;
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const allowedOrigins = (process.env.CORS_ORIGIN?.split(',') ?? defaultOrigins)
  .map((origin) => origin.trim())
  .filter(Boolean);

// Requisições que chegam pelo proxy do nginx são same-origin: o Origin do
// browser bate com o Host encaminhado, qualquer que seja o IP/domínio usado.
function isAllowedOrigin(origin: string | undefined, req: express.Request): boolean {
  if (!origin || allowedOrigins.includes(origin)) return true;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : req.protocol;
  return origin === `${proto}://${req.headers.host}`;
}

app.use(helmet());
app.use((req, res, next) => {
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin, req)) {
        callback(null, true);
        return;
      }
      callback(new HttpError(403, 'Origem não permitida', 'CORS_ORIGIN_DENIED'));
    },
  })(req, res, next);
});
app.use(express.json());

app.use('/api', router);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

export default app;
