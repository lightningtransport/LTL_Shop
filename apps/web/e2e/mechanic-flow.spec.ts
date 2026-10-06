import { test, expect } from './support/test';
import { devLogin } from './support/dev-login';

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
    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('link', { name: /Create New Work Order/i })).toHaveCount(0);
  });

  test('restored session verifies current capabilities before loading work orders', async ({
    page,
  }) => {
    await devLogin(page);
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

    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    expect(workOrderReads).toBe(1);

    await page.getByRole('button', { name: /Start Work/i }).or(page.getByRole('link', { name: /View Work/i })).first().click();
    await expect(page.getByRole('heading', { name: /^Truck / })).toBeVisible();
    await page.getByRole('link', { name: /Back/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    expect(workOrderReads).toBe(1);
  });

  test('LTR-186 / D20, D21: the home card and the detail say why my clock stopped and Continue reopens it', async ({ page }) => {
    const stopped = { reason: 'switched_truck', elsewhereWorkOrder: { id: '00000000-0000-4000-8000-000000000199', displayId: 'WO-0199', truckNumber: '944' } };
    await page.route('**/api/work-orders?*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.active = body.active.map((item: Record<string, unknown>, index: number) => (index === 0 ? { ...item, myClockStopped: stopped } : item));
      await route.fulfill({ response, json: body });
    });
    await page.route(/\/api\/work-orders\/[0-9a-f-]+$/, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, laborRunning: false, myLaborStarted: true, myClockStopped: { reason: 'day_close' } } });
    });

    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    await expect(page.getByTestId('clock-stopped-tap-continue').first()).toHaveText('Your clock is on Truck 944 · tap Continue');

    await page.getByRole('link', { name: /View Work/i }).first().click();
    await expect(page.getByTestId('clock-stopped')).toHaveText("Yesterday's work is still open · tap Continue");
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
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

    await devLogin(page);
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
