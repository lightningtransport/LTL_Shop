import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';
import { switchLanguage } from './support/locale';

const user = {
  id: 'mechanic-1',
  email: 'mechanic@example.com',
  name: 'Alex Mechanic',
  role: 'mechanic',
  active: true,
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
  vin: '1FUJGLDR8CSBA0905',
  location: '4802 Orient Road, Tampa, FL',
  locationUpdatedOn: '2026-09-11',
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
    // LTR-154 / D11: the mechanic reaches this Work Order through their own Job.
    assignedMechanic: { id: user.id, name: user.name },
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
let profileMode: 'normal' | 'error' | 'stall' = 'normal';
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
      if (profileMode === 'stall') return;
      if (profileBarrier) await profileBarrier;
      if (profileMode === 'error') return json(route, { message: 'Profile unavailable' }, 503);
      return json(route, { user });
    }
    if (path === '/api/work-orders' && request.method() === 'GET') {
      if (workOrdersMode === 'stall-once') {
        workOrdersMode = 'normal';
        return;
      }
      return json(route, {
        created: [workOrder],
        active: activeWorkOrders,
        paused: [{
          ...workOrder,
          id: 'wo-paused-1',
          displayId: 'WO-PAUSED-1',
          status: 'waiting_paused',
          currentPauseReason: 'waiting_for_parts',
        }],
        completed: [],
      });
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
    if (path === '/api/catalog/aliases') return json(route, aliases);
    if (path === '/api/catalog/jobs') {
      const categoryId = url.searchParams.get('categoryId');
      const jobs = [
        {
          id: 'catalog-brake-inspection',
          categoryId: categories[0].id,
          displayName: 'Brake inspection',
          aliases: ['brake inspection', 'brake check'],
        },
        {
          id: 'catalog-engine-diagnostic',
          categoryId: categories[1].id,
          displayName: 'Engine diagnostic',
          aliases: ['engine diagnostic'],
        },
      ].filter((job) => !categoryId || job.categoryId === categoryId);
      return json(route, jobs);
    }
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
  await devLogin(page);
  await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
}

async function openStandardCreateBlocked(page: Page) {
  await login(page);
  await page.goto('/mechanic/standard/new');
  await expect(page.getByText(/Ask your Shop Manager to create a Work Order/i)).toBeVisible({ timeout: 15_000 });
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

    await devLogin(page, undefined, { waitForRedirect: false });
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
    await page.getByRole('button', { name: /Start Work/i }).first().click();
    await expect(page.getByRole('heading', { name: `Truck ${workOrder.truckNumber}` })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const detailHeader = await page.getByRole('heading', { name: `Truck ${workOrder.truckNumber}` }).boundingBox();
    expect(detailHeader?.y).toBeGreaterThanOrEqual(0);
    expect(detailHeader?.y).toBeLessThan(await page.evaluate(() => window.innerHeight));
    await expect(page.locator('main')).toBeFocused();

    await page.getByRole('link', { name: /Back/i }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('Report Blocker opens a dialog that keeps focus inside it', async ({ page }) => {
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
    // Manager-first ownership: mechanics report a blocker instead of pausing. Since LTR-155 the button sits on
    // each Job and opens a modal in place; the old scroll-to-top only applied to ?action= links (legacy PM).
    await page.getByRole('button', { name: /^Report blocker/i }).first().click();
    const dialog = page.getByRole('dialog', { name: /Report Blocker/i });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
  });

  test('login form paints without waiting for session restore when no token exists', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('status', { name: /Restoring session/i })).toHaveCount(0);
  });

  test('root without a session reaches login instead of hanging on restore', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });
    await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByRole('status', { name: /Restoring session/i })).toHaveCount(0);
  });

  test('standalone home-screen display reaches login without staying on the restore skeleton', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });
    await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByRole('status', { name: /Restoring session/i })).toHaveCount(0);
  });

  test('stalled profile restore on login surfaces retry instead of hanging', async ({ page }) => {
    profileMode = 'stall';
    await page.addInitScript(() => localStorage.setItem('ltl_shop_token', 'dev:mechanic@example.com'));
    await page.goto('/login');
    await expect(page.getByRole('status', { name: /Restoring session/i })).toBeVisible();
    const timeoutAlert = page.getByRole('alert').filter({ hasText: /took too long|Unable to restore|Unable to reach/i });
    await expect(timeoutAlert).toBeVisible({ timeout: 12_000 });
    await expect(timeoutAlert.getByRole('button', { name: /Try again|Reintentar/i })).toBeVisible();
    await expect(page.getByRole('status', { name: /Restoring session/i })).toHaveCount(0);
  });

  test('authenticated root leaves restore and opens the mechanic workspace', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ltl_shop_token', 'dev:mechanic@example.com'));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/mechanic\/standard$/);
    await expect(page.getByRole('status', { name: /Restoring session/i })).toHaveCount(0);
  });

  test('stalled profile restore on Home surfaces retry instead of hanging', async ({ page }) => {
    profileMode = 'stall';
    await page.addInitScript(() => localStorage.setItem('ltl_shop_token', 'dev:mechanic@example.com'));
    await page.goto('/');
    await expect(page.getByRole('status', { name: /Restoring session/i })).toBeVisible();
    const timeoutAlert = page.getByRole('alert').filter({ hasText: /took too long|Unable to restore|Unable to reach/i });
    await expect(timeoutAlert).toBeVisible({ timeout: 12_000 });
    await expect(timeoutAlert.getByRole('button', { name: /Try again|Reintentar/i })).toBeVisible();
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
    await expect(page.getByRole('button', { name: /Start Work/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Work truck 905, Work Order WO-1001' })).toBeVisible();
  });

  test('keeps Home controls exclusive and uses logical back destinations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('banner', { name: 'Home controls' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Back/i })).toHaveCount(0);

    await login(page);
    await expect(page.getByRole('banner', { name: 'Home controls' })).toBeVisible();
    await expect(page.getByAltText('Lightning Transport and Logistics')).toBeVisible();

    await page.goto('/mechanic/standard/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('banner', { name: 'Home controls' })).toHaveCount(0);
    await expect(page.getByText(user.name, { exact: true })).toHaveCount(0);
    const backToHome = page.locator('header').getByRole('link', { name: 'Back to Home' });
    await expect(backToHome).toBeVisible();
    await backToHome.scrollIntoViewIfNeeded();
    const backBox = await backToHome.boundingBox();
    expect(backBox?.width).toBeGreaterThanOrEqual(44);
    expect(backBox?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByText(/Ask your Shop Manager to create a Work Order/i)).toBeVisible();

    await page.getByRole('link', { name: 'Back to Home' }).click();
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
    await page.getByRole('button', { name: /Start Work/i }).click();
    await expect(page.getByRole('heading', { name: `Truck ${workOrder.truckNumber}` })).toBeVisible();
    await expect(page.getByRole('banner', { name: 'Home controls' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to Home' }).click();
    await expect(page.getByRole('banner', { name: 'Home controls' })).toBeVisible();
  });

  test('toggles light/dark theme and persists explicit preference', async ({ page }) => {
    await login(page);
    // LTR-167: theme is a choice in the profile menu.
    await page.getByRole('button', { name: /Open profile for / }).click();
    const theme = page.getByRole('dialog').getByRole('group', { name: 'Theme' });
    const isDark = await page.locator('html').evaluate((node) => node.classList.contains('dark'));
    const toggle = theme.getByRole('button', { name: isDark ? 'Light' : 'Dark' });
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

  test('Standard create route asks the Manager and hides planning controls', async ({ page }) => {
    await openStandardCreateBlocked(page);
    await expect(page.getByRole('combobox', { name: /Truck/i })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Category/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Create (new )?Work Order/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('legacy /work-orders/new is EmptyState for Standard, not a dead form', async ({ page }) => {
    await login(page);
    await page.goto('/work-orders/new');
    await expect(page.getByText(/Ask your Shop Manager to create a Work Order/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('combobox', { name: /Truck/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Create (new )?Work Order/i })).toHaveCount(0);
  });

  test('Mechanic status chips and location copy follow the locale catalog', async ({ page }) => {
    await login(page);
    // Stage MG-3: the card no longer repeats the Work Order status (its section says it); the pause reason is
    // the card's notice line.
    const homeCard = (displayId: string) => page.locator('[data-testid^="home-card-"]').filter({ hasText: displayId });
    const createdCard = homeCard('WO-1001');
    const pausedCard = homeCard('WO-PAUSED-1');
    await expect(pausedCard.getByText('Waiting for Parts')).toBeVisible();

    await switchLanguage(page, 'es');
    await expect(page.getByRole('heading', { name: 'Mi trabajo asignado' })).toBeVisible();
    await expect(pausedCard.getByText('En espera de piezas')).toBeVisible();
    await expect(pausedCard.getByText('Waiting for Parts')).toHaveCount(0);
    await expect(createdCard.getByRole('button', { name: 'Iniciar trabajo unidad 905, Work Order WO-1001' })).toBeVisible();
    await expect(createdCard.getByRole('button', { name: /Start Work/i })).toHaveCount(0);

    const started = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return request.method() === 'POST' && url.pathname === `/api/work-orders/${workOrder.id}/start`;
    });
    await createdCard.getByRole('button', { name: /Start Work|Iniciar trabajo/i }).click();
    await started;
    await expect(page.getByRole('heading', { name: `Unidad ${workOrder.truckNumber}` })).toBeVisible();
    await page.getByRole('button', { name: /Truck Information|Información/i }).click();
    await expect(page.getByText('Ubicación reportada')).toBeVisible();
    await expect(page.getByText('4802 Orient Road, Tampa, FL')).toBeVisible();
    await expect(page.getByText(/in yard|en el yard/i)).toHaveCount(0);
  });

  test('Truck Information VIN does not overlay location on a 390px viewport', async ({ page }) => {
    const longVinTruck = {
      ...truck,
      truckNumber: '907',
      year: 2026,
      mileage: 269_216,
      company: 'CTTC',
      owner: 'Jorge',
      vin: '3AKJHHDR7TSWN2540',
      location: 'East Sligh Avenue, Orient Park, FL, 33592',
      locationUpdatedOn: '2026-09-13',
    };
    truckFixtures = [longVinTruck];
    const daniel = {
      ...user,
      id: 'daniel-1',
      email: 'daniel@lightning.local',
      name: 'Daniel',
      capabilities: ['mechanic.pm'],
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/auth/me', async (route) => json(route, { user: daniel }));
    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible({ timeout: 15_000 });
    await page.goto('/mechanic/pm/new');
    await page.getByRole('combobox', { name: /Truck/i }).fill('907');
    await page.getByRole('option', { name: /#907/ }).click();
    const vin = page.getByText(longVinTruck.vin, { exact: true });
    const location = page.getByText(longVinTruck.location, { exact: true });
    await expect(vin).toBeVisible();
    await expect(location).toBeVisible();
    const vinBox = await vin.boundingBox();
    const locationBox = await location.boundingBox();
    expect(vinBox).toBeTruthy();
    expect(locationBox).toBeTruthy();
    const overlaps =
      vinBox!.x < locationBox!.x + locationBox!.width &&
      vinBox!.x + vinBox!.width > locationBox!.x &&
      vinBox!.y < locationBox!.y + locationBox!.height &&
      vinBox!.y + vinBox!.height > locationBox!.y;
    expect(overlaps).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
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
    const daniel = { ...user, id: 'daniel-1', email: 'daniel@lightning.local', name: 'Daniel', capabilities: ['mechanic.pm'] };
    // LTR-180: no legacy PM Work Order; Daniel works the started PM job of the truck Work Order (LTR-146).
    const pmJobId = 'job-pm';
    const pmJob = { id: pmJobId, displayName: 'PM A Service', status: 'to_do', startedAt: '2026-01-01T12:01:00.000Z', completedAt: null, assignedMechanic: { id: daniel.id, name: daniel.name } };
    const pmWorkOrder = {
      ...workOrder,
      status: 'in_progress',
      jobsCompleted: 0,
      jobsTotal: 1,
      pmJob,
      jobs: [{
        id: pmJobId, workOrderId: workOrder.id, catalogJobId: 'cj-pm-a', categoryId: 'cat-pm',
        category: { id: 'cat-pm', name: 'PM' }, displayName: 'PM A Service', customDescription: null,
        status: 'to_do', completedAt: null, completedById: null, completionNotes: null,
        assignedMechanic: { id: daniel.id, name: daniel.name }, startedAt: pmJob.startedAt,
      }],
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
    await page.route(`**/api/work-orders/${workOrder.id}/jobs/${pmJobId}/complete`, async (route) => json(route, {
      ...pmWorkOrder, pmJob: { ...pmJob, status: 'completed', completedAt: '2026-01-01T14:00:00.000Z' }, notes: null, createdById: daniel.id,
      completedAt: null, totalActiveLaborMs: 1, totalWaitingMs: 0,
      mechanics: [], currentPause: null, truck, version: 2,
    }));
    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible({ timeout: 15_000 });
    // Let the login redirect settle before navigating to the fixture detail.
    await page.waitForTimeout(200);
    await page.goto(`/work-orders/${workOrder.id}`);
    await expect(page.getByText('Truck Information', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'PM Service' })).toBeVisible();
    await expect(page.getByText('Jobs To Do', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Your Jobs', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Unassigned', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Working With', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Priority', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Observed mileage')).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Finish Work' })).toBeDisabled();
    // LTR-151 (§8.11): nothing was written yet, so the card does not claim "Saved".
    await expect(page.getByText('Saved automatically', { exact: true })).toHaveCount(0);
    await page.getByLabel('Observed mileage').fill('120500');
    await page.waitForTimeout(650);
    await expect.poll(() => savedBody).toEqual({ observedMileage: 120500, selections: [] });
    // LTR-189 (W15): the autosave state shows by the title and under the parts.
    await expect(page.getByText('Saved automatically', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Oil Filter 1 Unit').selectOption('part-oil');
    await expect.poll(() => savedBody).toEqual({
      observedMileage: 120500,
      selections: [{ partCategoryId: 'part-cat-oil', partId: 'part-oil' }],
    });
    await expect(page.getByRole('button', { name: 'Finish Work' })).toBeEnabled();
    await page.getByRole('button', { name: 'Finish Work' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Finish Work' })).toBeVisible();
    await page.getByRole('button', { name: 'Finish Work' }).last().click();
    await expect.poll(() => savedBody).toEqual({
      observedMileage: 120500,
      selections: [{ partCategoryId: 'part-cat-oil', partId: 'part-oil' }],
    });
  });

  test('Standard detail hides Finish Work and Add Job after cutover', async ({ page }) => {
    const completedJobs = {
      ...workOrder,
      status: 'in_progress',
      jobsCompleted: 1,
      jobs: [{ ...workOrder.jobs[0], status: 'completed' }],
      startedAt: '2026-01-01T12:01:00.000Z',
    };

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

    await login(page);
    await page.goto(`/work-orders/${workOrder.id}`);
    await expect(page.getByRole('heading', { name: `Truck ${workOrder.truckNumber}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish Work' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Confirm completion|Complete Work Order|Completar Work Order/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Add job/i })).toHaveCount(0);
    // LTR-155 / D17: blockers are reported per pending Job; with every Job done there is none to block.
    await expect(page.getByRole('button', { name: /Report blocker/i })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /Jobs are done.*Manager closes this Work Order/i })).toBeVisible();
    await expect(page.getByText(/Need additional work on this Truck/i)).toBeVisible();
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
  test('shows only my Jobs and keeps other work read-only at mobile size (LTR-154)', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
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
      if (path === '/api/catalog/aliases') return json(route, aliases);
      if (path === '/api/catalog/jobs') {
        const categoryId = url.searchParams.get('categoryId');
        const jobs = [
          {
            id: 'catalog-brake-inspection',
            categoryId: categories[0].id,
            displayName: 'Brake inspection',
            aliases: ['brake inspection', 'brake check'],
          },
          {
            id: 'catalog-engine-diagnostic',
            categoryId: categories[1].id,
            displayName: 'Engine diagnostic',
            aliases: ['engine diagnostic'],
          },
        ].filter((job) => !categoryId || job.categoryId === categoryId);
        return json(route, jobs);
      }
      if (path === '/api/mechanics') return json(route, mechanics);
      if (path === '/api/trucks') return json(route, [truck]);
      return route.continue();
    });

    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    const assignedCard = page.locator('[data-testid^="home-card-"]').filter({ hasText: 'WO-ASSIGN-1' });
    // LTR-154 / D11: the card lists only my Jobs and marks the next one.
    await expect(assignedCard.getByText('Replace pads')).toBeVisible();
    await expect(assignedCard.getByText('Assigned to you')).toBeVisible();
    await expect(assignedCard.getByText('Next', { exact: true })).toBeVisible();
    await expect(assignedCard.getByText('Bleed brakes')).toHaveCount(0);
    await expect(assignedCard.getByText('ABS sensor')).toHaveCount(0);
    await expect(assignedCard.getByText(/Work Order team/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await assignedCard.getByRole('link', { name: /^View truck/ }).click();
    await expect(page.getByRole('heading', { name: 'Truck 905' })).toBeVisible();
    await expect(page.getByText('Work Order team', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Your Jobs', { exact: true })).toBeVisible();
    await expect(page.getByText('When a Job is done, tap Complete job.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete job: Replace pads' })).toBeVisible();
    await expect(page.getByText('Other work on this Truck')).toBeVisible();
    // Unassigned and other mechanics' Jobs are visible but not completable.
    await expect(page.getByRole('button', { name: /Bleed brakes/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /ABS sensor/ })).toHaveCount(0);
    // Stage MG-4 (D-MG5): other mechanics' work is folded; opened, it lists their two Jobs, read-only.
    await page.getByTestId('other-work').getByRole('button', { name: /Other work on this Truck/ }).click();
    await expect(page.getByTestId('job-read-only')).toHaveCount(2);
    await expect(page.getByTestId('my-job')).toHaveCount(1);
    await expect(page.getByText('Create new Work Order')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Complete job: Replace pads' }).click();
    const finishDialog = page.getByRole('dialog', { name: /Complete Replace pads\?|Completar Replace pads/i });
    await expect(finishDialog).toBeVisible();
    await expect(finishDialog.getByRole('button', { name: 'Close Complete job' })).toHaveCount(0);
    await expect(finishDialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await expect(finishDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    await finishDialog.getByRole('button', { name: 'Complete job', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /Job marked complete|Job marcado como completado/i })).toBeVisible();
    await expect(page.getByText('Replace pads')).toBeVisible();
    await expect(page.getByText('You finished your part on Truck 905.')).toBeVisible();
  });

  test('moves Standard Work Orders with no to-do Jobs out of Active Jobs', async ({ page }) => {
    const readyToClose = {
      ...assignedWorkOrder,
      id: 'wo-ready-close',
      displayId: 'WO-READY-1',
      jobsCompleted: 3,
      jobs: assignedWorkOrder.jobs.map((job) => ({ ...job, status: 'completed' })),
    };
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return json(route, { user });
      if (path === '/api/work-orders' && request.method() === 'GET') {
        return json(route, { created: [], active: [assignedWorkOrder, readyToClose], paused: [], completed: [] });
      }
      return route.continue();
    });

    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Waiting on Manager' })).toBeVisible();
    await expect(page.getByText('You finished your part on 1 Work Order. The Manager closes it when every step is done.')).toBeVisible();
    // Stage MG-3: a Truck where my part is done is one row in "Waiting on Manager", not an In Progress card.
    await expect(page.getByTestId('home-waiting').getByRole('link').filter({ hasText: 'WO-READY-1' })).toBeVisible();
    const activeCard = page.locator('[data-testid^="home-card-"]').filter({ hasText: 'WO-ASSIGN-1' });
    await expect(page.getByRole('heading', { name: 'In Progress' })).toBeVisible();
    await expect(page.getByTestId('home-in-progress').locator('[data-testid^="home-card-"]')).toHaveCount(1);
    await expect(activeCard.getByRole('link', { name: /^View truck .*, Work Order WO-ASSIGN-1$/ })).toBeVisible();
  });

  test('Active Jobs empty does not ask Standard to create when work is ready or waiting on Manager', async ({ page }) => {
    const readyToClose = {
      ...assignedWorkOrder,
      id: 'wo-ready-close',
      displayId: 'WO-READY-1',
      jobsCompleted: 3,
      jobs: assignedWorkOrder.jobs.map((job) => ({ ...job, status: 'completed' })),
    };
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return json(route, { user });
      if (path === '/api/work-orders' && request.method() === 'GET') {
        return json(route, { created: [workOrder], active: [readyToClose], paused: [], completed: [] });
      }
      return route.continue();
    });

    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Ready to Start' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Waiting on Manager' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In Progress' })).toBeVisible();
    await expect(page.getByText('No assigned work in progress.')).toBeVisible();
    await expect(page.getByText(/Ask your Shop Manager to create a Work Order/i)).toHaveCount(0);
  });

  test('PM paused empty and count talk about services, not Jobs', async ({ page }) => {
    const daniel = {
      ...user,
      id: 'daniel-1',
      email: 'daniel@lightning.local',
      name: 'Daniel',
      capabilities: ['mechanic.pm'],
    };
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return json(route, { user: daniel });
      if (path === '/api/work-orders' && request.method() === 'GET') {
        return json(route, { created: [], active: [], paused: [], completed: [] });
      }
      return route.continue();
    });

    await devLogin(page);
    await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Active PM services' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Paused PM services' })).toBeVisible();
    await expect(page.getByText('0 paused PM services')).toBeVisible();
    await expect(page.getByText('No paused PM services. Paused work will appear here until it is resumed.')).toBeVisible();
    await expect(page.getByText(/paused jobs/i)).toHaveCount(0);
    await switchLanguage(page, 'es');
    await expect(page.getByRole('heading', { name: 'Servicios de PM pausados' })).toBeVisible();
    await expect(page.getByText('0 servicios de PM pausados')).toBeVisible();
    await expect(page.getByText(/Jobs pausados/i)).toHaveCount(0);
  });
});
