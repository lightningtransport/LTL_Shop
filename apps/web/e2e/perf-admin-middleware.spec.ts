import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

// P19 / D38: once the Admin session is set, moving around the Admin does not ask the API who you are.
const FIXTURE_API = process.env.E2E_FIXTURE_API_URL ?? 'http://127.0.0.1:3101';

async function adminAccessCalls(request: import('@playwright/test').APIRequestContext) {
  const response = await request.get(`${FIXTURE_API}/__test/admin-access-calls`);
  return ((await response.json()) as { count: number }).count;
}

test.describe('Admin navigation without an API trip per click (P19)', () => {
  test('manager moves through three Admin screens and the middleware never calls /api/admin/access', async ({ page, request }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    const before = await adminAccessCalls(request);

    // LTR-248: History became a filter of Work Orders, so the third screen is the Jobs catalog.
    for (const path of ['/admin/work-orders', '/admin/trucks', '/admin/catalog']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { name: 'Shop Admin access denied' })).toHaveCount(0);
    }
    expect(await adminAccessCalls(request)).toBe(before);
  });

  test('a mechanic who types /admin still gets the 403 screen from the signed profile', async ({ page }) => {
    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: 'Shop Admin access denied' })).toBeVisible();
  });

  test('without the profile cookie the middleware still asks the API (fallback)', async ({ page, request, context }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    const cookies = await context.cookies();
    await context.clearCookies();
    await context.addCookies(cookies.filter((cookie) => cookie.name !== 'ltl_shop_admin_profile'));
    const before = await adminAccessCalls(request);
    await page.goto('/admin/trucks', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/trucks$/);
    expect(await adminAccessCalls(request)).toBeGreaterThan(before);
  });
});
