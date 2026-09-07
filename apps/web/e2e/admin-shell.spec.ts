import { expect, test } from '@playwright/test';

test.describe('Shop Admin Phase 1', () => {
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

    for (const viewport of [
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
  });

  test('mechanic receives a secure forbidden screen for direct Admin access', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: 'Shop Admin access denied' })).toBeVisible();
  });
});
