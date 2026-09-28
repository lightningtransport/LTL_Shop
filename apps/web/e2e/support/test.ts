import { test as base, type Page } from '@playwright/test';

export { expect, type Locator, type Page, type Route } from '@playwright/test';

const FIXTURE_API = 'http://127.0.0.1:3101';

/**
 * LTR-162: a full page load (goto / reload) is server-rendered first. Under a full run `next dev` hydrates
 * late, and a click that lands before hydration does nothing. Wait until React owns the page content.
 * Client-side navigations after that are already hydrated.
 */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('main') ?? document.body.firstElementChild;
    return Boolean(root && Object.keys(root).some((key) => key.startsWith('__reactFiber$')));
  }, undefined, { timeout: 20_000 }).catch(() => {
    // Pages without React content (redirects, errors) fail loudly in their own assertions.
  });
}

/**
 * With ADMIN_E2E_FIXTURE the specs share one in-memory fixture API. Reset it before every test so results
 * do not depend on test order or on which browser project ran first.
 */
export const test = base.extend<{ resetFixtureApi: void }>({
  resetFixtureApi: [async ({ request }, use) => {
    if (process.env.ADMIN_E2E_FIXTURE) {
      const response = await request.post(`${FIXTURE_API}/__test/reset`);
      if (!response.ok()) throw new Error(`Fixture reset failed: ${response.status()}`);
    }
    await use();
  }, { auto: true }],
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = async (...args: Parameters<Page['goto']>) => {
      let response;
      try {
        response = await goto(...args);
      } catch (error) {
        // WebKit reports a client-side navigation still settling (router.replace of filters, post-login
        // redirect) as an interrupted goto. The test still wants this URL, so try once more.
        if (!(error instanceof Error) || !error.message.includes('is interrupted by another navigation')) throw error;
        await page.waitForLoadState('load').catch(() => undefined);
        response = await goto(...args);
      }
      await waitForHydration(page);
      return response;
    };
    page.reload = async (...args: Parameters<Page['reload']>) => {
      const response = await reload(...args);
      await waitForHydration(page);
      return response;
    };
    await use(page);
  },
});
