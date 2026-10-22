import { expect, test, type Locator, type Page } from './support/test';
import { devLogin, waitForLoginForm } from './support/dev-login';
import { switchLanguage } from './support/locale';

const WORK_ORDER_FILTERS_BUTTON = /^(Filters|Filtros)( \(\d+\))?$/;

async function workOrderFilterPanel(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) return dialog;
  const openFilters = page.getByRole('button', { name: WORK_ORDER_FILTERS_BUTTON });
  if (await openFilters.isVisible()) {
    await openFilters.click();
    await expect(dialog).toBeVisible();
    return dialog;
  }
  return page.getByRole('search');
}

// Mobile projects keep Admin links in the navigation sheet; Dashboard metric
// cards also contain "Work Orders", so match the sheet link exactly.
async function openAdminNavLink(page: Page, name: string) {
  await page.getByRole('button', { name: 'Open Shop Admin navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Shop Admin mobile navigation' })
    .getByRole('link', { name, exact: true })
    .click();
}

test.describe('Shop Admin Phase 2A', () => {
  test('mechanic shell uses shared safe-area tokens under viewport-fit=cover', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);

    const mechanicShell = page.locator('#main-content');
    await expect(mechanicShell).toHaveClass(/app-shell/);
    expect(await mechanicShell.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('24px');

    await page.addStyleTag({ content: ':root { --app-safe-top: 59px; --app-safe-bottom: 48px; }' });
    // LTR-167: 1rem below the status bar, so iOS does not blur the first line in the installed app.
    await expect.poll(async () => mechanicShell.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('75px');
    await expect.poll(async () => mechanicShell.evaluate((element) => getComputedStyle(element).paddingBottom)).toBe('48px');
  });

  test('Admin sticky header and bottom sheet honor shared safe-area tokens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);

    const header = page.getByRole('banner', { name: 'Shop Admin controls' });
    await expect(header).toBeVisible();
    expect(await header.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('0px');

    await page.setViewportSize({ width: 1440, height: 1024 });
    expect(await header.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('0px');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({ content: ':root { --app-safe-top: 59px; --app-safe-bottom: 48px; }' });
    const menu = page.getByRole('button', { name: 'Open Shop Admin navigation' });
    // Stage 8 (mockups): the brand is in the sidebar; the top bar carries the breadcrumb.
    const logo = header.getByTestId('admin-breadcrumb');
    const profile = page.getByRole('button', { name: /Open profile for / });

    await expect.poll(async () => header.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('59px');
    const menuBox = await menu.boundingBox();
    const logoBox = await logo.boundingBox();
    const profileBox = await profile.boundingBox();
    expect(menuBox?.y).toBeGreaterThanOrEqual(59);
    expect(logoBox?.y).toBeGreaterThanOrEqual(59);
    expect(profileBox?.y).toBeGreaterThanOrEqual(59);
    expect(menuBox?.height).toBeGreaterThanOrEqual(44);
    expect(profileBox?.height).toBeGreaterThanOrEqual(44);

    await menu.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const dialogPaddingBottom = Number.parseFloat(await dialog.evaluate((element) => getComputedStyle(element).paddingBottom));
    expect(dialogPaddingBottom).toBeGreaterThanOrEqual(20 + 48);
    await page.getByRole('button', { name: 'Close Shop Admin navigation' }).click();
  });

  test('login landmark does not show a focus ring while controls keep focus styles', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#main-content').focus();
    await expect(page.locator('#main-content')).toHaveCSS('outline-style', 'none');
    await page.getByLabel('Email').focus();
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByLabel('Email')).toHaveCSS('outline-style', 'solid');
  });

  test('unauthenticated requests are redirected to the shared login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test('manager login opens the responsive Admin shell in EN and ES', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('What needs you now, in order.')).toBeVisible();
    await expect(page.getByText(/^Live · updated /)).toHaveCount(1);
    await expect(page.getByText(/supabase|postgres|Source:|Generated/i)).toHaveCount(0);
    // Stage 3: four counters, one queue grouped by the action; history counts are links.
    await expect(page.getByTestId('dashboard-counter-blocked')).toBeVisible();
    await expect(page.getByRole('link', { name: /open Work Orders$/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Needs you/ })).toBeVisible();
    await expect(page.getByTestId('dashboard-group-close')).toContainText('Closing makes the truck Ready to Go.');
    await page.getByRole('link', { name: 'WO-0102' }).first().click();
    await expect(page.getByRole('heading', { name: 'T-102' })).toBeVisible();
    // Stage 8 (mockup): Confirm completion lives in the Next step callout; the Jobs card comes after it.
    const completeHeading = page.getByTestId('admin-wo-next-step');
    const summaryHeading = page.getByRole('heading', { name: /^Jobs/ });
    await expect(completeHeading).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm completion' })).toHaveCount(1);
    // LTR-168: the fixed bar only appears once the inline card scrolls away.
    await expect(page.getByTestId('admin-wo-next-action')).toHaveCount(0);
    await expect(summaryHeading).toBeVisible();
    const completeBox = await completeHeading.boundingBox();
    const summaryBox = await summaryHeading.boundingBox();
    expect(completeBox && summaryBox && completeBox.y < summaryBox.y).toBe(true);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 834, height: 1194 },
      { width: 1440, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
      await expect(page.locator('nav.grid.grid-cols-2')).toHaveCount(0);
      // UX-4-002: the sidebar is fixed from 1024 px; tablets (834) use the header menu like phones.
      if (viewport.width < 1024) {
        await expect(page.getByRole('button', { name: 'Open Shop Admin navigation' })).toBeVisible();
        await expect(page.getByRole('complementary', { name: 'Shop Admin navigation' })).toHaveCount(0);
      } else {
        await expect(page.getByRole('complementary', { name: 'Shop Admin navigation' })).toBeVisible();
      }
    }

    await switchLanguage(page, 'es');
    await expect(page.getByRole('heading', { name: 'Panel', exact: true })).toBeVisible();
    await expect(page.getByText('Lo que te necesita ahora, en orden.')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Te necesita/ })).toBeVisible();
    await expect(page.getByTestId('dashboard-group-close')).toContainText('Listos para cerrar');
    await expect(page.getByText(/^En vivo · actualizado /)).toHaveCount(1);
    await expect(page.getByText(/supabase|postgres|Fuente:|Generado/i)).toHaveCount(0);
    const esNav = page.getByRole('complementary', { name: 'Navegación de Shop Admin' });
    await expect(esNav.getByRole('link', { name: 'Panel', exact: true })).toBeVisible();
    await expect(esNav.getByRole('link', { name: 'Work Orders', exact: true })).toBeVisible();
    await expect(esNav.getByRole('link', { name: 'Patio', exact: true })).toBeVisible();
    // LTR-170: Admin says Truck in Spanish too (glossary); "unidad" stays in the mechanic app.
    await expect(esNav.getByRole('link', { name: 'Trucks', exact: true })).toBeVisible();
    await expect(esNav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
  });

  test('mobile Admin navigation is a one-column sheet with every Admin link', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Filter what needs you' })).toBeVisible();

    const openNav = page.getByRole('button', { name: 'Open Shop Admin navigation' });
    await expect(openNav).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openNav.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const mobileNav = dialog.getByRole('navigation', { name: 'Shop Admin mobile navigation' });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav).not.toHaveClass(/grid-cols-2/);
    for (const name of ['Dashboard', 'Yard Operations', 'Work Orders', 'Trucks', 'Purchases', 'Outside repairs', 'Parts', 'Vendors', 'Internal invoices', 'People', 'Jobs', 'Shop workflow', 'Inspection checklist', 'Samsara', 'Shop rates']) {
      await expect(mobileNav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    // LTR-122: grouped by job — operation, setup (LTR-248: History became the Closed filter of Work Orders).
    for (const group of ['Operations', 'Setup']) {
      await expect(mobileNav.getByText(group, { exact: true })).toBeVisible();
    }
    // LTR-200 / D-PC7: the Manager also has Parts & costs; PCA8: week's work, month's close, then catalogs, and Labor rate under Setup.
    // D47 / HU-M20: Stock left the menu; Parts is the inventory.
    await expect(mobileNav.getByRole('link')).toHaveText(['Dashboard', 'Yard Operations', 'Work Orders', 'Trucks', 'Purchases', 'Outside repairs', 'Parts', 'Vendors', 'Internal invoices', 'People', 'Jobs', 'Shop workflow', 'Inspection checklist', 'Samsara', 'Shop rates']);

    await page.getByRole('button', { name: 'Close Shop Admin navigation' }).click();
    await switchLanguage(page, 'es');
    await expect(page.getByRole('heading', { name: 'Panel', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir navegación de Shop Admin' }).click();
    const esMobileNav = page.getByRole('dialog').getByRole('navigation', { name: 'Navegación móvil de Shop Admin' });
    for (const name of ['Panel', 'Work Orders', 'Patio', 'Trucks', 'Personas', 'Jobs']) {
      await expect(esMobileNav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(esMobileNav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);

    await esMobileNav.getByRole('link', { name: 'Trucks', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/trucks$/);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Trucks' })).toBeVisible();
  });

  test('manager navigates Dashboard to filtered list, pagination, and read-only detail', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/work-orders');
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await expect(page.getByRole('heading', { name: 'Work Orders' })).toBeVisible();
    const filters = await workOrderFilterPanel(page);
    await filters.getByLabel('Status').selectOption('waiting_paused');
    await filters.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/status=waiting_paused/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'WO-0101' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'WO-0101' }).first().click();
    await expect(page.getByRole('heading', { name: 'T-101' })).toBeVisible();
    // LTR-166: one page header, no "Shop Admin" eyebrow above the title.
    await expect(page.locator('main header').getByText('Shop Admin', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Read only')).toHaveCount(0);
    // Stage 5 (R1): one Truck card with its data, not a folded "Truck details" repeating it.
    await expect(page.getByRole('heading', { name: 'Truck details' })).toHaveCount(0);
    await expect(page.getByTestId('admin-wo-truck-card').getByText('120,000')).toBeVisible();
    await expect(page.getByText('WO-0104').first()).toBeVisible();
    // Stage 8 (mockup): History is always open, with its tabs in the header: Activity, Times, Pauses.
    await expect(page.getByRole('tab', { name: /^Activity/ })).toHaveAttribute('aria-selected', 'true');
    // LTR-126: notes are append-only entries with author and time.
    await expect(page.getByRole('heading', { name: /^Notes/ })).toBeVisible();
    // Stage 5: the composer is always under the thread and posts with "Post".
    await page.getByRole('textbox', { name: 'Add note' }).fill('Check the leak again');
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Note added.' }).first()).toBeVisible();
    await expect(page.getByText('Check the leak again')).toBeVisible();
    await expect(page.locator('[aria-labelledby="admin-wo-notes-title"]').getByText('Shop Manager', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Add note' })).toHaveValue('');
    // LTR-154 / D11: no Work Order team editor; each Job has its own owner.
    await expect(page.getByRole('heading', { name: 'Assignments' })).toHaveCount(0);
    // LTR-189 (W1) / Stage 5 (R5): cancel and reopen are in the row's "…" menu and ask their reason in a dialog.
    await page.getByRole('button', { name: 'Actions for Inspect brake chamber' }).click();
    await page.getByRole('menuitem', { name: 'Cancel Job…' }).click();
    await page.getByLabel('Reason for this Job change').fill('Not needed');
    await page.getByRole('button', { name: 'Confirm job cancellation' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Job cancelled.' }).first()).toBeVisible();
    // A cancelled Job goes to the "Done and cancelled" group (open by default, Stage 8).
    await expect(page.getByTestId('admin-wo-closed-jobs-toggle')).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Actions for Inspect brake chamber' }).click();
    await page.getByRole('menuitem', { name: 'Reopen Job…' }).click();
    await page.getByLabel('Reason for this Job change').fill('Job is still required');
    await page.getByRole('button', { name: 'Confirm job reopen' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Job reopened.' }).first()).toBeVisible();
    // Cancel WO-0103, not WO-0101: the fixture API keeps state for the whole run,
    // and later tests need WO-0101 to stay open and Waiting / Paused.
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000103');
    await expect(page.getByRole('heading', { name: 'T-103' })).toBeVisible();
    // LTR-158 / LTR-174: rare actions are behind the header "…" menu.
    await page.getByTestId('admin-wo-more-actions').click();
    await page.getByRole('menuitem', { name: 'Cancel Work Order' }).click();
    await page.getByLabel('Reason for cancellation').fill('Duplicate Work Order');
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Work Order cancelled.' }).first()).toBeVisible();
    await expect(page.getByText('Cancelled').first()).toBeVisible();
    await page.getByTestId('admin-breadcrumb').getByRole('link', { name: 'Work Orders' }).click();
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000102');
    await expect(page.getByRole('heading', { name: 'T-102' })).toBeVisible();
    await expect(page.getByText('Jobs are done. Confirm completion to close this Work Order.').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm completion' }).first()).toBeVisible();
    // Stage 5 (R4, R7): "Correct time…" in the "…" opens History on Times; one list of segments, each with "Correct…".
    await page.getByTestId('admin-wo-more-actions').click();
    await page.getByRole('menuitem', { name: 'Correct time…' }).click();
    await expect(page.getByRole('tab', { name: 'Times' })).toHaveAttribute('aria-selected', 'true');
    // LTR-186 / D20: a segment the day close stopped says so next to its end time.
    await expect(page.getByTestId('labor-end-reason').first()).toHaveText('Day close');
    await page.getByTestId('time-segment').getByRole('button', { name: /^Correct / }).first().click();
    await page.getByLabel('Corrected end time').fill('2026-09-06T17:00');
    await page.getByLabel('Reason for time correction').fill('Clock was wrong');
    await page.getByRole('button', { name: 'Apply time correction' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Time correction saved.' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Confirm completion' }).first().click();
    // Owner decision (2026-10-05): closing confirms in a dialog.
    await page.getByTestId('close-work-order-dialog').getByRole('button', { name: 'Close Work Order' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Work Order completed.' }).first()).toBeVisible();
    // Stage 8 (mockup): Return to Service is the completed Work Order's Next step, not in the "…".
    await page.getByTestId('admin-wo-next-step').getByRole('button', { name: 'Return to Service' }).click();
    await page.getByLabel('Reason (optional)').fill('Repairs verified');
    await page.getByRole('button', { name: 'Confirm Return to Service' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Truck returned to service.' }).first()).toBeVisible();
    await page.getByTestId('admin-wo-more-actions').click();
    await page.getByRole('menuitem', { name: 'Reopen Work Order' }).click();
    await page.getByLabel('Reason for reopening').fill('More work found');
    await page.getByRole('button', { name: 'Confirm reopen' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Work Order reopened.' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 700 });
    const content = page.locator('#main-content main');
    await expect(content).toHaveCSS('overflow-y', 'auto');
    await content.evaluate((element) => { element.scrollTop = 500; });
    await expect(page.getByRole('banner', { name: 'Shop Admin controls' })).toBeInViewport();
    await expect(page.getByRole('complementary', { name: 'Shop Admin navigation' })).toBeInViewport();
  });

  test('work orders open with all statuses and dashboard metrics use explicit list filters', async ({ page }) => {
    test.setTimeout(90_000);
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: /open Work Orders$/ }).click();
    await expect(page).toHaveURL(/status=created%2Cin_progress%2Cwaiting_paused/);
    await page.goBack();

    // Stage 3: the history counts are links with the same explicit filters as before.
    const verifyMetric = async (name: RegExp, expected: Record<string, string>) => {
      await page.getByRole('region', { name: 'Filter what needs you' }).getByRole('link', { name }).click();
      await page.waitForURL((url) => Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value));
      const url = new URL(page.url());
      for (const [key, value] of Object.entries(expected)) expect(url.searchParams.get(key)).toBe(value);
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15_000 });
    };
    await verifyMetric(/completed today$/, { status: 'completed', completedFrom: '2026-09-06T04:00:00.000Z', completedBefore: '2026-09-07T04:00:00.000Z' });
    await verifyMetric(/in the last 7 days$/, { status: 'completed', completedFrom: '2026-08-31T04:00:00.000Z', completedBefore: '2026-09-07T04:00:00.000Z' });

    // A counter puts its group first and hides the other counters, and toggles back.
    const closeCounter = page.getByTestId('dashboard-counter-close');
    await closeCounter.click();
    await expect(closeCounter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('dashboard-group-close')).toBeVisible();
    await expect(page.getByTestId('dashboard-group-blocked')).toHaveCount(0);
    await closeCounter.click();
    await expect(page.getByTestId('dashboard-group-blocked')).toBeVisible();

    await page.goto('/admin/work-orders');
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    const clearPanel = await workOrderFilterPanel(page);
    await expect(clearPanel.getByLabel('Status')).toHaveValue('all');
    await clearPanel.getByRole('button', { name: 'Clear' }).click();
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await expect(page.getByText('WO-0101').first()).toBeVisible();
    // The first page may still be settling when Load more is first clicked (WebKit); retry the pair.
    await expect(async () => {
      if (!(await page.getByText('WO-0104').first().isVisible())) {
        await page.getByRole('button', { name: 'Load more' }).click({ timeout: 2_000 });
      }
      await expect(page.getByText('WO-0104').first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText('WO-0105').first()).toBeVisible();
  });

  test('LTR-261: a truck Samsara sees in the yard without a Work Order waits on the Dashboard, with Create WO', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15_000 });
    const arrived = page.getByTestId('dashboard-group-arrived');
    await expect(arrived).toContainText('Arrived · Needs a Work Order');
    const row = arrived.getByTestId('dashboard-arrived-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Y-101');
    await expect(row).toContainText(/In yard · since /);
    await row.getByTestId('dashboard-create-wo').click();
    await expect(page.getByRole('dialog')).toContainText('Y-101');
    await page.keyboard.press('Escape');
    // LTR-277 §1: a counter hides only the other counters; the arrivals stay.
    await page.getByTestId('dashboard-counter-close').click();
    await expect(arrived).toBeVisible();
  });

  test('work order search 9 + Apply returns ranked WO/truck matches and EmptyState', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/work-orders');
    await expect(page.getByRole('heading', { name: 'Work Orders' })).toBeVisible();
    await expect(page.getByText('WO-0101').first()).toBeVisible();

    const search = page.getByLabel('Search Work Order, Truck, category, or Mechanic');
    await search.fill('9');
    const applySearch = await workOrderFilterPanel(page);
    await applySearch.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/search=9/);
    await expect(page.getByRole('link', { name: 'WO-0009', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'WO-0905', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'WO-0422', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'WO-0609', exact: true }).first()).toBeVisible();
    await expect(page.getByText('WO-0101')).toHaveCount(0);

    const ids = await page.getByRole('link', { name: /^WO-\d+$/ }).allTextContents();
    expect(ids.indexOf('WO-0009')).toBeLessThan(ids.indexOf('WO-0905'));
    expect(ids.indexOf('WO-0905')).toBeLessThan(ids.indexOf('WO-0422'));
    expect(ids.indexOf('WO-0422')).toBeLessThan(ids.indexOf('WO-0609'));

    await search.fill('zzz-no-match');
    const applyEmpty = await workOrderFilterPanel(page);
    await applyEmpty.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/search=zzz-no-match/);
    await expect(page.getByText('No Work Orders match these filters.')).toBeVisible();

    const clearSearch = await workOrderFilterPanel(page);
    await clearSearch.getByRole('button', { name: 'Clear' }).click();
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await expect(page.getByText('WO-0101').first()).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await search.fill('9');
    const desktopApply = await workOrderFilterPanel(page);
    await desktopApply.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('table').getByRole('link', { name: 'WO-0009', exact: true })).toBeVisible();
    await expect(page.locator('table').getByRole('link', { name: 'WO-0422', exact: true })).toBeVisible();
    await expect(page.locator('table').getByText('WO-0101')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/work-orders');
    await expect(page.getByText('WO-0101').first()).toBeVisible();
    await search.fill('9644');
    await expect(search).toHaveValue('9644');
    const mobileApply = await workOrderFilterPanel(page);
    await mobileApply.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/search=9644/);
    await expect(page.getByRole('link', { name: 'WO-0422', exact: true }).first()).toBeVisible();
    await expect(page.getByText('9644').first()).toBeVisible();
    await expect(page.getByText('WO-0101')).toHaveCount(0);
  });

  test('work order table Next column says the same next step as the Trucks list (DM1, LTR-204)', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/work-orders?status=completed');
    const row = page.locator('table tbody tr', { has: page.getByRole('link', { name: 'WO-0104', exact: true }) });
    await expect(row).toBeVisible();
    // A completed Work Order whose Truck is Ready to Go reads "Return to Service", not "1 Job · all done".
    // D52 (LTR-260): Samsara saw WO-0104's truck leave the yard after the close, so it asks to confirm.
    const next = row.getByTestId('work-order-row-next-step');
    await expect(next).toHaveAttribute('data-kind', 'return_to_service');
    // Chromium writes "Sep 21, 10:40 AM"; WebKit "Sep 21 at 10:40 AM".
    const leftText = /Left the yard Sep 21(,| at) 10:40\sAM \(Samsara\)\. Confirm Return to Service\./;
    await expect(next).toHaveText(leftText);
    await page.goto('/admin');
    const dashboardRow = page.getByTestId('dashboard-queue-row').filter({ hasText: 'WO-0104' });
    await expect(dashboardRow).toContainText(leftText);
    await expect(dashboardRow).toContainText('Nothing changes until you confirm.');
    await expect(row.getByText('all done')).toHaveCount(0);

    // An open Work Order with a Job left names that Job, like the Truck does.
    await page.goto('/admin/work-orders?status=in_progress');
    const open = page.locator('table tbody tr', { has: page.getByRole('link', { name: 'WO-0106', exact: true }) });
    await expect(open.getByTestId('work-order-row-next-step')).toHaveText('1 Job left · next: Inspect brake chamber');
  });

  test('work order filters stay collapsed on mobile and compact on desktop', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/work-orders');
    await expect(page.getByRole('heading', { name: 'Work Orders' })).toBeVisible();
    await expect(page.getByText('WO-0101').first()).toBeVisible();

    await expect(page.getByRole('button', { name: WORK_ORDER_FILTERS_BUTTON })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Status')).toBeHidden();
    await expect(page.getByRole('link', { name: 'WO-0101' }).first()).toBeInViewport();

    const sheet = await workOrderFilterPanel(page);
    await expect(sheet.getByLabel('Status')).toBeVisible();
    await expect(sheet.getByLabel('Priority')).toBeVisible();
    await expect(sheet.getByLabel('Sort')).toBeVisible();
    await expect(sheet.getByLabel('Direction')).toBeVisible();
    await sheet.getByLabel('Status').selectOption('waiting_paused');
    await sheet.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/status=waiting_paused/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Filters \(1\)/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'WO-0101' }).first()).toBeInViewport();

    // UX-4-001 (PR 338) + LTR-259: from a 44rem card (an iPad Pro in landscape, 1280–1366 px laptops) the four selects
    // show on a second row under the search; from 68rem (about 1440 px with the sidebar) everything sits on one row.
    // Narrower cards keep the sheet.
    for (const width of [768]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: WORK_ORDER_FILTERS_BUTTON }), `sheet at ${width}px`).toBeVisible();
    }
    for (const width of [1194, 1280, 1366, 1440, 1536, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: WORK_ORDER_FILTERS_BUTTON })).toBeHidden();
      const toolbar = page.getByRole('search');
      await expect(toolbar.getByLabel('Status')).toBeVisible();
      await expect(toolbar.getByLabel('Priority')).toBeVisible();
      await expect(toolbar.getByLabel('Sort')).toBeVisible();
      await expect(toolbar.getByLabel('Direction')).toBeVisible();
      await expect(toolbar.getByRole('button', { name: 'Clear' })).toBeVisible();
      await expect(toolbar.getByRole('button', { name: 'Apply filters' })).toBeVisible();
      const box = await toolbar.boundingBox();
      expect(box?.height, `toolbar rows at ${width}px`).toBeLessThan(width >= 1440 ? 110 : 190);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    }
  });

  test('admin role can load dashboard and pagination completes', async ({ page }) => {
    await devLogin(page, 'admin@lightning.local');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await openAdminNavLink(page, 'Work Orders');
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.getByText('WO-0103').first()).toBeVisible();
  });

  for (const email of ['ibrain@ltransl.com', 'cristian240588@hotmail.com']) {
    test(`${email} opens Standard and PM without signing in again`, async ({ page }) => {
      await devLogin(page, email);
      await expect(page).toHaveURL(/\/admin$/);
      // P4 (owner, 2026-10-06): the workspaces are a group in the navigation, not a Dashboard block.
      await expect(page.getByRole('heading', { name: 'Workspaces' })).toHaveCount(0);
      await openAdminNavLink(page, 'Standard Mechanic');
      await expect(page).toHaveURL(/\/mechanic\/standard$/);
      await expect(page.getByRole('heading', { name: 'My assigned work' })).toBeVisible();
      await page.getByRole('link', { name: 'Back to Shop Admin' }).click();
      await expect(page).toHaveURL(/\/admin$/);

      await switchLanguage(page, 'es');
      await page.getByRole('button', { name: 'Abrir navegación de Shop Admin' }).click();
      await page.getByRole('navigation', { name: 'Navegación móvil de Shop Admin' }).getByRole('link', { name: 'Mecánico PM', exact: true }).click();
      await expect(page).toHaveURL(/\/mechanic\/pm$/);
      // The shared ltl_shop_locale cookie keeps the PM workspace in Spanish.
      await expect(page.getByRole('heading', { name: 'Mecánico de PM' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Volver a Shop Admin' })).toBeVisible();
    });
  }

  test('mechanic receives a secure forbidden screen for direct Admin access', async ({ page }) => {
    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'My assigned work' })).toBeVisible();
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: 'Shop Admin access denied' })).toBeVisible();
    // The way back names no role: "/" sends each person to their own home (Safety goes to /qc).
    await expect(page.getByRole('link', { name: 'Return to your Home' })).toHaveAttribute('href', '/');
    const mechanics = await page.goto('/admin/mechanics');
    expect(mechanics?.status()).toBe(403);
    const history = await page.goto('/admin/history');
    expect(history?.status()).toBe(403);
    const trucks = await page.goto('/admin/trucks');
    expect(trucks?.status()).toBe(403);
    const catalog = await page.goto('/admin/catalog');
    expect(catalog?.status()).toBe(403);
  });

  test('manager opens read-only Mechanics, History, and Trucks', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await openAdminNavLink(page, 'People');
    await expect(page).toHaveURL(/\/admin\/mechanics$/);
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    // LTR-248: History is the Closed filter of Work Orders; its old link lands there.
    await page.goto('/admin/history');
    await expect(page).toHaveURL(/\/admin\/work-orders\?status=completed%2Ccancelled$/);
    await expect(page.getByText('WO-0104').first()).toBeVisible();
    await openAdminNavLink(page, 'Trucks');
    await expect(page).toHaveURL(/\/admin\/trucks$/);
    await expect(page.getByRole('heading', { name: 'Trucks' })).toBeVisible();
    await expect(page.getByText('T-101').first()).toBeVisible();
    await expect(page.getByText('WO-0101').first()).toBeVisible();
    await expect(page.getByText('No open Work Order').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await openAdminNavLink(page, 'Jobs');
    await expect(page).toHaveURL(/\/admin\/catalog$/);
    await expect(page.getByRole('heading', { name: 'Jobs catalog' })).toBeVisible();
    await expect(page.getByText('Brakes').first()).toBeVisible();
    await expect(page.getByText('Suspension').first()).toBeVisible();
    await expect(page.getByText('Inactive', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await page.getByRole('link', { name: 'Brakes' }).click();
    await expect(page).toHaveURL(/\/admin\/catalog\/categories\/00000000-0000-4000-8000-000000000301$/);
    await expect(page.getByRole('heading', { name: 'Brakes' })).toBeVisible();
    await expect(page.getByText('Inspect brake chamber')).toBeVisible();
    // LTR-198: aliases are chips the Manager can edit.
    await expect(page.getByText('Brake chamber', { exact: true })).toBeVisible();
    await expect(page.getByText('Chamber', { exact: true })).toBeVisible();
    await expect(page.getByText('Retired brake job')).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
  });

  test('Trucks: going back from a truck keeps the list search (LTR-245 / UX-5-008)', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/trucks');
    const search = page.getByRole('searchbox', { name: 'Search Trucks' }).or(page.getByRole('textbox', { name: 'Search Trucks' }));
    await search.fill('T-102');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/admin\/trucks\?search=T-102$/);
    await expect(page.getByRole('link', { name: 'T-101', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'T-102', exact: true }).first().click();
    await expect(page).toHaveURL(/\/admin\/trucks\/[0-9a-f-]+\?from=%2Fadmin%2Ftrucks%3Fsearch%3DT-102/);
    // The breadcrumb names where the Manager came from and goes back there with the same search.
    const parent = page.getByTestId('admin-breadcrumb').getByRole('link', { name: /Trucks/ });
    await expect(parent).toHaveAttribute('href', '/admin/trucks?search=T-102');
    await parent.click();
    await expect(page).toHaveURL(/\/admin\/trucks\?search=T-102$/);
    await expect(search).toHaveValue('T-102');
    await expect(page.getByRole('link', { name: 'T-102', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'T-101', exact: true })).toHaveCount(0);
  });

  test('People: the Show filter reads ?status=all from the URL (DM2, LTR-204)', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/mechanics?status=all');
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
    // The list shows the inactive person, and the filter says so instead of "Active".
    await expect(page.getByRole('row', { name: /Retired Mechanic/ })).toBeVisible();
    const filtersButton = page.getByRole('search').getByRole('button', { name: /^Filters( [0-9]+)?$/ });
    await expect(filtersButton).toHaveAccessibleName(/Filters 1/);
    await filtersButton.click();
    await expect(page.getByRole('dialog', { name: 'Filters' }).getByLabel('Show')).toHaveValue('all');
  });

  test('login and Admin SSR the shared ltl_shop_locale cookie without an EN/ES flash', async ({ page }) => {
    await page.goto('/login');
    const cookieUrl = `${new URL(page.url()).origin}/`;

    await page.context().addCookies([{ name: 'ltl_shop_locale', value: 'es', url: cookieUrl }]);
    const loginEsHtml = await (await page.request.get('/login')).text();
    expect(loginEsHtml).toContain('lang="es"');
    expect(loginEsHtml).toMatch(/<h1[^>]*>Iniciar sesión<\/h1>/);
    expect(loginEsHtml).not.toMatch(/<h1[^>]*>Sign in<\/h1>/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);

    await page.context().addCookies([{ name: 'ltl_shop_locale', value: 'en', url: cookieUrl }]);
    const loginEnHtml = await (await page.request.get('/login')).text();
    expect(loginEnHtml).toContain('lang="en"');
    expect(loginEnHtml).toMatch(/<h1[^>]*>Sign in<\/h1>/);
    expect(loginEnHtml).not.toMatch(/<h1[^>]*>Iniciar sesión<\/h1>/);

    await page.reload({ waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await waitForLoginForm(page);
    await page.getByLabel('Email').fill('manager@lightning.local');
    await expect(page.getByLabel('Email')).toHaveValue('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

    await page.context().addCookies([{ name: 'ltl_shop_locale', value: 'es', url: cookieUrl }]);
    const adminEsHtml = await (await page.request.get('/admin')).text();
    // The server renders the Spanish loading state; the English one never appears (no EN/ES flash).
    expect(adminEsHtml).toContain('Operaciones actuales del Shop');
    expect(adminEsHtml).not.toContain('Current shop operations');

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Panel', exact: true })).toBeVisible();
    await switchLanguage(page, 'en');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    const localeCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'ltl_shop_locale');
    expect(localeCookie?.value).toMatch(/^(en|es)$/);
    expect(localeCookie?.path).toBe('/');
    expect(localeCookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + 30_000_000);
  });

  test('Dashboard Work Orders and the open Work Orders link navigate on the first click ten times', async ({ page }) => {
    test.setTimeout(180_000);
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);

    await page.setViewportSize({ width: 1440, height: 900 });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
      await page.getByRole('complementary', { name: 'Shop Admin navigation' }).getByRole('link', { name: 'Work Orders', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/work-orders$/);
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
      await page.getByRole('link', { name: /open Work Orders$/ }).click();
      await expect(page).toHaveURL(/\/admin\/work-orders\?status=created/);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Open Shop Admin navigation' }).click();
      await page.getByRole('dialog').getByRole('link', { name: 'Work Orders', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/work-orders$/);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  test('Admin WO detail keeps Confirm completion sticky when Jobs are done', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000102');
    await expect(page.getByRole('heading', { name: 'T-102' })).toBeVisible();
    const nextAction = page.getByTestId('admin-wo-next-action');
    // LTR-168: Confirm completion is on screen once: the Next step callout at the top, the fixed bar after scrolling.
    const callout = page.getByTestId('admin-wo-next-step');
    await expect(callout).toBeInViewport();
    await expect(nextAction).toHaveCount(0);

    await page.getByRole('tab', { name: /^Pauses/ }).scrollIntoViewIfNeeded();
    await expect(callout).not.toBeInViewport();
    const stickyButton = nextAction.getByRole('button', { name: 'Confirm completion' });
    await expect(nextAction).toBeInViewport();
    await expect(stickyButton).toBeInViewport();
    const stickyBox = await stickyButton.boundingBox();
    expect(stickyBox?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('button', { name: 'Confirm completion' })).toHaveCount(2);
    expect(await page.getByRole('button', { name: 'Confirm completion' }).evaluateAll((buttons) =>
      buttons.filter((button) => {
        const box = button.getBoundingClientRect();
        return box.bottom > 0 && box.top < window.innerHeight;
      }).length)).toBe(1);
    // Pause is a header button now (no Controls card); the callout still sits above the Jobs.
    const jobsBox = await page.getByRole('heading', { name: /^Jobs/ }).boundingBox();
    const completeCardBox = await callout.boundingBox();
    expect(completeCardBox && jobsBox && completeCardBox.y < jobsBox.y).toBe(true);

    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000101');
    await expect(page.getByRole('heading', { name: 'T-101' })).toBeVisible();
    await expect(page.getByTestId('admin-wo-next-action')).toHaveCount(0);

    await switchLanguage(page, 'es');
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000102');
    await expect(page.getByRole('button', { name: 'Confirmar finalización' }).first()).toBeVisible();
  });

  test('Admin WO Jobs: Add helper, Send to external shop and Returned from the row (LTR-188 / D23, D24)', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000101');
    await expect(page.getByRole('heading', { name: 'T-101' })).toBeVisible();

    // G2: on a pending Job the completion action is a bordered "Mark complete" button, never a check that reads as a status.
    const pendingRow = page.getByTestId('admin-wo-job-row').first();
    await expect(pendingRow.getByRole('button', { name: 'Mark complete: Inspect brake chamber' })).toHaveText('Mark complete');
    await expect(pendingRow.getByTestId('admin-wo-job-row')).toHaveCount(0);

    // D23: the helper gets a Job of their own, shown with "· helper".
    await page.getByRole('button', { name: 'Actions for Inspect brake chamber', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add helper' }).click();
    const helperDialog = page.getByTestId('admin-wo-add-helper-dialog');
    await helperDialog.getByLabel('Helper').selectOption({ label: 'Anthony' });
    await helperDialog.getByRole('button', { name: 'Add helper' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Helper added.' }).first()).toBeVisible();
    await expect(page.getByTestId('admin-wo-job-row')).toHaveCount(2);
    await expect(page.getByTestId('admin-wo-job-row').nth(1)).toContainText('Inspect brake chamber · helper');

    // A helper Job cannot get its own helper; it can still go to an external shop.
    await page.getByRole('button', { name: 'Actions for Inspect brake chamber · helper' }).click();
    await expect(page.getByTestId('admin-wo-job-add-helper')).toHaveCount(0);
    await expect(page.getByTestId('admin-wo-job-send-external')).toBeVisible();
    await page.keyboard.press('Escape');

    // D24: the truck goes out with a note; the row says where it is and offers "Returned".
    await page.getByRole('button', { name: 'Actions for Inspect brake chamber', exact: true }).click();
    await page.getByTestId('admin-wo-job-send-external').click();
    const sendDialog = page.getByTestId('admin-wo-send-external-dialog');
    await sendDialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(sendDialog.getByRole('alert')).toHaveText('Write where it goes and when it comes back.');
    await sendDialog.getByRole('radio', { name: 'The truck goes out' }).check();
    await sendDialog.getByLabel('Note (where it goes, when it comes back)').fill('Body shop on 5th, back Monday');
    await sendDialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sent to the external shop.' }).first()).toBeVisible();
    const firstRow = page.getByTestId('admin-wo-job-row').first();
    await expect(firstRow.getByTestId('admin-wo-job-external-where')).toHaveText('Truck out · Body shop on 5th, back Monday');
    await expect(firstRow.getByTestId('admin-wo-job-external-where')).toHaveAttribute('title', 'Body shop on 5th, back Monday');
    await expect(firstRow.getByTestId('admin-wo-job-external').first()).toBeVisible();
    await expect(firstRow.getByRole('button', { name: /^Mark complete/ })).toHaveCount(0);

    // Returned → Assign to a mechanic.
    await firstRow.getByTestId('admin-wo-job-returned').click();
    const returnDialog = page.getByTestId('admin-wo-return-external-dialog');
    await returnDialog.getByRole('radio', { name: 'Assign to' }).check();
    await expect(returnDialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await returnDialog.getByRole('combobox', { name: 'Assign to' }).selectOption({ label: 'Alejandro 1' });
    await returnDialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'The Job is back from the external shop.' }).first()).toBeVisible();
    await expect(firstRow.getByTestId('admin-wo-job-external-where')).toHaveCount(0);
    // PCA3 (UX-10-001): back without an invoice, the row says so and still offers to load it.
    await expect(firstRow.getByTestId('admin-wo-job-awaiting-invoice')).toHaveText('Returned · no invoice yet');
    await page.getByRole('button', { name: 'Actions for Inspect brake chamber', exact: true }).click();
    await expect(page.getByTestId('admin-wo-job-outside-invoice')).toBeVisible();
    await page.keyboard.press('Escape');

    await switchLanguage(page, 'es');
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000101');
    await expect(page.getByTestId('admin-wo-job-row').nth(1)).toContainText('Inspect brake chamber · ayudante');
  });

  test('LTR-293 §1: Back returns to the place in the list; a filter does not jump to the top', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
    await page.goto('/admin/work-orders');
    await expect(page.getByText('WO-0101').first()).toBeVisible();
    const main = page.locator('#main-content main');
    const scrollTop = () => main.evaluate((element) => element.scrollTop);
    const room = await main.evaluate((element) => element.scrollHeight - element.clientHeight);
    expect(room).toBeGreaterThan(150);
    const place = Math.min(400, room);
    // The list can redraw right after it loads (and the browser then clamps the scroll), so scroll until the place holds,
    // as a person would; then open a Work Order without letting Playwright scroll to the link.
    await expect(async () => {
      await main.evaluate((element, top) => { element.scrollTop = top; }, place);
      await page.waitForTimeout(300);
      expect(await scrollTop()).toBe(place);
    }).toPass({ timeout: 10_000 });
    await main.evaluate((element) => (element.querySelector('a[href*="/admin/work-orders/00000000"]') as HTMLAnchorElement).click());
    await expect(page).toHaveURL(/\/admin\/work-orders\/00000000/);
    await expect.poll(scrollTop).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await expect.poll(scrollTop, { timeout: 5_000 }).toBeGreaterThanOrEqual(place - 2);

    // A replace on the same screen (how every filter changes the URL) leaves the page where it was. The param changes
    // nothing in the list, so a shorter list cannot be what moves it.
    const before = await scrollTop();
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('ltr293', '1');
      // Plain state, so Next.js applies the new URL and the route hooks update, as with router.replace.
      window.history.replaceState({}, '', url);
    });
    await expect(page).toHaveURL(/ltr293=1/);
    await page.waitForTimeout(300);
    expect(Math.abs((await scrollTop()) - before)).toBeLessThanOrEqual(2);
  });

  test('LTR-293 §2: the Manager\'s note and a new Work Order note survive a reload', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000101');
    const note = page.getByRole('textbox', { name: 'Add note' });
    await note.fill('Waiting on the air dryer from Rush');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Add note' })).toHaveValue('Waiting on the air dryer from Rush');

    await page.goto('/admin/work-orders/new');
    const notes = page.getByRole('textbox', { name: 'Notes (optional)' });
    await notes.fill('Driver says it pulls left');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Notes (optional)' })).toHaveValue('Driver says it pulls left');
  });

  test('LTR-293 §12: catalog search results are links (they open in a new tab with Cmd/Ctrl-click)', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
    await page.goto('/admin/catalog');
    await page.getByRole('textbox', { name: 'Search categories, Jobs or aliases' }).first().fill('brake');
    const results = page.getByTestId('catalog-search-results');
    await expect(results.getByRole('link').first()).toHaveAttribute('href', /\/admin\/catalog\/categories\//);
    await expect(results.getByRole('button')).toHaveCount(0);
  });
});

