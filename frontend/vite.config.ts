/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const rulesDir = fileURLToPath(new URL('../rules', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@rules': rulesDir } },
  server: { fs: { allow: ['..'] } },
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.stories.tsx', 'src/**/*.test.*', 'src/main.tsx', 'src/vite-env.d.ts', 'src/stories/**'],
      thresholds: {
        lines: 80, statements: 80, functions: 80, branches: 70,
        'src/core/**': { lines: 85, statements: 85, functions: 85, branches: 75 },
      },
    },
  },
});
