import { afterEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { dashboardAuth } from '../src/middleware/auth';
afterEach(() => vi.unstubAllEnvs());
function app() { const result = express(); result.use(dashboardAuth()); result.get('/', (_req, res) => res.send('ok')); return result; }
it('allows local development without credentials', async () => {
  vi.stubEnv('DASHBOARD_AUTH_USER', ''); vi.stubEnv('DASHBOARD_AUTH_PASSWORD', '');
  expect((await request(app()).get('/')).status).toBe(200);
});
it('fails closed for missing or invalid production credentials', () => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('DASHBOARD_AUTH_USER', ''); vi.stubEnv('DASHBOARD_AUTH_PASSWORD', '');
  expect(app).toThrow('Configure');
  vi.stubEnv('DASHBOARD_AUTH_USER', 'arthur');
  expect(app).toThrow('Configure');
  vi.stubEnv('DASHBOARD_AUTH_PASSWORD', 'short'); expect(app).toThrow('Configure');
  vi.stubEnv('DASHBOARD_AUTH_PASSWORD', 'a-long-test-password');
  vi.stubEnv('DASHBOARD_AUTH_USER', 'invalid:name'); expect(app).toThrow('Configure');
});
it('challenges missing, malformed and incorrect credentials and accepts correct ones', async () => {
  vi.stubEnv('DASHBOARD_AUTH_USER', 'arthur'); vi.stubEnv('DASHBOARD_AUTH_PASSWORD', 'a-long-test-password');
  const target = app();
  const response = await request(target).get('/');
  expect(response.status).toBe(401); expect(response.headers['www-authenticate']).toContain('Basic');
  expect((await request(target).get('/').set('Authorization', 'Bearer bad')).status).toBe(401);
  expect((await request(target).get('/').auth('arthur', 'bad')).status).toBe(401);
  expect((await request(target).get('/').auth('arthur', 'a-long-test-password')).status).toBe(200);
});
