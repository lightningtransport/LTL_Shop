import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL
      ?? (process.env.ADMIN_E2E_FIXTURE ? 'http://127.0.0.1:3010' : 'http://localhost:3000'),
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : process.env.ADMIN_E2E_FIXTURE
      ? [
          {
            command: 'node e2e/fixtures/admin-api.mjs',
            port: 3101,
            reuseExistingServer: false,
          },
          {
            command: '../../node_modules/.bin/next dev --hostname 127.0.0.1 --port 3010',
            port: 3010,
            reuseExistingServer: false,
            env: {
              NODE_ENV: 'development',
              NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3101',
            },
          },
        ]
      : {
        command: 'echo "Start pnpm dev separately for e2e"',
        port: 3000,
        reuseExistingServer: true,
      },
});
