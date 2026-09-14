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
});
