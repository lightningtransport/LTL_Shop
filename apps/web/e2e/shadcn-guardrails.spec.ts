import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const canonicalViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

async function expectAccessiblePage(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(
    results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')),
  ).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
}

async function signInAsManager(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('manager@lightning.local');
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('shadcn accessibility and overflow baseline', () => {
  test('login is accessible and fits canonical viewports', async ({ page }) => {
    await page.goto('/login');

    for (const viewport of canonicalViewports) {
      await page.setViewportSize(viewport);
      await expectNoHorizontalOverflow(page);
    }
    await expectAccessiblePage(page);
  });

  test('canonical Admin routes are accessible and fit canonical viewports', async ({ page }) => {
    await signInAsManager(page);

    for (const path of ['/admin', '/admin/work-orders', '/admin/trucks']) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      for (const viewport of canonicalViewports) {
        await page.setViewportSize(viewport);
        await expectNoHorizontalOverflow(page);
      }
      await expectAccessiblePage(page);
    }
  });
});
