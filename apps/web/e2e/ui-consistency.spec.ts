import { expect, test, type Page } from '@playwright/test';

async function signInAsManager(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('manager@lightning.local');
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('shared UI consistency', () => {
  test('Admin list pages share the same header hierarchy and fit narrow screens', async ({ page }) => {
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
    const history = page.getByRole('heading', { name: 'Repair history' }).locator('..');
    await expect(history).toBeVisible();
    await expect(history.locator('li .shrink-0.text-right').first()).toBeVisible();
  });
});
