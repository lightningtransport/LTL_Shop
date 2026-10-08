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

  test('LTR-197 / D28: step teams from Setup → Shop workflow; a team of one owns the new Job; QC waits for Safety', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/setup/workflow');
    await expect(page.getByRole('heading', { name: 'Shop workflow' })).toBeVisible();
    await expect(page.getByTestId('workflow-step-quality_check')).toContainText('The Shop Manager can do QC as backup.');
    await expect(page.getByTestId('workflow-step-quality_check').getByRole('link', { name: 'Open Quality Check' })).toHaveAttribute('href', '/qc');

    for (const [stepKey, step, person] of [['pm', 'PM', 'Daniel PM'], ['detailing', 'Detailing', 'Anthony']] as const) {
      const row = page.getByTestId(`workflow-step-${stepKey}`);
      for (const member of await row.getByRole('button', { name: /^Remove / }).all()) await member.click();
      await row.getByRole('button', { name: 'Add' }).click();
      const dialog = page.getByRole('dialog', { name: `Add to ${step}` });
      await dialog.getByRole('checkbox').first().waitFor();
      await dialog.locator('label', { hasText: person }).getByRole('checkbox').check();
      await dialog.getByRole('button', { name: 'Add to team' }).click();
      await expect(row).toContainText(`New ${step} Jobs are assigned to ${person}.`);
    }
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Save steps', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Shop workflow saved.' }).first()).toBeVisible();

    await page.goto('/admin/work-orders/new');
    await chooseTruck(page, '105');
    await page.getByRole('button', { name: 'Create Work Order' }).click();
    await expect(page).toHaveURL(/\/admin\/work-orders\/00000000-0000-4000-8000-000000000199/);
    // LTR-174: on the Work Order each pending Job shows its owner in the mechanic picker.
    await expect(page.getByRole('button', { name: 'Mechanic for PM A Service' })).toContainText('Daniel PM');
    await expect(page.getByRole('button', { name: 'Mechanic for Detailing' })).toContainText('Anthony');
  });

  test('LTR-186 / D20: the Manager sets the shop hours (day close and workdays) in Setup', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin/);
    // D-SET5: Shop hours is a tab of Shop workflow with its own URL.
    await page.goto('/admin/setup/workflow');
    await page.getByRole('link', { name: 'Shop hours' }).click();
    await expect(page).toHaveURL(/\/admin\/setup\/workflow\/hours$/);
    const hours = page.getByTestId('shop-hours');
    await expect(hours.getByRole('heading', { name: 'Shop hours' })).toBeVisible();
    const cutoff = hours.getByLabel('Day close (Eastern time)');
    await expect(cutoff).toHaveValue(/^\d\d:\d\d$/);
    await expect(hours.getByRole('button', { name: 'Save shop hours' })).toBeDisabled();
    // The fixture API is shared by every browser project: change to whatever it is not yet.
    const target = (await cutoff.inputValue()) === '18:30' ? '19:15' : '18:30';
    const saturday = !(await hours.getByLabel('Sat').isChecked());

    await cutoff.fill('09:00');
    await expect(hours.getByRole('alert')).toHaveText('Choose a time between 12:00 p.m. and 11:59 p.m. and at least one day.');
    await expect(hours.getByRole('button', { name: 'Save shop hours' })).toBeDisabled();
    await cutoff.fill(target);
    await hours.getByLabel('Sat').setChecked(saturday);
    await hours.getByRole('button', { name: 'Save shop hours' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Shop hours saved.' }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('shop-hours').getByLabel('Day close (Eastern time)')).toHaveValue(target);
    await expect(page.getByTestId('shop-hours').getByLabel('Sat')).toBeChecked({ checked: saturday });
  });
});
