import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * Mobile UI review (2026-10-19): on a phone, the Admin page itself never scrolls. Only its `main` does. When an absolute
 * child (an `sr-only` label) escaped `main`, the document grew past the screen; in a phone browser the whole page
 * then scrolled, the header with the menu button went out of view, and the bottom looked cut.
 */
const SCREENS = [
  '/admin',
  '/admin/yard-operations',
  '/admin/trucks/00000000-0000-4000-8000-000000001001',
  '/admin/work-orders/00000000-0000-4000-8000-000000000106',
  '/admin/parts/purchases/00000000-0000-4000-8000-00000000b001',
  '/admin/parts/catalog',
];

test.describe('Mobile frame', () => {
  test('the Admin document is never taller than the screen, so the header and its menu stay in view', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Open Shop Admin navigation' })).toBeVisible();
      await page.waitForTimeout(800);
      const sizes = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, screen: window.innerHeight }));
      expect(sizes.doc, `${path}: document ${sizes.doc}px on a ${sizes.screen}px screen`).toBeLessThanOrEqual(sizes.screen + 1);
    }
  });

  test('page header actions wrap instead of running off the screen (Parts)', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/parts/catalog');
    const count = page.getByTestId('count-stock');
    await expect(count).toBeVisible();
    const box = await count.boundingBox();
    const width = await page.evaluate(() => window.innerWidth);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  });
});
