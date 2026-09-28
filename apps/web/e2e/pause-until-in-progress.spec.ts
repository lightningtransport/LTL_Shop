import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';

const CREATED_ID = '00000000-0000-4000-8000-000000000103';
const IN_PROGRESS_ID = '00000000-0000-4000-8000-000000000102';
const PM_CREATED_ID = '00000000-0000-4000-8000-000000000501';
const PM_ACTIVE_ID = '00000000-0000-4000-8000-000000000502';

const pmUser = {
  id: '00000000-0000-4000-8000-000000000005',
  email: 'cristian240588@hotmail.com',
  name: 'Cristian Perez',
  role: 'admin',
  active: true,
  pmAuthorized: true,
  capabilities: ['mechanic.pm'],
};

const pmTruck = {
  id: '00000000-0000-4000-8000-000000000701',
  truckNumber: '905',
  make: 'Freightliner',
  model: 'Cascadia',
  year: 2022,
  mileage: 120000,
  company: 'Lightning Transport',
  owner: 'Lightning Transport',
};

function pmSummary(id: string, displayId: string, status: 'created' | 'in_progress') {
  return {
    id,
    displayId,
    truckId: pmTruck.id,
    truckNumber: pmTruck.truckNumber,
    primaryCategoryId: '00000000-0000-4000-8000-000000000301',
    primaryCategoryName: 'PM',
    status,
    priority: 'normal',
    jobsCompleted: 0,
    jobsTotal: 0,
    jobs: [],
    mechanics: [],
    currentPauseReason: null,
    createdAt: '2026-09-06T15:00:00.000Z',
    startedAt: status === 'created' ? null : '2026-09-06T16:00:00.000Z',
  };
}

function pmDetail(id: string, displayId: string, status: 'created' | 'in_progress') {
  return {
    ...pmSummary(id, displayId, status),
    notes: '',
    createdById: pmUser.id,
    completedAt: null,
    totalActiveLaborMs: 0,
    totalWaitingMs: 0,
    version: 1,
    truck: pmTruck,
    currentPause: null,
  };
}

async function fulfill(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function loginToAdmin(page: Page, email: string) {
  await devLogin(page, email);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

test('Admin Pause stays disabled on Created and enables on In Progress', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');

  await page.goto(`/admin/work-orders/${CREATED_ID}`);
  await expect(page.getByRole('heading', { name: 'Pause Work Order' })).toBeVisible();
  const pause = page.getByRole('button', { name: 'Pause Work Order' });
  await expect(pause).toBeDisabled();
  await expect(page.getByLabel('Pause reason')).toBeDisabled();
  await expect(page.getByText('Pause is available after this Work Order is In Progress.')).toBeVisible();

  await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  await expect(page.getByRole('button', { name: 'Pausar Work Order' })).toBeDisabled();
  await expect(page.getByText('La pausa está disponible cuando esta Work Order está En progreso.')).toBeVisible();

  await page.goto(`/admin/work-orders/${IN_PROGRESS_ID}`);
  const enabledPause = page.getByRole('button', { name: 'Pausar Work Order' });
  await expect(enabledPause).toBeEnabled();
  await expect(page.getByLabel('Motivo de pausa')).toBeEnabled();
  await expect(page.getByText('La pausa está disponible cuando esta Work Order está En progreso.')).toHaveCount(0);
});

test('PM mechanic Pause stays disabled until the service is In Progress', async ({ page }) => {
  const created = pmDetail(PM_CREATED_ID, 'WO-PM-CREATED', 'created');
  const active = pmDetail(PM_ACTIVE_ID, 'WO-PM-ACTIVE', 'in_progress');
  await page.route('**/api/work-orders**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/work-orders/${PM_CREATED_ID}`) return fulfill(route, created);
    if (path === `/api/work-orders/${PM_ACTIVE_ID}`) return fulfill(route, active);
    if (path === '/api/work-orders') {
      return fulfill(route, {
        created: [pmSummary(PM_CREATED_ID, 'WO-PM-CREATED', 'created')],
        active: [pmSummary(PM_ACTIVE_ID, 'WO-PM-ACTIVE', 'in_progress')],
        paused: [],
        completed: [],
      });
    }
    return route.fallback();
  });

  await loginToAdmin(page, 'cristian240588@hotmail.com');
  await page.goto('/mechanic/pm');
  const createdCard = page.locator('.card').filter({ hasText: 'WO-PM-CREATED' });
  await expect(createdCard.getByRole('button', { name: 'Pause Work Order' })).toBeDisabled();
  await expect(createdCard.getByText('Pause is available after this Work Order is In Progress.')).toBeVisible();
  await expect(createdCard.getByRole('button', { name: 'Start Work' })).toBeEnabled();

  await page.goto(`/work-orders/${PM_CREATED_ID}`);
  await expect(page.getByRole('button', { name: 'Pause Work Order' })).toBeDisabled();
  await expect(page.getByText('Pause is available after this Work Order is In Progress.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Work' })).toBeEnabled();

  await page.goto(`/work-orders/${PM_ACTIVE_ID}`);
  await expect(page.getByRole('button', { name: 'Pause Work Order' })).toBeEnabled();
  await expect(page.getByText('Pause is available after this Work Order is In Progress.')).toHaveCount(0);
});
