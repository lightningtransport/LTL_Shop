import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

// D26 (stages 2–3): the Next step acts where you are. The fixture Dashboard queue has WO-0102 (T-102)
// with every Job done, so its step is "close".
test.describe('D26 Next step acts where you are', () => {
  test('Manager closes a Work Order from the Dashboard after confirming (D27), without going to the Truck', async ({ page }) => {
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

    // The button opens the confirmation here; nothing has been sent yet.
    await row.getByTestId('next-step-action').click();
    const dialog = page.getByTestId('close-work-order-dialog');
    await expect(dialog).toContainText('becomes Ready to Go');
    expect(completeBody).toBeNull();

    await dialog.getByRole('button', { name: 'Close Work Order' }).click();
    await expect.poll(() => completeBody).toMatchObject({ expectedVersion: expect.any(Number) });
    await expect(page.getByRole('status').filter({ hasText: 'Work Order completed.' }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('Without work_orders.manage the step has no button (no dead end)', async ({ page }) => {
    await devLogin(page, 'system-admin@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByTestId('dashboard-group-close').getByTestId('dashboard-queue-row').first()).toHaveAttribute('data-kind', 'close');
    await expect(page.getByTestId('next-step-action')).toHaveCount(0);
  });
});
