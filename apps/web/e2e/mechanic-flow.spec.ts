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

  test('login → home shows create CTA', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('link', { name: /Create New Work Order/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('restored session loads work orders without waiting for profile', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(
      page.getByRole('link', { name: /Create New Work Order/i }),
    ).toBeVisible();

    let releaseProfile!: () => void;
    const profileBlocked = new Promise<void>((resolve) => {
      releaseProfile = resolve;
    });
    await page.route('**/api/auth/me', async (route) => {
      await profileBlocked;
      await route.continue();
    });

    const workOrdersRequest = page.waitForRequest('**/api/work-orders');
    await page.reload();
    await workOrdersRequest;
    await expect(
      page.getByRole('link', { name: /Create New Work Order/i }),
    ).toBeVisible();

    const profileResponse = page.waitForResponse('**/api/auth/me');
    releaseProfile();
    await profileResponse;
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
    await expect(
      page.getByRole('link', { name: /Create New Work Order/i }),
    ).toBeVisible();
    expect(workOrderReads).toBe(1);

    await page.getByRole('link', { name: /Create New Work Order/i }).click();
    await expect(
      page.getByRole('heading', { name: /New Work Order/i }),
    ).toBeVisible();
    await page.getByRole('link', { name: /Back/i }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    expect(workOrderReads).toBe(1);
  });

  test('home shell stays usable while work orders load', async ({ page }) => {
    let releaseWorkOrders!: () => void;
    const workOrdersBlocked = new Promise<void>((resolve) => {
      releaseWorkOrders = resolve;
    });
    await page.route('**/api/work-orders', async (route) => {
      await workOrdersBlocked;
      await route.continue();
    });

    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(
      page.getByRole('link', { name: /Create New Work Order/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('status', { name: /Loading work orders/i }),
    ).toBeVisible();

    releaseWorkOrders();
    await expect(
      page.getByRole('status', { name: /Loading work orders/i }),
    ).toBeHidden();
  });
});
