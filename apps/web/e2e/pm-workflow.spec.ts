import { expect, test, type Page, type Route } from '@playwright/test';

const daniel = { id: '00000000-0000-0000-0000-000000000101', email: 'daniel@lightning.local', name: 'Daniel', role: 'mechanic', active: true, pmAuthorized: true, capabilities: ['mechanic.pm'] };
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
  let noteEntries: unknown[] = [];
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
    if (path === '/api/work-orders' && request.method() === 'GET') return fulfill(route, { created: [], active: [summary()], paused: [], completed: [] });
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
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as { kind: string; body: string };
        if (pmSaveDelayMs) await new Promise((resolve) => setTimeout(resolve, pmSaveDelayMs));
        noteEntries = [...noteEntries, { id: `note-${noteEntries.length}`, kind: body.kind, body: body.body, author: { id: daniel.id, name: daniel.name }, createdAt: '2026-01-01T12:05:00.000Z', handledAt: null, handledBy: null }];
      }
      return fulfill(route, { ...detail(), noteEntries });
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
  await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible();
}

async function chooseTruckAndCreate(page: Page) {
  await page.getByRole('link', { name: /Create PM Service|Create New Work Order/i }).click();
  await expect(page.getByRole('heading', { name: /New PM Service|New Work Order/i })).toBeVisible();
  const input = page.getByRole('combobox', { name: /Truck/i }).first();
  await input.fill('905');
  await expect(page.getByRole('option', { name: /905/i }).first()).toBeVisible();
  await page.getByRole('option', { name: /905/i }).first().click();
  await expect(page.getByRole('button', { name: /Create PM Service/i })).toBeEnabled();
  await page.getByRole('button', { name: /Create PM Service/i }).click();
}

test.describe('Daniel PM workflow', () => {
  test('auto-starts PM without creating a notes record', async ({ page }) => {
    let createBody: Record<string, unknown> | undefined;
    await mockPmApi(page);
    await page.route('**/api/work-orders', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      createBody = route.request().postDataJSON();
      await fulfill(route, { id: woId }, 201);
    });
    await login(page);
    await chooseTruckAndCreate(page);
    await expect(page.getByRole('heading', { name: /PM Service/i })).toBeVisible();
    await expect(page.getByText('Jobs To Do')).toHaveCount(0);
    await expect.poll(() => createBody).toMatchObject({ primaryCategoryId: pmCategory.id, mechanicIds: [], jobs: [] });
    expect(createBody).not.toHaveProperty('notes');
  });

  test('adds an append-only PM note and keeps observed mileage focused during a slow save', async ({ page }) => {
    await mockPmApi(page, null, 750);
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    // LTR-126: a note is its own entry with author and time; the box clears after adding.
    const notes = page.getByPlaceholder('Write a note, or describe additional work the Truck needs');
    await notes.fill('Filter housing inspected');
    await page.getByRole('button', { name: 'Add Note' }).click();
    await expect(page.getByText('Filter housing inspected')).toBeVisible();
    await expect(page.getByText(/Daniel · /)).toBeVisible();
    await expect(notes).toHaveValue('');

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
    await expect(page.getByText('Parts used')).toHaveCount(0);
    await expect(page.getByText('Enter the observed mileage to record parts used.')).toBeVisible();
    await page.getByLabel('Observed mileage').fill('155000');
    await expect(page.getByLabel('Fuel Filter: no compatible parts for this truck')).toBeVisible();
    const oil = page.getByLabel('Oil Filter 1 Unit');
    await expect(oil).toBeVisible();
    await oil.selectOption(oilPart);
    await expect(oil).toHaveValue(oilPart);
  });

  test('LTR-133: tabs lead to Truck search and Completed work', async ({ page }) => {
    await mockPmApi(page);
    await login(page);
    const nav = page.getByRole('navigation', { name: 'Mechanic workspace' });
    await expect(nav.getByRole('link', { name: 'My work' })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Trucks' }).click();
    await expect(page).toHaveURL(/\/mechanic\/pm\/trucks$/);
    await expect(page.getByRole('heading', { name: 'Find a Truck' })).toBeVisible();
    await page.getByLabel('Truck', { exact: true }).fill('905');
    const result = page.getByRole('link', { name: /Truck 905/ });
    await expect(result).toHaveAttribute('href', `/trucks/${truck.id}/history?from=%2Fmechanic%2Fpm%2Ftrucks`);
    await nav.getByRole('link', { name: 'Completed' }).click();
    await expect(page).toHaveURL(/\/mechanic\/pm\/completed$/);
    await expect(page.getByRole('heading', { name: 'Completed work' })).toBeVisible();
    await expect(page.getByText('No completed work yet.')).toBeVisible();
  });

  test('LTR-140: Truck search marks a Truck that already has an open Work Order', async ({ page }) => {
    await mockPmApi(page);
    // Registered after mockPmApi, so it answers /api/trucks first.
    await page.route('**/api/trucks', (route) => fulfill(route, [
      { ...truck, openWorkOrder: { id: 'wo-open', displayId: 'WO-009', status: 'in_progress' } },
    ]));
    await login(page);
    await page.goto('/mechanic/pm/trucks');
    await page.getByLabel('Truck', { exact: true }).fill('905');
    await expect(page.getByRole('link', { name: /Truck 905/ }).getByTestId('truck-open-work-order')).toHaveText('Open WO-009');
    await page.goto('/mechanic/pm/new');
    await page.getByRole('combobox', { name: /Truck/i }).first().fill('905');
    await expect(page.getByRole('option', { name: /#905/ }).getByTestId('truck-open-work-order')).toHaveText('Open WO-009');
  });

  test('PM-only mechanic leaving /mechanic/standard gets an access exit', async ({ page }) => {
    await mockPmApi(page);
    await login(page);
    await page.goto('/mechanic/standard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status', { name: /Restoring session|Loading work orders/i })).toHaveCount(0);
    await expect(page.getByText(/not available for your account/i)).toBeVisible();
    await page.getByRole('link', { name: /Go to your Shop home/i }).click();
    await expect(page).toHaveURL(/\/mechanic\/pm$/);
    await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible();
  });

  test('PM service load failure uses shared retry', async ({ page }) => {
    await mockPmApi(page);
    await page.route(`**/api/work-orders/${woId}/pm`, async (route) => {
      if (route.request().method() === 'GET') {
        await fulfill(route, { message: 'Unable to load PM service details.' }, 500);
        return;
      }
      return route.fallback();
    });
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    await expect(page.getByRole('alert').filter({ hasText: /Unable to load PM service details/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Try again|Retry/i })).toBeVisible();
  });
});

test.describe('PM job inside the truck Work Order (LTR-146 / LTR-148)', () => {
  const jobWoId = '00000000-0000-0000-0000-000000000901';
  const pmJobId = '00000000-0000-0000-0000-000000000911';
  const pmCategoryId = pmCategory.id;

  async function mockPmJobApi(page: Page) {
    let started: string | null = null;
    let finished = false;
    let savedPm = pm(null);
    const pmJob = () => ({
      id: pmJobId, displayName: 'PM A Service', status: finished ? 'completed' : 'to_do', startedAt: started,
      completedAt: finished ? '2026-01-01T13:00:00.000Z' : null, assignedMechanic: { id: daniel.id, name: daniel.name },
    });
    const jobSummary = () => ({
      ...summary(), id: jobWoId, displayId: 'WO-900', primaryCategoryName: 'Inspection', status: 'created',
      priority: 'normal', jobs: [], jobsCompleted: 0, jobsTotal: 5, pmJob: pmJob(),
    });
    const jobDetail = () => ({
      ...jobSummary(), notes: null, createdById: 'mgr', completedAt: null, totalActiveLaborMs: 0, totalWaitingMs: 0,
      laborRunning: false, mechanics: [], currentPause: null, truck, version: 1, noteEntries: [],
      jobs: [{
        id: pmJobId, workOrderId: jobWoId, catalogJobId: 'cj-pm-a', categoryId: pmCategoryId,
        category: { id: pmCategoryId, name: 'PM' }, displayName: 'PM A Service', customDescription: null,
        status: finished ? 'completed' : 'to_do', completedAt: null, completedById: null, completionNotes: null,
        assignedMechanic: { id: daniel.id, name: daniel.name }, startedAt: started,
      }],
    });
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return fulfill(route, { user: daniel });
      if (path === '/api/catalog/categories') return fulfill(route, [pmCategory]);
      if (path.startsWith('/api/catalog/')) return fulfill(route, []);
      if (path === '/api/work-orders' && request.method() === 'GET') {
        const item = jobSummary();
        return fulfill(route, started
          ? { created: [], active: [{ ...item, status: 'in_progress' }], paused: [], completed: [] }
          : { created: [item], active: [], paused: [], completed: [] });
      }
      if (path === `/api/work-orders/${jobWoId}/jobs/${pmJobId}/pm/start`) {
        started = '2026-01-01T12:30:00.000Z';
        savedPm = { ...savedPm, workOrderId: jobWoId };
        return fulfill(route, jobDetail());
      }
      if (path === `/api/work-orders/${jobWoId}/jobs/${pmJobId}/complete`) {
        finished = true;
        return fulfill(route, jobDetail());
      }
      if (path === `/api/work-orders/${jobWoId}/pm`) {
        if (request.method() === 'POST') {
          const body = request.postDataJSON() as { observedMileage: number | null; selections: unknown[] };
          savedPm = { ...savedPm, observedMileage: body.observedMileage, selections: body.selections };
        }
        return fulfill(route, { ...savedPm, workOrderId: jobWoId, canEdit: Boolean(started) && !finished });
      }
      if (path === `/api/work-orders/${jobWoId}`) return fulfill(route, jobDetail());
      return route.continue();
    });
  }

  test('Standard mechanic does not get "Complete job" on the PM job of someone else (LTR-151)', async ({ page }) => {
    const standard = { ...daniel, id: '00000000-0000-0000-0000-000000000102', email: 'mechanic@lightning.local', name: 'Alejandro', pmAuthorized: false, capabilities: ['mechanic.standard'] };
    const brakesJobId = '00000000-0000-0000-0000-000000000912';
    const assignee = { id: daniel.id, name: daniel.name };
    const detail = {
      ...summary(), id: jobWoId, displayId: 'WO-900', primaryCategoryName: 'Inspection', status: 'in_progress',
      pmJob: { id: pmJobId, displayName: 'PM A Service', status: 'to_do', startedAt: null, completedAt: null, assignedMechanic: assignee },
      notes: null, createdById: 'mgr', completedAt: null, totalActiveLaborMs: 0, totalWaitingMs: 0, laborRunning: true,
      mechanics: [{ mechanicId: standard.id, mechanicName: standard.name }], currentPause: null, truck, version: 1, noteEntries: [],
      jobsCompleted: 0, jobsTotal: 2,
      jobs: [
        { id: pmJobId, workOrderId: jobWoId, catalogJobId: 'cj-pm-a', categoryId: pmCategoryId, category: { id: pmCategoryId, name: 'PM' }, displayName: 'PM A Service', customDescription: null, status: 'to_do', completedAt: null, completedById: null, completionNotes: null, assignedMechanic: assignee, startedAt: null },
        { id: brakesJobId, workOrderId: jobWoId, catalogJobId: 'cj-brakes', categoryId: 'cat-brakes', category: { id: 'cat-brakes', name: 'Brakes' }, displayName: 'Brake adjustment', customDescription: null, status: 'to_do', completedAt: null, completedById: null, completionNotes: null, assignedMechanic: null, startedAt: null },
      ],
    };
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') return fulfill(route, { user: standard });
      if (path === '/api/work-orders' && route.request().method() === 'GET') return fulfill(route, { created: [], active: [detail], paused: [], completed: [] });
      if (path === `/api/work-orders/${jobWoId}`) return fulfill(route, detail);
      if (path.startsWith('/api/catalog/')) return fulfill(route, []);
      return route.continue();
    });
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/mechanic/, { timeout: 15_000 });
    await page.goto(`/work-orders/${jobWoId}`);
    await expect(page.getByRole('button', { name: /Brake adjustment/ })).toBeEnabled();
    await expect(page.getByTestId('job-read-only')).toContainText('PM A Service');
    await expect(page.getByRole('button', { name: /PM A Service/ })).toHaveCount(0);
  });

  test('PM mechanic starts and finishes only the PM job', async ({ page }) => {
    await mockPmJobApi(page);
    await login(page);
    await expect(page.getByText('PM A Service · Work Order WO-900')).toBeVisible();
    await page.getByRole('link', { name: /Start PM service/i }).click();
    await expect(page).toHaveURL(new RegExp(`/work-orders/${jobWoId}\\?view=pm$`));
    await expect(page.getByText('Start the PM service to record the observed mileage and parts.')).toBeVisible();
    await page.getByRole('button', { name: 'Start PM service' }).click();
    await page.getByLabel('Observed mileage').fill('120500');
    await page.getByLabel('Oil Filter 1 Unit').selectOption(oilPart);
    const finish = page.getByRole('button', { name: 'Finish Work' });
    await expect(finish).toBeEnabled({ timeout: 10_000 });
    await finish.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Finish Work' }).click();
    await expect(page).toHaveURL(/\/mechanic\/pm$/);
  });
});
