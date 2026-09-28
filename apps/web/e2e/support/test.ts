import { test as base } from '@playwright/test';

export { expect, type Locator, type Page, type Route } from '@playwright/test';

const FIXTURE_API = 'http://127.0.0.1:3101';

/**
 * LTR-162: with ADMIN_E2E_FIXTURE the specs share one in-memory fixture API. Reset it before every test
 * so results do not depend on test order or on which browser project ran first.
 */
export const test = base.extend<{ resetFixtureApi: void }>({
  resetFixtureApi: [async ({ request }, use) => {
    if (process.env.ADMIN_E2E_FIXTURE) {
      const response = await request.post(`${FIXTURE_API}/__test/reset`);
      if (!response.ok()) throw new Error(`Fixture reset failed: ${response.status()}`);
    }
    await use();
  }, { auto: true }],
});
