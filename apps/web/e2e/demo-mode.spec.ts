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
    await input.fill('ms@lightning.local');
    await expect(input).toHaveValue('ms@lightning.local');
    await page.getByRole('button', { name: /Enter demo mode/ }).click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });

    const panel = page.getByRole('complementary', { name: 'Demo panel' });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('button', { name: /^MS/ })).toHaveAttribute('aria-pressed', 'true');

    // A user button loads that account's home from scratch (new document, new cookie).
    await panel.getByRole('button', { name: /^MG1/ }).click();
    await page.waitForURL(/\/mechanic\/standard$/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Open profile for MG1 · Mecánico General' })).toBeVisible({ timeout: 15_000 });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: /^MG1/ })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Demo', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Demo', exact: true }).click();
    await expect(panel).toBeVisible();

    // Every roster account the fixture knows is enabled; the one signed in is marked and disabled.
    await expect(panel.getByRole('button', { name: /^QC1/ })).toBeEnabled();

    await panel.getByRole('button', { name: /^MPM/ }).click();
    await page.waitForURL(/\/mechanic\/pm$/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Open profile for MPM · Mecánico PM' })).toBeVisible({ timeout: 15_000 });

    await panel.getByRole('button', { name: /^MS/ }).click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    // Turning the mode off asks first (UX-1-006) and can be undone from the profile menu (UX-1-001).
    await panel.getByRole('button', { name: 'Turn demo mode off' }).click();
    await panel.getByRole('button', { name: 'Turn off' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Open profile for MS/ })).toBeVisible();

    await page.getByRole('button', { name: /Open profile for MS/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Turn on' }).click();
    await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('a story walks the presenter screen by screen (HU-M7, no data changes)', async ({ page }) => {
    await page.addInitScript(seedDemoState, DEMO_STATE);
    await devLogin(page, 'ms@lightning.local');
    const panel = page.getByRole('complementary', { name: 'Demo panel' });
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await panel.getByRole('combobox', { name: 'Story' }).selectOption('HU-M7');
    const card = panel.getByTestId('demo-step');
    // Choosing a story only previews it (UX-7-003); Start opens the first screen.
    await expect(card).toContainText('Ready · 5 steps');
    await expect(card).toContainText('Operations');
    await card.getByRole('button', { name: 'Start' }).click();
    await expect(card).toContainText('Step 1 of 5');
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

  test('the demo flow runs by chapters and the chapter list jumps', async ({ page }) => {
    await page.addInitScript(seedDemoState, DEMO_STATE);
    await devLogin(page, 'ms@lightning.local');
    const panel = page.getByRole('complementary', { name: 'Demo panel' });
    await expect(panel).toBeVisible({ timeout: 15_000 });

    await panel.getByRole('combobox', { name: 'Story' }).selectOption('FLOW');
    const card = panel.getByTestId('demo-step');
    await expect(card).toContainText('Ready · 49 steps');
    await expect(card).toContainText('Chapter 1 of 14 · Start of the day');
    // Chapter 1 is MG3's: Start switches the account (page replaced) and lands on the mechanic home.
    await card.getByRole('button', { name: /^Start as MG3/ }).click();
    await page.waitForURL(/\/mechanic\/standard$/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Open profile for MG3 · Mecánico General' })).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByTestId('demo-step')).toContainText('Chapter 1 of 14');

    // The chapter list jumps: chapter 14 is the Manager's Shop workflow.
    await panel.getByText(/^Chapters · 14/).click();
    await panel.getByRole('button', { name: /^14 · Setup/ }).click();
    await page.waitForURL(/\/admin\/setup\/workflow$/, { timeout: 30_000 });
    await expect(panel.getByTestId('demo-step')).toContainText('Chapter 14 of 14');
  });

  test('a saved state reopens the panel after a sign-in', async ({ page }) => {
    await page.addInitScript(seedDemoState, DEMO_STATE);
    await devLogin(page, 'mpm@lightning.local');
    await expect(page.getByRole('complementary', { name: 'Demo panel' })).toBeVisible({ timeout: 15_000 });
  });
});
