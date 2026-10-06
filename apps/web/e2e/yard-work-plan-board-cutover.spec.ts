import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';

const manager = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'manager@lightning.local',
  name: 'Shop Manager',
  role: 'manager',
  active: true,
  capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'],
};

const truckId = '00000000-0000-4000-8000-00000000bbb1';

function yardPage() {
  return {
    items: [
      {
        truck: {
          id: truckId,
          truckNumber: 'Y-WP2',
          make: 'Volvo',
          model: 'VNL',
          year: 2024,
          mileage: 100000,
          company: 'Lightning Transport',
          owner: 'Lightning Transport',
          vin: null,
          location: null,
          locationUpdatedOn: null,
        },
        phase: 'shop_work',
        readiness: 'under_review',
        assessment: null,
        activeWorkOrder: {
          id: '00000000-0000-4000-8000-000000000201',
          displayId: 'WO-201',
          status: 'in_progress',
          priority: 'normal',
          category: { id: '00000000-0000-4000-8000-000000000301', name: 'Air & Brake System' },
          mechanics: [],
          currentPause: null,
        },
        blockers: [],
        presence: { state: 'unknown', provenance: 'phase_1_unavailable' },
      },
    ],
    nextCursor: null,
    counts: { notStarted: 0, underReview: 1, readyToGo: 0, blocked: 0, presenceUnknown: 1 },
    workLocation: { status: 'ok', items: [], total: 0 },
    incomingTrucks: { status: 'unavailable', reason: 'integration_not_connected', items: [], total: 0 },
    upcomingDepartures: { status: 'unavailable', reason: 'integration_not_connected', items: [], total: 0 },
  };
}

function truckDetailWorkPlan() {
  return {
    truck: {
      id: truckId,
      truckNumber: 'Y-WP2',
      make: 'Volvo',
      model: 'VNL',
      year: 2024,
      mileage: 100000,
      company: 'Lightning Transport',
      owner: 'Lightning Transport',
      vin: null,
      location: null,
      locationUpdatedOn: null,
    },
    phase: 'shop_work',
    readiness: 'under_review',
    operationalStatus: 'in_shop',
    assessment: null,
    activeWorkOrder: {
      id: '00000000-0000-4000-8000-000000000201',
      displayId: 'WO-201',
      status: 'in_progress',
      priority: 'normal',
      category: { id: '00000000-0000-4000-8000-000000000301', name: 'Air & Brake System' },
      mechanics: [],
      currentPause: null,
    },
    blockers: [],
    presence: { state: 'unknown', provenance: 'phase_1_unavailable' },
    repairHistory: { items: [], nextCursor: null },
    repairHistoryUrl: `/api/admin/trucks/${truckId}/repair-history`,
    incomingTrucks: { status: 'unavailable', reason: 'integration_not_connected' },
    upcomingDepartures: { status: 'unavailable', reason: 'integration_not_connected' },
    workPlan: {
      sliceEnabled: true,
      inspection: { outcome: 'issues_found' },
      workOrder: {
        id: '00000000-0000-4000-8000-000000000201',
        displayId: 'WO-201',
        status: 'in_progress',
        version: 1,
        primaryCategoryName: 'Air & Brake System',
      },
      jobs: [
        {
          id: '00000000-0000-4000-8000-000000000401',
          catalogJobId: '00000000-0000-4000-8000-000000000801',
          displayName: 'Brake Inspection',
          customDescription: null,
          status: 'to_do',
          uiStatus: 'pending',
          category: { id: '00000000-0000-4000-8000-000000000301', name: 'Air & Brake System' },
        },
      ],
      remainingJobCount: 1,
      readiness: 'not_ready',
      readyReason: 'jobs_remaining',
      phase: 'shop_work',
      mandatory: {
        pm: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
        alignment: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
        detailing: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
        qualityCheck: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
      },
      capabilities: { canRead: true, canAddWork: true, canRecordInspection: true, canCompleteJobs: true },
      phase1: { assessmentId: null, gatesRemainDefault: true },
    },
  };
}

async function mockSession(page: Page) {
  // The Admin shell needs a real session; mocking /api/auth/me alone lands on /login.
  await devLogin(page, 'manager@lightning.local');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await page.route('**/api/auth/me', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manager) });
  });
}

test.describe('Yard Work Plan board cutover (LTR-40)', () => {
  test('board columns follow Work Plan phases and Detail hides six-gate', async ({ page }) => {
    await mockSession(page);
    await page.route('**/api/admin/yard-operations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(yardPage()),
      });
    });
    await page.route(`**/api/admin/trucks/${truckId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(truckDetailWorkPlan()),
      });
    });

    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto('/admin/yard-operations');
    await expect(page.getByRole('heading', { name: 'Yard Operations', exact: true })).toBeVisible();
    for (const phase of ['Inspection', 'Shop Work', 'PM', 'Alignment', 'Detailing', 'Quality Check', 'Ready to close', 'Ready to Go']) {
      await expect(page.getByRole('heading', { name: phase, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Needs evaluation', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Required Work', exact: true })).toHaveCount(0);
    // Stage 6: the step is the lane; the card does not repeat it.
    await expect(page.locator('[data-phase="shop_work"]').getByTestId('yard-truck-card').first()).toBeVisible();

    await page.getByRole('link', { name: 'Y-WP2', exact: true }).click();
    // LTR-110: Yard links carry ?from= so Truck Detail can link back to the board.
    await expect(page).toHaveURL(new RegExp(`/admin/trucks/${truckId}\\?from=%2Fadmin%2Fyard-operations$`));
    await expect(page.getByRole('heading', { name: 'Work Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start assessment' })).toHaveCount(0);
    await expect(page.getByText('Required Work')).toHaveCount(0);
  });

  test('LTR-148 / LTR-159: the board has the PM column, QC always, and a card shows the one Next step', async ({ page }) => {
    await mockSession(page);
    const base = yardPage();
    const pmPage = {
      ...base,
      items: [{
        ...base.items[0], phase: 'pm', readyReason: 'pm_pending',
        activeWorkOrder: { ...base.items[0].activeWorkOrder, jobsCompleted: 1, jobsTotal: 5, createdAt: new Date().toISOString() },
        nextStep: { kind: 'work', jobName: 'PM A Service', remaining: 4 },
      }],
    };
    await page.route('**/api/admin/yard-operations**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pmPage) });
    });

    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto('/admin/yard-operations');
    const headings = ['Inspection', 'Shop Work', 'PM', 'Alignment', 'Detailing', 'Quality Check', 'Ready to close', 'Ready to Go'];
    for (const phase of headings) {
      await expect(page.getByRole('heading', { name: phase, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('yard-card-next-step').first()).toHaveText('4 Jobs left · next: PM A Service');
  });
});
