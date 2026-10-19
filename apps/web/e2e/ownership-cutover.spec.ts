import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

test.describe('V2-002 TARGET ownership cutover', () => {
  test('Standard mechanic cannot create, pause, or add a Job', async ({ page }) => {
    await devLogin(page, 'mechanic@lightning.local');
    await expect(page.getByRole('heading', { name: 'My assigned work' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Create New Work Order/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Resume work/i })).toHaveCount(0);

    await page.goto('/mechanic/standard/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Ask your Shop Manager to create a Work Order/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Truck/i })).toHaveCount(0);

    await page.goto('/work-orders/00000000-0000-4000-8000-000000000106', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Truck T-106' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Report blocker' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish work' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Add job/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Resume work' })).toHaveCount(0);
    await expect(page.getByText(/Need additional work on this Truck/i)).toBeVisible();
  });

  test('Manager can create, officially pause, and add work from the Work Plan', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.getByRole('link', { name: 'Work Orders' }).first().click();
    await expect(page.getByRole('link', { name: 'New Work Order' })).toBeVisible();
    await page.getByRole('link', { name: 'New Work Order' }).click();
    await expect(page.getByRole('heading', { name: 'New Work Order' })).toBeVisible();

    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000106', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'T-106' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    // D6 / LTR-150: work is added from the Truck Work Plan (covered by admin-truck-work-plan.spec.ts).
    await expect(page.getByRole('button', { name: 'Add job +' })).toHaveCount(0);
    const addWork = page.getByRole('link', { name: 'Add work in the Work Plan' });
    await expect(addWork).toHaveAttribute('href', /\/admin\/trucks\/.*#truck-work-plan-title$/);
  });

  test('Admin without manage cannot see Create', async ({ page }) => {
    await devLogin(page, 'ibrain@ltransl.com');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.getByRole('link', { name: 'Work Orders' }).first().click();
    await expect(page.getByRole('heading', { name: 'Work Orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Work Order' })).toHaveCount(0);
    await page.goto('/admin/work-orders/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('You do not have permission to create Work Orders.', { exact: false })).toBeVisible();
  });
});
