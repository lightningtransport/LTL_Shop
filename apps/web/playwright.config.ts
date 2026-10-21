import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromiumExecutablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ?? (process.platform === 'darwin' && existsSync(localChromePath) ? localChromePath : undefined);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // LTR-162: every spec shares one in-memory fixture API that each test resets; parallel workers
  // would reset or mutate it under each other.
  workers: process.env.ADMIN_E2E_FIXTURE ? 1 : undefined,
  // LTR-163: the fixture suite runs against a production build, so a slow or flaky run is a real failure.
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL
      ?? (process.env.ADMIN_E2E_FIXTURE ? 'http://127.0.0.1:3010' : 'http://localhost:3000'),
    trace: 'on-first-retry',
  },
  // LTR-259: TABLET_WALK=1 runs only the iPad Pro 11" projects (e2e/tablet-walk.spec.ts), both orientations and
  // Safari's desktop mode.
  projects: process.env.TABLET_WALK ? [
    { name: 'ipad-portrait', use: { ...devices['iPad Pro 11'], browserName: 'webkit' } },
    { name: 'ipad-landscape', use: { ...devices['iPad Pro 11 landscape'], browserName: 'webkit' } },
    // LTR-271: Safari on an iPad asks for the desktop site by default and lays the page out about 980 px wide
    // (the owner's iPad Pro 11" in portrait). Same screen, scaled: 980 × 1403.
    {
      name: 'ipad-desktop-mode',
      use: {
        browserName: 'webkit',
        viewport: { width: 980, height: 1403 },
        deviceScaleFactor: 1.7,
        hasTouch: true,
        isMobile: false,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      },
    },
  ] : [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        launchOptions: {
          executablePath: chromiumExecutablePath,
        },
      },
    },
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
            // LTR-163: a production build instead of `next dev`. Routes are compiled once up front, so a long run
            // does not slow down. NEXT_PUBLIC_E2E_DEV_LOGIN keeps Dev Login in this build only (see
            // src/lib/dev-login.ts); NEXT_DIST_DIR keeps it away from a running `next dev`.
            command: '../../node_modules/.bin/next build && ../../node_modules/.bin/next start --hostname 127.0.0.1 --port 3010',
            port: 3010,
            reuseExistingServer: false,
            timeout: 600_000,
            env: {
              NODE_ENV: 'production',
              NEXT_DIST_DIR: '.next-e2e',
              NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3101',
              NEXT_PUBLIC_E2E_DEV_LOGIN: '1',
              // P19 / D38: the signed Admin profile cookie is on in the e2e build, so its path is what the specs exercise.
              ADMIN_PROFILE_SECRET: 'e2e-only-admin-profile-secret-0123456789abcdef',
              NEXT_TELEMETRY_DISABLED: '1',
            },
          },
        ]
      : {
        command: 'echo "Start pnpm dev separately for e2e"',
        port: 3000,
        reuseExistingServer: true,
      },
});
