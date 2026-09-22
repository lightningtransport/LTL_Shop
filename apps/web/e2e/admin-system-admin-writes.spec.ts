import { expect, test, type Page } from '@playwright/test';

async function devLogin(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

test('manager stays read-only on the mechanic roster and Job Catalog', async ({ page }) => {
  await devLogin(page, 'manager@lightning.local');

  await page.goto('/admin/mechanics');
  await expect(page.getByRole('heading', { name: 'Mechanics' })).toBeVisible();
  await expect(page.getByText('Read-only view of Shop mechanics')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create mechanic' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activate' })).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toHaveCount(0);
  await page.getByRole('link', { name: 'Alejandro 1' }).click();
  await expect(page.getByText('Read only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save mechanic' })).toHaveCount(0);

  await page.goto('/admin/catalog');
  await expect(page.getByRole('heading', { name: 'Job Catalog' })).toBeVisible();
  await expect(page.getByText('Read-only Categories, Jobs, and aliases')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Job' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Category' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Brakes' }).click();
  await expect(page.getByRole('heading', { name: 'Brakes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Job' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rename Job' })).toHaveCount(0);
});

test('system admin adds, renames, and activates a Job, then creates and activates a mechanic', async ({ page }) => {
  await devLogin(page, 'admin@lightning.local');

  await page.goto('/admin/catalog');
  await expect(page.getByTestId('pd-light-tip')).toContainText('System Admin only');
  await expect(page.getByRole('button', { name: 'Add Category' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Job' }).click();
  const jobDialog = page.getByRole('dialog');
  await expect(jobDialog.getByRole('option', { name: 'Suspension' })).toHaveCount(0);
  await jobDialog.getByLabel('Category').selectOption({ label: 'Brakes' });
  await jobDialog.getByLabel('Job name').fill('Bleed brakes');
  await jobDialog.getByRole('button', { name: 'Add Job' }).click();
  await expect(page.getByText('Job added.')).toBeVisible();

  await page.getByRole('link', { name: 'Suspension' }).click();
  await expect(page.getByRole('heading', { name: 'Suspension' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Job' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByText('Job activated.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Retired suspension job' })).not.toContainText('Inactive');
  await page.getByRole('button', { name: 'Rename Job' }).click();
  const renameDialog = page.getByRole('dialog');
  await renameDialog.getByLabel('Job name').fill('Service suspension');
  await renameDialog.getByRole('button', { name: 'Rename Job' }).click();
  await expect(page.getByText('Job renamed.')).toBeVisible();
  await expect(page.getByText('Service suspension', { exact: true })).toBeVisible();

  await page.goto('/admin/catalog/categories/00000000-0000-4000-8000-000000000301');
  await expect(page.getByText('Bleed brakes', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.goto('/admin/mechanics');
  await expect(page.getByTestId('pd-light-tip')).toContainText('System Admin only');
  await page.getByRole('button', { name: 'Create mechanic' }).click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel('Name').fill('Luz Mechanic');
  await createDialog.getByLabel('Email').fill('luz@lightning.local');
  await createDialog.getByLabel('PM').check();
  await createDialog.getByRole('button', { name: 'Create mechanic' }).click();
  await expect(page.getByText('Mechanic created.')).toBeVisible();
  await expect(page.getByRole('row', { name: /Luz Mechanic/ })).toContainText('mechanic.pm');

  await page.getByRole('row', { name: /Retired Mechanic/ }).getByRole('button', { name: 'Activate' }).click();
  const activateDialog = page.getByRole('dialog');
  await activateDialog.getByLabel('PM').check();
  await activateDialog.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByText('Mechanic activated.')).toBeVisible();
  await expect(page.getByText('Inactive')).toHaveCount(0);

  await page.getByRole('link', { name: 'Luz Mechanic' }).click();
  await expect(page.getByRole('heading', { name: 'Standard or PM' })).toBeVisible();
  await expect(page.getByText('Read only')).toHaveCount(0);
  await page.getByLabel('Name').fill('Luz Mendez');
  await page.getByLabel('Standard').check();
  await page.getByRole('button', { name: 'Save mechanic' }).click();
  await expect(page.getByText('Mechanic saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Luz Mendez' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  await expect(page.getByTestId('pd-light-tip')).toContainText('Solo System Admin');
  await expect(page.getByRole('button', { name: 'Guardar mecánico' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
