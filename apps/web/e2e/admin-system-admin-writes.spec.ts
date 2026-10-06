import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';
import { switchLanguage } from './support/locale';

async function loginToAdmin(page: Page, email: string) {
  await devLogin(page, email);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

test('manager manages the roster (D22) and the Job Catalog (D25)', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');

  await page.goto('/admin/mechanics');
  await expect(page.getByRole('heading', { name: 'Mechanics' })).toBeVisible();
  await expect(page.getByText('Add Standard, PM or Safety people. The app creates their access account with a temporary password.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add person' })).toBeVisible();
  await expect(page.getByTestId('pd-light-tip')).toContainText('Manager or System Admin');
  // LTR-185: Safety shows on the roster with a people-facing label.
  await expect(page.getByRole('row', { name: /Retired Mechanic/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Alejandro 1' }).click();
  await expect(page.getByRole('heading', { name: 'Name and type' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Access' })).toBeVisible();
  await expect(page.getByText('Read only')).toHaveCount(0);

  await page.goto('/admin/catalog');
  await expect(page.getByRole('heading', { name: 'Job Catalog' })).toBeVisible();
  await expect(page.getByText('Read-only Categories, Jobs, and aliases')).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toContainText('Manager or System Admin');
  await expect(page.getByRole('button', { name: 'Add Job' })).toBeVisible();
  // Categories do not change (D25).
  await expect(page.getByRole('button', { name: 'Add Category' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Brakes' }).click();
  await expect(page.getByRole('heading', { name: 'Brakes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rename Job' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add Job' }).first().click();
  const jobDialog = page.getByRole('dialog');
  await expect(jobDialog.getByLabel('Job name')).toBeFocused();
  await jobDialog.getByLabel('Job name').fill('replace BRAKE pads');
  await jobDialog.getByRole('button', { name: 'Add Job' }).click();
  await expect(jobDialog.getByText('That Job name is already in the Job Catalog.')).toBeVisible();
  await jobDialog.getByLabel('Job name').fill('Adjust slack adjusters');
  await jobDialog.getByRole('button', { name: 'Add Job' }).click();
  await expect(page.getByText('Job added.')).toBeVisible();
  await expect(page.getByText('Adjust slack adjusters', { exact: true })).toBeVisible();
});

test('manager adds a Safety person and gets the temporary password once (D22, HU-M9)', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.setViewportSize({ width: 375, height: 740 });

  await page.goto('/admin/mechanics');
  await page.getByRole('button', { name: 'Add person' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Name')).toBeFocused();
  await dialog.getByLabel('Name').fill('Sofia Safety');
  await dialog.getByLabel('Email').fill('sofia@lightning.local');
  await dialog.getByLabel('Safety (Quality Check)').check();
  await dialog.getByRole('button', { name: 'Add person' }).click();

  await expect(page.getByText('Person added.')).toBeVisible();
  const panel = dialog.getByTestId('temporary-password-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('Temporary password')).toHaveValue(/^[A-Za-z2-9]{14}$/);
  await expect(panel.getByText('Pass it to the person; the app will ask them to change it when they sign in. It is shown only once.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Copy' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Sofia Safety/ })).toContainText('Safety (Quality Check)');

  // The same email twice is refused with the conflict copy.
  await page.getByRole('button', { name: 'Add person' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Sofia Again');
  await page.getByRole('dialog').getByLabel('Email').fill('sofia@lightning.local');
  await page.getByRole('dialog').getByRole('button', { name: 'Add person' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('That email already belongs to a Shop user.');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  // Spanish copy on the result step.
  await switchLanguage(page, 'es');
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByRole('dialog').getByLabel('Nombre').fill('Pedro PM');
  await page.getByRole('dialog').getByLabel('Email').fill('pedro@lightning.local');
  await page.getByRole('dialog').getByLabel('PM').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Agregar persona' }).click();
  await expect(page.getByRole('dialog').getByText('Pásala a la persona; la app le pedirá cambiarla al entrar. Se muestra una sola vez.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Listo' }).click();
});

test('deactivating a person with open work is refused and lists the Jobs to reassign; reset password shows a new one (D22)', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.setViewportSize({ width: 375, height: 740 });

  await page.goto('/admin/mechanics/00000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { name: 'Alejandro 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Deactivate' }).click();
  const deactivate = page.getByRole('dialog', { name: 'Deactivate person' });
  await expect(deactivate.getByText('This person will stop signing in and appearing in assignee lists. Nothing is deleted; their history stays.')).toBeVisible();
  await deactivate.getByRole('button', { name: 'Deactivate' }).click();
  const blocked = deactivate.getByTestId('mechanic-open-work');
  await expect(blocked).toContainText('Reassign first');
  await expect(blocked.getByRole('link', { name: 'WO-0102 · T-102' })).toHaveAttribute('href', '/admin/work-orders/00000000-0000-4000-8000-000000000102');
  await expect(blocked).toContainText('Brake pads');
  await expect(blocked).toContainText('Their labor time is running.');
  await expect(deactivate.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  await deactivate.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Reset password' }).click();
  const reset = page.getByRole('dialog', { name: 'Reset password' });
  await expect(reset.getByText('A new temporary password replaces the current one. The person must change it at the next sign-in.')).toBeVisible();
  await reset.getByRole('button', { name: 'Reset password' }).click();
  await expect(reset.getByLabel('Temporary password')).toHaveValue(/^[A-Za-z2-9]{14}$/);
  await reset.getByRole('button', { name: 'Done' }).click();

  // Someone with nothing open can be deactivated and reactivated; the retired mechanic has no account to reset.
  await page.goto('/admin/mechanics/00000000-0000-4000-8000-000000000006');
  await expect(page.getByRole('heading', { name: 'Anthony' })).toBeVisible();
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByRole('dialog', { name: 'Deactivate person' }).getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText('Person deactivated.')).toBeVisible();
  await expect(page.getByText('Does not sign in or appear in assignee lists. Their history stays.')).toBeVisible();
  await page.getByRole('button', { name: 'Reactivate' }).click();
  await expect(page.getByText('Person reactivated.')).toBeVisible();
  await expect(page.getByText('Signs in and appears in assignee lists.')).toBeVisible();

  await page.goto('/admin/mechanics/00000000-0000-4000-8000-000000000007');
  await expect(page.getByRole('heading', { name: 'Retired Mechanic' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset password' }).click();
  await page.getByRole('dialog', { name: 'Reset password' }).getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByRole('dialog', { name: 'Reset password' }).getByRole('alert')).toContainText('This person has no access account yet, so there is no password to reset.');
});

test('system admin with only admin.access sees catalog and roster writes', async ({ page }) => {
  await loginToAdmin(page, 'system-admin@lightning.local');

  await page.goto('/admin/catalog');
  await expect(page.getByRole('heading', { name: 'Job Catalog' })).toBeVisible();
  await expect(page.getByText('Read-only Categories, Jobs, and aliases')).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toContainText('Manager or System Admin');
  await expect(page.getByRole('button', { name: 'Add Job' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Category' })).toHaveCount(0);

  await page.getByLabel('Search Category').fill('zzzz-no-category');
  await expect(page.getByText('No Categories match this search.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Job' })).toHaveCount(2);
  await page.getByLabel('Search Category').fill('');
  await expect(page.getByRole('link', { name: 'Brakes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Job' })).toHaveCount(1);

  await page.goto('/admin/mechanics');
  await expect(page.getByRole('button', { name: 'Add person' })).toBeVisible();
  await expect(page.getByText('Add Standard, PM or Safety people. The app creates their access account with a temporary password.')).toBeVisible();
  await expect(page.getByText(/read-only/i)).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toContainText('Manager or System Admin');
});

test('system admin adds, renames, and activates a Job, then creates and activates a mechanic', async ({ page }) => {
  await loginToAdmin(page, 'admin@lightning.local');

  await page.goto('/admin/catalog');
  await expect(page.getByTestId('pd-light-tip')).toContainText('Manager or System Admin');
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
  await expect(page.getByTestId('pd-light-tip')).toContainText('Manager or System Admin');
  await page.getByRole('button', { name: 'Add person' }).click();
  const createDialog = page.getByRole('dialog');
  // LTR-163: the dialog focuses Name when it opens; typing before that lands the email in Name.
  await expect(createDialog.getByLabel('Name')).toBeFocused();
  await createDialog.getByLabel('Name').fill('Luz Mechanic');
  await createDialog.getByLabel('Email').fill('luz@lightning.local');
  await createDialog.getByLabel('PM').check();
  await createDialog.getByRole('button', { name: 'Add person' }).click();
  await expect(page.getByText('Person added.')).toBeVisible();
  // D22: the temporary password step; Done closes the dialog.
  await expect(createDialog.getByLabel('Temporary password')).toBeVisible();
  await createDialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('row', { name: /Luz Mechanic/ })).toContainText('PM');
  await expect(page.getByRole('row', { name: /Luz Mechanic/ })).not.toContainText('mechanic.pm');

  // LTR-160: inactive mechanics are hidden until "Show inactive" is applied.
  await expect(page.getByRole('row', { name: /Retired Mechanic/ })).toHaveCount(0);
  await page.getByRole('search').getByRole('button', { name: /^Filters( [0-9]+)?$/ }).click();
  const filtersSheet = page.getByRole('dialog', { name: 'Filters' });
  await filtersSheet.getByLabel('Show inactive').check();
  await filtersSheet.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/includeInactive=true/);
  await page.getByRole('row', { name: /Retired Mechanic/ }).getByRole('button', { name: 'Activate' }).click();
  const activateDialog = page.getByRole('dialog');
  await activateDialog.getByLabel('PM').check();
  await activateDialog.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByText('Person activated.')).toBeVisible();
  await expect(page.getByText('Inactive', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Luz Mechanic' }).click();
  await expect(page.getByRole('heading', { name: 'Name and type' })).toBeVisible();
  await expect(page.getByText('Read only')).toHaveCount(0);
  await page.getByLabel('Name').fill('Luz Mendez');
  await page.getByLabel('Standard').check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Luz Mendez' })).toBeVisible();

  await switchLanguage(page, 'es');
  await expect(page.getByTestId('pd-light-tip')).toContainText('Manager o System Admin');
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();
  await page.goto('/admin/mechanics');
  await expect(page.getByText('Agrega personas Standard, PM o Safety. La app crea su cuenta de acceso con una contraseña temporal.')).toBeVisible();
  await expect(page.getByText(/solo lectura/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
