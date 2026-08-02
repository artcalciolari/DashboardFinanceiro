import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    fileParallelism: false,
    env: { NODE_ENV: 'test', BUSINESS_TIME_ZONE: 'America/Sao_Paulo', TZ: 'America/Sao_Paulo' },
    coverage: { reporter: ['text', 'html'] },
  },
});
