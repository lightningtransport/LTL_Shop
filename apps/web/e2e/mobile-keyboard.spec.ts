import { expect, test } from './support/test';

/**
 * LTR-234: the phone keyboard never covers a bottom sheet or sits under a fixed bar. Playwright has no real
 * on-screen keyboard, so the visual viewport is replaced by one the test shrinks, like iOS does when it opens.
 */
test.describe('Phone keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      class FakeViewport extends EventTarget {
        height = window.innerHeight;
        width = window.innerWidth;
        offsetTop = 0;
        offsetLeft = 0;
        pageTop = 0;
        pageLeft = 0;
        scale = 1;
      }
      const fake = new FakeViewport();
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
      (window as unknown as { __keyboard: (px: number) => void }).__keyboard = (px: number) => {
        fake.height = window.innerHeight - px;
        fake.dispatchEvent(new Event('resize'));
      };
    });
  });

  test('a bottom sheet stands on the keyboard, fixed bars hide, and both come back when it closes', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await page.evaluate(() => {
      const sheet = document.createElement('div');
      sheet.setAttribute('data-sheet', '');
      sheet.setAttribute('data-testid', 'fake-sheet');
      sheet.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:200px;background:red';
      const bar = document.createElement('div');
      bar.setAttribute('data-hide-on-keyboard', '');
      bar.setAttribute('data-testid', 'fake-bar');
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:56px';
      bar.textContent = 'bar';
      document.body.append(sheet, bar);
    });
    const height = await page.evaluate(() => window.innerHeight);

    await page.evaluate(() => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(336));
    await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', '');
    await expect.poll(async () => (await page.getByTestId('fake-sheet').boundingBox())!.y + 200).toBeLessThanOrEqual(height - 336 + 1);
    await expect(page.getByTestId('fake-bar')).toBeHidden();

    await page.evaluate(() => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(0));
    await expect(page.locator('html')).not.toHaveAttribute('data-keyboard-open', '');
    await expect.poll(async () => Math.round((await page.getByTestId('fake-sheet').boundingBox())!.y + 200)).toBe(height);
    await expect(page.getByTestId('fake-bar')).toBeVisible();
  });

  test('a small toolbar change is not a keyboard', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(50));
    await expect(page.locator('html')).not.toHaveAttribute('data-keyboard-open', '');
  });
});
