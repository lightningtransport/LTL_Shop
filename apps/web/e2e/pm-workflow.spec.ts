import { expect, test, type Page, type Route } from '@playwright/test';

const daniel = { id: '00000000-0000-0000-0000-000000000101', email: 'daniel@lightning.local', name: 'Daniel', role: 'mechanic', active: true, pmAuthorized: true };
const truck = { id: '00000000-0000-0000-0000-000000000201', truckNumber: '905', make: 'Freightliner', model: 'Cascadia', year: 2022, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport' };
const pmCategory = { id: '00000000-0000-0000-0000-000000000301', name: 'PM', sortOrder: 1 };
const oilPartCategory = '00000000-0000-0000-0000-000000000401';
const oilPart = '00000000-0000-0000-0000-000000000402';
const woId = '00000000-0000-0000-0000-000000000501';

const summary = (status = 'in_progress') => ({ id: woId, displayId: 'WO-PM-1001', truckId: truck.id, truckNumber: truck.truckNumber, primaryCategoryId: pmCategory.id, primaryCategoryName: 'PM', status, priority: 'normal', jobsCompleted: 0, jobsTotal: 0, jobs: [], currentPauseReason: null, createdAt: '2026-01-01T12:00:00.000Z', startedAt: '2026-01-01T12:01:00.000Z' });
const detail = (status = 'in_progress') => ({ ...summary(status), notes: '', createdById: daniel.id, completedAt: null, totalActiveLaborMs: 1, totalWaitingMs: 0, mechanics: [], currentPause: null, truck, version: 1 });
const pm = (lastCompletedPm: unknown = null, selections: unknown[] = [], observedMileage: number | null = null) => ({ workOrderId: woId, canEdit: true, currentTruckMileage: truck.mileage, observedMileage, lastCompletedPm, categories: [{ id: oilPartCategory, slug: 'oil-filter-1-unit', name: 'Oil Filter 1 Unit', parts: [{ id: oilPart, partNumber: '2234788', displayName: 'PETERBILT Oil Filter Paccar' }] }, { id: '00000000-0000-0000-0000-000000000403', slug: 'fuel-filter', name: 'Fuel Filter', parts: [] }], selections });

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPmApi(page: Page, last: unknown = null, pmSaveDelayMs = 0) {
  let notes = '';
  let currentLast = last;
  let savedPm = pm(last);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return fulfill(route, { user: daniel });
    if (path === '/api/catalog/categories') return fulfill(route, [pmCategory]);
    if (path === '/api/mechanics') return fulfill(route, [{ ...daniel, role: 'mechanic' }]);
    if (path === '/api/trucks') return fulfill(route, [truck]);
    if (path === `/api/trucks/${truck.id}/open-work-order`) return fulfill(route, { exists: false });
    if (path === '/api/work-orders' && request.method() === 'GET') return fulfill(route, { created: [], active: [summary()], paused: [] });
    if (path === '/api/work-orders' && request.method() === 'POST') return fulfill(route, { id: woId }, 201);
    if (path === `/api/work-orders/${woId}/pm`) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as { observedMileage: number | null; selections: unknown[] };
        savedPm = { ...savedPm, observedMileage: body.observedMileage, selections: body.selections };
        if (pmSaveDelayMs) await new Promise((resolve) => setTimeout(resolve, pmSaveDelayMs));
      }
      return fulfill(route, { ...savedPm, lastCompletedPm: currentLast });
    }
    if (path === `/api/work-orders/${woId}/notes`) {
      if (request.method() === 'POST') notes = (request.postDataJSON() as { notes?: string }).notes ?? '';
      return fulfill(route, { ...detail(), notes });
    }
    if (path === `/api/work-orders/${woId}`) return fulfill(route, detail());
    if (path === `/api/work-orders/${woId}/complete`) return fulfill(route, detail('completed'));
    return route.continue();
  });
  return { setLast: (next: unknown) => { currentLast = next; } };
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

async function chooseTruckAndCreate(page: Page) {
  await page.getByRole('link', { name: /Create New PM Service|Create New Work Order/i }).click();
  await expect(page.getByRole('heading', { name: /New PM Service|New Work Order/i })).toBeVisible();
  const input = page.getByRole('combobox', { name: /Truck/i }).first();
  await input.fill('905');
  await expect(page.getByRole('option', { name: /905/i }).first()).toBeVisible();
  await page.getByRole('option', { name: /905/i }).first().click();
  await expect(page.getByRole('button', { name: /Create PM Work Order/i })).toBeEnabled();
  await page.getByRole('button', { name: /Create PM Work Order/i }).click();
}

test.describe('Daniel PM workflow', () => {
  test('auto-starts PM without creating a notes record', async ({ page }) => {
    let createBody: Record<string, unknown> | undefined;
    await mockPmApi(page);
    await page.route('**/api/work-orders', async (route) => {
      if (route.request().method() === 'POST') createBody = route.request().postDataJSON();
      await fulfill(route, { id: woId }, 201);
    });
    await login(page);
    await chooseTruckAndCreate(page);
    await expect(page.getByRole('heading', { name: /PM Service/i })).toBeVisible();
    await expect.poll(() => createBody).toMatchObject({ primaryCategoryId: pmCategory.id, mechanicIds: [], jobs: [] });
    expect(createBody).not.toHaveProperty('notes');
  });

  test('autosaves PM notes and keeps observed mileage focused during a slow save', async ({ page }) => {
    await mockPmApi(page, null, 750);
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    const notes = page.getByLabel('Notes');
    await notes.fill('Filter housing inspected');
    await notes.blur();
    await expect(page.getByText('Saved')).toBeVisible();
    await expect(notes).toHaveValue('Filter housing inspected');

    const observedMileage = page.getByLabel('Observed mileage');
    await observedMileage.fill('155000');
    await expect(observedMileage).toBeFocused();
    await page.waitForTimeout(650);
    await expect(observedMileage).toBeFocused();
    await expect(observedMileage).toHaveValue('155,000');
  });

  test('formats last PM mileage and date, with an empty state when absent', async ({ page }) => {
    const last = { workOrderId: 'old-pm', displayId: 'WO-PM-0999', completedAt: '2025-12-01T12:00:00.000Z', observedMileage: 119000 };
    const mock = await mockPmApi(page, last);
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    await expect(page.getByLabel('Last completed PM')).toHaveValue(/119,000 mi/);
    mock.setLast(null);
    await page.reload();
    await expect(page.getByLabel('Last completed PM')).toHaveValue(/No prior PM recorded/);
  });

  test('shows category empty state and validates truck fitment', async ({ page }) => {
    await mockPmApi(page);
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    await expect(page.getByLabel('Fuel Filter: no compatible parts for this truck')).toBeVisible();
    const oil = page.getByLabel('Oil Filter 1 Unit');
    await expect(oil).toBeVisible();
    await oil.selectOption(oilPart);
    await expect(oil).toHaveValue(oilPart);
  });
});
