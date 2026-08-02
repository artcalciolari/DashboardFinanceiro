import { defineConfig } from 'vitest/config';
import os from 'node:os';
import path from 'node:path';

const workers = os.availableParallelism();

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    fileParallelism: true,
    maxWorkers: workers,
    minWorkers: 1,
    env: { NODE_ENV: 'test', BUSINESS_TIME_ZONE: 'America/Sao_Paulo', TZ: 'America/Sao_Paulo' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // OneDrive locks/deletes in-repo coverage/.tmp; pid keeps concurrent runs apart.
      reportsDirectory: path.join(
        os.tmpdir(),
        `dashboard-financeiro-backend-coverage-${process.pid}`
      ),
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
