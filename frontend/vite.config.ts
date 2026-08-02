/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Unique dir avoids concurrent vitest runs wiping shared tmp coverage shards.
const coverageDir = path.join(
  os.tmpdir(),
  `dashboard-financeiro-frontend-coverage-${process.pid}`
);
fs.mkdirSync(path.join(coverageDir, '.tmp'), { recursive: true });

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    fileParallelism: false,
    pool: 'threads',
    maxWorkers: 1,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      clean: true,
      reportOnFailure: true,
      reporter: ['text', 'json-summary'],
      reportsDirectory: coverageDir,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**',
        'src/test/**',
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
