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
  await expect(page.getByText('In use on the open PM of Truck 968 until it is finished.')).toBeVisible();

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
  await expect(page.getByTestId('purchases-summary')).toHaveText('1 purchase · $48.20');
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
  await expect(form.getByTestId('cost-source').first()).toHaveText('Last price paid to FleetPride (Oct 6, 2026).');
  await form.getByLabel('Qty').first().fill('2');
  await form.getByRole('button', { name: 'Add line' }).click();
  await form.getByLabel('Part', { exact: true }).nth(1).selectOption({ label: 'Other — only on this invoice' });
  await expect(form.getByTestId('other-hint')).toContainText('Saved only on this purchase; it is not added to Parts.');
  await form.getByPlaceholder('Description').fill('Shop rags');
  await form.getByLabel('Unit cost').nth(1).fill('10');
  await form.getByLabel('Tax').fill('1.50');
  await expect(form.getByTestId('purchase-total')).toHaveText('$59.70');

  await form.getByLabel('Lines go to different trucks').check();
  await form.getByLabel('Truck 1').selectOption({ label: 'Truck 606' });
  await expect(form.getByTestId('purchase-destination')).toContainText(/Truck 606: \$49\.\d\d/);
  await expect(form.getByTestId('purchase-destination')).toContainText(/No truck: \$10\.\d\d/);
  await expect(form.getByTestId('files-off')).toBeVisible();
  await form.getByRole('button', { name: 'Save purchase' }).click();

  await expect(page.getByText('Purchase saved · $59.70')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FleetPride · 88412200' })).toBeVisible();
  await expect(page.getByTestId('truck-shares')).toContainText('Truck 606');
  await expect(page.getByTestId('truck-shares')).toContainText('No truck');

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
  // UX-7-029: the question shows in the footer, in place of the buttons, always in view.
  await expect(page.getByTestId('form-footer').getByRole('alertdialog', { name: 'Discard this purchase?' })).toBeInViewport();
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
  await page.goto('/admin/parts/outside-repairs?new=1&forTruck=truck-606&jobId=00000000-0000-4000-8000-0000000e0001');
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

// LB-1 (LTR-201 / D34): the shop's labor rate.
test('manager sets the shop labor rate from a date; the same date twice is refused', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.goto('/admin/parts/labor-rate');
  await expect(page.getByRole('heading', { name: 'Shop rates', exact: true })).toBeVisible();
  await expect(page.getByTestId('labor-rate-current')).toContainText('No labor rate yet.');
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(page.getByText('Enter the rate per hour.')).toBeVisible();
  await page.getByLabel('Rate per hour (USD)').fill('95');
  await page.getByLabel('From', { exact: true }).fill('2026-09-01');
  // PCA7 (UX-10-005): before saving, the screen says what the date recalculates and what is already invoiced.
  await expect(page.getByTestId('labor-rate-preview')).toHaveText('Saving recalculates 3 completed Work Orders with work from Sep 1, 2026. 1 already invoiced: the difference goes on the next invoice.');
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(page.getByText('Rate saved · 3 Work Orders recalculated')).toBeVisible();
  await expect(page.getByTestId('labor-rate-current')).toContainText('$95.00 per hour, since Sep 1, 2026');
  await page.getByLabel('Rate per hour (USD)').fill('100');
  await page.getByLabel('From', { exact: true }).fill('2026-09-01');
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(page.getByText('There is already a rate from that date. Pick another date.')).toBeVisible();

  // PCA7: a mistyped rate can be taken back while nothing invoiced used it.
  await page.getByTestId('labor-rate-remove').click();
  await expect(page.getByRole('dialog', { name: 'Remove this rate?' })).toContainText('Work Orders priced at $95.00 from Sep 1, 2026 go back to the previous rate.');
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Rate removed · 3 Work Orders recalculated')).toBeVisible();
  await expect(page.getByTestId('labor-rate-current')).toContainText('No labor rate yet.');
});

// UX-7-026 / PC1: Save with something missing says what, and goes to it.
test('saving a purchase with missing fields lists them and goes to the first one', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.goto('/admin/parts/purchases');
  await page.getByRole('button', { name: 'New purchase' }).click();
  const form = page.getByRole('dialog');
  await form.getByRole('button', { name: 'Save purchase' }).click();
  const missing = form.getByTestId('form-missing');
  await expect(missing).toContainText('Complete these to save:');
  for (const item of ['Vendor', 'Invoice #', 'Line 1: part or description', 'Line 1: unit cost']) await expect(missing.getByRole('button', { name: item, exact: true })).toBeVisible();
  await expect(form.getByLabel('Vendor')).toBeFocused();
  await missing.getByRole('button', { name: 'Line 1: unit cost' }).click();
  await expect(form.getByLabel('Unit cost')).toBeFocused();
  await expect(form.getByText('Tax (optional)')).toBeVisible();
});

// UX-4-012 / PC5: the summary comes first; "Per truck" only with several trucks.
test('a purchase detail starts with vendor, invoice, truck, file and total', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');
  await page.goto('/admin/parts/purchases/00000000-0000-4000-8000-00000000b001');
  const summary = page.getByTestId('purchase-summary');
  await expect(summary).toContainText('FleetPride');
  await expect(summary).toContainText('88412093');
  await expect(summary).toContainText('Truck 606');
  await expect(summary).toContainText('No invoice file');
  await expect(page.getByTestId('purchase-detail-total')).toHaveText('$48.20');
  await expect(page.getByTestId('truck-shares')).toHaveCount(0);
});
