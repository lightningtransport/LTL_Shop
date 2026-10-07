import { expect, test } from './support/test';

// Owner request (2026-10-06): the animated Lightning loader on the brand navy shows before the sign-in screen,
// then fades away. Automation skips it (navigator.webdriver); `?loader=1` forces it.
test.describe('Login loader', () => {
  test('shows the animated logo on navy, then the sign-in form', async ({ page }) => {
    await page.goto('/login?loader=1');
    const loader = page.getByTestId('login-loader');
    await expect(loader).toBeVisible();
    await expect(loader).toHaveAttribute('aria-label', /Lightning Shop/);
    await expect(loader).toHaveCSS('background-color', 'rgb(15, 26, 51)');
    await expect(loader.locator('img[src="/lightning-loader.svg"]')).toBeVisible();
    await expect(loader).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('does not slow down automated sign-ins', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /Dev Login/i })).toBeVisible();
    await expect(page.getByTestId('login-loader')).toHaveCount(0);
  });
});
