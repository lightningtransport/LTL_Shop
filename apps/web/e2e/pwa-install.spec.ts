import { expect, test } from './support/test';

test.describe('LTR-171 installed app', () => {
  test('manifest has a neutral name, light launch colors, and 192/512/maskable PNG icons that load', async ({ page, request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    const manifest = await response.json();

    expect(manifest.name).toBe('Lightning Shop');
    expect(manifest.short_name).toBe('LTL Shop');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#ffffff');
    expect(manifest.theme_color).toBe('#ffffff');

    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose: string }>;
    expect(icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true);
    for (const icon of icons) {
      const file = await request.get(icon.src);
      expect(file.ok(), icon.src).toBe(true);
      expect(file.headers()['content-type']).toContain('image/png');
    }

    await page.goto('/login');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-touch-icon\.png/);
    expect(await page.locator('meta[name="theme-color"]').evaluateAll((metas) =>
      // LTR-179 (U5): one tag, no media query; BrowserThemeColor follows the app theme, not the system.
      metas.map((meta) => `${meta.getAttribute('media')} ${meta.getAttribute('content')}`))).toEqual([
      'null #ffffff',
    ]);
    expect((await request.get('/apple-touch-icon.png')).ok()).toBe(true);
  });

  test('the installed app paints the theme background, not a dark color under the light theme', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => { document.documentElement.dataset.display = 'standalone'; });
    const htmlBackground = await page.locator('html').evaluate((element) => getComputedStyle(element).backgroundColor);
    const bodyBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(htmlBackground).toBe(bodyBackground);
  });
});
