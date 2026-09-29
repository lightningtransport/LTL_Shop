import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

const MECHANIC_WO_ID = '00000000-0000-4000-8000-000000000106';

test.describe('LTR-172 fixture routes: mechanic notes and Admin History', () => {
  test('mechanic adds a note and stays on the Work Order detail', async ({ page }) => {
    await devLogin(page, 'mechanic@lightning.local');
    await page.goto(`/work-orders/${MECHANIC_WO_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Truck T-106' })).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder(/Write a note/i).fill('Air line checked, no leaks');
    await page.getByRole('button', { name: 'Add Note' }).click();

    await expect(page.getByText('Note added.')).toBeVisible();
    await expect(page.getByText('Air line checked, no leaks')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Truck T-106' })).toBeVisible();
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  });

  test('Admin History lists closed Work Orders', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/history', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('WO-0104').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('WO-0105').first()).toBeVisible();
    await expect(page.getByText('WO-0102')).toHaveCount(0);
  });
});
