import { defineConfig } from 'vitest/config';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    fileParallelism: false,
    env: { NODE_ENV: 'test', BUSINESS_TIME_ZONE: 'America/Sao_Paulo', TZ: 'America/Sao_Paulo' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // OneDrive locks/deletes coverage/.tmp mid-run on this machine.
      reportsDirectory: path.join(os.tmpdir(), 'dashboard-financeiro-backend-coverage'),
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
