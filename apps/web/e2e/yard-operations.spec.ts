import { expect, test, type Locator, type Page } from '@playwright/test';

const YARD_FILTERS_BUTTON = /^(Filters|Filtros)( \(\d+\))?$/;

async function yardFilterPanel(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) return dialog;
  const openFilters = page.getByRole('button', { name: YARD_FILTERS_BUTTON });
  if (await openFilters.isVisible()) {
    await openFilters.click();
    await expect(dialog).toBeVisible();
    return dialog;
  }
  return page.getByRole('search');
}

test.describe('Yard Operations Phase 1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.goto('/admin/yard-operations');
    await expect(page).toHaveURL(/\/admin\/yard-operations$/);
    await expect(page.getByRole('heading', { name: 'Yard Operations', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('shows Phase 1 unavailable boundary and real URL filters', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Yard Operations', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Phase 1 data boundary' }).click();
    await expect(page.getByText('Work location, incoming Trucks, and upcoming departures are not connected yet. This view shows maintenance readiness only — not physical yard presence or dispatch.')).toBeVisible();
    await expect(page.getByText(/in the yard|en el patio/i)).toHaveCount(0);
    await expect(page.getByText('Physical presence is not connected')).toHaveCount(0);
    await expect(page.getByText('Presence unknown')).toHaveCount(0);
    await expect(page.getByText('Incoming Trucks unavailable')).toBeVisible();
    await expect(page.getByTestId('yard-truck-card').getByText('Last reported location')).toHaveCount(0);
    await page.getByLabel('Search Work Order, Truck, category, or Mechanic').fill('Y-103');
    const filters = await yardFilterPanel(page);
    await filters.getByLabel('Phase', { exact: true }).selectOption('required_work');
    await filters.getByLabel('Blockers').selectOption('true');
    await filters.getByRole('button', { name: 'Apply filters' }).click();
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

  test('densifies filters and Kanban cards per LTR-26', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Readiness list' })).toBeVisible();
    await expect(page.getByRole('button', { name: YARD_FILTERS_BUTTON })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Readiness')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Y-101', exact: true })).toBeInViewport();

    const sheet = await yardFilterPanel(page);
    await expect(sheet.getByLabel('Readiness')).toBeVisible();
    await expect(sheet.getByLabel('Phase', { exact: true })).toBeVisible();
    await expect(sheet.getByLabel('Work Order status')).toBeVisible();
    await expect(sheet.getByLabel('Priority')).toBeVisible();
    await expect(sheet.getByLabel('Blockers')).toBeVisible();
    await sheet.getByLabel('Phase', { exact: true }).selectOption('required_work');
    await sheet.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/phase=required_work/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Filters \(1\)/ })).toBeVisible();

    await page.getByRole('button', { name: /Filters \(1\)/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Clear' }).click();
    await expect(page).not.toHaveURL(/phase=/);

    const y101 = page.getByTestId('yard-truck-card').filter({ hasText: 'Y-101' });
    await expect(y101).toBeVisible();
    await expect(y101.getByText('No open Work Order')).toBeVisible();
    await expect(y101.getByText('Needs evaluation')).toBeVisible();
    await expect(y101.getByText('Needs evaluation')).toHaveCSS('text-transform', 'none');
    await expect(y101.getByText('2024 Volvo VNL')).toBeVisible();
    await expect(y101.getByText('Time in assessment')).toHaveCount(0);
    await expect(y101.getByText('No active Work Order')).toHaveCount(0);
    await expect(y101.getByText('No mechanics assigned')).toHaveCount(0);
    await expect(y101.getByText('No blocker recorded')).toHaveCount(0);
    await expect(y101.getByText('Last reported location')).toHaveCount(0);
    await expect(y101.getByText('—')).toHaveCount(0);

    const y102 = page.getByTestId('yard-truck-card').filter({ hasText: 'Y-102' });
    await expect(y102.getByText('WO-102')).toBeVisible();
    await expect(y102.getByText('High')).toBeVisible();
    await expect(y102.getByText('Blocked')).toBeVisible();

    await y101.click();
    await expect(page).toHaveURL(/\/admin\/trucks\/.*001001/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/yard-operations/);

    for (const width of [768, 1280, 1366, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: YARD_FILTERS_BUTTON })).toBeHidden();
      const toolbar = page.getByRole('search');
      await expect(toolbar.getByLabel('Readiness')).toBeVisible();
      await expect(toolbar.getByLabel('Phase', { exact: true })).toBeVisible();
      await expect(toolbar.getByLabel('Blockers')).toBeVisible();
      await expect(toolbar.getByLabel('Work Order status')).toBeHidden();
      await expect(toolbar.getByLabel('Priority')).toBeHidden();
      await expect(page.getByRole('button', { name: /More filters/ })).toBeVisible();
      await expect(toolbar.getByRole('button', { name: 'Clear' })).toBeVisible();
      await expect(toolbar.getByRole('button', { name: 'Apply filters' })).toBeVisible();
      const box = await toolbar.boundingBox();
      expect(box?.height, `desktop toolbar wraps at ${width}px`).toBeLessThan(120);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    }

    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.getByRole('button', { name: 'More filters' }).click();
    const more = page.getByRole('dialog');
    await expect(more.getByLabel('Work Order status')).toBeVisible();
    await expect(more.getByLabel('Priority')).toBeVisible();
    await more.getByLabel('Priority').selectOption('critical');
    await more.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/priority=critical/);
    await expect(page.getByRole('button', { name: /More filters \(1\)/ })).toBeVisible();
  });
});
