import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { HttpError } from './utils/httpError';
import prisma from './lib/prisma';

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function isAllowedOrigin(origin: string | undefined, req: express.Request, allowedOrigins: string[]) {
  if (!origin || allowedOrigins.includes(origin)) return true;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : req.protocol;
  return origin === `${proto}://${req.headers.host}`;
}

export function createApp() {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN?.split(',') ?? defaultOrigins)
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(pinoHttp({ enabled: process.env.NODE_ENV !== 'test' }));
  app.use((req, res, next) => {
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin, req, allowedOrigins)) {
          callback(null, true);
          return;
        }
        callback(new HttpError(403, 'Origem não permitida', 'CORS_ORIGIN_DENIED'));
      },
    })(req, res, next);
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database health check timeout')), 2_000)),
      ]);
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });
  app.get('/health', (_req, res) => res.redirect(307, '/health/live'));
  app.use('/api', router);
  app.use(errorHandler);

  return app;
}
