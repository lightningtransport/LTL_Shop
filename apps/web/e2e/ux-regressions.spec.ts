import { expect, test, type Page, type Route } from '@playwright/test';

const user = {
  id: 'mechanic-1',
  email: 'mechanic@example.com',
  name: 'Alex Mechanic',
  role: 'mechanic',
  active: true,
  pmAuthorized: false,
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
  jobs: [{ id: 'job-1', displayName: 'Brake inspection', status: 'to_do' }],
  currentPauseReason: null,
  createdAt: '2026-01-01T12:00:00.000Z',
  startedAt: null,
};

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

    if (path === '/api/auth/me') return json(route, { user });
    if (path === '/api/work-orders' && request.method() === 'GET') {
      return json(route, { created: [workOrder], active: [], paused: [] });
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
    if (path === '/api/trucks') return json(route, [truck]);
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
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible({ timeout: 15_000 });
}

async function openNewWorkOrder(page: Page) {
  await login(page);
  await page.getByRole('link', { name: /Create New Work Order/i }).click();
  await expect(page.getByRole('heading', { name: /New Work Order/i })).toBeVisible();
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
    await mockShopApi(page);
  });

  test('resets scroll to the top when navigating between screens and on back', async ({ page }) => {
    await login(page);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.getByRole('link', { name: /Create New Work Order/i }).click();
    await expect(page.getByRole('heading', { name: /New Work Order/i })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.getByRole('link', { name: /Back/i }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
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
    await page.getByRole('link', { name: /See Truck Repair History/i }).click();
    await expect(page.getByRole('heading', { name: 'REPAIR HISTORY' })).toBeVisible();
    await expect(page.getByRole('banner', { name: 'Home controls' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to New Work Order' }).click();
    await expect(page.getByRole('heading', { name: 'New Work Order' })).toBeVisible();

    await page.getByRole('link', { name: 'Back to Home' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
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

  test('job picker groups aliases and blocks rapid duplicate additions', async ({ page }) => {
    await openNewWorkOrder(page);
    await selectTruck(page);
    await page.getByRole('combobox', { name: /Category/i }).selectOption(categories[0].id);
    await page.getByRole('button', { name: /Add job/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Add job' });
    const option = dialog.getByRole('button', { name: 'Add Brake inspection' });
    await expect(option).toHaveCount(1);
    const box = await option.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await Promise.all([option.click(), option.click()]);
    await expect(page.getByText('Brake inspection', { exact: true })).toHaveCount(1);
  });

  test('Daniel PM flow autosaves the service and requires mileage plus a part to finish', async ({ page }) => {
    const daniel = { ...user, id: 'daniel-1', email: 'daniel@lightning.local', name: 'Daniel', pmAuthorized: true };
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
    await login(page);
    // Let the login redirect settle before navigating to the fixture detail.
    await page.waitForTimeout(200);
    await page.goto(`/work-orders/${workOrder.id}`);
    await expect(page.getByRole('heading', { name: 'Truck Information' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'PM Service' })).toBeVisible();
    await expect(page.getByText('Jobs To Do', { exact: true })).toHaveCount(0);
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

  test('Add job dialog traps focus and closes with Escape', async ({ page }) => {
    await openNewWorkOrder(page);
    await selectTruck(page);
    await page.getByRole('button', { name: /Add job/i }).click();
    const dialog = page.getByRole('dialog', { name: /Add job/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Add job/i })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
        ),
      )
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: /Add job/i })).toBeFocused();
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
