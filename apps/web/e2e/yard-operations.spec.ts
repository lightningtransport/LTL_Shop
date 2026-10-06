import { YARD_DATA_BOUNDARY_COPY, type YardDataBoundaryLocale } from '@ltl-shop/shared';
import { expect, test, type Locator, type Page } from './support/test';
import { devLogin } from './support/dev-login';

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

async function openMovementTab(page: Page, name: RegExp = /^Dispatch$/) {
  await page.getByRole('tab', { name }).click();
  await expect(page).toHaveURL(/tab=movement/);
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

  test('Dispatch has its own tab; the Shop board filters live in the URL (stage 6)', async ({ page }) => {
    await openMovementTab(page);
    await expect(page.getByRole('heading', { name: 'Yard movement' })).toBeVisible();
    // UX-6-008: the time is when the app checked Dispatch (Dispatch sends no time of its own).
    await expect(page.getByTestId('yard-movement-source')).toHaveText(/^Reported by Dispatch · checked /);
    // LTR-102: external statuses are labeled as reported by Dispatch, not the Shop's Ready to Go.
    await expect(page.getByText(/^Reported by Dispatch: Truck status, expected arrivals, and departures\./)).toBeVisible();
    await expect(page.getByText(/in the yard|en el patio/i)).toHaveCount(0);
    await expect(page.getByText('Presence unknown')).toHaveCount(0);
    await expectDataBoundaryRequested();
    await expectPdBoundaryCards(page, 'en');
    await page.getByRole('tab', { name: 'Shop', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Truck, Work Order or mechanic' }).fill('Y-103');
    await expect(page).toHaveURL(/search=Y-103/, { timeout: 5_000 });
    // Stage 8 (owner decision): no "More filters"; the URL still accepts phase from links on other screens.
    await expect(page.getByRole('button', { name: /More filters/ })).toHaveCount(0);
    await page.goto('/admin/yard-operations?search=Y-103&phase=shop_work');
    await expect(page).toHaveURL(/search=Y-103/);
    await expect(page).toHaveURL(/phase=shop_work/);
    await expect(page.locator('[data-phase="shop_work"]').getByRole('link', { name: 'Y-103', exact: true })).toBeVisible();
    await expect(page.getByTestId('yard-showing')).toContainText('Showing 1 of 9 trucks');
  });

  test('quick filters apply on tap, show their counts and keep "Showing N of M" (stage 6, D6)', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Shop', exact: true })).toHaveAttribute('aria-selected', 'true');
    const quick = page.getByTestId('yard-quick-filters');
    await expect(page.getByTestId('yard-quick-all')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('yard-quick-all')).toContainText('9');
    await expect(page.getByTestId('yard-quick-high')).toContainText('2');
    await expect(page.getByTestId('yard-showing')).toContainText('9 trucks in the shop');
    await expect(page.getByTestId('yard-live')).toContainText(/Live · updated /);
    await quick.getByRole('button', { name: /High priority/ }).click();
    await expect(page).toHaveURL(/priority=high%2Ccritical/);
    await expect(page.getByTestId('yard-quick-high')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('yard-showing')).toContainText('Showing 2 of 9 trucks');
    // The quick counts stay the same while one of them is on.
    await expect(page.getByTestId('yard-quick-all')).toContainText('9');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page).not.toHaveURL(/priority=/);
  });

  test('separates the Shop from Dispatch and shows arrivals as a card signal (LTR-120)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Yard movement' })).toHaveCount(0);
    await expect(page.getByTestId('yard-data-boundary-workLocation')).toHaveCount(0);
    const card = page.getByRole('link', { name: 'Y-101', exact: true }).first();
    await expect(card.getByTestId('yard-card-dispatch')).toHaveText('Dispatch: expected in Sep 28, 2026');
    await openMovementTab(page);
    await expect(page.getByRole('tab', { name: 'Dispatch', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('yard-truck-card')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Yard movement' })).toBeVisible();
  });

  test('Dispatch is crossed with the shop: chips open the Truck and disagreements are said (D8)', async ({ page }) => {
    await openMovementTab(page);
    const status = page.getByTestId('yard-data-boundary-workLocation');
    await expect(status.getByText(/^301 Yard · 2$/)).toBeVisible();
    await expect(status.getByText('277', { exact: true })).toBeVisible();
    await expect(page.getByTestId('yard-dispatch-conflicts')).toContainText('Truck Y-103: Dispatch says Outside, but it has an open Work Order in the shop (WO-103).');
    const y103 = status.getByRole('link', { name: 'Y-103' });
    await expect(y103).toHaveAttribute('href', /\/admin\/trucks\/00000000-0000-4000-8000-000000001003\?from=/);
    await expect(y103).toHaveAttribute('data-in-shop', 'true');
    const nestedScroll = await page.getByRole('region', { name: 'Yard movement' }).evaluate((element) => (
      [...element.querySelectorAll('*')].some((node) => ['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    ));
    expect(nestedScroll).toBe(false);
    await page.getByLabel('Filter Yard movement by Truck').fill('905');
    await expect(status.getByText('905', { exact: true })).toBeVisible();
    await expect(status.getByText('277', { exact: true })).toHaveCount(0);
  });

  test('one lane per step on every width, empty steps in one line, no sideways scroll (D9)', async ({ page }) => {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 834, height: 1194 }, { width: 1440, height: 1024 }]) {
      await page.setViewportSize(viewport);
      // Stage 8 (mockup): desktop lists every step (an empty one is one line); phones hide the empty steps.
      const phases = viewport.width >= 1024
        ? ['Inspection', 'Shop Work', 'PM', 'Alignment', 'Detailing', 'Quality Check', 'Ready to close', 'Ready to Go']
        : ['Inspection', 'Shop Work', 'PM'];
      for (const phase of phases) {
        await expect(page.getByTestId('yard-lanes').getByRole('heading', { name: phase, exact: true })).toBeVisible();
      }
      if (viewport.width < 1024) await expect(page.getByText('Empty steps are hidden.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Y-101', exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${viewport.width}px`).toBe(false);
    }
    await page.setViewportSize({ width: 1440, height: 1024 });
    await expect(page.getByText('No trucks', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Load more Trucks' }).click();
    await expect(page.getByTestId('yard-lanes').getByRole('link', { name: 'Y-108', exact: true })).toBeVisible();
  });

  test('cards: Truck number, one alert line, no repeated phase badge (UX-4-005)', async ({ page }) => {
    const lanes = page.getByTestId('yard-lanes');
    const y101 = lanes.getByTestId('yard-truck-card').filter({ hasText: 'Y-101' });
    await expect(y101).toBeVisible();
    await expect(y101.getByText('No open Work Order')).toBeVisible();
    // The step is the lane; the card does not repeat it.
    await expect(y101.getByText('Inspection')).toHaveCount(0);
    await expect(y101.getByText('2024 Volvo VNL')).toBeVisible();
    await expect(y101.getByText('Last reported location')).toHaveCount(0);

    const y102 = lanes.getByTestId('yard-truck-card').filter({ hasText: 'Y-102' });
    await expect(y102.getByText(/WO-102/)).toBeVisible();
    await expect(y102.getByText('High')).toBeVisible();
    // LTR-92 / D5: an open (not paused, not blocked) Work Order is not Blocked.
    await expect(y102.getByText(/Blocked/)).toHaveCount(0);
    await expect(y102.getByText('2024 PETERBILT 579')).toBeVisible();

    await expect(async () => {
      if (!/\/admin\/trucks\/.*001001/.test(page.url())) await y101.click({ timeout: 2_000 });
      await expect(page).toHaveURL(/\/admin\/trucks\/.*001001/, { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/yard-operations/);

    // Stage 8: "Leaving soon" is a quick filter; it stays in the URL like the others.
    await page.getByTestId('yard-quick-soon').click();
    await expect(page).toHaveURL(/soon=true/);
    await expect(page.getByTestId('yard-quick-soon')).toHaveAttribute('aria-pressed', 'true');
  });

  test('does not clip Yard search or data-boundary labels at 390 and desktop', async ({ page }) => {
    async function assertLabelUnclipped(locator: Locator, label: string, width: number) {
      await expect(locator).toBeVisible();
      const clipped = await locator.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(clipped, `${label} clips at ${width}px`).toBe(false);
    }

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const search = page.getByRole('searchbox', { name: 'Truck, Work Order or mechanic' });
      await expect(search).toBeVisible();
      const searchClipped = await search.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(searchClipped, `search field clips at ${width}px`).toBe(false);
      await page.getByRole('tab', { name: 'Dispatch', exact: true }).click();

      const copy = YARD_DATA_BOUNDARY_COPY.en;
      const workLocation = page.getByTestId('yard-data-boundary-workLocation').getByText(copy.workLocation.label, { exact: true });
      const incoming = page.getByTestId('yard-data-boundary-incomingTrucks').getByText(copy.incomingTrucks.label, { exact: true });
      const departures = page.getByTestId('yard-data-boundary-upcomingDepartures').getByText(copy.upcomingDepartures.label, { exact: true });
      await assertLabelUnclipped(workLocation, 'Dispatch status', width);
      await assertLabelUnclipped(incoming, 'Incoming Trucks', width);
      await assertLabelUnclipped(departures, 'Upcoming Departures', width);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
      await page.getByRole('tab', { name: 'Shop', exact: true }).click();
    }
  });

  test('renders ES yard movement copy without claiming GPS presence', async ({ page }) => {
    const cookieUrl = `${new URL(page.url()).origin}/`;
    await page.context().addCookies([{ name: 'ltl_shop_locale', value: 'es', url: cookieUrl }]);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Operaciones del patio', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Taller', exact: true })).toBeVisible();
    await openMovementTab(page, /^Dispatch$/);
    await expect(page.getByRole('heading', { name: 'Movimiento del yard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'En taller / en el yard' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Llegadas de Trucks' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Próximas salidas' })).toHaveCount(0);
    await expectDataBoundaryRequested();
    await expectPdBoundaryCards(page, 'es');
    await expect(page.getByText(/en el patio/i)).toHaveCount(0);
  });
});
