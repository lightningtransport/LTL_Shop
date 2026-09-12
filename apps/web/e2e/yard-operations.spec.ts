import { expect, test } from '@playwright/test';

test.describe('Yard Operations Phase 1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'Yard Operations' }).first().click();
    await expect(page).toHaveURL(/\/admin\/yard-operations$/);
  });

  test('shows Phase 1 unavailable boundary and real URL filters', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Yard Operations', exact: true })).toBeVisible();
    await expect(page.getByText('Physical presence is not connected')).toHaveCount(0);
    await expect(page.getByText('Presence unknown')).toHaveCount(0);
    await expect(page.getByText('Last reported location').first()).toBeVisible();
    await expect(page.getByText('Incoming Trucks unavailable')).toBeVisible();
    await page.getByLabel('Search Work Order, Truck, category, or Mechanic').fill('Y-103');
    await page.getByLabel('Phase', { exact: true }).selectOption('required_work');
    await page.getByLabel('Blockers').selectOption('true');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/search=Y-103/);
    await expect(page).toHaveURL(/phase=required_work/);
    await expect(page).toHaveURL(/blocked=true/);
    await expect(page.getByLabel('Readiness list').getByRole('link', { name: 'Y-103', exact: true })).toBeVisible();
  });

  test('uses grouped list on mobile and tablet without compressing the board', async ({ page }) => {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 834, height: 1194 }]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('heading', { name: 'Readiness list' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Readiness board' })).toBeHidden();
      await expect(page.getByRole('link', { name: 'Y-101', exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    }
  });

  test('shows all derived phases in the desktop board and paginates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await expect(page.getByRole('heading', { name: 'Readiness board' })).toBeVisible();
    for (const phase of ['Needs evaluation', 'Inspection', 'Required Work', 'PM', 'Alignment', 'Detailing', 'Quality Check', 'Ready for Approval', 'Ready to Go']) {
      await expect(page.getByRole('heading', { name: phase, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page).toHaveURL(/view=list/);
    await expect(page.getByRole('heading', { name: 'Readiness list' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Readiness board' })).toBeHidden();
    await page.getByRole('button', { name: 'Board' }).click();
    await expect(page).not.toHaveURL(/view=list/);
    await expect(page.getByRole('heading', { name: 'Readiness board' })).toBeVisible();
    await page.getByRole('button', { name: 'Load more Trucks' }).click();
    await expect(page.getByLabel('Readiness board').getByRole('link', { name: 'Y-108', exact: true })).toBeVisible();
  });
});
