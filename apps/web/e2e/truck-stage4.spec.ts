import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

// Stage 4 (truck-detail-redesign): New Work Order is a dialog on the Truck, and the Work Order opened
// from the Truck goes back to it, opens the Job's row and the pause dialog.
test.describe('Stage 4 Truck ↔ Work Order', () => {
  test('Manager opens a New Work Order from the Truck and stays on the Truck (owner decision 2026-10-05)', async ({ page }) => {
    let created: Record<string, unknown> | null = null;
    await page.route('**/api/admin/work-orders', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      created = route.request().postDataJSON();
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: '00000000-0000-4000-8000-0000000009aa', displayId: 'WO-0900', version: 1 }) });
    });
    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/trucks/00000000-0000-4000-8000-000000001001');
    const step = page.getByTestId('truck-next-step');
    await expect(step).toHaveAttribute('data-kind', 'create_work_order');
    await step.getByRole('button', { name: 'New Work Order' }).click();
    const dialog = page.getByTestId('new-work-order-dialog');
    await expect(dialog).toContainText('PM, Alignment, Detailing and QC');
    await dialog.getByLabel('Priority').selectOption('high');
    await dialog.getByRole('button', { name: 'Create Work Order' }).click();
    await expect.poll(() => created).toMatchObject({ truckId: '00000000-0000-4000-8000-000000001001', priority: 'high', jobs: [] });
    await expect(page.getByRole('status').filter({ hasText: 'Work Order WO-0900 created for Truck Y-101.' }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/trucks\/00000000-0000-4000-8000-000000001001$/);
  });

  test('The Work Order opened from the Truck goes back to it and shows the Job asked for (T4)', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    const truckPath = '/admin/trucks/00000000-0000-4000-8001-000000000102';
    await page.goto(`/admin/work-orders/00000000-0000-4000-8000-000000000102?from=${encodeURIComponent(truckPath)}#job-00000000-0000-4000-8000-000000000502`);
    // Stage 8 (mockup): the breadcrumb goes back to the Truck ("Trucks › T-102 › WO-0102").
    await expect(page.getByTestId('admin-breadcrumb').getByRole('link', { name: 'T-102' })).toHaveAttribute('href', truckPath);
    const row = page.locator('#job-00000000-0000-4000-8000-000000000502');
    await expect(row).toBeInViewport();
    await expect(row).toHaveAttribute('data-highlighted', 'true');
  });

  test('"Pause Work Order…" from the Truck opens the pause dialog on the Work Order', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000102?from=%2Fadmin%2Ftrucks%2Fx&action=pause');
    await expect(page.getByRole('dialog', { name: 'Pause Work Order' })).toBeVisible();
  });
});

// LTR-245 (UX-5-006, UX-5-008): going back from a Truck or a Work Order keeps the list's filters, and an unknown
// origin goes back to Trucks (what the sidebar highlights), not to Yard Operations.
test.describe('LTR-245 going back keeps the filters', () => {
  test('A Truck opened from a filtered Trucks list goes back to the same filters', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/trucks?status=all');
    const link = page.locator('a[href^="/admin/trucks/"]').first();
    await expect(link).toHaveAttribute('href', /from=%2Fadmin%2Ftrucks%3Fstatus%3Dall/);
    await page.goto(`/admin/trucks/00000000-0000-4000-8000-000000001001?from=${encodeURIComponent('/admin/trucks?status=all')}`);
    await expect(page.getByTestId('admin-breadcrumb').getByRole('link', { name: 'Trucks' })).toHaveAttribute('href', '/admin/trucks?status=all');
  });

  test('A Truck with no known origin goes back to Trucks', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/trucks/00000000-0000-4000-8000-000000001001');
    await expect(page.getByTestId('admin-breadcrumb').getByRole('link', { name: 'Trucks' })).toHaveAttribute('href', '/admin/trucks');
  });

  test('A Work Order opened from a filtered list goes back to the same filters', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    const list = '/admin/work-orders?status=waiting_paused';
    await page.goto(`/admin/work-orders/00000000-0000-4000-8000-000000000102?from=${encodeURIComponent(list)}`);
    await expect(page.getByTestId('admin-breadcrumb').getByRole('link', { name: 'Work Orders' })).toHaveAttribute('href', list);
  });
});
