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

// LTR-200 / D32 (PC-2): Purchases.
test('manager loads a purchase: live total, repeated invoice warning, split trucks, detail and void', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.goto('/admin/parts/purchases');
  await expect(page.getByRole('heading', { name: 'Purchases', exact: true })).toBeVisible();
  await expect(page.getByTestId('purchases-summary')).toHaveText('1 purchases · $48.20');
  await expect(page.getByRole('row', { name: /88412093/ })).toContainText('No invoice file');

  await page.getByRole('button', { name: 'New purchase' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Vendor').selectOption({ label: 'FleetPride' });
  await form.getByLabel('Invoice #').fill('8841-2093');
  await form.getByLabel('Invoice #').blur();
  await expect(form.getByTestId('duplicate-invoice')).toContainText('FleetPride invoice 88412093 is already saved (Oct 6, 2026 · $48.20).');
  await expect(form.getByRole('button', { name: 'Save purchase' })).toBeDisabled();
  await form.getByLabel('Invoice #').fill('88412200');
  await expect(form.getByTestId('duplicate-invoice')).toHaveCount(0);

  // D-PC6: picking the part fills the last price paid to this vendor.
  await form.getByLabel('Part', { exact: true }).first().selectOption({ label: 'Fuel Filter 4 Micron · LFF8897' });
  await expect(form.getByLabel('Unit cost').first()).toHaveValue('24.10');
  await form.getByLabel('Qty').first().fill('2');
  await form.getByRole('button', { name: 'Add line' }).click();
  await form.getByLabel('Part', { exact: true }).nth(1).selectOption({ label: 'Other (not in catalog)' });
  await form.getByPlaceholder('Description').fill('Shop rags');
  await form.getByLabel('Unit cost').nth(1).fill('10');
  await form.getByLabel('Tax').fill('1.50');
  await expect(form.getByTestId('purchase-total')).toHaveText('$59.70');

  await form.getByLabel('Lines go to different trucks').check();
  await form.getByLabel('Truck 1').selectOption({ label: 'Truck 606' });
  await expect(form.getByText(/Assigned to trucks: \$49\.\d\d · No truck: \$10\.\d\d/)).toBeVisible();
  await expect(form.getByTestId('files-off')).toBeVisible();
  await form.getByRole('button', { name: 'Save purchase' }).click();

  await expect(page.getByText('Purchase saved · $59.70')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FleetPride · 88412200' })).toBeVisible();
  await expect(page.getByTestId('truck-shares')).toContainText('Truck 606');
  await expect(page.getByTestId('truck-shares')).toContainText('No truck · shop stock');

  await page.getByRole('button', { name: 'Void' }).click();
  const voidDialog = page.getByRole('dialog');
  await expect(voidDialog.getByRole('button', { name: 'Void' })).toBeDisabled();
  await voidDialog.getByLabel('Reason').fill('Loaded twice');
  await voidDialog.getByRole('button', { name: 'Void' }).click();
  await expect(page.getByTestId('purchase-voided')).toContainText('“Loaded twice”');
  await expect(page.getByRole('button', { name: 'Edit purchase' })).toHaveCount(0);
});

test('a new purchase that was not saved comes back in the same tab; Discard asks first', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.goto('/admin/parts/purchases');
  await page.getByRole('button', { name: 'New purchase' }).click();
  await page.getByRole('dialog').getByLabel('Invoice #').fill('DRAFT-1');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Discard this purchase?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'New purchase' }).click();
  await expect(page.getByText('Your unsaved purchase is back.')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Invoice #')).toHaveValue('DRAFT-1');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// LTR-200 / D32 (PC-3): Outside repairs.
test('manager loads an outside shop invoice from the Job: truck and Job come picked; a purchase invoice number is refused', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.goto('/admin/parts/outside-repairs?new=1&truckId=truck-606&jobId=00000000-0000-4000-8000-0000000e0001');
  const form = page.getByRole('dialog', { name: 'New outside repair' });
  await expect(form.getByText('From WO-001 · Radiator Repair')).toBeVisible();
  await expect(form.getByLabel('Truck', { exact: true })).toHaveValue('truck-606');
  await expect(form.getByLabel('Job sent to an external shop')).toHaveValue('00000000-0000-4000-8000-0000000e0001');
  await expect(form.getByLabel('Job sent to an external shop').locator('option:checked')).toHaveText('Radiator Repair · WO-001 · part out since Oct 6, 2026');
  await expect(page).toHaveURL(/\/admin\/parts\/outside-repairs$/);

  await form.getByLabel('Vendor').selectOption({ label: 'FleetPride' });
  await form.getByLabel('Invoice #').fill('88412093');
  await form.getByLabel('Invoice #').blur();
  await expect(form.getByTestId('duplicate-invoice')).toContainText('It was loaded as a purchase.');
  await form.getByLabel('Invoice #').fill('DP-4410');
  await form.getByLabel('What was done').fill('Radiator recore');
  await form.getByLabel('Amount (USD)').fill('1,840');
  await form.getByRole('button', { name: 'New outside repair' }).click();

  await expect(page.getByText('Outside repair saved · $1,840.00')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FleetPride · DP-4410' })).toBeVisible();
  await expect(page.getByTestId('outside-job')).toHaveText('Radiator Repair · WO-001 · part');
});
