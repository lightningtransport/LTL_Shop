import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

// D47 / HU-M20 (LTR-246): Parts is the Shop's inventory; the stock moves with Count stock, Add to stock and
// Remove from stock. The fixture's shelf: Fuel Filter 4 Micron has 3 at $24.10 (minimum 4 → Low); Fuel Filter
// Volvo has none and no reference cost.
async function loginToAdmin(page: Page) {
  await devLogin(page, 'manager@lightning.local');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

const visible = (locator: ReturnType<Page['getByLabel']>) => locator.filter({ visible: true }).first();

test.describe('D47 Parts is the inventory', () => {
  test('Parts shows what is on the shelf; Stock left the menu and its old link lands on Parts', async ({ page }) => {
    await loginToAdmin(page);
    await page.goto('/admin/parts/catalog');
    await expect(page.getByTestId('stock-totals')).toContainText('1 in stock');
    const row = page.getByTestId('part-in-stock').filter({ visible: true }).first();
    await expect(row).toContainText('3');
    await expect(row).toContainText('Low');
    await expect(page.getByTestId('part-cost').filter({ visible: true }).first()).toContainText('$24.10');
    const openNav = page.getByRole('button', { name: 'Open Shop Admin navigation' });
    if (await openNav.isVisible()) await openNav.click();
    await expect(page.getByRole('link', { name: 'Parts', exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stock', exact: true })).toHaveCount(0);
    await page.goto('/admin/parts/stock?q=Fuel');
    await expect(page).toHaveURL(/\/admin\/parts\/catalog\?inStock=true&q=Fuel/);
  });

  test('The part panel removes 2 damaged with a preview, and saves the minimum', async ({ page }) => {
    await loginToAdmin(page);
    await page.goto('/admin/parts/catalog');
    await page.getByTestId('part-open').filter({ hasText: 'Fuel Filter 4 Micron' }).filter({ visible: true }).first().click();
    const panel = page.getByTestId('part-panel');
    await expect(panel.getByTestId('part-panel-on-hand')).toHaveText('3');
    await panel.getByRole('button', { name: 'Remove from stock' }).click();
    const dialog = page.getByTestId('stock-remove-dialog');
    await dialog.getByLabel('How many leave').fill('2');
    await expect(dialog.getByTestId('stock-remove-preview')).toContainText('3 → 1 in stock');
    await expect(dialog.getByTestId('stock-remove-preview')).toContainText('no truck is charged');
    await dialog.getByRole('button', { name: 'Remove 2' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Removed from stock.' }).first()).toBeVisible();
    await expect(page.getByTestId('part-in-stock').filter({ visible: true }).first()).toContainText('1');
  });

  test('Count stock asks a cost only for a part that goes up without one, then saves in one go', async ({ page }) => {
    await loginToAdmin(page);
    await page.goto('/admin/parts/catalog');
    await page.getByTestId('count-stock').click();
    await expect(page).toHaveURL(/\/admin\/parts\/count$/);
    await visible(page.getByLabel('Counted · Fuel Filter 4 Micron')).fill('5');
    await visible(page.getByLabel('Counted · Fuel Filter Volvo')).fill('2');
    await expect(page.getByTestId('count-summary')).toContainText('1 need a cost');
    await expect(page.getByTestId('count-save')).toBeDisabled();
    await visible(page.getByLabel('Cost of each one · Fuel Filter Volvo')).fill('15');
    await expect(page.getByTestId('count-summary')).toContainText('2 changed');
    await page.getByTestId('count-save').click();
    await expect(page.getByRole('status').filter({ hasText: 'Count saved: 2 changed.' }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/parts\/catalog$/);
    await expect(page.getByTestId('stock-totals')).toContainText('2 in stock');
  });

  test('Add to stock from the part panel: parts that came in without an invoice', async ({ page }) => {
    await loginToAdmin(page);
    await page.goto('/admin/parts/catalog');
    await page.getByTestId('part-open').filter({ hasText: 'Fuel Filter 4 Micron' }).filter({ visible: true }).first().click();
    await page.getByTestId('part-panel').getByRole('button', { name: 'Add to stock' }).click();
    const dialog = page.getByTestId('stock-add-dialog');
    await expect(dialog.getByLabel('Cost of each one')).toHaveValue('24.10');
    await dialog.getByLabel('Qty').fill('2');
    await dialog.getByRole('button', { name: 'Add 2 to stock · $48.20' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Added to stock.' }).first()).toBeVisible();
    await expect(page.getByTestId('part-in-stock').filter({ visible: true }).first()).toContainText('5');
  });
});
