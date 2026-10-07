import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * Block A (field-role audits, OPEN_ISSUES §1j/§1k): the General mechanic's clock and blocker fixes,
 * and the drafts that survive closing a sheet. The API is mocked here so each case is exact.
 */
const mechanic = { id: '00000000-0000-0000-0000-000000000102', email: 'mechanic@lightning.local', name: 'Alejandro', role: 'mechanic', active: true, capabilities: ['mechanic.standard'] };
const safety = { id: '00000000-0000-0000-0000-000000000103', email: 'safety-1@lightning.local', name: 'Safety 1', role: 'mechanic', active: true, capabilities: ['quality_check.perform'] };
const truck = { id: '00000000-0000-0000-0000-000000000201', truckNumber: '922', make: 'Kenworth', model: 'T680', year: 2023, mileage: 150000, company: 'Lightning Transport', owner: 'Lightning Transport' };
const woId = '00000000-0000-0000-0000-000000000901';
const jobId = '00000000-0000-0000-0000-000000000912';
const me = { id: mechanic.id, name: mechanic.name };

const summary = (extra: Record<string, unknown> = {}) => ({
  id: woId, displayId: 'WO-900', truckId: truck.id, truckNumber: truck.truckNumber, primaryCategoryId: 'cat-brakes', primaryCategoryName: 'Brakes',
  status: 'in_progress', priority: 'normal', jobsCompleted: 0, jobsTotal: 1, currentPauseReason: null,
  createdAt: '2026-10-07T12:00:00.000Z', startedAt: '2026-10-07T12:01:00.000Z', pmJob: null,
  jobs: [{ id: jobId, displayName: 'Brake adjustment', status: 'to_do', assignedMechanic: me, activeBlocker: null, category: { id: 'cat-brakes', name: 'Brakes' } }],
  ...extra,
});
const detail = (extra: Record<string, unknown> = {}) => ({
  ...summary(), notes: null, createdById: 'mgr', completedAt: null, totalActiveLaborMs: 0, totalWaitingMs: 0,
  laborRunning: true, myLaborStarted: true, mechanics: [{ mechanicId: me.id, mechanicName: me.name }], currentPause: null, truck, version: 1, noteEntries: [],
  activeBlockers: [],
  jobs: [{
    id: jobId, workOrderId: woId, catalogJobId: 'cj-brakes', categoryId: 'cat-brakes', category: { id: 'cat-brakes', name: 'Brakes' },
    displayName: 'Brake adjustment', customDescription: null, status: 'to_do', completedAt: null, completedById: null, completionNotes: null,
    assignedMechanic: me, startedAt: null,
  }],
  ...extra,
});

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockMechanicApi(page: Page, listItem: Record<string, unknown>) {
  const sent: { blockers: Record<string, unknown>[] } = { blockers: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return fulfill(route, { user: mechanic });
    if (path.startsWith('/api/catalog/')) return fulfill(route, []);
    if (path === '/api/work-orders' && request.method() === 'GET') return fulfill(route, { created: [], active: [listItem], paused: [], completed: [] });
    if (path === `/api/work-orders/${woId}/start`) {
      return fulfill(route, { ...detail(), clockMovedFrom: { id: 'other', displayId: 'WO-0199', truckNumber: '944' } });
    }
    if (path === `/api/work-orders/${woId}/blockers`) {
      sent.blockers.push(request.postDataJSON());
      return fulfill(route, detail());
    }
    if (path === `/api/work-orders/${woId}/jobs/${jobId}/complete`) return fulfill(route, detail());
    if (path === `/api/work-orders/${woId}`) return fulfill(route, detail());
    return route.continue();
  });
  return sent;
}

async function loginMechanic(page: Page) {
  await devLogin(page, mechanic.email);
  await expect(page.getByRole('heading', { name: 'My Assigned Work' })).toBeVisible();
}

test.describe('Block A · General mechanic', () => {
  test('MG3, MG4, MG2: a stopped clock says so, the card offers Continue, and Start says which Truck the clock left', async ({ page }) => {
    await mockMechanicApi(page, summary({ myClockStopped: { reason: 'switched_truck', elsewhereWorkOrder: null } }));
    await loginMechanic(page);
    await expect(page.getByTestId('clock-stopped-tap-continue')).toHaveText('Your clock is stopped · tap Continue');
    await expect(page.getByRole('link', { name: /View Work/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue truck 922, Work Order WO-900' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Work started. Your clock moved from Truck 944 to Truck 922.' }).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/work-orders/${woId}$`));
  });

  test('MG8: the blocker note is always offered, and "Other" without a note says what is missing', async ({ page }) => {
    const sent = await mockMechanicApi(page, summary());
    await loginMechanic(page);
    await page.goto(`/work-orders/${woId}`);
    await page.getByRole('button', { name: 'Report blocker: Brake adjustment' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('What is missing? (optional)')).toBeVisible();

    await dialog.getByLabel('Blocker reason').selectOption('other');
    await dialog.getByRole('button', { name: 'Report Blocker', exact: true }).click();
    await expect(dialog.getByText('Say what is stopping you.')).toBeVisible();
    expect(sent.blockers).toHaveLength(0);

    await dialog.getByLabel('Blocker reason').selectOption('waiting_for_parts');
    await dialog.getByLabel('What is missing? (optional)').fill('Brake chamber 30/30');
    await dialog.getByRole('button', { name: 'Report Blocker', exact: true }).click();
    await expect.poll(() => sent.blockers.at(-1)).toMatchObject({ jobId, reason: 'waiting_for_parts', notes: 'Brake chamber 30/30' });
  });

  test('MG9: the closing note survives closing the sheet and is gone once the Job is completed', async ({ page }) => {
    await mockMechanicApi(page, summary());
    await loginMechanic(page);
    await page.goto(`/work-orders/${woId}`);
    await page.getByRole('button', { name: 'Complete job: Brake adjustment' }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('Adjusted both sides');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Complete job: Brake adjustment' }).click();
    await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('Adjusted both sides');
    await page.getByRole('dialog').getByRole('button', { name: 'Complete job', exact: true }).click();
    await expect.poll(() => page.evaluate((id) => window.localStorage.getItem(`ltl-draft:job-finish:${id}`), jobId)).toBeNull();
  });

  test('PM6/MG9: an unsent Work Order note stays on the phone after leaving', async ({ page }) => {
    await mockMechanicApi(page, summary());
    await loginMechanic(page);
    await page.goto(`/work-orders/${woId}`);
    const notes = page.getByPlaceholder('Write a note, or describe additional work the Truck needs');
    await notes.fill('Left rear slack adjuster is worn');
    await page.reload();
    await expect(page.getByPlaceholder('Write a note, or describe additional work the Truck needs')).toHaveValue('Left rear slack adjuster is worn');
  });
});

test.describe('Block A · Safety', () => {
  test('Q9: the return note survives closing the sheet', async ({ page }) => {
    const item = {
      workOrderId: woId, displayId: 'WO-900', version: 3, truck: { id: truck.id, truckNumber: truck.truckNumber, make: truck.make, model: truck.model, year: truck.year },
      doneJobs: ['Brake adjustment'], mechanics: ['Alejandro'], readySince: '2026-10-07T12:30:00.000Z', takenBy: { id: safety.id, name: safety.name }, mine: true,
    };
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') return fulfill(route, { user: safety });
      if (path === '/api/qc/queue') return fulfill(route, { pending: [item], returned: [] });
      return route.continue();
    });
    await devLogin(page, safety.email);
    await expect(page.getByRole('heading', { name: 'Quality Check' })).toBeVisible();
    await page.getByRole('button', { name: 'Return', exact: true }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('Rear brake hose leaking');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Return', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('Rear brake hose leaking');
  });
});
