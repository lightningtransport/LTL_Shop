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
    : [
        {
          command: 'npm run dev:api --prefix ../..',
          port: 3001,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 npm run dev:web --prefix ../..',
          port: 3000,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
