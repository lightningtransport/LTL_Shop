import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * Safety redesign (docs/proposals/qc-screen-redesign, D-QC1…D-QC7): the list most urgent first, the review of
 * a truck, Approve with a confirmation, Return with the Job, Let go, and the Returned and Done tabs.
 * The API is mocked so every state is exact; the API itself is covered by test:real QC1–QC10.
 */
const safety = { id: '00000000-0000-0000-0000-000000000103', email: 'safety-1@lightning.local', name: 'Safety 1', role: 'mechanic', active: true, capabilities: ['quality_check.perform'] };
const safety2 = { id: '00000000-0000-0000-0000-000000000104', name: 'Safety 2' };
const daniel = { id: '00000000-0000-0000-0000-000000000105', name: 'Daniel' };
const alejandro = { id: '00000000-0000-0000-0000-000000000106', name: 'Alejandro 1' };

const truck = (id: string, truckNumber: string) => ({ id, truckNumber, make: 'Freightliner', model: 'Cascadia', year: 2024 });
const item = (id: string, truckNumber: string, extra: Record<string, unknown> = {}) => ({
  workOrderId: id, displayId: `WO-${truckNumber}`, version: 3, truck: truck(`t-${id}`, truckNumber),
  doneJobs: ['PM A Service', 'Alignment'], mechanics: ['Daniel', 'Alejandro 1'],
  doneBy: [{ jobId: `${id}-pm`, job: 'PM A Service', mechanic: daniel }, { jobId: `${id}-al`, job: 'Alignment', mechanic: alejandro }],
  priority: 'normal', leavesOn: null, location: null, readySince: '2026-10-07T12:00:00.000Z', takenBy: null, mine: false, ...extra,
});

const urgent = '00000000-0000-0000-0000-000000000918';
const taken = '00000000-0000-0000-0000-000000000602';
const free = '00000000-0000-0000-0000-000000000606';

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockQc(page: Page) {
  const sent: Array<{ action: string; id: string; body: Record<string, unknown> }> = [];
  let mine: string | null = null;
  const queue = () => ({
    pending: [
      item(urgent, '918', { priority: 'high', leavesOn: '2026-10-08', location: 'Outside · gate 2', ...(mine === urgent ? { takenBy: { id: safety.id, name: safety.name }, mine: true } : {}) }),
      item(taken, '602', { priority: 'critical', takenBy: safety2 }),
      item(free, '606', mine === free ? { takenBy: { id: safety.id, name: safety.name }, mine: true } : {}),
    ],
    returned: [{ ...item('00000000-0000-0000-0000-000000000931', '931'), note: 'Alignment: steering wheel off center', returnedBy: 'Safety 1', returnedAt: '2026-10-07T10:00:00.000Z' }],
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return fulfill(route, { user: safety });
    if (path === '/api/qc/queue') return fulfill(route, queue());
    if (path === '/api/qc/history') {
      return fulfill(route, { days: 7, items: [
        { workOrderId: 'h1', displayId: 'WO-944', truck: truck('t-h1', '944'), outcome: 'approved', at: new Date().toISOString(), note: null },
        { workOrderId: 'h2', displayId: 'WO-957', truck: truck('t-h2', '957'), outcome: 'returned', at: '2026-10-03T15:00:00.000Z', note: 'Light out' },
      ] });
    }
    const action = /^\/api\/qc\/([0-9a-f-]+)\/(take|approve|return|release)$/.exec(path);
    if (action) {
      sent.push({ action: action[2], id: action[1], body: request.postDataJSON() ?? {} });
      if (action[2] === 'take') mine = action[1];
      if (action[2] === 'release' || action[2] === 'approve' || action[2] === 'return') mine = null;
      return fulfill(route, queue());
    }
    const review = /^\/api\/qc\/([0-9a-f-]+)$/.exec(path);
    if (review) {
      const listed = queue().pending.find((entry) => entry.workOrderId === review[1])!;
      return fulfill(route, {
        ...listed,
        truck: { ...listed.truck, vin: '1XPBD49X6TD785091', mileage: 296710, company: 'Lightning' },
        jobs: [
          { id: `${review[1]}-pm`, name: 'PM A Service', category: 'PM', mechanic: daniel, completedAt: '2026-10-07T12:05:00.000Z', note: 'PM complete', isPm: true },
          { id: `${review[1]}-al`, name: 'Alignment', category: 'Suspension & Steering', mechanic: alejandro, completedAt: '2026-10-07T12:10:00.000Z', note: null, isPm: false },
        ],
        pm: { service: 'PM A Service', observedMileage: 296710, parts: [{ category: 'Oil Filter 1 Unit', partNumber: '21707132', name: 'Oil Filter' }] },
        inspection: { outcome: 'issues_found', recordedAt: '2026-10-06T09:12:00.000Z' },
        blockers: [],
        previousReturns: [{ note: 'Air leak at the dryer', returnedBy: 'Safety 2', returnedAt: '2026-10-06T16:00:00.000Z', resolvedAt: '2026-10-07T08:00:00.000Z', resolvedBy: 'Manager', resolution: 'Work added' }],
      });
    }
    return route.continue();
  });
  return sent;
}

async function login(page: Page) {
  await devLogin(page, safety.email);
  await expect(page.getByRole('heading', { name: 'Quality Check' })).toBeVisible();
}

test.describe('Safety redesign', () => {
  test('the list: most urgent first, Dispatch and priority on the card, a truck of the other person cannot be taken', async ({ page }) => {
    await mockQc(page);
    await login(page);
    const cards = page.locator('[data-testid^="qc-card-"]');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toHaveAttribute('data-testid', 'qc-card-918');
    const first = page.getByTestId('qc-card-918');
    await expect(first.getByText('High')).toBeVisible();
    await expect(first.getByText(/Leaves .* · Dispatch/)).toBeVisible();
    await expect(first.getByText(/Outside · gate 2/)).toBeVisible();
    const other = page.getByTestId('qc-card-602');
    await expect(other.getByText('Taken by Safety 2')).toBeVisible();
    await expect(other.getByRole('button', { name: /^Take/ })).toHaveCount(0);
    await expect(page.getByTestId('qc-count')).toHaveText('3 to review');
  });

  test('Take opens the review: what was done, the PM, the inspection and the earlier return (Q2)', async ({ page }) => {
    const sent = await mockQc(page);
    await login(page);
    await page.getByRole('button', { name: 'Take · Truck 606' }).click();
    const review = page.getByTestId('qc-review');
    await expect(review).toBeVisible();
    expect(sent.map((entry) => entry.action)).toEqual(['take']);
    await expect(review.getByTestId('qc-review-jobs').getByText('PM A Service')).toBeVisible();
    await expect(review.getByText('Mileage 296,710 mi · 1 part')).toBeVisible();
    await expect(review.getByText('“PM complete”')).toBeVisible();
    await expect(review.getByText('Issues found')).toBeVisible();
    await expect(review.getByTestId('qc-previous-returns').getByText('“Air leak at the dryer”')).toBeVisible();
  });

  test('Approve asks first (D-QC1); Back sends nothing', async ({ page }) => {
    const sent = await mockQc(page);
    await login(page);
    await page.getByRole('button', { name: 'Take · Truck 606' }).click();
    await page.getByTestId('qc-approve').click();
    const dialog = page.getByRole('dialog', { name: 'Approve Truck 606?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Back' }).click();
    expect(sent.map((entry) => entry.action)).toEqual(['take']);
    await page.getByTestId('qc-approve').click();
    await page.getByTestId('qc-confirm-approve').click();
    await expect.poll(() => sent.map((entry) => entry.action)).toEqual(['take', 'approve']);
    await expect(page.getByRole('status').filter({ hasText: 'Truck 606 approved' }).first()).toBeVisible();
  });

  test('Return names the Job (D-QC3), asks for the note, and keeps the draft when the sheet closes (Q9)', async ({ page }) => {
    const sent = await mockQc(page);
    await login(page);
    await page.getByRole('button', { name: 'Take · Truck 606' }).click();
    await page.getByTestId('qc-review').getByRole('button', { name: 'Return', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Return Truck 606' });
    await dialog.getByRole('button', { name: 'Alignment' }).click();
    await dialog.getByRole('button', { name: 'Return truck' }).click();
    // D46 / SQ-3: a note or a finding is required.
    await expect(dialog.getByText('Write what you found, or add a finding.')).toBeVisible();
    await dialog.getByLabel('What did you find?').fill('Steering wheel off center');
    await dialog.getByRole('button', { name: 'Back' }).click();
    await page.getByTestId('qc-review').getByRole('button', { name: 'Return', exact: true }).click();
    await expect(page.getByLabel('What did you find?')).toHaveValue('Steering wheel off center');
    await page.getByRole('dialog', { name: 'Return Truck 606' }).getByRole('button', { name: 'Alignment' }).click();
    await page.getByRole('dialog', { name: 'Return Truck 606' }).getByRole('button', { name: 'Return truck' }).click();
    await expect.poll(() => sent.at(-1)).toMatchObject({ action: 'return', id: free, body: { notes: 'Steering wheel off center', jobId: `${free}-al` } });
  });

  test('Let go from the review menu (D-QC2)', async ({ page }) => {
    const sent = await mockQc(page);
    await login(page);
    await page.getByRole('button', { name: 'Take · Truck 606' }).click();
    await page.getByTestId('qc-review').getByRole('button', { name: 'More' }).click();
    await page.getByTestId('qc-let-go').click();
    await expect.poll(() => sent.map((entry) => entry.action)).toEqual(['take', 'release']);
    await expect(page.getByRole('status').filter({ hasText: 'You let go of Truck 606' }).first()).toBeVisible();
  });

  test('Returned and Done tabs (D-QC6)', async ({ page }) => {
    await mockQc(page);
    await login(page);
    const tabs = page.getByTestId('qc-tabs');
    await tabs.getByRole('button', { name: /Returned/ }).click();
    await expect(page).toHaveURL(/\?tab=returned$/);
    await expect(page.getByTestId('qc-returned').getByText('“Alignment: steering wheel off center”')).toBeVisible();
    await tabs.getByRole('button', { name: /Done/ }).click();
    const done = page.getByTestId('qc-done');
    await expect(done.locator('p', { hasText: /^Today/ })).toBeVisible();
    await expect(done.getByText('Truck 944')).toBeVisible();
    await expect(done.locator('p', { hasText: /^Last 7 days/ })).toBeVisible();
    await expect(done.getByText('“Light out”')).toBeVisible();
  });
});
