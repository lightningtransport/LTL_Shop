import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

const BLOCKER_WO_ID = '00000000-0000-4000-8000-000000000106';

test.describe('LTR-155 blocker lifecycle (D17: per Job, only the Manager resolves)', () => {
  test('mechanic blocks a Job and adds a note; Manager sees it and resolves with a note; official pause still works', async ({ page }) => {
    test.setTimeout(90_000);
    await devLogin(page, 'mechanic@lightning.local');
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    await page.goto(`/work-orders/${BLOCKER_WO_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Truck T-106' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/In Progress/i).first()).toBeVisible();

    // The blocker is reported from the Job, with mechanic reasons only.
    await page.getByRole('button', { name: 'Report blocker: Inspect brake chamber' }).click();
    const dialog = page.getByRole('dialog', { name: /Report blocker: Inspect brake chamber/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Blocker reason').locator('option', { hasText: 'Break' })).toHaveCount(0);
    await dialog.getByLabel('Blocker reason').selectOption('waiting_for_parts');
    await dialog.getByRole('button', { name: 'Report Blocker', exact: true }).click();

    await expect(page.getByText('Work Order WO-0106 · In Progress')).toBeVisible();
    await expect(page.getByText('Inspect brake chamber · Blocked · Waiting for Parts')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark resolved' })).toHaveCount(0);
    await expect(page.getByText('Only the Manager resolves a blocker. Add a note if something changes.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Add note to blocker' }).fill('The part arrived');
    await page.getByRole('button', { name: 'Add note to blocker' }).click();
    await expect(page.getByText('The part arrived').first()).toBeVisible();

    await page.evaluate(() => localStorage.removeItem('ltl_shop_token'));
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.goto(`/admin/work-orders/${BLOCKER_WO_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'T-106' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Reported blockers' })).toBeVisible();
    const blocker = page.getByTestId('admin-blocker').first();
    await expect(blocker.getByText('Blocked · Inspect brake chamber: Waiting for Parts')).toBeVisible();
    await expect(blocker.getByText(/Alejandro 1 · .*: The part arrived/)).toBeVisible();
    // A blocker does not pause the Work Order: Pause is offered, Resume is not (LTR-168: summary starts folded).
    await expect(page.getByRole('heading', { name: 'Pause Work Order' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume Work Order' })).toHaveCount(0);

    await blocker.getByLabel('Note for the mechanic (optional)').fill('Installed from stock');
    await blocker.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Blocker resolved.' }).first()).toBeVisible();
    // LTR-164 (#9): a resolved blocker reads "Resolved" and keeps the Manager's note.
    await expect(blocker.getByText('Resolved · Inspect brake chamber: Waiting for Parts')).toBeVisible();
    await expect(blocker.getByText('Manager note: Installed from stock')).toBeVisible();

    // The Manager's official pause is separate from Job blockers.
    await page.getByLabel('Pause reason').selectOption('waiting_for_approval');
    await page.getByRole('button', { name: 'Pause Work Order' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Work Order paused.' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume Work Order' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume Work Order' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Work Order resumed.' }).first()).toBeVisible();
    // A blocker does not pause the Work Order: Pause is offered, Resume is not (LTR-168: summary starts folded).
    await expect(page.getByRole('heading', { name: 'Pause Work Order' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume Work Order' })).toHaveCount(0);

    // LTR-164 (#9): the mechanic sees who resolved it and the Manager's note.
    await page.evaluate(() => localStorage.removeItem('ltl_shop_token'));
    await devLogin(page, 'mechanic@lightning.local');
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    await page.goto(`/work-orders/${BLOCKER_WO_ID}`, { waitUntil: 'domcontentloaded' });
    const resolved = page.getByTestId('resolved-blocker');
    await expect(resolved.getByText(/^Inspect brake chamber · Resolved by /)).toBeVisible({ timeout: 15_000 });
    await expect(resolved.getByText('Manager note: Installed from stock')).toBeVisible();
  });
});
