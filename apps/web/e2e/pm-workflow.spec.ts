import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';

const daniel = { id: '00000000-0000-0000-0000-000000000101', email: 'daniel@lightning.local', name: 'Daniel', role: 'mechanic', active: true, capabilities: ['mechanic.pm'] };
const truck = { id: '00000000-0000-0000-0000-000000000201', truckNumber: '905', make: 'Freightliner', model: 'Cascadia', year: 2022, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport' };
const pmCategory = { id: '00000000-0000-0000-0000-000000000301', name: 'PM', sortOrder: 1 };
const oilPartCategory = '00000000-0000-0000-0000-000000000401';
const oilPart = '00000000-0000-0000-0000-000000000402';
const woId = '00000000-0000-0000-0000-000000000501';
const danielPmJobId = '00000000-0000-0000-0000-000000000521';

// LTR-180: the legacy PM Work Order is gone. Daniel's PM lives as the started PM job
// of the truck Work Order (LTR-146), so these fixtures describe that shape.
const danielPmJob = (status = 'in_progress') => ({
  id: danielPmJobId, displayName: 'PM A Service', status: status === 'completed' ? 'completed' : 'to_do',
  startedAt: '2026-01-01T12:01:00.000Z', completedAt: status === 'completed' ? '2026-01-01T13:00:00.000Z' : null,
  assignedMechanic: { id: daniel.id, name: daniel.name },
});
const summary = (status = 'in_progress') => ({ id: woId, displayId: 'WO-1001', truckId: truck.id, truckNumber: truck.truckNumber, primaryCategoryId: 'cat-inspection', primaryCategoryName: 'Inspection', status, priority: 'normal', jobsCompleted: 0, jobsTotal: 1, jobs: [], currentPauseReason: null, createdAt: '2026-01-01T12:00:00.000Z', startedAt: '2026-01-01T12:01:00.000Z', pmJob: danielPmJob(status) });
const detail = (status = 'in_progress') => ({
  ...summary(status), notes: '', createdById: 'mgr', completedAt: null, totalActiveLaborMs: 1, totalWaitingMs: 0, laborRunning: true,
  mechanics: [], currentPause: null, truck, version: 1, noteEntries: [],
  jobs: [{
    id: danielPmJobId, workOrderId: woId, catalogJobId: 'cj-pm-a', categoryId: pmCategory.id,
    category: { id: pmCategory.id, name: 'PM' }, displayName: 'PM A Service', customDescription: null,
    status: danielPmJob(status).status, completedAt: danielPmJob(status).completedAt, completedById: null, completionNotes: null,
    assignedMechanic: { id: daniel.id, name: daniel.name }, startedAt: '2026-01-01T12:01:00.000Z',
  }],
});
const pm = (lastCompletedPm: unknown = null, selections: unknown[] = [], observedMileage: number | null = null) => ({ workOrderId: woId, canEdit: true, currentTruckMileage: truck.mileage, observedMileage, lastCompletedPm, categories: [{ id: oilPartCategory, slug: 'oil-filter-1-unit', name: 'Oil Filter 1 Unit', parts: [{ id: oilPart, partNumber: '2234788', displayName: 'PETERBILT Oil Filter Paccar' }] }, { id: '00000000-0000-0000-0000-000000000403', slug: 'fuel-filter', name: 'Fuel Filter', parts: [] }], selections });

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPmApi(page: Page, last: unknown = null, pmSaveDelayMs = 0) {
  let noteEntries: unknown[] = [];
  let currentLast = last;
  let savedPm = pm(last);
  // D2: one running PM per PM mechanic. The active PM exists only after Create PM service.
  let created = false;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return fulfill(route, { user: daniel });
    if (path === '/api/catalog/categories') return fulfill(route, [pmCategory]);
    if (path.startsWith('/api/catalog/')) return fulfill(route, []);
    if (path === '/api/trucks') return fulfill(route, [truck]);
    if (path === `/api/trucks/${truck.id}/open-work-order`) return fulfill(route, { exists: false });
    if (path === '/api/work-orders' && request.method() === 'GET') return fulfill(route, { created: [], active: created ? [summary()] : [], paused: [], completed: [] });
    if (path === '/api/work-orders' && request.method() === 'POST') {
      created = true;
      return fulfill(route, { id: woId }, 201);
    }
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
    if (path === `/api/work-orders/${woId}/jobs/${danielPmJobId}/complete`) return fulfill(route, detail('completed'));
    return route.continue();
  });
  return { setLast: (next: unknown) => { currentLast = next; } };
}

async function login(page: Page) {
  await devLogin(page);
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
    // The PM mechanic lands on the PM job of the truck Work Order (LTR-146).
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
    const notes = page.getByPlaceholder('Write a note: something the shop should know');
    await notes.fill('Filter housing inspected');
    await page.getByRole('button', { name: 'Add Note' }).click();
    await expect(page.getByText('Filter housing inspected')).toBeVisible();
    await expect(page.locator('li').filter({ hasText: 'Filter housing inspected' }).getByText('Daniel', { exact: true })).toBeVisible();
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
    // Stage PM-2 (UX-4-002): what is already known is text with a label, not a field.
    const lastPm = page.getByText('Last PM', { exact: true }).locator('xpath=following-sibling::dd[1]');
    await expect(lastPm).toHaveText(/119,000 mi · Dec 1/);
    mock.setLast(null);
    await page.reload();
    await expect(page.getByText('Last PM', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('No PM on record');
  });

  test('shows category empty state and validates truck fitment', async ({ page }) => {
    await mockPmApi(page);
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    // Stage PM-2: the parts are switches, locked until the mileage is entered.
    await expect(page.getByText('Enter the observed mileage to record parts used.')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Oil Filter 1 Unit changed' })).toBeDisabled();
    await page.getByLabel('Observed mileage').fill('155000');
    await expect(page.getByTestId('pm-part-row-fuel-filter').getByText(/compatible/i)).toBeVisible();
    await page.getByRole('switch', { name: 'Oil Filter 1 Unit changed' }).click();
    const oil = page.getByLabel('Oil Filter 1 Unit', { exact: true });
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
    // Stage MG-6: the card is not one link; "Repair history ›" is its own row.
    const result = page.locator('li').filter({ hasText: 'Truck 905' }).getByRole('link', { name: /Repair history/i });
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
    await expect(page.locator('li').filter({ hasText: 'Truck 905' }).getByTestId('truck-open-work-order')).toHaveText('Open WO-009');
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

  /** Collects the bodies the PM card POSTs, so a test can say what reached the Shop. */
  function pmPosts(page: Page) {
    const bodies: { observedMileage: number | null; selections: unknown[] }[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === `/api/work-orders/${woId}/pm`) bodies.push(request.postDataJSON());
    });
    return bodies;
  }

  test('Block A (PM2): with a mileage jump not confirmed, parts wait for the confirmation', async ({ page }) => {
    await mockPmApi(page);
    const posts = pmPosts(page);
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    await page.getByLabel('Observed mileage').fill('200000');
    await expect(page.getByText('Confirm the mileage above to save parts.')).toBeVisible();
    const oilSwitch = page.getByRole('switch', { name: 'Oil Filter 1 Unit changed' });
    await expect(oilSwitch).toBeDisabled();
    await page.waitForTimeout(900);
    expect(posts).toHaveLength(0);

    await page.getByRole('button', { name: 'Confirm mileage' }).click();
    await expect(oilSwitch).toBeEnabled();
    await oilSwitch.click();
    await page.getByLabel('Oil Filter 1 Unit', { exact: true }).selectOption(oilPart);
    await expect.poll(() => posts.at(-1)).toMatchObject({ observedMileage: 200000, selections: [{ partId: oilPart }] });
  });

  test('Block A (PM3): clearing the mileage never saves it empty', async ({ page }) => {
    await mockPmApi(page);
    const posts = pmPosts(page);
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    const mileage = page.getByLabel('Observed mileage');
    await mileage.fill('155000');
    await expect.poll(() => posts.at(-1)?.observedMileage).toBe(155000);
    await expect(page.getByText('Saved automatically').first()).toBeVisible();

    await mileage.fill('');
    await mileage.blur();
    await expect(page.getByText('Enter the mileage. The last saved mileage stays until then.').first()).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Oil Filter 1 Unit changed' })).toBeDisabled();
    await page.waitForTimeout(900);
    expect(posts.some((body) => body.observedMileage === null)).toBe(false);
  });

  test('Block A (PM1): without a connection the entry stays on the phone and is sent when it is back', async ({ page }) => {
    await mockPmApi(page);
    await page.route(`**/api/work-orders/${woId}/pm`, (route) => (route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback()));
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    await page.getByLabel('Observed mileage').fill('155000');
    await expect(page.getByTestId('pm-not-saved')).toBeVisible();
    await expect(page.getByText(/stays on this phone and is sent when the connection is back/)).toBeVisible();

    // Leaving and coming back keeps what was entered.
    await page.reload();
    await expect(page.getByLabel('Observed mileage')).toHaveValue('155,000');

    await page.unroute(`**/api/work-orders/${woId}/pm`);
    const posts = pmPosts(page);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => posts.at(-1)?.observedMileage).toBe(155000);
    await expect(page.getByTestId('pm-not-saved')).toHaveCount(0);
    await expect.poll(() => page.evaluate((id) => window.localStorage.getItem(`ltl-pm-draft:${id}`), woId)).toBeNull();
  });

  test('Block A (A12): a Work Order that is gone or no longer mine keeps a way back to My work', async ({ page }) => {
    await mockPmApi(page);
    let status = 404;
    await page.route(`**/api/work-orders/${woId}`, (route) => fulfill(route, { statusCode: status, message: 'nope' }, status));
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    await expect(page.getByText('This Work Order no longer exists.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to My work' })).toHaveAttribute('href', '/mechanic/pm');

    status = 403;
    await page.reload();
    await expect(page.getByText(/You have no Jobs on this Work Order anymore/)).toBeVisible();
    await page.getByRole('link', { name: 'Back to My work' }).click();
    await expect(page).toHaveURL(/\/mechanic\/pm$/);
  });
});

test.describe('PM redesign (Stage PM-4)', () => {
  test('Completed lists finished PMs by day with date, mileage and parts', async ({ page }) => {
    await mockPmApi(page);
    const done = { ...summary('completed'), pmJob: { ...danielPmJob('completed'), completedAt: new Date().toISOString(), observedMileage: 154300, partsCount: 1 } };
    await page.route(/\/api\/work-orders(\?.*)?$/, (route) => (route.request().method() === 'GET'
      ? fulfill(route, { created: [], active: [], paused: [], completed: [done] })
      : route.fallback()));
    await login(page);
    await page.goto('/mechanic/pm/completed');
    const list = page.getByTestId('pm-completed-by-day');
    await expect(list.getByText('Today')).toBeVisible();
    await expect(list.getByText(/154,300 mi · 1 part/)).toBeVisible();
  });

  test('Block C: without a connection the PM screen shows one Offline notice', async ({ page, context }) => {
    await mockPmApi(page);
    await login(page);
    await page.goto(`/work-orders/${woId}`);
    await expect(page.getByLabel('Observed mileage')).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByTestId('offline-strip')).toHaveText(/Offline · your changes are kept on this phone/);
    await context.setOffline(false);
    await expect(page.getByTestId('offline-strip')).toHaveCount(0);
  });

  test('Create PM service names what will happen on a truck with an open Work Order', async ({ page }) => {
    await mockPmApi(page);
    await page.route(`**/api/trucks/${truck.id}/open-work-order`, (route) => fulfill(route, { exists: true, pmJoin: { displayId: 'WO-010', status: 'add', assignedMechanicName: null } }));
    await login(page);
    await page.goto('/mechanic/pm/new');
    await page.getByRole('combobox', { name: /Truck/i }).first().fill('905');
    await page.getByRole('option', { name: /905/i }).first().click();
    await expect(page.getByRole('button', { name: 'Add PM to WO-010' })).toBeEnabled();
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
    const standard = { ...daniel, id: '00000000-0000-0000-0000-000000000102', email: 'mechanic@lightning.local', name: 'Alejandro', capabilities: ['mechanic.standard'] };
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
        { id: brakesJobId, workOrderId: jobWoId, catalogJobId: 'cj-brakes', categoryId: 'cat-brakes', category: { id: 'cat-brakes', name: 'Brakes' }, displayName: 'Brake adjustment', customDescription: null, status: 'to_do', completedAt: null, completedById: null, completionNotes: null,
          // LTR-154 / D11: the Standard mechanic completes only their own Job.
          assignedMechanic: { id: standard.id, name: standard.name }, startedAt: null },
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
    await devLogin(page);
    await expect(page).toHaveURL(/\/mechanic/, { timeout: 15_000 });
    await page.goto(`/work-orders/${jobWoId}`);
    await expect(page.getByRole('button', { name: 'Complete job: Brake adjustment' })).toBeEnabled();
    // LTR-189 (W12): my own Job is a read-only card too; the PM job is the one without a Complete button.
    await page.getByTestId('other-work').getByRole('button', { name: /Other work on this Truck/ }).click();
    await expect(page.getByTestId('job-read-only').filter({ hasText: 'PM A Service' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /PM A Service/ })).toHaveCount(0);
  });

  test('PM mechanic starts and finishes only the PM job', async ({ page }) => {
    await mockPmJobApi(page);
    await login(page);
    await expect(page.getByText('PM A Service · Work Order WO-900')).toBeVisible();
    await page.getByRole('link', { name: /Start PM on Truck 905/ }).click();
    await expect(page).toHaveURL(new RegExp(`/work-orders/${jobWoId}\\?view=pm$`));
    await expect(page.getByText('Start the PM service to record the observed mileage and parts.')).toBeVisible();
    await page.getByRole('button', { name: 'Start PM service' }).click();
    await page.getByLabel('Observed mileage').fill('120500');
    await page.getByRole('switch', { name: 'Oil Filter 1 Unit changed' }).click();
    await page.getByLabel('Oil Filter 1 Unit', { exact: true }).selectOption(oilPart);
    const finish = page.getByRole('button', { name: 'Finish PM' });
    await expect(finish).toBeEnabled({ timeout: 10_000 });
    await expect(page.getByTestId('pm-finish-reason')).toHaveText(/Ready to finish · 120,500 mi · 1 part/);
    await finish.click();
    // Stage PM-2 (UX-7-007): the confirmation shows what stays recorded.
    await expect(page.getByTestId('pm-finish-summary')).toContainText('Oil Filter 1 Unit');
    await page.getByRole('dialog').getByRole('button', { name: 'Finish PM' }).click();
    await expect(page).toHaveURL(/\/mechanic\/pm$/);
  });

  test('Block A (PM5): with a PM running, Create and another PM lead back to it instead of offering Start', async ({ page }) => {
    await mockPmJobApi(page);
    // Daniel's PM on Truck 905 (WO-1001) is running; WO-900 waits with its PM not started.
    await page.route(/\/api\/work-orders(\?.*)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return fulfill(route, { created: [{ ...summary(), id: jobWoId, displayId: 'WO-900', status: 'created', pmJob: { ...danielPmJob(), id: pmJobId, startedAt: null } }], active: [summary()], paused: [], completed: [] });
    });
    await login(page);
    const notice = page.getByTestId('pm-in-progress-notice');
    await expect(notice).toContainText('You have a PM service in progress on Truck 905 (WO-1001).');
    await expect(page.getByRole('button', { name: /Create PM Service/i })).toBeDisabled();
    // The paused-style card of another PM offers no Start either.
    await expect(page.getByRole('link', { name: /Start PM on Truck/ })).toHaveCount(0);

    await page.goto('/mechanic/pm/new');
    await expect(page.getByTestId('pm-in-progress-notice').getByRole('link', { name: 'Continue PM on Truck 905' })).toHaveAttribute('href', `/work-orders/${woId}?view=pm`);

    await page.goto(`/work-orders/${jobWoId}?view=pm`);
    await expect(page.getByTestId('pm-in-progress-notice')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start PM service' })).toBeDisabled();
  });
});
