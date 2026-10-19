import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';
import { switchLanguage } from './support/locale';

test.describe('LTR-167 header and profile menu', () => {
  test('mechanic header holds only the logo and a 44px profile button; settings live in the menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await devLogin(page, 'mechanic@lightning.local');
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });

    const header = page.getByRole('banner', { name: 'Home controls' });
    await expect(header.getByRole('button')).toHaveCount(1);
    const profile = header.getByRole('button', { name: 'Open profile for Alejandro 1' });
    await expect(profile).toHaveText('A1');
    const box = await profile.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await profile.click();
    const menu = page.getByRole('dialog');
    await expect(menu.getByRole('heading', { name: 'Alejandro 1' })).toBeVisible();
    await expect(menu.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    await expect(menu.getByRole('group', { name: 'Theme' }).getByRole('button')).toHaveCount(3);
    await expect(menu.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await menu.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await menu.getByRole('button', { name: 'Close profile' }).click();

    await switchLanguage(page, 'es');
    await expect(page.getByRole('heading', { name: 'Mi trabajo asignado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir perfil de Alejandro 1' })).toBeVisible();
  });

  test('installed app: the mechanic header covers the status bar and content starts below it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await devLogin(page, 'mechanic@lightning.local');
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    await page.addStyleTag({ content: ':root { --app-safe-top: 59px; }' });

    const header = page.getByRole('banner', { name: 'Home controls' });
    await expect.poll(async () => header.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('59px');
    expect((await header.boundingBox())?.y).toBe(0);
    expect((await page.getByRole('button', { name: /Open profile for / }).boundingBox())?.y).toBeGreaterThanOrEqual(59);

    // Scrolled content passes under the sticky header, never into the status bar strip.
    // The sticky header sticks within the page's own container, so that container is made tall too
    // (the home hides its empty sections since Stage MG-3 and can be shorter than the scroll).
    await page.addStyleTag({ content: '#main-content, #main-content > div { min-height: 3000px; }' });
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  });

  test('Admin uses the same profile menu for language', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    const header = page.getByRole('banner', { name: 'Shop Admin controls' });
    await expect(header.getByRole('button', { name: /Switch to Spanish|ES$/ })).toHaveCount(0);

    await switchLanguage(page, 'es');
    await expect(page.getByRole('heading', { name: 'Panel', exact: true })).toBeVisible();
    await switchLanguage(page, 'en');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });
});
