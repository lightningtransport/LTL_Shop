import { expect, test, type Page } from '@playwright/test';

async function devLogin(page: Page, email?: string) {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Dev Login/i })).toBeVisible({ timeout: 15_000 });
  if (email) await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Dev Login/i }).click();
}

test.describe('V2-002 TARGET ownership cutover', () => {
  test('Standard mechanic cannot create, pause, or add a Job', async ({ page }) => {
    await devLogin(page, 'mechanic@lightning.local');
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Create New Work Order/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Resume Work/i })).toHaveCount(0);

    await page.goto('/mechanic/standard/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Ask your Shop Manager to create a Work Order/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Truck/i })).toHaveCount(0);

    await page.goto('/work-orders/00000000-0000-4000-8000-000000000106', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '#T-106' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Report Blocker' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish Work' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Add job/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Resume Work' })).toHaveCount(0);
    await expect(page.getByText(/Need additional work on this Truck/i)).toBeVisible();
  });

  test('Manager can create, officially pause, and add a Job', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.getByRole('link', { name: 'Work Orders' }).first().click();
    await expect(page.getByRole('link', { name: 'New Work Order' })).toBeVisible();
    await page.getByRole('link', { name: 'New Work Order' }).click();
    await expect(page.getByRole('heading', { name: 'New Work Order' })).toBeVisible();

    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000106', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'T-106' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Pause Work Order' })).toBeVisible();
    await page.getByRole('button', { name: 'Add job +' }).click();
    const dialog = page.getByRole('dialog', { name: /Add job/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Job Category').selectOption({ label: 'Suspension' });
    await dialog.getByRole('button', { name: 'Add Inspect shocks' }).click();
    await expect(page.getByText('Job added.')).toBeVisible();
    await expect(page.getByText('Inspect shocks').first()).toBeVisible();
  });

  test('Admin without manage cannot see Create', async ({ page }) => {
    await devLogin(page, 'ibrain@ltransl.com');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.getByRole('link', { name: 'Work Orders' }).first().click();
    await expect(page.getByRole('heading', { name: 'Work Orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Work Order' })).toHaveCount(0);
    await page.goto('/admin/work-orders/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/requires work_orders.manage/i)).toBeVisible();
  });
});
