import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

// D26 (stage 2): the Next step acts where you are. The fixture sends no `nextStep`, so the Dashboard
// response is extended here with a "close" step on its first attention item.
async function dashboardWithCloseStep(page: Page) {
  let workOrderId = '';
  await page.route('**/api/admin/dashboard', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    workOrderId = body.attention[0].id;
    body.attention[0].nextStep = { kind: 'close', workOrderId };
    await route.fulfill({ response, json: body });
  });
  return () => workOrderId;
}

test.describe('D26 Next step acts where you are', () => {
  test('Manager closes a Work Order from the Dashboard after confirming (D27), without going to the Truck', async ({ page }) => {
    const workOrderId = await dashboardWithCloseStep(page);
    let completeBody: Record<string, unknown> | null = null;
    await page.route('**/api/admin/work-orders/*/complete', async (route) => {
      completeBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: workOrderId(), version: 9 }) });
    });

    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    const step = page.getByTestId('work-order-next-step').first();
    await expect(step).toHaveAttribute('data-kind', 'close');

    // The button opens the confirmation here; nothing has been sent yet.
    await step.getByTestId('next-step-action').click();
    const dialog = page.getByTestId('close-work-order-dialog');
    await expect(dialog).toContainText('becomes Ready to Go');
    expect(completeBody).toBeNull();

    await dialog.getByRole('button', { name: 'Close Work Order' }).click();
    await expect.poll(() => completeBody).toMatchObject({ expectedVersion: expect.any(Number) });
    await expect(page.getByRole('status').filter({ hasText: 'Work Order completed.' }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('Without work_orders.manage the step has no button (no dead end)', async ({ page }) => {
    await dashboardWithCloseStep(page);
    await devLogin(page, 'system-admin@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByTestId('work-order-next-step').first()).toHaveAttribute('data-kind', 'close');
    await expect(page.getByTestId('next-step-action')).toHaveCount(0);
  });
});
