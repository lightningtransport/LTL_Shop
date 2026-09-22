import { test, expect } from '@playwright/test';

/**
 * Critical mechanic flow smoke test.
 * Requires: API + web running, AUTH_DEV_BYPASS=true, DB seeded.
 */
test.describe('Mechanic P0 critical path', () => {
  test('protected routes redirect when no session exists', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login → home shows assigned work without create CTA', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('link', { name: /Create New Work Order/i })).toHaveCount(0);
  });

  test('restored session verifies current capabilities before loading work orders', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();

    let releaseProfile!: () => void;
    const profileBlocked = new Promise<void>((resolve) => {
      releaseProfile = resolve;
    });
    await page.route('**/api/auth/me', async (route) => {
      await profileBlocked;
      await route.continue();
    });

    let workOrdersRequested = false;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/work-orders') workOrdersRequested = true;
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    expect(workOrdersRequested).toBe(false);
    const workOrdersRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === '/api/work-orders' && url.searchParams.get('mode') === 'standard';
    });
    const profileResponse = page.waitForResponse('**/api/auth/me');
    releaseProfile();
    await Promise.all([profileResponse, workOrdersRequest]);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Create New Work Order/i })).toHaveCount(0);
  });

  test('navigation reuses the fresh work-order cache', async ({ page }) => {
    let workOrderReads = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/work-orders'
      ) {
        workOrderReads += 1;
      }
    });

    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    expect(workOrderReads).toBe(1);

    await page.getByRole('button', { name: /Start Work/i }).or(page.getByRole('link', { name: /View Work/i })).first().click();
    await expect(page.getByRole('heading', { name: /^#/ })).toBeVisible();
    await page.getByRole('link', { name: /Back/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    expect(workOrderReads).toBe(1);
  });

  test('home shell stays usable while work orders load', async ({ page }) => {
    let releaseWorkOrders!: () => void;
    const workOrdersBlocked = new Promise<void>((resolve) => {
      releaseWorkOrders = resolve;
    });
    await page.route('**/api/work-orders?*', async (route) => {
      await workOrdersBlocked;
      await route.continue();
    });

    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    await expect(
      page.getByRole('status', { name: /Loading work orders/i }),
    ).toBeVisible();

    releaseWorkOrders();
    await expect(
      page.getByRole('status', { name: /Loading work orders/i }),
    ).toBeHidden();
  });
});
