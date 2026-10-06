import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

async function signInAsManager(page: Page) {
  await devLogin(page, 'manager@lightning.local');
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('shared UI consistency', () => {
  test('Admin list pages share the same header hierarchy and fit narrow screens', async ({ page }) => {
    // Six pages at four viewports each.
    test.setTimeout(120_000);
    await signInAsManager(page);

    for (const path of ['/admin', '/admin/trucks', '/admin/mechanics', '/admin/catalog', '/admin/history', '/admin/work-orders']) {
      await page.goto(path);
      // LTR-166: every page uses PageHeader (h1.page-title) and nothing is an uppercase eyebrow.
      await expect(page.locator('main header h1.page-title').first()).toBeVisible();
      expect(await page.locator('main *').evaluateAll((els) =>
        els.filter((el) => getComputedStyle(el).textTransform === 'uppercase' && el.textContent?.trim()).length)).toBe(0);
      for (const viewport of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 834, height: 1194 },
        { width: 1440, height: 1024 },
      ]) {
        await page.setViewportSize(viewport);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
    }
  });

  test('Dashboard counters name the group and its value, and say when they filter (LTR-151, stage 3)', async ({ page }) => {
    await signInAsManager(page);
    const counters = page.getByRole('region', { name: 'Filter what needs you' }).getByRole('button');
    await expect(counters).toHaveCount(4);
    for (const text of await counters.allInnerTexts()) expect(text.replace(/\s+/g, ' ')).toMatch(/^.+ \d+$/);
    await expect(counters.first()).toHaveAttribute('aria-pressed', 'false');
    await counters.first().click();
    await expect(counters.first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('Work Order detail labels job pickers, hides System Admin accounts, and uses one empty-mechanics wording (LTR-151)', async ({ page }) => {
    await signInAsManager(page);
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000106');
    // LTR-154 / D11 / Stage 5: every pending Job row carries its owner picker (search, with "Unassign").
    await page.getByRole('button', { name: 'Mechanic for Inspect brake chamber' }).click();
    const picker = page.getByTestId('mechanic-picker');
    await expect(picker.getByRole('option', { name: /Anthony/ })).toHaveCount(1);
    await expect(picker.getByRole('option', { name: /iBrain Admin/ })).toHaveCount(0);
    await expect(picker.getByRole('option', { name: /Cristian Perez/ })).toHaveCount(0);
    await expect(picker.getByRole('option', { name: 'Unassign' })).toBeVisible();
    await picker.getByRole('searchbox').or(picker.getByRole('textbox')).fill('anth');
    await expect(picker.getByRole('option', { name: /Alejandro/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox', { name: 'Select mechanic', exact: true })).toHaveCount(0);

    // Stage 5 (R1): the mechanics are not repeated in an Operational summary.
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000103');
    await expect(page.getByRole('heading', { name: 'T-103' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Operational summary' })).toHaveCount(0);
  });

  test('Return to Service says the Truck leaves Ready to Go (LTR-151)', async ({ page }) => {
    await signInAsManager(page);
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000104');
    // Stage 8 (mockup): Return to Service is the completed Work Order's Next step.
    await page.getByTestId('admin-wo-next-step').getByRole('button', { name: 'Return to Service' }).click();
    await expect(page.getByText(/The Truck leaves Ready to Go\./)).toBeVisible();
    await expect(page.getByText(/does not change Work Order status, Ready to Go/)).toHaveCount(0);
  });

  test('filter actions keep their labels on one line', async ({ page }) => {
    await signInAsManager(page);
    for (const path of ['/admin/trucks', '/admin/mechanics', '/admin/history']) {
      await page.goto(path);
      await page.setViewportSize({ width: 320, height: 568 });
      // LTR-169: lists with extra filters keep Apply in the Filters sheet on phones, like Work Orders and Yard.
      const filters = page.getByRole('search').getByRole('button', { name: /^Filters( [0-9]+)?$/ });
      const hasFilterSheet = (await filters.count()) > 0;
      if (hasFilterSheet) await filters.click();
      const scope = hasFilterSheet ? page.getByRole('dialog', { name: 'Filters' }) : page.getByRole('search');
      // LTR-189 (W6): a search-only list (Trucks) says "Search" instead of "Apply filters".
      const apply = scope.getByRole('button', { name: hasFilterSheet ? 'Apply filters' : 'Search' });
      await expect(apply).toBeVisible();
      const box = await apply.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(36);
      expect(await apply.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    }
  });

  test('Repair History keeps mileage in a deliberate metadata column', async ({ page }) => {
    await signInAsManager(page);
    await page.goto('/admin/trucks');
    await page.locator('main table tbody a').first().click();
    // Stage 4: repair history is open beside the Work Plan (with "Load more").
    const history = page.getByRole('region', { name: 'Repair history' });
    await expect(history).toBeVisible();
    // Stage 8 (mockup): the mileage sits on the Work Order's line, right-aligned, in "mi".
    await expect(history.locator('li').first().getByText(/ mi$/)).toBeVisible();
  });
});
