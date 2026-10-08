import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // The smoke test targets the deployed site only.
  testIgnore: process.env.SMOKE ? [] : ['**/smoke.spec.ts'],
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'pnpm build && pnpm preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 180_000 },
});
