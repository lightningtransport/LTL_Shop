import { expect, test, type Page, type Route } from '@playwright/test';

const user = {
  id: 'mechanic-1',
  email: 'mechanic@example.com',
  name: 'Alex Mechanic',
  role: 'mechanic',
  active: true,
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
