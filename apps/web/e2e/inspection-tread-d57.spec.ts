import { expect, test, type Route } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * D57 / LTR-302: tread at or under the minimum is a Fix, Watch is the minimum + 1 up to the watch margin, OK above.
 * The sheet's tire dialog and diagram legend, and Setup → Inspection checklist, say it with numbers.
 */
const truckId = '00000000-0000-4000-8000-000000001001';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const baseLimits = { steerTargetPsi: 110, driveTargetPsi: 95, steerMinTread: 4, driveMinTread: 2, watchPct: 10, fixPct: 20, treadWatchMargin: 2 };

function sheetState() {
  return {
    truck: { id: truckId, truckNumber: 'Y-101', mileage: 412000 },
    workOrder: { id: '00000000-0000-4000-8000-000000000106', displayId: 'WO-106', status: 'open', jobCatalogIds: [] },
    checklist: [
      { id: '00000000-0000-4000-8000-000000000c01', section: 'interior', label: 'Dash lights and gauges', sortOrder: 1, active: true, catalogJob: null, workflowStepKey: 'detailing' },
    ],
    tireJobs: null,
    limits: baseLimits,
    inspection: null,
    previousTires: [],
    canInspect: true,
    canAssign: true,
    legacyInspection: null,
    installedTires: [],
    tireJobsGoTo: null,
  };
}

test.describe('D57 tire tread bands', () => {
  test('the tire dialog and the legend show the Job / Watch / OK tread numbers, and 4/32 on a steer tire is a Fix', async ({ page }) => {
    await page.route(`**/api/admin/trucks/${truckId}/inspection`, (route) => route.request().method() === 'GET' ? json(route, sheetState()) : route.fallback());
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await page.goto(`/admin/trucks/${truckId}/inspection`);

    await expect(page.getByText('Steer tread: Job at 4/32 or less · Watch 5–6/32 · OK from 7/32')).toBeVisible();
    await expect(page.getByText('Drive tread: Job at 2/32 or less · Watch 3–4/32 · OK from 5/32')).toBeVisible();
    await expect(page.getByText(/Min tread:/)).toHaveCount(0);

    await page.getByTestId('tire-LF').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Tread · Job at 4/32 or less · Watch 5–6/32 · OK from 7/32')).toBeVisible();
    await dialog.getByLabel('LF PSI').fill('110');
    await dialog.getByLabel('LF tread').fill('4');
    await expect(dialog.getByText('Fix — creates a Job')).toBeVisible();
    await dialog.getByLabel('LF tread').fill('6');
    await expect(dialog.getByText(/^Watch/).first()).toBeVisible();
    await dialog.getByLabel('LF tread').fill('7');
    await expect(dialog.getByText('In range', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();

    await page.getByTestId('tire-LFO').click();
    const drive = page.getByRole('dialog');
    await expect(drive.getByText('Tread · Job at 2/32 or less · Watch 3–4/32 · OK from 5/32')).toBeVisible();
    await drive.getByLabel('LFO PSI').fill('95');
    await drive.getByLabel('LFO tread').fill('4');
    await expect(drive.getByText(/^Watch/).first()).toBeVisible();
    await drive.getByLabel('LFO tread').fill('2');
    await expect(drive.getByText('Fix — creates a Job')).toBeVisible();
  });

  test('Setup → Inspection checklist: the watch margin field moves the tread lines and is saved with the limits', async ({ page }) => {
    const saves: Array<{ limits: Record<string, number> }> = [];
    await devLogin(page, 'manager@lightning.local');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    // The fixture API answers GET and PUT; record the PUT body on the way through.
    await page.route('**/api/admin/inspection-checklist', async (route) => {
      if (route.request().method() === 'PUT') saves.push(route.request().postDataJSON());
      await route.fallback();
    });
    await page.goto('/admin/setup/inspection');

    const margin = page.getByLabel('Watch margin above min tread /32');
    await expect(margin).toBeVisible();
    await expect(margin).toHaveValue('2');
    await expect(page.getByText('Steer tread: Job at 4/32 or less · Watch 5–6/32 · OK from 7/32')).toBeVisible();
    await expect(page.getByText('Drive tread: Job at 2/32 or less · Watch 3–4/32 · OK from 5/32')).toBeVisible();
    await expect(page.getByText('Fix: past the fix range or tread at the minimum or under')).toBeVisible();

    await margin.fill('3');
    await expect(page.getByText('Steer tread: Job at 4/32 or less · Watch 5–7/32 · OK from 8/32')).toBeVisible();
    await page.getByTestId('checklist-save').click();
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0].limits.treadWatchMargin).toBe(3);
  });
});
