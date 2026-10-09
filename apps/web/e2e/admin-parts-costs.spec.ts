import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

async function loginToAdmin(page: Page, email: string) {
  await devLogin(page, email);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

/** The Parts & costs group is in the sidebar (phones: behind the menu button). */
async function expectPartsCostsNav(page: Page) {
  const openNav = page.getByRole('button', { name: 'Open Shop Admin navigation' });
  if (await openNav.isVisible()) await openNav.click();
  await expect(page.getByText('Parts & costs').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vendors' }).filter({ visible: true })).toBeVisible();
}

// LTR-200 / D32 (PC-1): Parts & costs → Parts and Vendors.
test('manager keeps the PM part catalog: cost, usual vendor, a part in an open PM stays on', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await expectPartsCostsNav(page);
  await page.goto('/admin/parts/catalog');

  await expect(page.getByRole('heading', { name: 'Parts', exact: true })).toBeVisible();
  const volvo = page.getByRole('row', { name: /Fuel Filter Volvo/ });
  await expect(volvo).toContainText('No cost yet');
  await expect(volvo).toContainText('In the PM in progress on Truck 968');
  await expect(page.getByRole('row', { name: /Fuel Filter 4 Micron/ })).toContainText('$24.10');

  // A54: turning off a part picked in a PM in progress says why, before anything is sent.
  await volvo.getByRole('button', { name: 'Actions for Fuel Filter Volvo' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await expect(page.getByText('Picked in the PM in progress on Truck 968.')).toBeVisible();

  // A53: reference cost and usual vendor.
  await volvo.getByRole('button', { name: 'Actions for Fuel Filter Volvo' }).click();
  await page.getByRole('menuitem', { name: 'Edit part' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Used in 4 PMs')).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: /Active/ })).toBeDisabled();
  await dialog.getByLabel('Reference cost').fill('12.345');
  await expect(dialog.getByText('Enter an amount like 24.10')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await dialog.getByLabel('Reference cost').fill('31.5');
  await dialog.getByLabel('Usual vendor').selectOption({ label: 'FleetPride' });
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Part saved')).toBeVisible();
  await expect(volvo).toContainText('$31.50');
  await expect(volvo).toContainText('FleetPride');
});

test('manager adds a vendor; the same name in other capitals is refused', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.goto('/admin/parts/vendors');
  await expect(page.getByRole('heading', { name: 'Vendors', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add vendor' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('fleetpride');
  await dialog.getByRole('button', { name: 'Add vendor' }).click();
  await expect(dialog.getByText('“FleetPride” already exists.')).toBeVisible();
  await dialog.getByLabel('Name').fill('Diesel Pro');
  await dialog.getByLabel('Parts').uncheck();
  await expect(dialog.getByText('Choose Parts, Outside repairs, or both.')).toBeVisible();
  await dialog.getByLabel('Outside repairs').check();
  await dialog.getByRole('button', { name: 'Add vendor' }).click();
  await expect(page.getByText('Vendor added')).toBeVisible();
  await expect(page.getByRole('row', { name: /Diesel Pro/ })).toContainText('Outside repairs');
});

test('the System Admin sees Parts & costs too (D-PC7)', async ({ page }) => {
  await loginToAdmin(page, 'system-admin@lightning.local');
  await expectPartsCostsNav(page);
});
