import { expect, test, type Page } from '@playwright/test';

async function openNewWorkOrder(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('manager@lightning.local');
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await expect(page).toHaveURL(/\/admin/);
  await page.goto('/admin/work-orders/new');
  await expect(page.getByRole('heading', { name: /New Work Order|Nueva Work Order/ })).toBeVisible();
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

  test('selecting a Category lists catalog jobs and Search filters that list', async ({ page }) => {
    await openNewWorkOrder(page);

    const category = page.getByLabel('Category').first();
    await category.selectOption({ label: 'Air & Brake System' });
    await expect(page.getByRole('button', { name: /Add (Brake Inspection|Inspect brake chamber)/i })).toBeVisible();

    await category.selectOption({ label: 'Suspension & Steering' });
    const suspensionJobs = page.getByRole('list', { name: /Jobs in this Category: Suspension & Steering/i });
    await expect(suspensionJobs.getByRole('button').first()).toBeVisible();
    const listedCount = await suspensionJobs.getByRole('button').count();
    expect(listedCount).toBeGreaterThan(1);

    await page.getByLabel('Search jobs in this category').fill('3 in');
    await expect(suspensionJobs.getByRole('button', { name: /Add 3 in 1/i })).toBeVisible();
    await expect(suspensionJobs.getByRole('button')).toHaveCount(1);

    await page.getByLabel('Search jobs in this category').fill('');
    await expect(suspensionJobs.getByRole('button')).toHaveCount(listedCount);

    await suspensionJobs.getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'Work Plan' }).or(page.getByText('Work Plan'))).toBeVisible();
  });

  test('search with no matches still allows a custom job', async ({ page }) => {
    await openNewWorkOrder(page);

    await page.getByLabel('Category').first().selectOption({ label: 'Trailer' });
    await expect(page.getByRole('button', { name: /Add Trailer Repair/i })).toBeVisible();

    await page.getByLabel('Search jobs in this category').fill('zzzz-no-such-job');
    await expect(page.getByText('No Jobs match this search.')).toBeVisible();

    await page.getByLabel('Custom job name').fill('Road test after alignment');
    await page.getByRole('button', { name: 'Add custom job' }).click();
    await expect(page.getByText('Road test after alignment')).toBeVisible();
  });

  test('create Work Order shows a success toast and opens the new detail', async ({ page }) => {
    await openNewWorkOrder(page);

    await page.getByLabel('Truck number').fill('104');
    await page.getByRole('option', { name: /T-104/ }).click();
    await page.getByRole('button', { name: 'Continue to work' }).click();

    await page.getByLabel('Category').selectOption({ index: 1 });
    await page.getByLabel('Custom job name').fill('LTR-44 visible create feedback');
    await page.getByRole('button', { name: 'Add custom job' }).click();
    await page.getByRole('button', { name: 'Review Work Order' }).click();

    await page.route('**/api/admin/work-orders', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      await route.continue();
    });

    const create = page.getByRole('button', { name: 'Create Work Order' });
    await expect(create).toBeEnabled();
    await create.click();
    await expect(create).toBeDisabled();
    await expect(page.getByRole('button', { name: /Creating|Creando/ })).toBeVisible();

    await expect(page).toHaveURL(/\/admin\/work-orders\/[0-9a-f-]+/);
    await expect(page.getByText(/Work Order created\.|Work Order creada\./)).toBeVisible();
    await expect(page.getByRole('heading', { name: /WO-/ })).toBeVisible();
  });
});
