import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

function digest(value: string) { return createHash('sha256').update(value).digest(); }

// Single-user dashboard: browser HTTP Basic authentication, over HTTPS remotely.
export function dashboardAuth(): RequestHandler {
  const username = process.env.DASHBOARD_AUTH_USER;
  const password = process.env.DASHBOARD_AUTH_PASSWORD;
  if (!username && !password && process.env.NODE_ENV !== 'production') return (_req, _res, next) => next();
  if (!username || /[:\r\n]/.test(username) || !password || password.length < 16) {
    throw new Error('Configure DASHBOARD_AUTH_USER e DASHBOARD_AUTH_PASSWORD (mínimo 16 caracteres)');
  }
  const expected = digest(`${username}:${password}`);
  return (req, res, next) => {
    const authorization = req.headers.authorization;
    const match = authorization?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i);
    if (match && timingSafeEqual(digest(Buffer.from(match[1], 'base64').toString('utf8')), expected)) {
      next();
      return;
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Saldo Claro", charset="UTF-8"');
    res.setHeader('Cache-Control', 'no-store');
    res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Autenticação necessária' });
  };
}
