import { expect, test } from '@playwright/test';

test.describe('Shop Admin Phase 2A', () => {
  test('unauthenticated requests are redirected to the shared login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test('manager login opens the responsive Admin shell in EN and ES', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();
    await expect(page.getByText('Current operations from Supabase PostgreSQL')).toBeVisible();
    await expect(page.getByText('Open Work Orders').first()).toBeVisible();

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 834, height: 1194 },
      { width: 1440, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    }

    await page.getByRole('button', { name: /Language: English/ }).click();
    await expect(page.getByRole('heading', { name: 'Operaciones del Shop' })).toBeVisible();
    await expect(page.getByText('Operación actual desde Supabase PostgreSQL')).toBeVisible();
  });

  test('manager navigates Dashboard to filtered list, pagination, and read-only detail', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await page.getByRole('link', { name: 'Work Orders' }).first().click();
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await expect(page.getByRole('heading', { name: 'Work Orders' })).toBeVisible();
    await page.getByLabel('Status').selectOption('waiting_paused');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/status=waiting_paused/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('WO-0101').first()).toBeVisible();
    await page.getByText('WO-0101').first().click();
    await expect(page.getByRole('heading', { name: 'WO-0101' })).toBeVisible();
    await expect(page.getByText('Read only')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 700 });
    const content = page.locator('#main-content main');
    await expect(content).toHaveCSS('overflow-y', 'auto');
    await content.evaluate((element) => { element.scrollTop = 500; });
    await expect(page.getByRole('banner', { name: 'Shop Admin controls' })).toBeInViewport();
    await expect(page.getByRole('complementary', { name: 'Shop Admin navigation' })).toBeInViewport();
  });

  test('admin role can load dashboard and pagination completes', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();
    await page.getByRole('link', { name: 'Work Orders' }).first().click();
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.getByText('WO-0103').first()).toBeVisible();
  });

  for (const email of ['ibrain@ltransl.com', 'cristian240588@hotmail.com']) {
    test(`${email} opens Standard and PM without signing in again`, async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByRole('button', { name: /Dev Login/i }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();

      await page.getByRole('link', { name: 'Open Standard Mechanic' }).click();
      await expect(page).toHaveURL(/\/mechanic\/standard$/);
      await expect(page.getByRole('heading', { name: 'Standard Mechanic' })).toBeVisible();
      await page.getByRole('link', { name: 'Back to Shop Admin' }).click();

      await page.getByRole('button', { name: /Language: English/ }).click();
      await expect(page.getByRole('heading', { name: 'Espacios de trabajo' })).toBeVisible();
      await page.getByRole('link', { name: 'Abrir Mecánico PM' }).click();
      await expect(page).toHaveURL(/\/mechanic\/pm$/);
      await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to Shop Admin' })).toBeVisible();
    });
  }

  test('mechanic receives a secure forbidden screen for direct Admin access', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'Standard Mechanic' })).toBeVisible();
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: 'Shop Admin access denied' })).toBeVisible();
  });
});
