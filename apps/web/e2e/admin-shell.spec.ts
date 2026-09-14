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
    await expect(page.getByText(/^Actualizado /)).toHaveCount(1);
    await expect(page.getByText(/supabase|postgres|Fuente:|Generado/i)).toHaveCount(0);
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
      await expect(mobileNav.getByRole('link', { name })).toBeVisible();
    }

    await mobileNav.getByRole('link', { name: 'Trucks' }).click();
    await expect(page).toHaveURL(/\/admin\/trucks$/);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Trucks' })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'WO-0101' })).toBeVisible();
    await expect(page.locator('header .section-label')).toHaveText('Shop Admin');
    await expect(page.getByText('Read only')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Truck details' })).toBeVisible();
    await expect(page.getByText('120,000').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent repair history' })).toBeVisible();
    await expect(page.getByText('WO-0104').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Priority and notes' })).toBeVisible();
    await page.getByLabel('Work Order notes').fill('Check the leak again');
    await page.getByRole('button', { name: 'Update priority and notes' }).click();
    await expect(page.getByText('Priority and notes updated.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Assignments' })).toBeVisible();
    await page.getByLabel('Reason for this Job change').fill('Not needed');
    await page.getByRole('button', { name: 'Confirm job cancellation' }).click();
    await expect(page.getByText('Job cancelled.')).toBeVisible();
    await page.getByLabel('Reason for this Job change').fill('Job is still required');
    await page.getByRole('button', { name: 'Confirm job reopen' }).click();
    await expect(page.getByText('Job reopened.')).toBeVisible();
    await page.getByLabel('Select a mechanic to add').selectOption({ label: 'Anthony' });
    await page.getByRole('button', { name: 'Add mechanic' }).click();
    await expect(page.getByText('Anthony').first()).toBeVisible();
    await page.getByRole('listitem').filter({ hasText: 'Anthony' }).getByRole('button', { name: 'Remove' }).click();
    await page.getByLabel('Reason for cancellation').fill('Duplicate Work Order');
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(page.getByText('Work Order cancelled.')).toBeVisible();
    await expect(page.getByText('Cancelled').first()).toBeVisible();
    await page.getByRole('link', { name: 'Back to Work Orders' }).click();
    await page.goto('/admin/work-orders/00000000-0000-4000-8000-000000000102');
    await expect(page.getByRole('heading', { name: 'WO-0102' })).toBeVisible();
    await page.getByLabel('Time segment').selectOption({ index: 1 });
    await page.getByLabel('Corrected end time').fill('2026-09-06T17:00');
    await page.getByLabel('Reason for time correction').fill('Clock was wrong');
    await page.getByRole('button', { name: 'Apply time correction' }).click();
    await expect(page.getByText('Time correction saved.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm completion' }).click();
    await expect(page.getByText('Work Order completed.')).toBeVisible();
    await page.getByLabel('Reason for Return to Service').fill('Repairs verified');
    await page.getByRole('button', { name: 'Confirm Return to Service' }).click();
    await expect(page.getByText('Truck returned to service.')).toBeVisible();
    await page.getByLabel('Reason for reopening').fill('More work found');
    await page.getByRole('button', { name: 'Confirm reopen' }).click();
    await expect(page.getByText('Work Order reopened.')).toBeVisible();
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
    await page.getByRole('link', { name: 'Work Orders' }).first().click();
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

      await page.getByRole('button', { name: /Switch to Spanish|Language: English/ }).click();
      await expect(page.getByRole('heading', { name: 'Espacios de trabajo' })).toBeVisible();
      await page.getByRole('link', { name: 'Abrir Mecánico PM' }).click();
      await expect(page).toHaveURL(/\/mechanic\/pm$/);
      await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to Shop Admin' })).toBeVisible();
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
    await page.getByRole('link', { name: 'Mechanics' }).first().click();
    await expect(page).toHaveURL(/\/admin\/mechanics$/);
    await expect(page.getByRole('heading', { name: 'Mechanics' })).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await page.getByRole('link', { name: 'History' }).first().click();
    await expect(page).toHaveURL(/\/admin\/history$/);
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await page.getByRole('link', { name: 'Trucks' }).first().click();
    await expect(page).toHaveURL(/\/admin\/trucks$/);
    await expect(page.getByRole('heading', { name: 'Trucks' })).toBeVisible();
    await expect(page.getByText('T-101').first()).toBeVisible();
    await expect(page.getByText('WO-0101').first()).toBeVisible();
    await expect(page.getByText('No open Work Order').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|save/i })).toHaveCount(0);
    await page.getByRole('link', { name: 'Job Catalog' }).first().click();
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
});
