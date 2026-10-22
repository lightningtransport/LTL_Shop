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
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  await expect(page.getByText('Mechanics, PM and Safety people who use the app.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add person' })).toBeVisible();
  await expect(page.getByTestId('pd-light-tip')).toHaveCount(0);
  // LTR-185: Safety shows on the roster with a people-facing label.
  await expect(page.getByRole('row', { name: /Retired Mechanic/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Alejandro 1' }).click();
  await expect(page.getByRole('heading', { name: 'Name and type' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Access' })).toBeVisible();
  await expect(page.getByText('Read only')).toHaveCount(0);

  await page.goto('/admin/catalog');
  await expect(page.getByRole('heading', { name: 'Jobs catalog' })).toBeVisible();
  await expect(page.getByText('Only a Shop Manager or the System Admin can change them')).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Job' })).toBeVisible();
  // LTR-198 / D30: the Manager manages Categories too.
  await expect(page.getByRole('button', { name: 'Add category' })).toBeVisible();
  await page.getByRole('link', { name: 'Brakes' }).click();
  await expect(page.getByRole('heading', { name: 'Brakes' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Actions for / }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add Job' }).first().click();
  const jobDialog = page.getByRole('dialog');
  await expect(jobDialog.getByLabel('Job name')).toBeFocused();
  await jobDialog.getByLabel('Job name').fill('replace BRAKE pads');
  await jobDialog.getByRole('button', { name: 'Add Job' }).click();
  await expect(jobDialog.getByText('That Job name is already in the Job Catalog.')).toBeVisible();
  await jobDialog.getByLabel('Job name').fill('Adjust slack adjusters');
  await jobDialog.getByRole('button', { name: 'Add Job' }).click();
  await expect(page.getByText('Job added.')).toBeVisible();
  await expect(page.getByTestId('catalog-job-row').filter({ hasText: 'Adjust slack adjusters' }).first()).toBeVisible();
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
  // LTR-253 / D48: only a System Admin adds a Shop Manager or a System Admin.
  await expect(dialog.getByLabel('Shop Manager')).toHaveCount(0);
  await dialog.getByLabel('Safety (Quality Check)').check();
  await dialog.getByRole('button', { name: 'Add person' }).click();

  await expect(page.getByText('Person added.')).toBeVisible();
  const panel = dialog.getByTestId('temporary-password-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('Temporary password')).toHaveValue(/^[A-Za-z2-9]{14}$/);
  await expect(panel.getByText('Shown only once. They change it when they sign in.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Copy' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Sofia Safety/ })).toContainText('Safety (Quality Check)');

  // The same email twice is refused with the conflict copy. R10: wait for the dialog's own focus (as above)
  // and check the email is in its field before sending.
  await page.getByRole('button', { name: 'Add person' }).click();
  await expect(page.getByRole('dialog').getByLabel('Name')).toBeFocused();
  await page.getByRole('dialog').getByLabel('Name').fill('Sofia Again');
  await page.getByRole('dialog').getByLabel('Email').fill('sofia@lightning.local');
  await expect(page.getByRole('dialog').getByLabel('Email')).toHaveValue('sofia@lightning.local');
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
  await expect(page.getByRole('dialog').getByText('Se muestra una sola vez. La cambia al entrar.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Listo' }).click();
});

test('deactivating a person with open work is refused and lists the Jobs to reassign; reset password shows a new one (D22)', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.setViewportSize({ width: 375, height: 740 });

  await page.goto('/admin/mechanics/00000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { name: 'Alejandro 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Deactivate' }).click();
  const deactivate = page.getByRole('dialog', { name: 'Deactivate person' });
  await expect(deactivate.getByText('They stop signing in and leave assignee lists; their history stays.')).toBeVisible();
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
  await expect(reset.getByText('They get a new temporary password to change at the next sign-in.')).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Jobs catalog' })).toBeVisible();
  await expect(page.getByText('Only a Shop Manager or the System Admin can change them')).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Job' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add category' })).toBeVisible();

  // LTR-198 / JC2: the search finds Jobs and aliases in every Category, accents ignored.
  const search = page.getByLabel('Search categories, Jobs or aliases');
  await search.fill('zzzz-no-category');
  await expect(page.getByText('No Job or alias matches.')).toBeVisible();
  await search.fill('cámara');
  await expect(page.getByTestId('catalog-search-results')).toBeVisible();
  await search.fill('chamber');
  await expect(page.getByTestId('catalog-search-results').getByText('Inspect brake chamber')).toBeVisible();
  await search.fill('');
  await expect(page.getByRole('link', { name: 'Brakes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Job' })).toHaveCount(1);

  await page.goto('/admin/mechanics');
  await expect(page.getByRole('button', { name: 'Add person' })).toBeVisible();
  // LTR-253 / D48: a System Admin also adds Shop Managers and System Admins.
  await expect(page.getByText('Everyone who uses the app and what they can do.')).toBeVisible();
  await expect(page.getByText(/read-only/i)).toHaveCount(0);
  await expect(page.getByTestId('pd-light-tip')).toHaveCount(0);

  await page.getByRole('button', { name: 'Add person' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Name')).toBeFocused();
  await dialog.getByLabel('Name').fill('Jessica Manager');
  await dialog.getByLabel('Email').fill('jessica@lightning.local');
  await dialog.getByLabel('Shop Manager').check();
  await expect(dialog.getByText('Shop Managers and System Admins get Admin, Yard and Work Orders access.')).toBeVisible();
  await expect(dialog.getByLabel('System Admin')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add person' }).click();
  await expect(dialog.getByTestId('temporary-password-panel')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('row', { name: /Jessica Manager/ })).toContainText('Shop Manager');
});

test('system admin adds, renames, and activates a Job, then creates and activates a mechanic', async ({ page }) => {
  await loginToAdmin(page, 'admin@lightning.local');

  await page.goto('/admin/catalog');
  await expect(page.getByTestId('pd-light-tip')).toHaveCount(0);
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
  // JC3: the Category is inactive, so its Jobs cannot be activated until the Category is.
  await page.getByRole('button', { name: 'Actions for Suspension' }).click();
  await page.getByRole('menuitem', { name: 'Activate Category' }).click();
  await expect(page.getByText('Category activated.')).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Retired suspension job' }).click();
  await page.getByRole('menuitem', { name: 'Activate' }).click();
  await expect(page.getByText('Job activated.')).toBeVisible();
  await expect(page.getByTestId('catalog-job-row').filter({ hasText: 'Retired suspension job' })).not.toContainText('Inactive');
  await page.getByRole('button', { name: 'Actions for Retired suspension job' }).click();
  await page.getByRole('menuitem', { name: 'Rename Job' }).click();
  const renameDialog = page.getByRole('dialog');
  await expect(renameDialog.getByLabel('Job name')).toBeFocused();
  await expect(renameDialog.getByRole('checkbox')).toBeChecked();
  await renameDialog.getByLabel('Job name').fill('Service suspension');
  await renameDialog.getByRole('button', { name: 'Rename Job' }).click();
  await expect(page.getByText('Job renamed.')).toBeVisible();
  await expect(page.getByTestId('catalog-job-row').filter({ hasText: 'Service suspension' }).first()).toBeVisible();

  await page.goto('/admin/catalog/categories/00000000-0000-4000-8000-000000000301');
  await expect(page.getByTestId('catalog-job-row').filter({ hasText: 'Bleed brakes' }).first()).toBeVisible();

  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.goto('/admin/mechanics');
  await expect(page.getByTestId('pd-light-tip')).toHaveCount(0);
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

  // LTR-160: inactive people are hidden until the filter asks for them.
  await expect(page.getByRole('row', { name: /Retired Mechanic/ })).toHaveCount(0);
  await page.getByRole('search').getByRole('button', { name: /^Filters( [0-9]+)?$/ }).click();
  const filtersSheet = page.getByRole('dialog', { name: 'Filters' });
  // LTR-199: one filter for Active, Active and inactive, and Removed from the Shop.
  await filtersSheet.getByLabel('Show').selectOption('all');
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
  await expect(page.getByTestId('pd-light-tip')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();
  await page.goto('/admin/mechanics');
  // LTR-253 / D48: the System Admin's People subtitle names the Shop Manager and System Admin types too.
  await expect(page.getByText('Todas las personas que usan la app y lo que pueden hacer.')).toBeVisible();
  await expect(page.getByText(/solo lectura/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('R10: a dialog never takes focus away from a field the Manager is already typing in', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.goto('/admin/mechanics');
  // Make the dialog's own first-field focus late on purpose (a busy phone), then type in Email right away.
  await page.evaluate(() => {
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => window.setTimeout(() => original(callback), 400) as unknown as number;
  });
  await page.getByRole('button', { name: 'Add person' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').click();
  await page.keyboard.type('fast@lightning.local');
  await page.waitForTimeout(700);
  await expect(dialog.getByLabel('Email')).toBeFocused();
  await expect(dialog.getByLabel('Email')).toHaveValue('fast@lightning.local');
  await expect(dialog.getByLabel('Name')).toHaveValue('');
});
