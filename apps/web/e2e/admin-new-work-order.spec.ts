import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

async function openNewWorkOrder(page: Page) {
  await devLogin(page, 'manager@lightning.local');
  await expect(page).toHaveURL(/\/admin/);
  await page.goto('/admin/work-orders/new');
  await expect(page.getByRole('heading', { name: /New Work Order|Nueva Work Order/ })).toBeVisible();
}

// The mobile wizard shows the Work step (with Category) only after a Truck is chosen.
async function chooseTruck(page: Page, number: string) {
  await page.getByLabel('Truck number').fill(number);
  await page.getByRole('option', { name: new RegExp(`T-${number}`) }).click();
  await page.getByRole('button', { name: 'Continue to work' }).click();
}

test.describe('LTR-21 New WO category jobs', () => {
  test('mobile wizard keeps one task visible and requires review before create', async ({ page }) => {
    await openNewWorkOrder(page);

    await expect(page.getByRole('heading', { name: 'Truck', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeHidden();

    await page.getByLabel('Truck number').fill('104');
    await page.getByRole('option', { name: /T-104/ }).click();
    await page.getByRole('button', { name: 'Continue to work' }).click();

    await expect(page.getByRole('heading', { name: 'Truck', exact: true })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
    await page.getByLabel('Category').selectOption({ index: 1 });
    await page.getByLabel('Custom job name').fill('Road test after repair');
    await page.getByRole('button', { name: 'Add custom job' }).click();
    await page.getByRole('button', { name: 'Review Work Order' }).click();

    await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
    await expect(page.getByText('Road test after repair')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Work Order' })).toBeEnabled();
  });

  test('create Work Order shows a success toast and opens the new detail', async ({ page }) => {
    await openNewWorkOrder(page);

    await page.getByLabel('Truck number').fill('105');
    await page.getByRole('option', { name: /T-105/ }).click();
    await page.getByRole('button', { name: 'Continue to work' }).click();

    await page.getByLabel('Category').first().selectOption({ label: 'Brakes' });
    await page.getByRole('button', { name: /Add (Brake Inspection|Inspect brake chamber)/i }).first().click();
    await page.getByRole('button', { name: 'Review Work Order' }).click();
    await page.getByRole('button', { name: 'Create Work Order' }).click();

    await expect(page).toHaveURL(/\/admin\/work-orders\/00000000-0000-4000-8000-000000000199/);
    await expect(page.getByRole('heading', { name: 'T-105' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /WO-0199 created|WO-0199 creada/i })).toBeVisible();
  });

  test('selecting a Category lists catalog jobs and Search filters that list', async ({ page }) => {
    await openNewWorkOrder(page);

    await chooseTruck(page, '104');
    // Fixture catalog: Brakes and Suspension (see e2e/fixtures/admin-api.mjs).
    const category = page.getByLabel('Category').first();
    await category.selectOption({ label: 'Brakes' });
    await expect(page.getByRole('button', { name: /Add (Brake Inspection|Inspect brake chamber)/i }).first()).toBeVisible();

    await category.selectOption({ label: 'Suspension' });
    const suspensionJobs = page.getByRole('list', { name: /Jobs in this Category: Suspension/i });
    await expect(suspensionJobs.getByRole('button').first()).toBeVisible();
    const listedCount = await suspensionJobs.getByRole('button').count();
    expect(listedCount).toBeGreaterThan(1);

    await page.getByLabel('Search jobs in this category').fill('3 in');
    await expect(suspensionJobs.getByRole('button', { name: /Add 3 in 1/i })).toBeVisible();
    await expect(suspensionJobs.getByRole('button')).toHaveCount(1);

    await page.getByLabel('Search jobs in this category').fill('');
    await expect(suspensionJobs.getByRole('button')).toHaveCount(listedCount);

    await suspensionJobs.getByRole('button').first().click();
    await expect(page.getByText('1 job selected').filter({ visible: true }).first()).toBeVisible();
  });

  test('search with no matches still allows a custom job', async ({ page }) => {
    await openNewWorkOrder(page);

    await chooseTruck(page, '104');
    await page.getByLabel('Category').first().selectOption({ label: 'Brakes' });
    await expect(page.getByRole('button', { name: /Add Brake Inspection/i })).toBeVisible();

    await page.getByLabel('Search jobs in this category').fill('zzzz-no-such-job');
    await expect(page.getByText('No Jobs match this search.')).toBeVisible();

    await page.getByLabel('Custom job name').fill('Road test after alignment');
    await page.getByRole('button', { name: 'Add custom job' }).click();
    // On mobile the selected Jobs are listed in the Review step.
    await expect(page.getByText('1 job selected').filter({ visible: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Review Work Order' }).click();
    await expect(page.getByText('Road test after alignment')).toBeVisible();
  });
});
