import { expect, test } from './support/test';
import { devLogin, waitForLoginForm } from './support/dev-login';

const DEMO_STATE = JSON.stringify({ version: 1, enabled: true, storyId: null, stepIndex: 0, panelOpen: true, autoFollow: true });

/** Runs on every document load, so it only seeds the state the first time; later writes by the panel must survive reloads. */
function seedDemoState(value: string) {
  if (!window.localStorage.getItem('ltl_shop_demo')) window.localStorage.setItem('ltl_shop_demo', value);
}

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

  test('a story walks the presenter screen by screen (HU-M7, no data changes)', async ({ page }) => {
    await page.addInitScript(seedDemoState, DEMO_STATE);
    await devLogin(page, 'manager@lightning.local');
    const panel = page.getByRole('complementary', { name: 'Demo panel' });
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await panel.getByRole('combobox', { name: 'Story' }).selectOption('HU-M7');
    const card = panel.getByTestId('demo-step');
    await expect(card).toContainText('Step 1 of 5');
    await expect(card).toContainText('Operations');
    await expect(page).toHaveURL(/\/admin$/);

    await card.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/admin\/yard-operations$/, { timeout: 15_000 });
    await expect(card).toContainText('Step 2 of 5');

    await card.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/admin\/yard-operations\?tab=movement$/, { timeout: 15_000 });
    await expect(card).toContainText('Step 3 of 5');

    await card.getByRole('button', { name: 'Back' }).click();
    await expect(card).toContainText('Step 2 of 5');

    // The step survives a reload.
    await page.reload();
    await expect(panel.getByTestId('demo-step')).toContainText('Step 2 of 5', { timeout: 15_000 });

    await panel.getByRole('combobox', { name: 'Story' }).selectOption('');
    await expect(panel.getByTestId('demo-step')).toHaveCount(0);
  });

  test('a saved state reopens the panel after a sign-in', async ({ page }) => {
    await page.addInitScript(seedDemoState, DEMO_STATE);
    await devLogin(page, 'daniel@lightning.local');
    await expect(page.getByRole('complementary', { name: 'Demo panel' })).toBeVisible({ timeout: 15_000 });
  });
});
