import { test, expect } from '@playwright/test';

/**
 * Critical mechanic flow smoke test.
 * Requires: API + web running, AUTH_DEV_BYPASS=true, DB seeded.
 */
test.describe('Mechanic P0 critical path', () => {
  test('login → home shows create CTA', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('link', { name: /Create New Work Order/i })).toBeVisible({
      timeout: 15000,
    });
  });
});
