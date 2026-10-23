import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * AP-4 / D57 (LTR-303): the Truck's Tires card shows PSI and tread on every tire with its state, a legend and the
 * reason a tire made a Job; the Job's row in the Work Order says which tire and why. The API is mocked so every
 * reading is exact; the API side is covered by test:real A152.
 */
const TRUCK = '00000000-0000-4000-8000-000000001001';
const WO = '00000000-0000-4000-8000-000000000106';

const reading = (position: string, psi: number, tread: number, targetPsi: number, minTread: number, status: string) => ({
  position, psi, tread, targetPsi, minTread, status, readAt: '2026-10-22T14:00:00.000Z',
});
const TIRES = [
  reading('LF', 100, 3, 110, 4, 'fix'),
  reading('RF', 112, 8, 110, 4, 'ok'),
  reading('LFO', 95, 8, 95, 2, 'ok'),
  reading('LFI', 96, 9, 95, 2, 'ok'),
  reading('RFI', 111, 4, 95, 2, 'watch'),
  reading('RFO', 94, 8, 95, 2, 'ok'),
  reading('LRO', 95, 7, 95, 2, 'ok'),
  reading('LRI', 95, 7, 95, 2, 'ok'),
  reading('RRI', 158, 7, 95, 2, 'fix'),
  reading('RRO', 94, 6, 95, 2, 'ok'),
];

async function mockInspection(page: Page, tires = TIRES) {
  await page.route(`**/api/admin/trucks/${TRUCK}/inspection`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ json: {
      truck: { id: TRUCK, truckNumber: 'Y-101', mileage: 100000 }, workOrder: null, checklist: [], tireJobs: null,
      limits: { steerTargetPsi: 110, driveTargetPsi: 95, steerMinTread: 4, driveMinTread: 2, watchPct: 10, fixPct: 20 },
      inspection: {
        id: 'insp-1', inspectedAt: '2026-10-22T14:00:00.000Z', inspectedBy: { id: 'u1', name: 'Crixcrox', isMechanic: false },
        workOrderId: null, notes: null, items: [], tires, jobs: [], issuesFound: true, workOrderOpen: false,
      },
      previousTires: [], canInspect: false, canAssign: false, legacyInspection: null, installedTires: [], tireJobsGoTo: null,
    } });
  });
}

test.describe('AP-4 Tires card and Job row', () => {
  test('the card shows PSI and tread per tire, a legend, N/M OK and the reason under Job and Watch', async ({ page }) => {
    await mockInspection(page);
    await devLogin(page, 'manager@lightning.local');
    await page.goto(`/admin/trucks/${TRUCK}`);
    const card = page.getByTestId('truck-tires');
    await expect(card).toBeVisible();
    await expect(card).toContainText('7/10 OK');
    // Each tire: its name says PSI, tread and state, not only the color.
    await expect(card.getByRole('img', { name: 'LF: 100 PSI, 3/32, Fix (creates a Job)' })).toBeVisible();
    await expect(card.getByRole('img', { name: 'RFI: 111 PSI, 4/32, Watch (no Job)' })).toBeVisible();
    await expect(card.getByRole('img', { name: 'RF: 112 PSI, 8/32, OK' })).toBeVisible();
    await expect(card.getByTestId('tire-legend')).toContainText('OK');
    await expect(card.getByTestId('tire-legend')).toContainText('Watch (no Job)');
    await expect(card.getByTestId('tire-legend')).toContainText('Fix (creates a Job)');
    const job = card.getByTestId('truck-tires-job');
    await expect(job).toContainText('LF 100 PSI · 3/32 (min 4) · worn');
    await expect(job).toContainText('RRI 158 PSI (should be 95) · high pressure');
    await expect(card.getByTestId('truck-tires-watch')).toContainText('RFI 111 PSI · 4/32');
    // The 10 tires fit across, 44 px tall.
    const chips = card.getByRole('img');
    await expect(chips).toHaveCount(10);
    const box = await card.boundingBox();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (let at = 0; at < 10; at += 1) {
      const chip = await chips.nth(at).boundingBox();
      expect(chip!.height).toBeGreaterThanOrEqual(43.5);
      expect(chip!.x + chip!.width).toBeLessThanOrEqual(box!.x + box!.width);
    }
  });

  test('the count uses the readings there are, not a fixed 10', async ({ page }) => {
    await mockInspection(page, TIRES.slice(0, 4));
    await devLogin(page, 'manager@lightning.local');
    await page.goto(`/admin/trucks/${TRUCK}`);
    await expect(page.getByTestId('truck-tires')).toContainText('3/4 OK');
  });

  test('the Job row in the Work Order says which tire and why; the pill keeps counting tires to confirm', async ({ page }) => {
    await page.route(`**/api/admin/work-orders/${WO}`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      const proposed = ['LF', 'RF', 'RRI'].map((position, at) => ({
        id: `tire-${at}`, position, axle: position === 'LF' || position === 'RF' ? 'steer' : 'drive', tireType: 'new', status: 'proposed',
        part: null, suggestedSize: null, reading: null,
      }));
      body.jobs = [{
        ...body.jobs[0], tires: proposed,
        tireFindings: [
          { position: 'LF', psi: 100, targetPsi: 110, tread: 3, minTread: 4, reason: 'worn' },
          { position: 'RRI', psi: 158, targetPsi: 95, tread: 7, minTread: 2, reason: 'high_pressure' },
        ],
      }, ...body.jobs.slice(1)];
      await route.fulfill({ response, json: body });
    });
    await devLogin(page, 'manager@lightning.local');
    await page.goto(`/admin/work-orders/${WO}`);
    const lines = page.getByTestId('admin-wo-job-tire-finding');
    await expect(lines).toHaveCount(2);
    await expect(lines.nth(0)).toHaveText('LF · tread 3/32 (min 4) · worn');
    await expect(lines.nth(1)).toHaveText('RRI · 158 PSI (should be 95) · high pressure');
    const pill = page.getByTestId('admin-wo-job-tires-chip').locator('button, span').first();
    await expect(pill).toContainText('Tires · 3 to confirm');
    await expect(pill).toHaveAttribute('title', '3 tires proposed from stock · confirm in Parts…');
  });
});
