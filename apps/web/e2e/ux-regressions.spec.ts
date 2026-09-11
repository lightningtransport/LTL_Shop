import { expect, test, type Page, type Route } from '@playwright/test';

const user = {
  id: 'mechanic-1',
  email: 'mechanic@example.com',
  name: 'Alex Mechanic',
  role: 'mechanic',
  active: true,
  pmAuthorized: false,
  capabilities: ['mechanic.standard'],
};

const truck = {
  id: 'truck-905',
  truckNumber: '905',
  make: 'Freightliner',
  model: 'Cascadia',
  year: 2022,
  mileage: 120_000,
  company: 'Lightning Transport',
  owner: 'Lightning Transport',
};

const categories = [
  { id: 'cat-brakes', name: 'Brakes', sortOrder: 1 },
  { id: 'cat-engine', name: 'Engine', sortOrder: 2 },
];

const mechanics = [
  { id: user.id, name: user.name, email: user.email, role: 'mechanic' },
  { id: 'mechanic-2', name: 'Jamie Technician', email: 'jamie@example.com', role: 'mechanic' },
];

const workOrder = {
  id: 'wo-1001',
  displayId: 'WO-1001',
  truckId: truck.id,
  truckNumber: truck.truckNumber,
  primaryCategoryId: categories[0].id,
  primaryCategoryName: categories[0].name,
  status: 'created',
  priority: 'normal',
  jobsCompleted: 0,
  jobsTotal: 1,
  jobs: [{
    id: 'job-1',
    displayName: 'Brake inspection',
    status: 'to_do',
    categoryId: categories[0].id,
    category: { id: categories[0].id, name: categories[0].name },
    assignedMechanic: null,
  }],
  mechanics: [],
  currentPauseReason: null,
  createdAt: '2026-01-01T12:00:00.000Z',
  startedAt: null,
};

const activeWorkOrders = Array.from({ length: 5 }, (_, index) => ({
  ...workOrder,
  id: `wo-active-${index + 1}`,
  displayId: `WO-ACTIVE-${index + 1}`,
  status: 'in_progress',
}));

let workOrdersMode: 'normal' | 'stall-once' = 'normal';
let profileBarrier: Promise<void> | null = null;
let profileMode: 'normal' | 'error' = 'normal';
let truckFixtures = [truck];

const aliases = [
  {
    aliasText: 'brake inspection',
    catalogJobId: 'catalog-brake-inspection',
    categoryId: categories[0].id,
    displayName: 'Brake inspection',
  },
  {
    aliasText: 'brake check',
    catalogJobId: 'catalog-brake-inspection',
    categoryId: categories[0].id,
    displayName: 'Brake inspection',
  },
  {
    aliasText: 'engine diagnostic',
    catalogJobId: 'catalog-engine-diagnostic',
    categoryId: categories[1].id,
    displayName: 'Engine diagnostic',
  },
];

const history = {
  truck,
  items: [
    {
      workOrderId: workOrder.id,
      displayId: workOrder.displayId,
      date: '2025-12-01T12:00:00.000Z',
      primaryCategoryName: 'Brakes',
      truckNumber: truck.truckNumber,
      mechanicNames: [user.name],
      mileage: 119_000,
      jobs: ['Brake inspection'],
      jobDetails: [{
        id: 'job-1',
        categoryId: categories[0].id,
        category: { id: categories[0].id, name: categories[0].name },
        displayName: 'Brake inspection',
        status: 'completed',
      }],
    },
  ],
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockShopApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/auth/me') {
      if (profileBarrier) await profileBarrier;
      if (profileMode === 'error') return json(route, { message: 'Profile unavailable' }, 503);
      return json(route, { user });
    }
    if (path === '/api/work-orders' && request.method() === 'GET') {
      if (workOrdersMode === 'stall-once') {
        workOrdersMode = 'normal';
        return;
      }
      return json(route, { created: [workOrder], active: activeWorkOrders, paused: [], completed: [] });
    }
    if (path === '/api/work-orders' && request.method() === 'POST') {
      return json(route, { id: workOrder.id }, 201);
    }
    if (path === `/api/work-orders/${workOrder.id}`) {
      return json(route, {
        ...workOrder,
        notes: null,
        createdById: user.id,
        completedAt: null,
        totalActiveLaborMs: 0,
        totalWaitingMs: 0,
        mechanics: [],
        currentPause: null,
        truck,
        version: 1,
      });
    }
    if (path === '/api/catalog/categories') return json(route, categories);
    if (path === '/api/catalog/aliases' || path === '/api/catalog/jobs') return json(route, aliases);
    if (path === '/api/mechanics') return json(route, mechanics);
    if (path === '/api/trucks') return json(route, truckFixtures);
    if (path === '/api/admin/session') return json(route, {});
    if (path === `/api/trucks/${truck.id}/open-work-order`) return json(route, { exists: false });
    if (path === `/api/trucks/${truck.id}/repair-history`) return json(route, history);

    // Keep action requests deterministic if a detail page is opened by a regression test.
    if (path.startsWith('/api/work-orders/') && request.method() !== 'GET') {
      return json(route, workOrder);
    }
    return route.continue();
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
}

async function openNewWorkOrder(page: Page) {
  await login(page);
  await page.getByRole('link', { name: /Create New Work Order/i }).click();
  await expect(page.getByRole('heading', { name: /New Work Order/i })).toBeVisible({ timeout: 15_000 });
}

async function selectTruck(page: Page) {
  const truckInput = page.getByRole('combobox', { name: /Truck/i }).or(
    page.getByPlaceholder(/Search Truck Number/i),
  ).first();
  await truckInput.fill('905');
  await expect(page.getByRole('option', { name: /905/i }).first()).toBeVisible();
  await page.getByRole('option', { name: /905/i }).first().click();
  await expect(page.getByText(/Truck Information/i)).toBeVisible();
}

test.describe('Mechanic UX regressions (deterministic API fixtures)', () => {
  test.beforeEach(async ({ page }) => {
    workOrdersMode = 'normal';
    profileBarrier = null;
    profileMode = 'normal';
    truckFixtures = [truck];
    await mockShopApi(page);
  });

  test('finishes login initialization before navigating to Home', async ({ page }) => {
    let releaseProfile!: () => void;
    profileBarrier = new Promise<void>((resolve) => {
      releaseProfile = resolve;
    });

    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('status', { name: /Restoring session/i })).toBeVisible();

    releaseProfile();
    await expect(page).toHaveURL(/\/mechanic\/standard$/);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    await expect(page.getByRole('status', { name: /Loading work orders/i })).toBeHidden();
  });

  test('resets scroll to the top when navigating between screens and on back', async ({ page }) => {
    await login(page);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByRole('link', { name: /Create New Work Order/i }).click();
    await expect(page.getByRole('heading', { name: /New Work Order/i })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const newHeader = await page.getByRole('heading', { name: /New Work Order/i }).boundingBox();
    expect(newHeader?.y).toBeGreaterThanOrEqual(0);
    expect(newHeader?.y).toBeLessThan(await page.evaluate(() => window.innerHeight));
    await expect(page.locator('main')).toBeFocused();

    await page.getByRole('link', { name: /Back/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('opens query actions at the top and preserves dialog focus', async ({ page }) => {
    const activeWorkOrder = activeWorkOrders[0];
    await page.route(`**/api/work-orders/${activeWorkOrder.id}`, async (route) => {
      return json(route, {
        ...activeWorkOrder,
        notes: null,
        createdById: user.id,
        completedAt: null,
        totalActiveLaborMs: 1,
        totalWaitingMs: 0,
        mechanics: [],
        currentPause: null,
        truck,
        version: 1,
      });
    });

    await login(page);
    await page.goto(`/work-orders/${activeWorkOrder.id}`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    // Manager-first ownership: mechanics report a blocker instead of pausing.
    await page.getByRole('button', { name: 'Report Blocker' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Report Blocker/i });
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect
      .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
  });

  test('shows recovery actions when a saved session profile cannot be restored', async ({ page }) => {
    profileMode = 'error';
    await page.addInitScript(() => localStorage.setItem('ltl_shop_token', 'dev:mechanic@example.com'));
    await page.goto('/login');

    await expect(page.getByRole('alert').filter({ hasText: /Profile unavailable/i })).toBeVisible();
    await expect(page.getByRole('status', { name: /Restoring session/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Use another account' }).click();
    await expect(page.getByRole('button', { name: /Dev Login/i })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ltl_shop_token'))).toBeNull();
  });

  test('replaces a stalled Home skeleton with Retry and recovers without reload', async ({ page }) => {
    workOrdersMode = 'stall-once';
    await login(page);
    await expect(page.getByRole('status', { name: /Loading work orders/i })).toBeVisible();
    const timeoutAlert = page.getByRole('alert').filter({ hasText: /took too long/i });
    await expect(timeoutAlert).toBeVisible({ timeout: 12_000 });
    await page.getByRole('button', { name: /Try again|Retry work orders/i }).click();
    await expect(timeoutAlert).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Start Work/i })).toBeVisible();
  });

  test('keeps Home controls exclusive and uses logical back destinations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('banner', { name: 'Home controls' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Back/i })).toHaveCount(0);

    await login(page);
    await expect(page.getByRole('banner', { name: 'Home controls' })).toBeVisible();
    await expect(page.getByAltText('Lightning Transport and Logistics')).toBeVisible();

    await page.getByRole('link', { name: /Create New Work Order/i }).click();
    await expect(page.getByRole('banner', { name: 'Home controls' })).toHaveCount(0);
    await expect(page.getByText(user.name, { exact: true })).toHaveCount(0);
    const backToHome = page.getByRole('link', { name: 'Back to Home' });
    await expect(backToHome).toBeVisible();
    const backBox = await backToHome.boundingBox();
    expect(backBox?.width).toBeGreaterThanOrEqual(44);
    expect(backBox?.height).toBeGreaterThanOrEqual(44);

    await selectTruck(page);
    await page.getByRole('link', { name: /View truck repair history|See Truck Repair History/i }).click();
    await expect(page.getByRole('heading', { name: 'REPAIR HISTORY' })).toBeVisible();
    await expect(page.getByRole('banner', { name: 'Home controls' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to New Work Order' }).click();
    await expect(page.getByRole('heading', { name: 'New Work Order' })).toBeVisible();

    await page.getByRole('link', { name: 'Back to Home' }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    await page.getByRole('link', { name: /Start Work/i }).click();
    await expect(page.getByRole('heading', { name: workOrder.displayId })).toBeVisible();
    await expect(page.getByRole('banner', { name: 'Home controls' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to Home' }).click();
    await expect(page.getByRole('banner', { name: 'Home controls' })).toBeVisible();
  });

  test('toggles light/dark theme and persists explicit preference', async ({ page }) => {
    await login(page);
    const toggle = page.getByRole('button', { name: /toggle (theme|dark mode|light mode)/i }).first();
    await expect(toggle).toBeVisible();

    const before = await page.locator('html').evaluate((node) => ({
      className: node.className,
      theme: node.getAttribute('data-theme'),
    }));
    await toggle.click();
    await expect.poll(() => page.locator('html').evaluate((node) => ({
      className: node.className,
      theme: node.getAttribute('data-theme'),
    }))).not.toEqual(before);

    const after = await page.locator('html').evaluate((node) => ({
      className: node.className,
      theme: node.getAttribute('data-theme'),
    }));
    await page.reload();
    await expect.poll(() => page.locator('html').evaluate((node) => ({
      className: node.className,
      theme: node.getAttribute('data-theme'),
    }))).toEqual(after);
  });

  test('select controls expose labels and a stable non-native chevron layout', async ({ page }) => {
    await openNewWorkOrder(page);
    await selectTruck(page);
    const category = page.getByRole('combobox', { name: /Category/i });
    await expect(category).toBeVisible();
    await expect(category).toHaveAccessibleName(/Category/i);
    const box = await category.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(40);
    expect(await category.evaluate((node) => getComputedStyle(node).appearance)).toMatch(/none|auto/);
    expect(await category.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('Working With supports accessible multi-selection', async ({ page }) => {
    await openNewWorkOrder(page);
    await selectTruck(page);
    const control = page.getByRole('button', { name: /Working With/i });
    await control.click();
    const dialog = page.getByRole('dialog', { name: /Working With/i });
    await expect(dialog).toBeVisible();
    const jamie = dialog.getByRole('checkbox', { name: /Jamie Technician/i });
    await jamie.check();
    await expect(jamie).toBeChecked();
    await dialog.getByRole('button', { name: /Done/i }).click();
    await expect(control).toContainText(/Jamie|more/i);
  });

  test('lists category jobs inline and keeps custom jobs separate from the catalog', async ({ page }) => {
    await openNewWorkOrder(page);
    await selectTruck(page);
    await page.getByRole('combobox', { name: /Category/i }).selectOption(categories[0].id);
    const listedJobs = page.getByRole('list', { name: /Listed jobs for Brakes/i });
    const option = listedJobs.getByRole('button', { name: 'Brake inspection' });
    await expect(option).toHaveCount(1);
    const box = await option.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await option.click();
    await expect(page.getByText('Brake inspection', { exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Job not listed' }).click();
    await expect(listedJobs).toBeHidden();
    await expect(page.getByLabel('Custom job description')).toBeVisible();
    await page.getByRole('button', { name: 'Back to listed jobs' }).click();
    await expect(listedJobs).toBeVisible();
  });

  test('creates a Standard Work Order with Jobs from multiple Categories without dropping the initial Job', async ({ page }) => {
    await openNewWorkOrder(page);
    await selectTruck(page);
    const category = page.getByRole('combobox', { name: /Category/i });
    await category.selectOption(categories[0].id);
    await page.getByRole('list', { name: /Listed jobs for Brakes/i })
      .getByRole('button', { name: 'Brake inspection' }).click();
    await category.selectOption(categories[1].id);
    await expect(page.getByText('Brake inspection', { exact: true })).toBeVisible();
    await page.getByRole('list', { name: /Listed jobs for Engine/i })
      .getByRole('button', { name: 'Engine diagnostic' }).click();

    const request = page.waitForRequest((candidate) =>
      candidate.url().endsWith('/api/work-orders') && candidate.method() === 'POST',
    );
    await page.getByRole('button', { name: /Create (new )?Work Order/i }).click();
    const payload = JSON.parse((await request).postData() ?? '{}');
    expect(payload.primaryCategoryId).toBe(categories[1].id);
    expect(payload.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ catalogJobId: 'catalog-brake-inspection', categoryId: categories[0].id }),
      expect.objectContaining({ catalogJobId: 'catalog-engine-diagnostic', categoryId: categories[1].id }),
    ]));
  });

  test('ranks truck prefixes before contains matches and labels fallback results', async ({ page }) => {
    truckFixtures = [
      truck,
      { ...truck, id: 'truck-609', truckNumber: '609' },
      { ...truck, id: 'truck-797', truckNumber: '797' },
      { ...truck, id: 'truck-899', truckNumber: '899' },
      { ...truck, id: 'truck-901', truckNumber: '901' },
    ];
    await openNewWorkOrder(page);
    const input = page.getByRole('combobox', { name: /Truck/i });
    await input.fill('9');
    const options = page.getByRole('option');
    await expect(options.first()).toContainText('#901');
    await expect(page.getByRole('option', { name: /#609/i })).toHaveCount(0);
    await input.fill('05');
    await expect(page.getByRole('status')).toContainText(/Showing numbers that contain it/i);
    await expect(page.getByRole('option', { name: /905/i })).toBeVisible();
  });

  test('signing out returns to login and removes the local session', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /Open profile/i }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: /Dev Login/i })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ltl_shop_token'))).toBeNull();
  });

  test('Daniel PM flow autosaves the service and requires mileage plus a part to finish', async ({ page }) => {
    const daniel = { ...user, id: 'daniel-1', email: 'daniel@lightning.local', name: 'Daniel', pmAuthorized: true, capabilities: ['mechanic.pm'] };
    const pmWorkOrder = {
      ...workOrder,
      primaryCategoryId: 'cat-pm',
      primaryCategoryName: 'PM',
      status: 'in_progress',
      jobsCompleted: 0,
      jobsTotal: 0,
      jobs: [],
    };
    const pmDetails = {
      workOrderId: pmWorkOrder.id,
      canEdit: true,
      currentTruckMileage: 120000,
      observedMileage: 120000,
      lastCompletedPm: null,
      categories: [{
        id: 'part-cat-oil', slug: 'oil-filter-1-unit', name: 'Oil Filter 1 Unit',
        parts: [{ id: 'part-oil', partNumber: '2234788', displayName: 'PETERBILT Oil Filter Paccar' }],
      }],
      selections: [],
    };
    let savedBody: unknown;
    let savedSelections: { partCategoryId: string; partId: string }[] = [];
    let savedMileage: number | null = pmDetails.observedMileage;
    await page.route('**/api/auth/me', async (route) => json(route, { user: daniel }));
    await page.route(`**/api/work-orders/${workOrder.id}`, async (route) => {
      await json(route, {
        ...pmWorkOrder, notes: null, createdById: daniel.id, completedAt: null,
        totalActiveLaborMs: 0, totalWaitingMs: 0, mechanics: [], currentPause: null,
        truck, version: 1,
      });
    });
    await page.route(`**/api/work-orders/${workOrder.id}/pm`, async (route) => {
      if (route.request().method() === 'POST') {
        savedBody = route.request().postDataJSON();
        savedSelections = (savedBody as { selections: { partCategoryId: string; partId: string }[] }).selections;
        savedMileage = (savedBody as { observedMileage: number | null }).observedMileage;
      }
      await json(route, { ...pmDetails, observedMileage: savedMileage, selections: savedSelections });
    });
    await page.route(`**/api/work-orders/${workOrder.id}/complete`, async (route) => json(route, {
      ...pmWorkOrder, status: 'completed', notes: null, createdById: daniel.id,
      completedAt: '2026-01-01T14:00:00.000Z', totalActiveLaborMs: 1, totalWaitingMs: 0,
      mechanics: [], currentPause: null, truck, version: 2,
    }));
    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible({ timeout: 15_000 });
    // Let the login redirect settle before navigating to the fixture detail.
    await page.waitForTimeout(200);
    await page.goto(`/work-orders/${workOrder.id}`);
    await expect(page.getByRole('heading', { name: 'Truck Information' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'PM Service' })).toBeVisible();
    await expect(page.getByText('Jobs To Do', { exact: true })).toHaveCount(0);
    await expect(page.getByText('My Jobs', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Unassigned — inherits the Work Order team', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Working With', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Priority', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Observed mileage')).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Finish Work' })).toBeDisabled();
    await page.getByLabel('Observed mileage').fill('120500');
    await page.waitForTimeout(650);
    await expect.poll(() => savedBody).toEqual({ observedMileage: 120500, selections: [] });
    await page.getByLabel('Oil Filter 1 Unit').selectOption('part-oil');
    await expect.poll(() => savedBody).toEqual({
      observedMileage: 120500,
      selections: [{ partCategoryId: 'part-cat-oil', partId: 'part-oil' }],
    });
    await expect(page.getByRole('button', { name: 'Finish Work' })).toBeEnabled();
    await page.getByRole('button', { name: 'Finish Work' }).click();
    await expect(page.getByRole('heading', { name: 'Finish PM service' })).toBeVisible();
    await page.getByRole('button', { name: 'Finish Work' }).last().click();
    await expect.poll(() => savedBody).toEqual({
      observedMileage: 120500,
      selections: [{ partCategoryId: 'part-cat-oil', partId: 'part-oil' }],
    });
  });

  test('keeps selected Jobs when changing the primary Category on a 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openNewWorkOrder(page);
    await selectTruck(page);
    const category = page.getByRole('combobox', { name: /Category/i });
    await category.selectOption(categories[0].id);
    await page.getByRole('list', { name: /Listed jobs for Brakes/i }).getByRole('button', { name: 'Brake inspection' }).click();
    await category.selectOption(categories[1].id);
    await expect(page.getByRole('dialog', { name: 'Change category?' })).toHaveCount(0);
    await expect(page.getByText('Brake inspection', { exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: /Listed jobs for Engine/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('truck combobox supports keyboard selection and exposes state', async ({ page }) => {
    await openNewWorkOrder(page);
    const input = page.getByRole('combobox', { name: /Truck/i }).first();
    await expect(input).toHaveAttribute('aria-expanded', /true|false/);
    await input.fill('90');
    await expect(page.getByRole('option', { name: /905/i }).first()).toBeVisible();
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(input).toHaveValue(/905/);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  test('requires confirmation before finishing a standard Work Order', async ({ page }) => {
    const completedJobs = {
      ...workOrder,
      status: 'in_progress',
      jobsCompleted: 1,
      jobs: [{ ...workOrder.jobs[0], status: 'completed' }],
      startedAt: '2026-01-01T12:01:00.000Z',
    };
    let completeCalls = 0;

    await page.route(`**/api/work-orders/${workOrder.id}`, async (route) => {
      await json(route, {
        ...completedJobs,
        notes: null,
        createdById: user.id,
        completedAt: null,
        totalActiveLaborMs: 1,
        totalWaitingMs: 0,
        mechanics: [],
        currentPause: null,
        truck,
        version: 1,
      });
    });
    await page.route(`**/api/work-orders/${workOrder.id}/complete`, async (route) => {
      completeCalls += 1;
      await json(route, { ...completedJobs, status: 'completed' });
    });

    await login(page);
    await page.goto(`/work-orders/${workOrder.id}`);
    await page.getByRole('button', { name: 'Finish Work' }).click();
    const dialog = page.getByRole('dialog', { name: 'FINISH WORK ORDER' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/All 1 job is complete/i)).toBeVisible();
    expect(completeCalls).toBe(0);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect(completeCalls).toBe(0);

    await page.getByRole('button', { name: 'Finish Work' }).click();
    await dialog.getByRole('button', { name: 'Finish Work', exact: true }).click();
    await expect.poll(() => completeCalls).toBe(1);
  });

  test('priority choices expose pressed state and form fields have labels', async ({ page }) => {
    await openNewWorkOrder(page);
    await selectTruck(page);
    await expect(page.getByRole('group', { name: /Priority/i }).or(page.getByText(/Priority/i).first())).toBeVisible();
    const normal = page.getByRole('button', { name: /NORMAL/i });
    await expect(normal).toHaveAttribute('aria-pressed', 'true');
    const high = page.getByRole('button', { name: /HIGH/i });
    await high.click();
    await expect(high).toHaveAttribute('aria-pressed', 'true');
    await expect(normal).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('textbox', { name: /Notes/i })).toBeVisible();
  });
});

const assignedWorkOrder = {
  id: 'wo-assigned-1',
  displayId: 'WO-ASSIGN-1',
  truckId: truck.id,
  truckNumber: truck.truckNumber,
  primaryCategoryId: categories[0].id,
  primaryCategoryName: categories[0].name,
  status: 'in_progress',
  priority: 'high',
  jobsCompleted: 0,
  jobsTotal: 3,
  jobs: [
    {
      id: 'job-mine',
      workOrderId: 'wo-assigned-1',
      catalogJobId: 'catalog-pads',
      categoryId: categories[0].id,
      category: { id: categories[0].id, name: categories[0].name },
      displayName: 'Replace pads',
      customDescription: null,
      status: 'to_do',
      completedAt: null,
      completedById: null,
      assignedMechanic: { id: user.id, name: user.name },
    },
    {
      id: 'job-team',
      workOrderId: 'wo-assigned-1',
      catalogJobId: 'catalog-bleed',
      categoryId: categories[0].id,
      category: { id: categories[0].id, name: categories[0].name },
      displayName: 'Bleed brakes',
      customDescription: null,
      status: 'to_do',
      completedAt: null,
      completedById: null,
      assignedMechanic: null,
    },
    {
      id: 'job-other',
      workOrderId: 'wo-assigned-1',
      catalogJobId: 'catalog-abs',
      categoryId: categories[1].id,
      category: { id: categories[1].id, name: categories[1].name },
      displayName: 'ABS sensor',
      customDescription: null,
      status: 'to_do',
      completedAt: null,
      completedById: null,
      assignedMechanic: { id: 'mechanic-2', name: 'Jamie Technician' },
    },
  ],
  mechanics: [
    { mechanicId: user.id, mechanicName: user.name, addedAt: '2026-01-01T12:00:00.000Z', removedAt: null },
    { mechanicId: 'mechanic-2', mechanicName: 'Jamie Technician', addedAt: '2026-01-01T12:00:00.000Z', removedAt: null },
  ],
  currentPauseReason: null,
  createdAt: '2026-01-01T12:00:00.000Z',
  startedAt: '2026-01-01T12:05:00.000Z',
  notes: null,
  createdById: 'manager-1',
  completedAt: null,
  totalActiveLaborMs: 1,
  totalWaitingMs: 0,
  currentPause: null,
  truck,
  version: 1,
};

test.describe('My Assigned Work presentation', () => {
  test('labels assigned, unassigned inherited-team, and other Jobs at mobile size', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return json(route, { user });
      if (path === '/api/work-orders' && request.method() === 'GET') {
        return json(route, { created: [], active: [assignedWorkOrder], paused: [], completed: [] });
      }
      if (path === `/api/work-orders/${assignedWorkOrder.id}`) {
        return json(route, assignedWorkOrder);
      }
      if (path === `/api/work-orders/${assignedWorkOrder.id}/jobs/job-mine/complete`) {
        return json(route, {
          ...assignedWorkOrder,
          jobsCompleted: 1,
          jobs: assignedWorkOrder.jobs.map((job) => (
            job.id === 'job-mine' ? { ...job, status: 'completed' } : job
          )),
        });
      }
      if (path === '/api/catalog/categories') return json(route, categories);
      if (path === '/api/catalog/aliases' || path === '/api/catalog/jobs') return json(route, aliases);
      if (path === '/api/mechanics') return json(route, mechanics);
      if (path === '/api/trucks') return json(route, [truck]);
      return route.continue();
    });

    await page.goto('/login');
    await page.getByRole('button', { name: /Dev Login/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    const assignedCard = page.locator('article').filter({ hasText: 'WO-ASSIGN-1' });
    await expect(assignedCard.getByText('Work Order team: Alex Mechanic / Jamie Technician')).toBeVisible();
    await expect(assignedCard.getByText('Replace pads')).toBeVisible();
    await expect(assignedCard.getByText('Assigned to you')).toBeVisible();
    await expect(assignedCard.getByText('Bleed brakes')).toBeVisible();
    await expect(assignedCard.getByText('Unassigned — inherits the Work Order team')).toBeVisible();
    await expect(assignedCard.getByText('ABS sensor')).toBeVisible();
    await expect(assignedCard.getByText('Assigned to Jamie Technician')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await assignedCard.getByRole('link', { name: /View Work/i }).click();
    await expect(page.getByRole('heading', { name: 'WO-ASSIGN-1' })).toBeVisible();
    await expect(page.getByText('Work Order team', { exact: true })).toBeVisible();
    await expect(page.getByText('Alex Mechanic / Jamie Technician')).toBeVisible();
    await expect(page.getByText('My Jobs', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Replace pads/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bleed brakes/ })).toBeVisible();
    await expect(page.getByText('Other work on this Truck')).toBeVisible();
    await expect(page.getByRole('button', { name: /ABS sensor/ })).toBeVisible();
    await expect(page.getByText('Create new Work Order')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: /Replace pads/ }).click();
    await expect(page.getByRole('dialog', { name: 'JOB FINISHED' })).toBeVisible();
    await page.getByRole('button', { name: 'Complete Job' }).click();
    await expect(page.getByText('Replace pads')).toBeVisible();
  });
});
