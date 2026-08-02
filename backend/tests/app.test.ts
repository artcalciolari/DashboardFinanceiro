import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createPrismaMock } from './helpers/prismaMock';

const prisma = createPrismaMock();

vi.mock('../src/lib/prisma', () => ({ default: prisma }));

describe('health and app wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CORS_ORIGIN;
  });

  it('reports process liveness without touching the database', async () => {
    const { createApp } = await import('../src/app');
    const response = await request(createApp()).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('reports ready when the database answers', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const { createApp } = await import('../src/app');
    const response = await request(createApp()).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('reports degraded when the database check fails', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('down'));
    const { createApp } = await import('../src/app');
    const response = await request(createApp()).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', database: 'down' });
  });

  it('redirects /health to /health/live', async () => {
    const { createApp } = await import('../src/app');
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(307);
    expect(response.headers.location).toBe('/health/live');
  });

  it('rejects disallowed CORS origins', async () => {
    process.env.CORS_ORIGIN = 'http://allowed.example';
    const { createApp } = await import('../src/app');
    const response = await request(createApp())
      .get('/health/live')
      .set('Origin', 'http://evil.example');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CORS_ORIGIN_DENIED');
  });

  it('allows same-host origin via forwarded proto', async () => {
    process.env.CORS_ORIGIN = 'http://allowed.example';
    const { createApp } = await import('../src/app');
    const response = await request(createApp())
      .get('/health/live')
      .set('Host', 'app.example')
      .set('X-Forwarded-Proto', 'https, http')
      .set('Origin', 'https://app.example');
    expect(response.status).toBe(200);
  });

  it('allows configured origins and same-host without forwarded proto', async () => {
    process.env.CORS_ORIGIN = ' http://allowed.example , ';
    const { createApp } = await import('../src/app');
    const app = createApp();

    const allowed = await request(app)
      .get('/health/live')
      .set('Origin', 'http://allowed.example');
    expect(allowed.status).toBe(200);

    const sameHost = await request(app)
      .get('/health/live')
      .set('Host', '127.0.0.1:3999')
      .set('Origin', 'http://127.0.0.1:3999');
    expect(sameHost.status).toBe(200);

    const noOrigin = await request(app).get('/health/live');
    expect(noOrigin.status).toBe(200);
  });
});
