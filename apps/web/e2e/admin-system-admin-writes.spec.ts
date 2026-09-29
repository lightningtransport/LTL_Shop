import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';
import { switchLanguage } from './support/locale';

async function loginToAdmin(page: Page, email: string) {
  await devLogin(page, email);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

test('manager stays read-only on the mechanic roster and Job Catalog', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');

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

test('system admin with only admin.access sees catalog and roster writes', async ({ page }) => {
  await loginToAdmin(page, 'system-admin@lightning.local');

  await page.goto('/admin/catalog');
  await expect(page.getByRole('heading', { name: 'Job Catalog' })).toBeVisible();
  await expect(page.getByText('Read-only Categories, Jobs, and aliases')).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toContainText('System Admin only');
  await expect(page.getByRole('button', { name: 'Add Job' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Category' })).toHaveCount(0);

  await page.getByLabel('Search Category').fill('zzzz-no-category');
  await expect(page.getByText('No Categories match this search.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Job' })).toHaveCount(2);
  await page.getByLabel('Search Category').fill('');
  await expect(page.getByRole('link', { name: 'Brakes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Job' })).toHaveCount(1);

  await page.goto('/admin/mechanics');
  await expect(page.getByRole('button', { name: 'Create mechanic' })).toBeVisible();
  await expect(page.getByText('Create a mechanic with Standard or PM, or activate an existing mechanic.')).toBeVisible();
  await expect(page.getByText(/read-only/i)).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toContainText('System Admin only');
});

test('system admin adds, renames, and activates a Job, then creates and activates a mechanic', async ({ page }) => {
  await loginToAdmin(page, 'admin@lightning.local');

  await page.goto('/admin/catalog');
  await expect(page.getByTestId('pd-light-tip')).toContainText('System Admin only');
  await expect(page.getByRole('button', { name: 'Add Category' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Job' }).click();
  const jobDialog = page.getByRole('dialog');
  // The Modal focuses its first control one frame after opening (ui.tsx); wait so typing is not redirected.
  await expect(jobDialog.getByLabel('Category')).toBeFocused();
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
  await expect(renameDialog.getByLabel('Job name')).toBeFocused();
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
  // LTR-163: the dialog focuses Name when it opens; typing before that lands the email in Name.
  await expect(createDialog.getByLabel('Name')).toBeFocused();
  await createDialog.getByLabel('Name').fill('Luz Mechanic');
  await createDialog.getByLabel('Email').fill('luz@lightning.local');
  await createDialog.getByLabel('PM').check();
  await createDialog.getByRole('button', { name: 'Create mechanic' }).click();
  await expect(page.getByText('Mechanic created.')).toBeVisible();
  await expect(page.getByRole('row', { name: /Luz Mechanic/ })).toContainText('mechanic.pm');

  // LTR-160: inactive mechanics are hidden until "Show inactive" is applied.
  await expect(page.getByRole('row', { name: /Retired Mechanic/ })).toHaveCount(0);
  await page.getByLabel('Show inactive').check();
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/includeInactive=true/);
  await page.getByRole('row', { name: /Retired Mechanic/ }).getByRole('button', { name: 'Activate' }).click();
  const activateDialog = page.getByRole('dialog');
  await activateDialog.getByLabel('PM').check();
  await activateDialog.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByText('Mechanic activated.')).toBeVisible();
  await expect(page.getByText('Inactive', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Luz Mechanic' }).click();
  await expect(page.getByRole('heading', { name: 'Standard or PM' })).toBeVisible();
  await expect(page.getByText('Read only')).toHaveCount(0);
  await page.getByLabel('Name').fill('Luz Mendez');
  await page.getByLabel('Standard').check();
  await page.getByRole('button', { name: 'Save mechanic' }).click();
  await expect(page.getByText('Mechanic saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Luz Mendez' })).toBeVisible();

  await switchLanguage(page, 'es');
  await expect(page.getByTestId('pd-light-tip')).toContainText('Solo System Admin');
  await expect(page.getByRole('button', { name: 'Guardar mecánico' })).toBeVisible();
  await page.goto('/admin/mechanics');
  await expect(page.getByText('Crea un mecánico con Standard o PM, o activa un mecánico existente.')).toBeVisible();
  await expect(page.getByText(/solo lectura/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
