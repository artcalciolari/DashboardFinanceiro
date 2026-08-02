import { afterEach, describe, expect, it, vi } from 'vitest';

describe('env config', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  it('builds DATABASE_URL from DB_* parts when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    process.env.DB_USER = 'user@name';
    process.env.DB_PASSWORD = 'p@ss';
    process.env.DB_NAME = 'financeiro';
    process.env.DB_HOST = 'db.local';
    process.env.DB_PORT = '5433';
    process.env.BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

    await import('../src/config/env');

    expect(process.env.DATABASE_URL).toBe(
      'postgresql://user%40name:p%40ss@db.local:5433/financeiro'
    );
    expect(process.env.TZ).toBe('America/Sao_Paulo');
  });

  it('keeps an existing DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'postgresql://keep/me';
    process.env.DB_USER = 'ignored';
    process.env.DB_PASSWORD = 'ignored';
    process.env.DB_NAME = 'ignored';

    await import('../src/config/env');

    expect(process.env.DATABASE_URL).toBe('postgresql://keep/me');
  });

  it('defaults host/port and TZ when optional env vars are missing', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.TZ;
    delete process.env.BUSINESS_TIME_ZONE;
    process.env.DB_USER = 'u';
    process.env.DB_PASSWORD = 'p';
    process.env.DB_NAME = 'db';

    await import('../src/config/env');

    expect(process.env.DATABASE_URL).toBe('postgresql://u:p@localhost:5432/db');
    expect(process.env.TZ).toBe('America/Sao_Paulo');
  });

  it('does not rebuild DATABASE_URL when DB parts are incomplete', async () => {
    delete process.env.DATABASE_URL;
    process.env.DB_USER = 'u';
    process.env.DB_PASSWORD = '';
    process.env.DB_NAME = 'db';

    await import('../src/config/env');

    expect(process.env.DATABASE_URL).toBeUndefined();
  });
});
