import { YARD_DATA_BOUNDARY_COPY, type YardDataBoundaryLocale } from '@ltl-shop/shared';
import { expect, test, type Locator, type Page } from './support/test';
import { devLogin } from './support/dev-login';

const YARD_FILTERS_BUTTON = /^(Filters|Filtros)( \(\d+\))?$/;
const DATA_BOUNDARY_PATH = '/api/admin/yard/data-boundary';

let yardDataBoundaryRequests: string[] = [];

function isYardDataBoundaryRequest(url: string) {
  try {
    return new URL(url).pathname === DATA_BOUNDARY_PATH;
  } catch {
    return url.includes(DATA_BOUNDARY_PATH);
  }
}

async function expectDataBoundaryRequested() {
  await expect.poll(() => yardDataBoundaryRequests.length, { timeout: 15_000 }).toBeGreaterThan(0);
  for (const url of yardDataBoundaryRequests) {
    expect(url).not.toMatch(/agent-reporting|x-agent-key/i);
  }
}

async function expectPdBoundaryCards(page: Page, locale: YardDataBoundaryLocale) {
  const copy = YARD_DATA_BOUNDARY_COPY[locale];
  const cards = [
    ['yard-data-boundary-workLocation', copy.workLocation],
    ['yard-data-boundary-incomingTrucks', copy.incomingTrucks],
    ['yard-data-boundary-upcomingDepartures', copy.upcomingDepartures],
  ] as const;

  for (const [testId, card] of cards) {
    const region = page.getByTestId(testId);
    await expect(region).toBeVisible();
    await expect(region.getByText(card.label, { exact: true })).toBeVisible();
    await expect(region).not.toHaveAttribute('data-kind', 'loading');
    const kind = await region.getAttribute('data-kind');
    if (kind === 'unavailable') {
      await expect(region.getByText(copy.badge, { exact: true })).toBeVisible();
      await expect(region.getByText(copy.unavailable, { exact: true })).toBeVisible();
    } else if (kind === 'empty') {
      await expect(region.getByText(card.empty, { exact: true })).toBeVisible();
    } else {
      expect(kind, `${testId} kind`).toBe('ok');
    }
  }
}

async function openMovementTab(page: Page, name: RegExp = /^Movement \(Dispatch\)$/) {
  await page.getByRole('tab', { name }).click();
  await expect(page).toHaveURL(/tab=movement/);
}

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
    yardDataBoundaryRequests = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') return;
      const url = request.url();
      if (isYardDataBoundaryRequest(url) || /agent-reporting|x-agent-key/i.test(url)) {
        yardDataBoundaryRequests.push(url);
      }
    });
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.goto('/admin/yard-operations');
    await expect(page).toHaveURL(/\/admin\/yard-operations$/);
    await expect(page.getByRole('heading', { name: 'Yard Operations', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('shows yard movement feeds and real URL filters', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Yard Operations', exact: true })).toBeVisible();
    await openMovementTab(page);
    await expect(page.getByRole('heading', { name: 'Yard movement' })).toBeVisible();
    await expect(page.getByTestId('yard-movement-source')).toHaveText(/^Source: Dispatch · Updated /);
    // LTR-102: external statuses are labeled as reported by Dispatch, not the Shop's Ready to Go.
    await expect(page.getByText(/^Reported by Dispatch: Truck status, expected arrivals, and departures\./)).toBeVisible();
    await expect(page.getByText(/in the yard|en el patio/i)).toHaveCount(0);
    await expect(page.getByText('Physical presence is not connected')).toHaveCount(0);
    await expect(page.getByText('Presence unknown')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'In shop / at yard' })).toHaveCount(0);
    await expectDataBoundaryRequested();
    await expectPdBoundaryCards(page, 'en');
    await page.getByRole('tab', { name: 'Shop readiness' }).click();
    await expect(page.getByTestId('yard-truck-card').getByText('Last reported location')).toHaveCount(0);
    await page.getByLabel('Search Truck or Work Order').fill('Y-103');
    await expect(page).toHaveURL(/search=Y-103/, { timeout: 5_000 });
    const filters = await yardFilterPanel(page);
    await filters.getByLabel('Phase', { exact: true }).selectOption('shop_work');
    await filters.getByLabel('Blockers').selectOption('true');
    await filters.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/search=Y-103/);
    await expect(page).toHaveURL(/phase=shop_work/);
    await expect(page).toHaveURL(/blocked=true/);
    await expect(page.getByLabel('Readiness list').getByRole('link', { name: 'Y-103', exact: true })).toBeVisible();
  });

  test('separates Shop readiness from Dispatch movement and shows arrivals as a card signal (LTR-120)', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Shop readiness' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Yard movement' })).toHaveCount(0);
    await expect(page.getByTestId('yard-data-boundary-workLocation')).toHaveCount(0);
    const card = page.getByRole('link', { name: 'Y-101', exact: true }).first();
    await expect(card.getByTestId('yard-card-dispatch')).toHaveText('Dispatch: expected in Sep 28, 2026');
    await openMovementTab(page);
    await expect(page.getByRole('tab', { name: /^Movement \(Dispatch\)$/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('yard-truck-card')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Yard movement' })).toBeVisible();
  });

  test('groups Dispatch status without nested scroll and filters Yard movement by Truck (LTR-102, LTR-103)', async ({ page }) => {
    await openMovementTab(page);
    const status = page.getByTestId('yard-data-boundary-workLocation');
    await expect(status.getByText(/^301 Yard · 2$/)).toBeVisible();
    await expect(status.getByText('277', { exact: true })).toBeVisible();
    await expect(status.getByText('905', { exact: true })).toBeVisible();
    const nestedScroll = await page.getByRole('region', { name: 'Yard movement' }).evaluate((element) => (
      [...element.querySelectorAll('*')].some((node) => ['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    ));
    expect(nestedScroll).toBe(false);
    await page.getByLabel('Filter Yard movement by Truck').fill('905');
    await expect(status.getByText('905', { exact: true })).toBeVisible();
    await expect(status.getByText('277', { exact: true })).toHaveCount(0);
  });

  test('uses grouped list on mobile and tablet without compressing the board', async ({ page }) => {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 834, height: 1194 }]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('heading', { name: 'Readiness list' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Readiness board' })).toBeHidden();
      await expect(page.getByRole('link', { name: 'Y-101', exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${viewport.width}px`).toBe(false);
    }
  });

  test('shows all derived phases in the desktop board and paginates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await expect(page.getByRole('heading', { name: 'Readiness board' })).toBeVisible();
    for (const phase of ['Inspection', 'Shop Work', 'PM', 'Alignment', 'Detailing', 'Quality Check', 'Ready to close WO', 'Ready to Go']) {
      await expect(page.getByRole('heading', { name: phase, exact: true })).toBeVisible();
    }
    await expect(page.getByText('No Trucks in this phase.').first()).toBeVisible();
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
    await expect(page.getByRole('search').getByLabel('Readiness', { exact: true })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Y-101', exact: true })).toBeInViewport();

    const sheet = await yardFilterPanel(page);
    await expect(sheet.getByLabel('Readiness', { exact: true })).toBeVisible();
    await expect(sheet.getByLabel('Phase', { exact: true })).toBeVisible();
    await expect(sheet.getByLabel('Work Order status')).toBeVisible();
    await expect(sheet.getByLabel('Priority')).toBeVisible();
    await expect(sheet.getByLabel('Blockers')).toBeVisible();
    await sheet.getByLabel('Phase', { exact: true }).selectOption('shop_work');
    await sheet.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/phase=shop_work/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Filters \(1\)/ })).toBeVisible();

    await page.getByRole('button', { name: /Filters \(1\)/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Clear' }).click();
    await expect(page).not.toHaveURL(/phase=/);

    const list = page.getByLabel('Readiness list');
    const y101 = list.getByTestId('yard-truck-card').filter({ hasText: 'Y-101' });
    await expect(y101).toBeVisible();
    await expect(y101.getByText('No open Work Order')).toBeVisible();
    await expect(y101.getByText('Inspection')).toBeVisible();
    await expect(y101.getByText('Inspection')).toHaveCSS('text-transform', 'none');
    await expect(y101.getByText('2024 Volvo VNL')).toBeVisible();
    await expect(y101.getByText('Time in assessment')).toHaveCount(0);
    await expect(y101.getByText('No active Work Order')).toHaveCount(0);
    await expect(y101.getByText('No mechanics assigned')).toHaveCount(0);
    await expect(y101.getByText('No blocker recorded')).toHaveCount(0);
    await expect(y101.getByText('Last reported location')).toHaveCount(0);
    await expect(y101.getByText('—')).toHaveCount(0);

    const y102 = list.getByTestId('yard-truck-card').filter({ hasText: 'Y-102' });
    await expect(y102.getByText('WO-102')).toBeVisible();
    await expect(y102.getByText('High')).toBeVisible();
    // LTR-92 / D5: an open (not officially paused) Work Order is not Blocked.
    await expect(y102.getByText('Blocked')).toHaveCount(0);
    await expect(y102.getByText('2024 PETERBILT 579')).toBeVisible();
    await expect(y102.getByText(/PETERBILT PETERBILT/i)).toHaveCount(0);

    await y101.click();
    await expect(page).toHaveURL(/\/admin\/trucks\/.*001001/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/yard-operations/);

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.getByRole('button', { name: YARD_FILTERS_BUTTON })).toBeVisible();
    await expect(page.getByRole('search').getByLabel('Readiness', { exact: true })).toBeHidden();

    for (const width of [1280, 1366, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: YARD_FILTERS_BUTTON })).toBeHidden();
      const toolbar = page.getByRole('search');
      await expect(toolbar.getByLabel('Readiness', { exact: true })).toBeVisible();
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

  test('does not clip Yard search or data-boundary labels at 390 and desktop', async ({ page }) => {
    async function assertLabelUnclipped(locator: Locator, label: string, width: number) {
      await expect(locator).toBeVisible();
      const clipped = await locator.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(clipped, `${label} clips at ${width}px`).toBe(false);
    }

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const search = page.getByRole('searchbox', { name: 'Search Truck or Work Order' });
      await expect(search).toBeVisible();
      const searchClipped = await search.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(searchClipped, `search field clips at ${width}px`).toBe(false);
      await page.getByRole('tab', { name: /^Movement \(Dispatch\)$/ }).click();

      const copy = YARD_DATA_BOUNDARY_COPY.en;
      const workLocation = page.getByTestId('yard-data-boundary-workLocation').getByText(copy.workLocation.label, { exact: true });
      const incoming = page.getByTestId('yard-data-boundary-incomingTrucks').getByText(copy.incomingTrucks.label, { exact: true });
      const departures = page.getByTestId('yard-data-boundary-upcomingDepartures').getByText(copy.upcomingDepartures.label, { exact: true });
      await assertLabelUnclipped(workLocation, 'Dispatch status', width);
      await assertLabelUnclipped(incoming, 'Incoming Trucks', width);
      await assertLabelUnclipped(departures, 'Upcoming Departures', width);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
      await page.getByRole('tab', { name: 'Shop readiness' }).click();
    }
  });

  test('renders ES yard movement copy without claiming GPS presence', async ({ page }) => {
    const cookieUrl = `${new URL(page.url()).origin}/`;
    await page.context().addCookies([{ name: 'ltl_shop_locale', value: 'es', url: cookieUrl }]);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Operaciones del patio', exact: true })).toBeVisible();
    await openMovementTab(page, /^Movimiento \(Dispatch\)$/);
    await expect(page.getByRole('heading', { name: 'Movimiento del yard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'En taller / en el yard' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Llegadas de Trucks' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Próximas salidas' })).toHaveCount(0);
    await expectDataBoundaryRequested();
    await expectPdBoundaryCards(page, 'es');
    await expect(page.getByText(/en el patio/i)).toHaveCount(0);
  });
});
