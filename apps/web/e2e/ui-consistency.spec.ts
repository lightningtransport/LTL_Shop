import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

async function signInAsManager(page: Page) {
  await devLogin(page, 'manager@lightning.local');
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('shared UI consistency', () => {
  test('Admin list pages share the same header hierarchy and fit narrow screens', async ({ page }) => {
    // Six pages at four viewports each.
    test.setTimeout(120_000);
    await signInAsManager(page);

    for (const path of ['/admin', '/admin/trucks', '/admin/mechanics', '/admin/catalog', '/admin/history', '/admin/work-orders']) {
      await page.goto(path);
      await expect(page.locator('main .section-label').first()).toBeVisible();
      await expect(page.locator('main h1.font-display').first()).toBeVisible();
      for (const viewport of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 834, height: 1194 },
        { width: 1440, height: 1024 },
      ]) {
        await page.setViewportSize(viewport);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
    }
  });

  test('Dashboard metrics name the metric and its value (LTR-151)', async ({ page }) => {
    await signInAsManager(page);
    const metrics = page.getByRole('region', { name: 'Current shop operations' }).getByRole('link');
    await expect(metrics.first()).toBeVisible();
    for (const label of await metrics.evaluateAll((links) => links.map((link) => link.getAttribute('aria-label')))) {
      expect(label).toMatch(/^.+: \d+$/);
    }
    await expect(page.getByRole('link', { name: /^Open Work Orders: \d+$/ })).toBeVisible();
  });

  test('Work Order detail labels job pickers, hides System Admin accounts, and uses one empty-mechanics wording (LTR-151)', async ({ page }) => {
    await signInAsManager(page);
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000106');
    const jobPicker = page.getByRole('combobox', { name: 'Mechanic for Inspect brake chamber' });
    await expect(jobPicker).toBeVisible();
    await expect(jobPicker.locator('option', { hasText: 'Anthony' })).toHaveCount(1);
    await expect(jobPicker.locator('option', { hasText: 'iBrain Admin' })).toHaveCount(0);
    await expect(jobPicker.locator('option', { hasText: 'Cristian Perez' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Select mechanic', exact: true })).toHaveCount(0);

    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000103');
    const summary = page.getByRole('region', { name: 'Operational summary' });
    const mechanicsRow = summary.locator('div').filter({ has: page.getByText('Mechanics', { exact: true }) }).last();
    await expect(mechanicsRow.locator('dd')).toHaveText('No mechanics assigned');
  });

  test('Return to Service says the Truck leaves Ready to Go (LTR-151)', async ({ page }) => {
    await signInAsManager(page);
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000104');
    await expect(page.getByText(/The Truck leaves Ready to Go\./)).toBeVisible();
    await expect(page.getByText(/does not change Work Order status, Ready to Go/)).toHaveCount(0);
  });

  test('filter actions keep their labels on one line', async ({ page }) => {
    await signInAsManager(page);
    for (const path of ['/admin/trucks', '/admin/mechanics', '/admin/history']) {
      await page.goto(path);
      await page.setViewportSize({ width: 320, height: 568 });
      const apply = page.getByRole('button', { name: 'Apply filters' });
      await expect(apply).toBeVisible();
      const box = await apply.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(36);
      expect(await apply.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    }
  });

  test('Repair History keeps mileage in a deliberate metadata column', async ({ page }) => {
    await signInAsManager(page);
    await page.goto('/admin/trucks');
    await page.locator('main table tbody a').first().click();
    const history = page.getByRole('region', { name: 'Repair history' });
    await expect(history).toBeVisible();
    await expect(history.locator('li .shrink-0.text-right').first()).toBeVisible();
  });
});
