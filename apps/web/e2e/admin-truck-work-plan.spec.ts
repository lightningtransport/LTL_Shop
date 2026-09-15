import { expect, test, type Page, type Route } from '@playwright/test';

const truckId = '00000000-0000-4000-8000-00000000aaa1';
const manager = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'manager@lightning.local',
  name: 'Shop Manager',
  role: 'manager',
  active: true,
  pmAuthorized: false,
  capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'],
};

const categories = [
  { id: '00000000-0000-4000-8000-000000000301', name: 'Air & Brake System', sortOrder: 1 },
  { id: '00000000-0000-4000-8000-000000000302', name: 'Suspension & Steering', sortOrder: 2 },
  { id: '00000000-0000-4000-8000-000000000303', name: 'PM', sortOrder: 3 },
  { id: '00000000-0000-4000-8000-000000000304', name: 'Detailing', sortOrder: 4 },
];

const catalogJobs = [
  {
    id: '00000000-0000-4000-8000-000000000801',
    categoryId: categories[0].id,
    displayName: 'Brake Inspection',
    aliases: ['brake inspection'],
  },
  {
    id: '00000000-0000-4000-8000-000000000806',
    categoryId: categories[1].id,
    displayName: 'Alignment',
    aliases: ['alignment'],
  },
];

const truck = {
  id: truckId,
  truckNumber: 'Y-WP1',
  make: 'Freightliner',
  model: 'Cascadia',
  year: 2022,
  mileage: 1000,
  company: 'Lightning Transport',
  owner: 'Lightning Transport',
  vin: '1FUJGLDR8CSBA0WP1',
  location: '4802 Orient Road, Tampa, FL',
  locationUpdatedOn: '2026-09-14',
};

function emptyPlan(): {
  sliceEnabled: boolean;
  inspection: { outcome: 'not_started' | 'issues_found' | 'no_issues_found' };
  workOrder: null | {
    id: string;
    displayId: string;
    status: string;
    version: number;
    primaryCategoryName: string;
  };
  jobs: Array<{
    id: string;
    catalogJobId: string | null;
    displayName: string;
    customDescription: string | null;
    category: { id: string; name: string };
    status: string;
    uiStatus: string;
    lane: string;
  }>;
  remainingJobCount: number;
  readiness: string;
  readyReason: string;
  phase: string;
  mandatory: {
    alignment: { required: boolean; status: string; jobCount: number; remainingCount: number };
    detailing: { required: boolean; status: string; jobCount: number; remainingCount: number };
    qualityCheck: { required: boolean; status: string; jobCount: number; remainingCount: number };
  };
  capabilities: { canRead: boolean; canAddWork: boolean; canRecordInspection: boolean };
  phase1: { assessmentId: string | null; gatesRemainDefault: true };
} {
  return {
    sliceEnabled: true,
    inspection: { outcome: 'not_started' },
    workOrder: null,
    jobs: [],
    remainingJobCount: 0,
    readiness: 'not_ready',
    readyReason: 'inspection_pending',
    phase: 'inspection',
    mandatory: {
      alignment: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
      detailing: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
      qualityCheck: { required: false, status: 'not_applicable', jobCount: 0, remainingCount: 0 },
    },
    capabilities: { canRead: true, canAddWork: true, canRecordInspection: true },
    phase1: { assessmentId: null, gatesRemainDefault: true },
  };
}

function truckDetail(workPlan: ReturnType<typeof emptyPlan> | undefined) {
  return {
    truck,
    presence: { state: 'unknown', provenance: 'phase_1_unavailable' },
    operationalStatus: 'unknown',
    operationalStatusAt: null,
    assessment: null,
    phase: 'needs_evaluation',
    blockers: [],
    activeWorkOrder: workPlan?.workOrder
      ? {
        id: workPlan.workOrder.id,
        displayId: workPlan.workOrder.displayId,
        truck: { id: truck.id, truckNumber: truck.truckNumber, make: truck.make, model: truck.model, year: truck.year },
        category: { id: categories[0].id, name: workPlan.workOrder.primaryCategoryName },
        status: workPlan.workOrder.status,
        priority: 'normal',
        jobsCompleted: 0,
        jobsTotal: workPlan.jobs.length,
        mechanics: [],
        currentPause: null,
        latestReportedBlocker: null,
        createdAt: '2026-09-14T12:00:00.000Z',
        startedAt: null,
        completedAt: null,
        updatedAt: '2026-09-14T12:00:00.000Z',
      }
      : null,
    repairHistory: { items: [], nextCursor: null },
    repairHistoryUrl: `/api/admin/trucks/${truckId}/repair-history`,
    incomingTrucks: { status: 'unavailable', reason: 'integration_not_connected' },
    upcomingDepartures: { status: 'unavailable', reason: 'integration_not_connected' },
    ...(workPlan ? { workPlan } : {}),
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockWorkPlanApi(page: Page, workPlan: ReturnType<typeof emptyPlan> | undefined) {
  let plan = workPlan ? structuredClone(workPlan) : undefined;

  await page.route('**/api/admin/trucks/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === `/api/admin/trucks/${truckId}` && request.method() === 'GET') {
      return json(route, truckDetail(plan));
    }
    if (path === `/api/admin/trucks/${truckId}/work-plan/inspection` && request.method() === 'POST') {
      const body = request.postDataJSON() as { outcome: 'issues_found' | 'no_issues_found' };
      plan = plan ?? emptyPlan();
      plan.inspection.outcome = body.outcome;
      if (body.outcome === 'issues_found') {
        plan.readyReason = 'jobs_remaining';
        plan.phase = 'shop_work';
      } else {
        plan.readyReason = 'alignment_pending';
        plan.phase = 'alignment';
        plan.remainingJobCount = 0;
      }
      return json(route, plan);
    }
    if (path === `/api/admin/trucks/${truckId}/work-plan/jobs` && request.method() === 'POST') {
      const body = request.postDataJSON() as {
        jobs: Array<{ catalogJobId?: string; categoryId: string; displayName: string; customDescription?: string }>;
      };
      plan = plan ?? emptyPlan();
      plan.inspection.outcome = 'issues_found';
      plan.workOrder = plan.workOrder ?? {
        id: '00000000-0000-4000-8000-00000000bbb1',
        displayId: 'WO-WP1',
        status: 'created',
        version: 1,
        primaryCategoryName: categories[0].name,
      };
      for (const job of body.jobs) {
        const category = categories.find((item) => item.id === job.categoryId) ?? categories[0];
        const lane = job.displayName.toLowerCase().includes('alignment')
          ? 'alignment'
          : job.displayName.toLowerCase().includes('detailing')
            ? 'detailing'
            : 'shop_work';
        plan.jobs.push({
          id: crypto.randomUUID(),
          catalogJobId: job.catalogJobId ?? null,
          displayName: job.displayName,
          customDescription: job.customDescription ?? null,
          category: { id: category.id, name: category.name },
          status: 'to_do',
          uiStatus: 'pending',
          lane,
        });
      }
      plan.workOrder.version += 1;
      plan.remainingJobCount = plan.jobs.filter((job) => job.status === 'to_do').length;
      plan.readiness = 'not_ready';
      plan.readyReason = 'jobs_remaining';
      plan.phase = 'shop_work';
      if (plan.jobs.some((job) => job.lane === 'alignment')) {
        plan.mandatory.alignment = { required: true, status: 'pending', jobCount: 1, remainingCount: 1 };
      }
      return json(route, plan);
    }
    return route.continue();
  });

  await page.route('**/api/catalog/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/catalog/categories') return json(route, categories);
    if (url.pathname === '/api/catalog/jobs') {
      const categoryId = url.searchParams.get('categoryId');
      return json(route, catalogJobs.filter((job) => !categoryId || job.categoryId === categoryId));
    }
    return route.continue();
  });
}

async function loginManager(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(manager.email);
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
}

test.describe('LTR-33 Truck Detail Work Plan', () => {
  test('flag off keeps the Phase 1 six-gate Readiness journey', async ({ page }) => {
    await mockWorkPlanApi(page, undefined);
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);
    await expect(page.getByRole('heading', { name: 'Readiness' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start assessment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Work Plan', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Issues found', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark Ready to Go' })).toHaveCount(0);
  });

  test('flag on: Issues found adds a catalog job without editing six gates', async ({ page }) => {
    await mockWorkPlanApi(page, emptyPlan());
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);

    await expect(page.getByRole('heading', { name: 'Work Plan' }).first()).toBeVisible();
    await expect(page.getByText('Not Ready — 0 remaining')).toBeVisible();
    await expect(page.getByText('Inspection is not finished yet.')).toBeVisible();
    await expect(page.getByText('Mandatory for every yard Truck')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start assessment' })).toHaveCount(0);
    await expect(page.getByLabel('Outcome: Inspection')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark Ready to Go' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Issues found', exact: true }).click();
    await expect(page.getByText('Inspection recorded.')).toBeVisible();
    await page.getByLabel('Job Category').selectOption({ label: 'Air & Brake System' });
    await page.getByRole('button', { name: 'Add Brake Inspection' }).click();
    await page.getByRole('button', { name: 'Add to Work Plan' }).click();

    await expect(page.getByText('Work Plan updated.')).toBeVisible();
    const planList = page.getByRole('list', { name: 'Jobs in this Work Order' });
    await expect(planList.getByText('Brake Inspection')).toBeVisible();
    await expect(planList.getByText('Pending')).toBeVisible();
    await expect(page.getByText('Not Ready — 1 remaining')).toBeVisible();
    await expect(page.getByText('Open Jobs still need to be completed.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Work Order: WO-WP1/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Required Work' })).toHaveCount(0);
  });

  test('flag on: No issues found does not invent a Required Work gate', async ({ page }) => {
    await mockWorkPlanApi(page, emptyPlan());
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);
    await page.getByRole('button', { name: 'No issues found' }).click();
    await expect(page.getByText('Inspection is resolved without Shop Work Jobs. Alignment and Detailing are still required.')).toBeVisible();
    await expect(page.getByText('Alignment is required and not complete.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Required Work' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark Ready to Go' })).toHaveCount(0);
  });

  test('flag on: Detailing with no catalog Jobs shows EmptyState and keeps Custom available', async ({ page }) => {
    await mockWorkPlanApi(page, emptyPlan());
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);
    await page.getByRole('button', { name: 'Issues found', exact: true }).click();
    await expect(page.getByText('Inspection recorded.')).toBeVisible();
    await page.getByLabel('Job Category').selectOption({ label: 'Detailing' });
    await expect(page.getByText('No Jobs are listed for this Category.')).toBeVisible();
    await expect(page.getByText('You can still add a custom Job.')).toBeVisible();
    await expect(page.getByText('Detailing is required. If no catalog Job is listed, add a custom Job.')).toBeVisible();
    const customName = page.getByLabel('Custom job name');
    await expect(customName).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Add custom job' })).toBeDisabled();
    await customName.fill('Cab wash');
    await expect(page.getByRole('button', { name: 'Add custom job' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add custom job' }).click();
    await page.getByRole('button', { name: 'Add to Work Plan' }).click();
    await expect(page.getByText('Work Plan updated.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Jobs in this Work Order' }).getByText('Cab wash')).toBeVisible();
  });
});
