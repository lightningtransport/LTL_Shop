import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

// D26 (stages 2–3): the Next step acts where you are. The fixture Dashboard queue has WO-0102 (T-102)
// with every Job done, so its step is "close".
test.describe('D26 Next step acts where you are', () => {
  test('Manager closes a Work Order from the Dashboard with one tap (P5), without going to the Truck', async ({ page }) => {
    let completeBody: Record<string, unknown> | null = null;
    await page.route('**/api/admin/work-orders/*/complete', async (route) => {
      completeBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', version: 9 }) });
    });

    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    const row = page.getByTestId('dashboard-group-close').getByTestId('dashboard-queue-row').first();
    await expect(row).toHaveAttribute('data-kind', 'close');
    await expect(row).toContainText('T-102');

    // Owner decision P5 (2026-10-06): on the Dashboard the button closes right away, no dialog.
    await row.getByTestId('next-step-action').click();
    await expect.poll(() => completeBody).toMatchObject({ expectedVersion: expect.any(Number) });
    await expect(page.getByTestId('close-work-order-dialog')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Work Order completed.' }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('Manager records the inspection from the Dashboard row; Issues found opens the Truck with Add work (P3)', async ({ page }) => {
    const outcomes: string[] = [];
    // The first queue row asks for the inspection.
    await page.route('**/api/admin/dashboard', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const item = body.queue[0];
      item.nextStep = { kind: 'inspect', workOrderId: item.id };
      body.queue = [item];
      body.openWorkRequests = [];
      await route.fulfill({ response, json: body });
    });
    await page.route('**/api/admin/trucks/*/work-plan/inspection', async (route) => {
      outcomes.push(route.request().postDataJSON().outcome);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    const row = page.getByTestId('dashboard-group-inspect').getByTestId('dashboard-queue-row').first();
    await expect(row).toHaveAttribute('data-kind', 'inspect');

    await row.getByRole('button', { name: 'No issues found' }).click();
    await expect.poll(() => outcomes).toEqual(['no_issues_found']);
    await expect(page.getByRole('status').filter({ hasText: 'Inspection recorded.' }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin$/);

    await row.getByRole('button', { name: 'Issues found', exact: true }).click();
    await expect.poll(() => outcomes).toEqual(['no_issues_found', 'issues_found']);
    await expect(page).toHaveURL(/\/admin\/trucks\/.+#add-work$/);
  });

  test('Without work_orders.manage the step has no button (no dead end)', async ({ page }) => {
    await devLogin(page, 'system-admin@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByTestId('dashboard-group-close').getByTestId('dashboard-queue-row').first()).toHaveAttribute('data-kind', 'close');
    await expect(page.getByTestId('next-step-action')).toHaveCount(0);
  });
});
