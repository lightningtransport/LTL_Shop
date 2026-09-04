import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'echo "Start pnpm dev separately for e2e"',
        port: 3000,
        reuseExistingServer: true,
      },
});
