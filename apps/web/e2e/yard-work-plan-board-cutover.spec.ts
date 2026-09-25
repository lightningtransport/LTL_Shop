import { expect, test, type Page, type Route } from '@playwright/test';

const manager = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'manager@lightning.local',
  name: 'Shop Manager',
  role: 'manager',
  active: true,
  pmAuthorized: false,
  capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'],
};

const truckId = '00000000-0000-4000-8000-00000000bbb1';

function yardPage(cutover: boolean) {
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
        phase: cutover ? 'shop_work' : 'required_work',
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
    counts: { underReview: 1, readyToGo: 0, blocked: 0, presenceUnknown: 1 },
    workLocation: { status: 'ok', items: [], total: 0 },
    incomingTrucks: { status: 'unavailable', reason: 'integration_not_connected', items: [], total: 0 },
    upcomingDepartures: { status: 'unavailable', reason: 'integration_not_connected', items: [], total: 0 },
    workPlanBoardCutover: cutover,
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
        alignment: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
        detailing: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
        qualityCheck: { required: false, status: 'not_applicable', jobCount: 0, remainingCount: 0 },
      },
      capabilities: { canRead: true, canAddWork: true, canRecordInspection: true, canCompleteJobs: true },
      phase1: { assessmentId: null, gatesRemainDefault: true },
    },
  };
}

async function mockSession(page: Page) {
  await page.route('**/api/auth/me', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manager) });
  });
}

test.describe('Yard Work Plan board cutover (LTR-40)', () => {
  test('flag on: board columns follow Work Plan phases and Detail hides six-gate', async ({ page }) => {
    await mockSession(page);
    await page.route('**/api/admin/yard-operations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(yardPage(true)),
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
    await expect(page.locator('[data-work-plan-board="true"]')).toBeVisible();
    for (const phase of ['Inspection', 'Shop Work', 'Alignment', 'Detailing', 'Ready to Go']) {
      await expect(page.getByRole('heading', { name: phase, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Needs evaluation', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Required Work', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('yard-truck-card').getByText('Shop Work')).toBeVisible();

    await page.getByRole('link', { name: 'Y-WP2', exact: true }).click();
    // LTR-110: Yard links carry ?from= so Truck Detail can link back to the board.
    await expect(page).toHaveURL(new RegExp(`/admin/trucks/${truckId}\\?from=%2Fadmin%2Fyard-operations$`));
    await expect(page.getByRole('heading', { name: 'Work Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start assessment' })).toHaveCount(0);
    await expect(page.getByText('Required Work')).toHaveCount(0);
  });

  test('flag off: Phase 1 nine columns stay', async ({ page }) => {
    await mockSession(page);
    await page.route('**/api/admin/yard-operations**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(yardPage(false)),
      });
    });

    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto('/admin/yard-operations');
    await expect(page.locator('[data-work-plan-board="false"]')).toBeVisible();
    for (const phase of ['Needs evaluation', 'Inspection', 'Required Work', 'PM', 'Alignment', 'Detailing', 'Quality Check', 'Ready for Approval', 'Ready to Go']) {
      await expect(page.getByRole('heading', { name: phase, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Shop Work', exact: true })).toHaveCount(0);
  });
});
