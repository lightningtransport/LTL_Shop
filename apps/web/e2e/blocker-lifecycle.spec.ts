import { expect, test, type Page } from '@playwright/test';

const BLOCKER_WO_ID = '00000000-0000-4000-8000-000000000106';

async function devLogin(page: Page, email: string) {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Dev Login/i })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Dev Login/i }).click();
}

test.describe('V1.2-002 blocker lifecycle', () => {
  test('mechanic report stays visible to Manager without pausing; official pause/resume works', async ({ page }) => {
    test.setTimeout(90_000);
    await devLogin(page, 'mechanic@lightning.local');
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    await page.goto(`/work-orders/${BLOCKER_WO_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '#T-106' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/In Progress/i)).toBeVisible();

    await page.getByRole('button', { name: 'Report Blocker' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Report Blocker/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Blocker reason').selectOption('waiting_for_parts');
    await dialog.getByRole('button', { name: 'Report Blocker', exact: true }).click();

    await expect(page.getByRole('heading', { name: '#T-106' })).toBeVisible();
    await expect(page.getByText('Work Order WO-0106 · In Progress')).toBeVisible();
    await expect(page.getByText(/^Paused$/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Resume Work' })).toHaveCount(0);

    await page.evaluate(() => localStorage.removeItem('ltl_shop_token'));
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.goto(`/admin/work-orders/${BLOCKER_WO_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'T-106' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reported blockers' })).toBeVisible();
    await expect(page.getByText('Waiting for Parts').first()).toBeVisible();
    await expect(page.getByText('Alejandro 1').first()).toBeVisible();
    await expect(page.getByText('This Work Order is not currently paused.').first()).toBeVisible();
    await page.getByTestId('admin-wo-history').locator('summary').click();
    await expect(page.getByText('Blocker reported')).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
    await expect(page.getByText(/waiting_for_parts/)).toHaveCount(0);

    await page.getByLabel('Pause reason').selectOption('waiting_for_approval');
    await page.getByRole('button', { name: 'Pause Work Order' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Work Order paused.' }).first()).toBeVisible();
    await expect(page.getByText('Paused').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume Work Order' })).toBeVisible();
    await expect(page.getByText('Waiting for Approval').first()).toBeVisible();
    await expect(page.getByText('Waiting for Parts').first()).toBeVisible();

    await page.getByRole('button', { name: 'Resume Work Order' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Work Order resumed.' }).first()).toBeVisible();
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause Work Order' })).toBeVisible();
    await expect(page.getByText('This Work Order is not currently paused.').first()).toBeVisible();
  });
});
