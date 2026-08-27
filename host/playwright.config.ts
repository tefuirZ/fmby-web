import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for FMBY-V2 Host
 * docs/plans/tasks/gemini-frontend-002.md
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5180',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node e2e/start.mjs',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
