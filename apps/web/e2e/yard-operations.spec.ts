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
  await expect(page).toHaveURL(/tab=dispatch/);
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
    await expect(page.getByTestId('yard-movement-source')).toHaveText(/^Dispatch checked /);
    // LTR-102: external statuses are labeled as reported by Dispatch, not the Shop's Ready to Go.
    await expect(page.getByText(/^The week Dispatch planned\./)).toBeVisible();
    await expect(page.getByText(/in the yard|en el patio/i)).toHaveCount(0);
    await expect(page.getByText('Presence unknown')).toHaveCount(0);
    await expectDataBoundaryRequested();
    await expectPdBoundaryCards(page, 'en');
    await page.getByRole('tab', { name: 'Shop', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search by truck, Work Order or mechanic' }).fill('Y-103');
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
    // LTR-277 §10: on a touch phone each tab is at least 44×44 (Shop was 34 px wide).
    for (const name of ['Shop', 'Dispatch']) {
      const box = await page.getByRole('tab', { name, exact: true }).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
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
    await expect(card.getByTestId('yard-card-dispatch')).toHaveText('Dispatch: expected Sep 28, 2026');
    await openMovementTab(page);
    await expect(page.getByRole('tab', { name: 'Dispatch', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('yard-truck-card')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Yard movement' })).toBeVisible();
  });

  test('D51: Dispatch plans the week by day — what asks for action first; Samsara counters sit above the Shop board', async ({ page }) => {
    // The Shop board: Samsara counters open Trucks filtered; Dispatch's disagreement is one line.
    const counters = page.getByTestId('yard-samsara-counters');
    await expect(counters.getByTestId('yard-counter-in_shop')).toContainText('1In shop');
    await expect(counters.getByTestId('yard-counter-in_yard_no_wo')).toHaveAttribute('href', '/admin/trucks?place=in_yard_no_wo');
    await counters.getByText('Dispatch says otherwise for 1 truck').click();
    await expect(counters.getByTestId('yard-dispatch-disagrees')).toContainText('Y-105 · Dispatch: 301 Yard · Samsara: outside');

    await openMovementTab(page);
    await expect(page.getByText(/^The week Dispatch planned\./)).toBeVisible();
    await expect(page.getByTestId('yard-data-boundary-workLocation')).toHaveCount(0);
    const incoming = page.getByTestId('yard-data-boundary-incomingTrucks');
    await expect(incoming.getByTestId('yard-need-wo-count')).toHaveText('1 needs a Work Order');
    const days = incoming.getByTestId('yard-day');
    await expect(days).toHaveCount(3);
    // The first day is open: 277 is not in the app and can be added from Samsara.
    await expect(days.nth(0).getByTestId('yard-not-in-app')).toHaveText('Not in Shop app');
    await days.nth(1).locator('summary').click();
    await days.nth(1).getByTestId('yard-add-from-samsara').click();
    const dialog = page.getByTestId('add-from-samsara-dialog');
    await expect(dialog).toContainText('1XKYD49X0RJ000975');
    await dialog.getByRole('button', { name: 'Add truck 975' }).click();
    await expect(page.getByText('Truck 975 added and connected to Samsara.')).toBeVisible();

    // Sep 28: Y-101 arrived without a Work Order comes first, with Create WO; Y-103 has not arrived.
    await days.nth(2).locator('summary').click();
    const rows = days.nth(2).getByTestId('yard-movement-row');
    await expect(rows.nth(0)).toContainText('Y-101');
    await expect(rows.nth(0).getByTestId('yard-needs-wo')).toHaveText('Needs a Work Order');
    await expect(rows.nth(1)).toContainText(/Y-103.*Not here yet.*No GPS/);
    await expect(days.nth(2).locator('summary')).toContainText('1 here · 1 still coming');
    await rows.nth(0).getByTestId('yard-create-wo').click();
    await expect(page.getByRole('dialog')).toContainText('Y-101');
    await page.keyboard.press('Escape');

    const leaving = page.getByTestId('yard-data-boundary-upcomingDepartures');
    await expect(leaving.getByTestId('yard-not-ready-count')).toHaveText('2 not ready');
    await expect(leaving.getByTestId('yard-day').nth(0).getByTestId('yard-movement-row')).toContainText(/Left ·.*Monat Global/);
    await leaving.getByTestId('yard-day').nth(1).locator('summary').click();
    await expect(leaving.getByTestId('yard-day').nth(1).getByTestId('yard-not-ready').first()).toHaveText('Not ready · 3 Jobs left');

    const nestedScroll = await page.getByRole('region', { name: 'Yard movement' }).evaluate((element) => (
      [...element.querySelectorAll('*')].some((node) => ['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    ));
    expect(nestedScroll).toBe(false);
    await page.screenshot({ path: 'test-results/d51-dispatch.png', fullPage: true });
  });

  test('Kanban: one column per step on desktop, a foldable list on phones, the page never scrolls sideways (D33)', async ({ page }) => {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 834, height: 1194 }, { width: 1440, height: 1024 }]) {
      await page.setViewportSize(viewport);
      // D33: desktop shows every step as a list, an empty one too; phones hide the empty steps.
      const phases = viewport.width >= 1024
        ? ['Inspection', 'PM', 'Alignment', 'Shop Work', 'Detailing', 'Quality Check', 'Ready to close', 'Ready to Go']
        : ['Inspection', 'PM', 'Shop Work'];
      for (const phase of phases) {
        await expect(page.getByTestId('yard-lanes').getByRole('heading', { name: phase, exact: true })).toBeVisible();
      }
      if (viewport.width < 1024) await expect(page.getByText('Empty steps are hidden.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Y-101', exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${viewport.width}px`).toBe(false);
    }
    await page.setViewportSize({ width: 1440, height: 1024 });
    // An empty step is a list like the others (title on top) that says so; the lists sit side by side.
    await expect(page.getByTestId('yard-lanes').getByText('No trucks', { exact: true }).first()).toBeVisible();
    const inspection = await page.locator('[data-phase="inspection"]').boundingBox();
    const shopWork = await page.locator('[data-phase="shop_work"]').boundingBox();
    expect(shopWork!.x).toBeGreaterThan(inspection!.x);
    expect(Math.abs(shopWork!.y - inspection!.y)).toBeLessThan(2);
    await page.getByRole('button', { name: 'Load more Trucks' }).click();
    await expect(page.getByTestId('yard-lanes').getByRole('link', { name: 'Y-108', exact: true })).toBeVisible();
  });

  test('Full screen opens the board alone in a new tab with the same filters; the app stays here (LTR-228)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.getByTestId('yard-quick-high').click();
    await expect(page).toHaveURL(/priority=/);
    const popupPromise = page.context().waitForEvent('page');
    await page.getByTestId('kanban-fullscreen').click();
    const board = await popupPromise;
    await board.waitForLoadState();
    expect(board.url()).toMatch(/display=board/);
    expect(board.url()).toMatch(/priority=/);
    // The first tab keeps the app as it was.
    await expect(page.locator('#yard-panel-shop')).not.toHaveAttribute('data-board-view', 'true');
    // The new tab: only the board, covering the whole window (no menu), with search and filters working.
    await board.setViewportSize({ width: 1440, height: 1024 });
    const panel = board.locator('#yard-panel-shop');
    await expect(panel).toHaveAttribute('data-board-view', 'true');
    expect(await panel.boundingBox()).toMatchObject({ x: 0, y: 0, width: 1440 });
    await expect(board.getByTestId('yard-quick-high')).toHaveAttribute('aria-pressed', 'true');
    await expect(board.getByTestId('kanban-fullscreen')).toHaveCount(0);
    await board.getByTestId('yard-quick-all').click();
    await expect(board).toHaveURL(/display=board/);
    await expect(board.getByTestId('yard-lanes').getByRole('link', { name: 'Y-101', exact: true })).toBeVisible();
    await board.close();
  });

  test('the Full screen tab fits a TV: every step side by side, every truck, compact cards in a full list (D53)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/admin/yard-operations?display=board');
    const lanes = page.getByTestId('yard-lanes');
    await expect(lanes).toHaveAttribute('data-fit', 'true');
    // Every truck, without "Load more" (nobody taps a TV).
    await expect(lanes.getByRole('link', { name: 'Y-108', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load more Trucks' })).toHaveCount(0);
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport);
      expect(await lanes.evaluate((element) => element.scrollWidth <= element.clientWidth), `sideways scroll at ${viewport.width}px`).toBe(true);
      const last = await page.locator('[data-phase="ready_to_go"]').boundingBox();
      expect(last!.x + last!.width).toBeLessThanOrEqual(viewport.width);
      await expect(page.locator('[data-phase][data-compact]')).toHaveCount(0);
    }
    // A short screen: the list whose cards don't fit turns compact, and nothing needs scrolling down.
    await page.setViewportSize({ width: 1280, height: 380 });
    await expect(page.locator('[data-phase="inspection"]')).toHaveAttribute('data-compact', 'true');
    const overflowing = await lanes.evaluate((element) => [...element.querySelectorAll<HTMLElement>(':scope > [data-phase]')]
      .filter((column) => {
        const body = column.lastElementChild as HTMLElement;
        return body.scrollHeight > body.clientHeight + 1;
      })
      .map((column) => column.dataset.phase));
    expect(overflowing).toEqual([]);
    // Room again: normal cards.
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('[data-phase][data-compact]')).toHaveCount(0);
    // The Yard inside the app keeps its Trello lists that scroll sideways (D33).
    await page.goto('/admin/yard-operations');
    await expect(page.getByTestId('yard-lanes')).not.toHaveAttribute('data-fit', 'true');
  });

  test('a mouse drags the empty board sideways; a drag that starts on a card does not (LTR-227)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    const lanes = page.getByTestId('yard-lanes');
    await expect(lanes.getByRole('link', { name: 'Y-101', exact: true })).toBeVisible();
    const scrollLeft = () => lanes.evaluate((element) => element.scrollLeft);
    expect(await lanes.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    // A drag from a card leaves the board where it is.
    const card = await lanes.getByTestId('yard-truck-card').first().boundingBox();
    await page.mouse.move(card!.x + 20, card!.y + 10);
    await page.mouse.down();
    await page.mouse.move(card!.x - 200, card!.y + 10, { steps: 5 });
    await page.mouse.up();
    expect(await scrollLeft()).toBe(0);
    // A drag from an empty list's background moves the board left.
    const empty = await lanes.getByText('No trucks', { exact: true }).first().boundingBox();
    await page.mouse.move(empty!.x + 40, empty!.y + 40);
    await page.mouse.down();
    await page.mouse.move(empty!.x - 260, empty!.y + 40, { steps: 8 });
    await page.mouse.up();
    expect(await scrollLeft()).toBeGreaterThan(200);
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
      const search = page.getByRole('searchbox', { name: 'Search by truck, Work Order or mechanic' });
      await expect(search).toBeVisible();
      const searchClipped = await search.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
      expect(searchClipped, `search field clips at ${width}px`).toBe(false);
      await page.getByRole('tab', { name: 'Dispatch', exact: true }).click();

      const copy = YARD_DATA_BOUNDARY_COPY.en;
      const incoming = page.getByTestId('yard-data-boundary-incomingTrucks').getByText(copy.incomingTrucks.label, { exact: true });
      const departures = page.getByTestId('yard-data-boundary-upcomingDepartures').getByText(copy.upcomingDepartures.label, { exact: true });
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
    await expect(page.getByRole('heading', { name: 'Patio', exact: true })).toBeVisible();
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
