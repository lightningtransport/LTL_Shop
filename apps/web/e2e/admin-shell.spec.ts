import { expect, test, type Locator, type Page } from '@playwright/test';

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
    await expect.poll(async () => mechanicShell.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('59px');
    await expect.poll(async () => mechanicShell.evaluate((element) => getComputedStyle(element).paddingBottom)).toBe('48px');
  });

  test('Admin sticky header and bottom sheet honor shared safe-area tokens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const header = page.getByRole('banner', { name: 'Shop Admin controls' });
    await expect(header).toBeVisible();
    expect(await header.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('0px');

    await page.setViewportSize({ width: 1440, height: 1024 });
    expect(await header.evaluate((element) => getComputedStyle(element).paddingTop)).toBe('0px');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({ content: ':root { --app-safe-top: 59px; --app-safe-bottom: 48px; }' });
    const menu = page.getByRole('button', { name: 'Open Shop Admin navigation' });
    const logo = header.getByRole('img', { name: 'Lightning Transport and Logistics' });
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
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();
    await expect(page.getByText('Current shop operations')).toBeVisible();
    await expect(page.getByText(/^Updated /)).toHaveCount(1);
    await expect(page.getByText('Created, in progress, or waiting / paused')).toBeVisible();
    await expect(page.getByText(/supabase|postgres|Source:|Generated/i)).toHaveCount(0);
    await expect(page.getByText('Open Work Orders').first()).toBeVisible();
    await expect(page.getByText('Jobs ready to close first')).toBeVisible();
    await expect(page.getByText('Jobs are done. Confirm completion to close this Work Order.')).toBeVisible();
    await page.getByRole('link', { name: 'WO-0102' }).first().click();
    await expect(page.getByRole('heading', { name: 'T-102' })).toBeVisible();
    const completeHeading = page.getByRole('heading', { name: 'Complete Work Order' });
    const summaryHeading = page.getByRole('heading', { name: 'Operational summary' });
    await expect(completeHeading).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm completion' }).first()).toBeVisible();
    await expect(page.getByTestId('admin-wo-next-action').getByRole('button', { name: 'Confirm completion' })).toBeVisible();
    await expect(summaryHeading).toBeVisible();
    const completeBox = await completeHeading.boundingBox();
    const summaryBox = await summaryHeading.boundingBox();
    expect(completeBox && summaryBox && completeBox.y < summaryBox.y).toBe(true);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();

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
      if (viewport.width < 768) {
        await expect(page.getByRole('button', { name: 'Open Shop Admin navigation' })).toBeVisible();
        await expect(page.getByRole('complementary', { name: 'Shop Admin navigation' })).toHaveCount(0);
      } else {
        await expect(page.getByRole('complementary', { name: 'Shop Admin navigation' })).toBeVisible();
      }
    }

    await page.getByRole('button', { name: /Switch to Spanish|Language: English/ }).click();
    await expect(page.getByRole('heading', { name: 'Operaciones del Shop' })).toBeVisible();
    await expect(page.getByText('Operaciones actuales del Shop')).toBeVisible();
    await expect(page.getByText('Primero los listos para cerrar')).toBeVisible();
    await expect(page.getByText(/^Actualizado /)).toHaveCount(1);
    await expect(page.getByText(/supabase|postgres|Fuente:|Generado/i)).toHaveCount(0);
    const esNav = page.getByRole('complementary', { name: 'Navegación de Shop Admin' });
    await expect(esNav.getByRole('link', { name: 'Operaciones', exact: true })).toBeVisible();
    await expect(esNav.getByRole('link', { name: 'Work Orders', exact: true })).toBeVisible();
    await expect(esNav.getByRole('link', { name: 'Operaciones del patio', exact: true })).toBeVisible();
    await expect(esNav.getByRole('link', { name: 'Unidades', exact: true })).toBeVisible();
    await expect(esNav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
  });

  test('mobile Admin navigation is a one-column sheet with every Admin link', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Current shop operations' })).toBeVisible();

    const openNav = page.getByRole('button', { name: 'Open Shop Admin navigation' });
    await expect(openNav).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openNav.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const mobileNav = dialog.getByRole('navigation', { name: 'Shop Admin mobile navigation' });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav).not.toHaveClass(/grid-cols-2/);
    for (const name of ['Dashboard', 'Work Orders', 'Yard Operations', 'Trucks', 'Mechanics', 'Job Catalog', 'History']) {
      await expect(mobileNav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    // LTR-122: grouped by job — operation, setup, audit.
    for (const group of ['Operations', 'Setup', 'Audit']) {
      await expect(mobileNav.getByText(group, { exact: true })).toBeVisible();
    }
    await expect(mobileNav.getByRole('link')).toHaveText(['Dashboard', 'Yard Operations', 'Work Orders', 'Trucks', 'Mechanics', 'Job Catalog', 'History']);

    await page.getByRole('button', { name: 'Close Shop Admin navigation' }).click();
    await page.getByRole('button', { name: /Switch to Spanish|Language: English/ }).click();
    await expect(page.getByRole('heading', { name: 'Operaciones del Shop' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir navegación de Shop Admin' }).click();
    const esMobileNav = page.getByRole('dialog').getByRole('navigation', { name: 'Navegación móvil de Shop Admin' });
    for (const name of ['Operaciones', 'Work Orders', 'Operaciones del patio', 'Unidades', 'Mecánicos', 'Catálogo de Jobs', 'Historial']) {
      await expect(esMobileNav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(esMobileNav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);

    await esMobileNav.getByRole('link', { name: 'Unidades', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/trucks$/);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Unidades' })).toBeVisible();
  });

  test('manager navigates Dashboard to filtered list, pagination, and read-only detail', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
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
    await expect(page.locator('header .section-label')).toHaveText('Shop Admin');
    await expect(page.getByText('Read only')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Truck details' })).toBeVisible();
    await expect(page.getByText('120,000').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent repair history' })).toBeVisible();
    await expect(page.getByText('WO-0104').first()).toBeVisible();
    // LTR-109: times, correction, pauses and Activity Log live in "History and audit".
    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeHidden();
    await page.getByTestId('admin-wo-history').locator('summary').click();
    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    // LTR-126: notes are append-only entries with author and time.
    await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Add note' }).fill('Check the leak again');
    await page.getByRole('button', { name: 'Add note' }).click();
    await expect(page.getByRole('main').getByText('Note added.')).toBeVisible();
    await expect(page.getByText('Check the leak again')).toBeVisible();
    await expect(page.getByText(/Shop Manager · /).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Add note' })).toHaveValue('');
    // LTR-154 / D11: no Work Order team editor; each Job has its own owner.
    await expect(page.getByRole('heading', { name: 'Assignments' })).toHaveCount(0);
    await page.getByLabel('Reason for this Job change').fill('Not needed');
    await page.getByRole('button', { name: 'Confirm job cancellation' }).click();
    await expect(page.getByRole('main').getByText('Job cancelled.')).toBeVisible();
    await page.getByLabel('Reason for this Job change').fill('Job is still required');
    await page.getByRole('button', { name: 'Confirm job reopen' }).click();
    await expect(page.getByRole('main').getByText('Job reopened.')).toBeVisible();
    // Cancel WO-0103, not WO-0101: the fixture API keeps state for the whole run,
    // and later tests need WO-0101 to stay open and Waiting / Paused.
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000103');
    await expect(page.getByRole('heading', { name: 'T-103' })).toBeVisible();
    await page.getByLabel('Reason for cancellation').fill('Duplicate Work Order');
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(page.getByRole('main').getByText('Work Order cancelled.')).toBeVisible();
    await expect(page.getByText('Cancelled').first()).toBeVisible();
    await page.getByRole('link', { name: 'Back to Work Orders' }).click();
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000102');
    await expect(page.getByRole('heading', { name: 'T-102' })).toBeVisible();
    await expect(page.getByTestId('admin-wo-next-action').getByText('Jobs are done. Confirm completion to close this Work Order.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm completion' }).first()).toBeVisible();
    await page.getByTestId('admin-wo-history').locator('summary').click();
    await page.getByLabel('Time segment').selectOption({ index: 1 });
    await page.getByLabel('Corrected end time').fill('2026-09-06T17:00');
    await page.getByLabel('Reason for time correction').fill('Clock was wrong');
    await page.getByRole('button', { name: 'Apply time correction' }).click();
    await expect(page.getByRole('main').getByText('Time correction saved.')).toBeVisible();
    await page.getByTestId('admin-wo-next-action').getByRole('button', { name: 'Confirm completion' }).click();
    await expect(page.getByRole('main').getByText('Work Order completed.')).toBeVisible();
    await page.getByLabel('Reason for Return to Service').fill('Repairs verified');
    await page.getByRole('button', { name: 'Confirm Return to Service' }).click();
    await expect(page.getByRole('main').getByText('Truck returned to service.')).toBeVisible();
    await page.getByLabel('Reason for reopening').fill('More work found');
    await page.getByRole('button', { name: 'Confirm reopen' }).click();
    await expect(page.getByRole('main').getByText('Work Order reopened.')).toBeVisible();
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
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: /^Open Work Orders\b/ }).click();
    await expect(page).toHaveURL(/status=created%2Cin_progress%2Cwaiting_paused/);
    await page.goBack();

    const verifyMetric = async (name: RegExp, expected: Record<string, string>) => {
      await page.getByRole('region', { name: 'Current shop operations' }).getByRole('link', { name }).click();
      await page.waitForURL((url) => Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value));
      const url = new URL(page.url());
      for (const [key, value] of Object.entries(expected)) expect(url.searchParams.get(key)).toBe(value);
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible({ timeout: 15_000 });
    };
    await verifyMetric(/Waiting \/ Paused/, { status: 'waiting_paused' });
    await verifyMetric(/High \/ Critical open/, { status: 'created,in_progress,waiting_paused', priority: 'high,critical' });
    await verifyMetric(/Open more than 24 hours/, { status: 'created,in_progress,waiting_paused', createdBefore: '2026-09-05T18:30:00.000Z' });
    await verifyMetric(/Completed today/, { status: 'completed', completedFrom: '2026-09-06T04:00:00.000Z', completedBefore: '2026-09-07T04:00:00.000Z' });
    await verifyMetric(/Completed in the last 7 days/, { status: 'completed', completedFrom: '2026-08-31T04:00:00.000Z', completedBefore: '2026-09-07T04:00:00.000Z' });

    await page.goto('/admin/work-orders');
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    const clearPanel = await workOrderFilterPanel(page);
    await expect(clearPanel.getByLabel('Status')).toHaveValue('all');
    await clearPanel.getByRole('button', { name: 'Clear' }).click();
    await expect(page).toHaveURL(/\/admin\/work-orders$/);
    await expect(page.getByText('WO-0101').first()).toBeVisible();
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.getByText('WO-0104').first()).toBeVisible();
    await expect(page.getByText('WO-0105').first()).toBeVisible();
  });

  test('work order search 9 + Apply returns ranked WO/truck matches and EmptyState', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
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

  test('work order filters stay collapsed on mobile and compact on desktop', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
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

    for (const width of [768, 1280, 1366, 1440]) {
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
      expect(box?.height, `desktop toolbar wraps at ${width}px`).toBeLessThan(110);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    }
  });

  test('admin role can load dashboard and pagination completes', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();
    await openAdminNavLink(page, 'Work Orders');
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
      await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
      await page.getByRole('link', { name: 'Back to Shop Admin' }).click();
      await expect(page).toHaveURL(/\/admin$/);

      // The mechanic header has its own "Switch to Spanish"; use the Admin one.
      await page.getByRole('banner', { name: 'Shop Admin controls' }).getByRole('button', { name: 'Switch to Spanish' }).click();
      await expect(page.getByRole('heading', { name: 'Espacios de trabajo' })).toBeVisible();
      await page.getByRole('link', { name: 'Abrir Mecánico PM' }).click();
      await expect(page).toHaveURL(/\/mechanic\/pm$/);
      // The shared ltl_shop_locale cookie keeps the PM workspace in Spanish.
      await expect(page.getByRole('heading', { name: 'Mecánico de PM' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Volver a Shop Admin' })).toBeVisible();
    });
  }

  test('mechanic receives a secure forbidden screen for direct Admin access', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: 'Shop Admin access denied' })).toBeVisible();
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
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await openAdminNavLink(page, 'Mechanics');
    await expect(page).toHaveURL(/\/admin\/mechanics$/);
    await expect(page.getByRole('heading', { name: 'Mechanics' })).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await openAdminNavLink(page, 'History');
    await expect(page).toHaveURL(/\/admin\/history$/);
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await openAdminNavLink(page, 'Trucks');
    await expect(page).toHaveURL(/\/admin\/trucks$/);
    await expect(page.getByRole('heading', { name: 'Trucks' })).toBeVisible();
    await expect(page.getByText('T-101').first()).toBeVisible();
    await expect(page.getByText('WO-0101').first()).toBeVisible();
    await expect(page.getByText('No open Work Order').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await openAdminNavLink(page, 'Job Catalog');
    await expect(page).toHaveURL(/\/admin\/catalog$/);
    await expect(page.getByRole('heading', { name: 'Job Catalog' })).toBeVisible();
    await expect(page.getByText('Brakes').first()).toBeVisible();
    await expect(page.getByText('Suspension').first()).toBeVisible();
    await expect(page.getByText('Inactive').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await page.getByRole('link', { name: 'Brakes' }).click();
    await expect(page).toHaveURL(/\/admin\/catalog\/categories\/00000000-0000-4000-8000-000000000301$/);
    await expect(page.getByRole('heading', { name: 'Brakes' })).toBeVisible();
    await expect(page.getByText('Inspect brake chamber')).toBeVisible();
    await expect(page.getByText('Brake chamber, Chamber')).toBeVisible();
    await expect(page.getByText('Retired brake job')).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
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
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

    await page.context().addCookies([{ name: 'ltl_shop_locale', value: 'es', url: cookieUrl }]);
    const adminEsHtml = await (await page.request.get('/admin')).text();
    expect(adminEsHtml).toContain('Operaciones del Shop');
    expect(adminEsHtml).not.toContain('Shop Operations');

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Operaciones del Shop' })).toBeVisible();
    await page.getByRole('button', { name: /Switch to Spanish|Cambiar a inglés/ }).click();
    const localeCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'ltl_shop_locale');
    expect(localeCookie?.value).toMatch(/^(en|es)$/);
    expect(localeCookie?.path).toBe('/');
    expect(localeCookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + 30_000_000);
  });

  test('Dashboard Work Orders and View all navigate on the first click ten times', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.setViewportSize({ width: 1440, height: 900 });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();
      await page.getByRole('complementary', { name: 'Shop Admin navigation' }).getByRole('link', { name: 'Work Orders', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/work-orders$/);
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();
      await page.getByRole('link', { name: 'View all Work Orders' }).click();
      await expect(page).toHaveURL(/\/admin\/work-orders$/);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Shop Operations' })).toBeVisible();
      await page.getByRole('button', { name: 'Open Shop Admin navigation' }).click();
      await page.getByRole('dialog').getByRole('link', { name: 'Work Orders', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/work-orders$/);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  test('Admin WO detail keeps Confirm completion sticky when Jobs are done', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@lightning.local');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000102');
    await expect(page.getByRole('heading', { name: 'T-102' })).toBeVisible();
    const nextAction = page.getByTestId('admin-wo-next-action');
    await expect(nextAction).toBeVisible();
    const stickyButton = nextAction.getByRole('button', { name: 'Confirm completion' });
    await expect(stickyButton).toBeVisible();
    const stickyBox = await stickyButton.boundingBox();
    expect(stickyBox?.height).toBeGreaterThanOrEqual(44);

    await page.getByTestId('admin-wo-history').locator('summary').click();
    await page.getByRole('heading', { name: 'Activity Log' }).scrollIntoViewIfNeeded();
    await expect(nextAction).toBeInViewport();
    await expect(stickyButton).toBeInViewport();
    const pauseBox = await page.getByRole('heading', { name: /Pause Work Order|Resume Work Order/ }).first().boundingBox();
    const completeCardBox = await page.getByRole('heading', { name: 'Complete Work Order' }).boundingBox();
    expect(completeCardBox && pauseBox && completeCardBox.y < pauseBox.y).toBe(true);

    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000101');
    await expect(page.getByRole('heading', { name: 'T-101' })).toBeVisible();
    await expect(page.getByTestId('admin-wo-next-action')).toHaveCount(0);

    await page.getByRole('button', { name: /Switch to Spanish|Language: English/ }).click();
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000102');
    await expect(page.getByTestId('admin-wo-next-action').getByRole('button', { name: 'Confirmar finalización' })).toBeVisible();
  });
});
