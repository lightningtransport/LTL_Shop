import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

async function openNewWorkOrder(page: Page) {
  await devLogin(page, 'manager@lightning.local');
  await expect(page).toHaveURL(/\/admin/);
  await page.goto('/admin/work-orders/new');
  await expect(page.getByRole('heading', { name: /New Work Order|Nueva Work Order/ })).toBeVisible();
}

async function chooseTruck(page: Page, number: string) {
  await page.getByLabel('Truck number').fill(number);
  await page.getByRole('option', { name: new RegExp(`T-${number}`) }).click();
}

test.describe('LTR-157 / D13 New Work Order with only the Truck', () => {
  test('asks only for the Truck, priority and a note, and creates with the mandatory steps', async ({ page }) => {
    await openNewWorkOrder(page);

    await expect(page.getByLabel('Category')).toHaveCount(0);
    await expect(page.getByLabel('Custom job name')).toHaveCount(0);
    await expect(page.getByText(/starts with PM, Alignment, Detailing and QC/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Work Order' })).toBeDisabled();

    await chooseTruck(page, '105');
    await page.getByLabel('Notes (optional)').fill('Driver reports a pull to the right');
    await expect(page.getByRole('button', { name: 'Create Work Order' })).toBeEnabled();
    await page.getByRole('button', { name: 'Create Work Order' }).click();

    await expect(page).toHaveURL(/\/admin\/work-orders\/00000000-0000-4000-8000-000000000199/);
    await expect(page.getByRole('heading', { name: 'T-105' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /WO-0199 created|WO-0199 creada/i })).toBeVisible();
    for (const step of ['PM A Service', 'Alignment', 'Detailing', 'Quality Check']) {
      await expect(page.getByText(step, { exact: true }).first()).toBeVisible();
    }
  });

  test('default owners from Setup → Shop workflow land on the new Work Order; QC has none', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/setup/workflow');
    await expect(page.getByRole('heading', { name: 'Shop workflow' })).toBeVisible();
    await expect(page.getByText('Safety (Quality Check) takes it from the queue')).toBeVisible();
    await expect(page.getByLabel('Default owner for Quality Check')).toHaveCount(0);

    await page.getByLabel('Default owner for PM A Service').selectOption({ label: 'Daniel PM' });
    await page.getByLabel('Default owner for Detailing').selectOption({ label: 'Anthony' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Shop workflow saved.' }).first()).toBeVisible();

    await page.goto('/admin/work-orders/new');
    await chooseTruck(page, '105');
    await page.getByRole('button', { name: 'Create Work Order' }).click();
    await expect(page).toHaveURL(/\/admin\/work-orders\/00000000-0000-4000-8000-000000000199/);
    await expect(page.getByText('Assigned to: Daniel PM')).toBeVisible();
    await expect(page.getByText('Assigned to: Anthony')).toBeVisible();
  });
});
