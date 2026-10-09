import { expect, test } from './support/test';
import { devLogin, waitForLoginForm } from './support/dev-login';

const DEMO_STATE = JSON.stringify({ version: 1, enabled: true, storyId: null, stepIndex: 0, panelOpen: true, autoFollow: true });

/**
 * D36: the local demo panel. The e2e build has Dev Login on, so the Demo button must still be absent until
 * the presenter turns the mode on (header-profile-menu.spec counts exactly one header button).
 */
test.describe('D36 demo mode', () => {
  test('without demo mode there is no Demo button', async ({ page }) => {
    await devLogin(page, 'mechanic@lightning.local');
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Demo panel' })).toHaveCount(0);
  });

  test('enter from /login, switch accounts from the panel, leave', async ({ page }) => {
    await page.goto('/login');
    await waitForLoginForm(page);
    const input = page.getByLabel('Email');
    await input.fill('manager@lightning.local');
    await expect(input).toHaveValue('manager@lightning.local');
    await page.getByRole('button', { name: /Enter demo mode/ }).click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });

    const panel = page.getByRole('complementary', { name: 'Demo panel' });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: /Shop Manager/ })).toHaveAttribute('aria-pressed', 'true');

    // A user button loads that account's home from scratch (new document, new cookie).
    await panel.getByRole('button', { name: /^Anthony/ }).click();
    await page.waitForURL(/\/mechanic\/standard$/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Open profile for Anthony' })).toBeVisible({ timeout: 15_000 });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: /^Anthony/ })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Demo', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Demo', exact: true }).click();
    await expect(panel).toBeVisible();

    // Accounts the API does not list (the fixture has no Safety) stay disabled, so a tap never ends in a 403.
    await expect(panel.getByRole('button', { name: /Safety 1/ })).toBeDisabled();

    await panel.getByRole('button', { name: /^Daniel/ }).click();
    await page.waitForURL(/\/mechanic\/pm$/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Open profile for Daniel' })).toBeVisible({ timeout: 15_000 });

    await panel.getByRole('button', { name: /Shop Manager/ }).click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    await panel.getByRole('button', { name: 'Leave demo mode' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Open profile for Shop Manager/ })).toBeVisible();
  });

  test('a saved state reopens the panel after a sign-in', async ({ page }) => {
    await page.addInitScript((value) => window.localStorage.setItem('ltl_shop_demo', value), DEMO_STATE);
    await devLogin(page, 'daniel@lightning.local');
    await expect(page.getByRole('complementary', { name: 'Demo panel' })).toBeVisible({ timeout: 15_000 });
  });
});
