import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';

const truckId = '00000000-0000-4000-8000-00000000aaa1';
const manager = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'manager@lightning.local',
  name: 'Shop Manager',
  role: 'manager',
  active: true,
  capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'],
};

const mechanicAlex = {
  id: '00000000-0000-4000-8000-000000000011',
  name: 'Alex Mechanic',
  email: 'alex@lightning.local',
  role: 'mechanic',
  active: true,
  capabilities: ['mechanic.standard'],
  openWorkOrderCount: 0,
  currentAssignments: [],
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
    assignedMechanic?: { id: string; name: string } | null;
  }>;
  remainingJobCount: number;
  readiness: string;
  readyReason: string;
  phase: string;
  mandatory: {
    pm: { required: boolean; status: string; jobCount: number; remainingCount: number };
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
      pm: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
      alignment: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
      detailing: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
      qualityCheck: { required: true, status: 'pending', jobCount: 0, remainingCount: 0 },
    },
    capabilities: { canRead: true, canAddWork: true, canRecordInspection: true },
    phase1: { assessmentId: null, gatesRemainDefault: true },
  };
}

function truckDetail(workPlan: ReturnType<typeof emptyPlan>) {
  return {
    truck,
    presence: { state: 'unknown', provenance: 'phase_1_unavailable' },
    operationalStatus: 'unknown',
    operationalStatusAt: null,
    assessment: null,
    phase: 'inspection',
    blockers: [],
    activeWorkOrder: workPlan.workOrder
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
    workPlan,
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

type AddJobsBody = {
  expectedVersion?: number;
  jobs: Array<{ catalogJobId?: string; categoryId: string; displayName: string; customDescription?: string; assignedMechanicId?: string }>;
};

async function mockWorkPlanApi(page: Page, workPlan: ReturnType<typeof emptyPlan>, addJobsBodies: AddJobsBody[] = []) {
  const plan = structuredClone(workPlan);

  await page.route('**/api/admin/trucks/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === `/api/admin/trucks/${truckId}` && request.method() === 'GET') {
      return json(route, truckDetail(plan));
    }
    if (path === `/api/admin/trucks/${truckId}/work-plan` && request.method() === 'GET') {
      return json(route, plan);
    }
    if (path === `/api/admin/trucks/${truckId}/work-plan/inspection` && request.method() === 'POST') {
      const body = request.postDataJSON() as { outcome: 'issues_found' | 'no_issues_found' };
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
      const body = request.postDataJSON() as AddJobsBody;
      addJobsBodies.push(body);
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
          // D14: the owner chosen in Hallazgos comes back on the Job.
          assignedMechanic: job.assignedMechanicId === mechanicAlex.id
            ? { id: mechanicAlex.id, name: mechanicAlex.name }
            : null,
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

  // LTR-154 / D11: per-Job owner from the Truck Work Plan.
  await page.route('**/api/admin/mechanics?**', async (route) => json(route, {
    items: [mechanicAlex],
    nextCursor: null,
  }));
  await page.route('**/api/admin/work-orders/*/jobs/*/assign', async (route) => {
    const jobId = new URL(route.request().url()).pathname.split('/').at(-2);
    const job = plan.jobs.find((item) => item.id === jobId);
    if (job) job.assignedMechanic = { id: mechanicAlex.id, name: mechanicAlex.name };
    if (plan.workOrder) plan.workOrder.version += 1;
    return json(route, { id: plan.workOrder?.id, version: plan.workOrder?.version });
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
  await devLogin(page, manager.email);
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
}

test.describe('LTR-33 Truck Detail Work Plan', () => {
  test('Add work adds a catalog job without editing six gates', async ({ page }) => {
    await mockWorkPlanApi(page, emptyPlan());
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);

    await expect(page.getByRole('heading', { name: 'Work Plan' }).first()).toBeVisible();
    // LTR-174: without a Work Order only the arrival inspection exists; the readiness rows come with the Work Order.
    await expect(page.getByRole('heading', { name: 'Readiness' })).toHaveCount(0);
    await expect(page.getByText('Not Ready — 0 remaining')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start assessment' })).toHaveCount(0);
    await expect(page.getByLabel('Outcome: Inspection')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark Ready to Go' })).toHaveCount(0);

    // D41: the inspection is the sheet now; the work is added with Add work.
    await page.getByRole('button', { name: 'Add work' }).first().click();
    await page.getByRole('radio', { name: 'Air & Brake System' }).click();
    await page.getByRole('button', { name: 'Add Brake Inspection' }).click();
    await page.getByRole('button', { name: 'Add to Work Plan' }).click();

    await expect(page.getByText('Work Plan updated.').first()).toBeVisible();
    // Stage 4: the steps to leave the shop appear with the Work Order; the header says what it is.
    await expect(page.getByTestId('truck-stepper')).toBeVisible();
    const planList = page.getByRole('list', { name: 'Jobs in this Work Order' });
    await expect(planList.getByText('Brake Inspection')).toBeVisible();
    await expect(planList.getByText('To do').first()).toBeVisible();
    await expect(page.getByTestId('operational-counts')).toHaveText(/1 job left.*0 mechanics/);
    await expect(page.getByTestId('truck-work-order-chip')).toContainText(/WO-WP1.*Created/);
    // T4: each Job opens its row on the Work Order, which comes back to this Truck.
    await expect(planList.getByRole('link', { name: 'Manage Brake Inspection in the Work Order' }))
      .toHaveAttribute('href', /\/admin\/work-orders\/00000000-0000-4000-8000-00000000bbb1\?from=%2Fadmin%2Ftrucks%2F.*#job-/);
    await expect(page.getByRole('heading', { name: 'Required Work' })).toHaveCount(0);
  });

  test('The inspection step asks for the sheet, with no outcome buttons (D41)', async ({ page }) => {
    await mockWorkPlanApi(page, emptyPlan());
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);
    await expect(page.getByTestId('truck-inspection').getByText(/every check and the 10 tires/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'No issues found' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Issues found', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Required Work' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark Ready to Go' })).toHaveCount(0);
  });

  test('Detailing with no catalog Jobs shows EmptyState and keeps Custom available', async ({ page }) => {
    await mockWorkPlanApi(page, emptyPlan());
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);
    await page.getByRole('button', { name: 'Add work' }).first().click();
    await page.getByRole('radio', { name: 'Detailing' }).click();
    await expect(page.getByText('No Jobs are listed for this Category.')).toBeVisible();
    await expect(page.getByText('You can still add a custom Job.')).toBeVisible();
    await expect(page.getByText('Detailing is required. Choose the Detailing catalog Job, or add a custom Job.')).toBeVisible();
    const customName = page.getByLabel('Custom job name');
    await expect(customName).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Add custom job' })).toBeDisabled();
    await customName.fill('Cab wash');
    await expect(page.getByRole('button', { name: 'Add custom job' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add custom job' }).click();
    await page.getByRole('button', { name: 'Add to Work Plan' }).click();
    await expect(page.getByText('Work Plan updated.').first()).toBeVisible();
    await expect(page.getByRole('list', { name: 'Jobs in this Work Order' }).getByText('Cab wash')).toBeVisible();
  });

  test('Manager adds a custom Job also to the catalog: it goes on as a catalog Job; a name already there selects that one (D25)', async ({ page }) => {
    const plan = emptyPlan();
    plan.inspection.outcome = 'issues_found';
    plan.workOrder = { id: '00000000-0000-4000-8000-00000000bbb1', displayId: 'WO-WP1', status: 'created', version: 3, primaryCategoryName: categories[0].name };
    const bodies: AddJobsBody[] = [];
    await mockWorkPlanApi(page, plan, bodies);
    const created: typeof catalogJobs = [];
    const catalogPosts: Array<{ categoryId: string; displayName: string }> = [];
    // Registered after mockWorkPlanApi, so these win for the catalog list and the catalog write.
    await page.route('**/api/catalog/jobs**', async (route) => {
      const categoryId = new URL(route.request().url()).searchParams.get('categoryId');
      return json(route, [...catalogJobs, ...created].filter((job) => !categoryId || job.categoryId === categoryId));
    });
    await page.route('**/api/admin/catalog/jobs', async (route) => {
      const body = route.request().postDataJSON() as { categoryId: string; displayName: string };
      catalogPosts.push(body);
      const existing = [...catalogJobs, ...created].find((job) => (
        job.categoryId === body.categoryId && job.displayName.toLowerCase() === body.displayName.trim().toLowerCase()
      ));
      if (existing) {
        return json(route, { code: 'CATALOG_JOB_EXISTS', message: 'A catalog job with this name already exists in the category.', jobId: existing.id }, 409);
      }
      const job = { id: '00000000-0000-4000-8000-000000000901', categoryId: body.categoryId, displayName: body.displayName.trim(), aliases: [body.displayName.trim()] };
      created.push(job);
      return json(route, { ...job, status: 'active' });
    });
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);

    await page.getByRole('radio', { name: 'Air & Brake System' }).click();
    const alsoCatalog = page.getByLabel('Also add to the catalog');
    await expect(alsoCatalog).not.toBeChecked();

    await page.getByLabel('Custom job name').fill('  Air dryer cartridge ');
    await alsoCatalog.check();
    await page.getByRole('button', { name: 'Add custom job' }).click();
    await expect(page.getByLabel('Custom job name')).toHaveValue('');
    await expect(alsoCatalog).not.toBeChecked();
    // It is now a catalog Job: selected in the category list, which reloaded with it.
    await expect(page.getByRole('button', { name: 'Add Air dryer cartridge' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByLabel('Custom job name').fill('brake inspection');
    await alsoCatalog.check();
    await page.getByRole('button', { name: 'Add custom job' }).click();
    await expect(page.getByText('"Brake Inspection" is already in the catalog. We selected it from the list.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Brake Inspection' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByLabel('Custom job name').fill('Mirror bracket');
    await page.getByRole('button', { name: 'Add custom job' }).click();

    await page.getByRole('button', { name: 'Add to Work Plan' }).click();
    await expect(page.getByText('Work Plan updated.').first()).toBeVisible();
    expect(catalogPosts).toEqual([
      { categoryId: categories[0].id, displayName: 'Air dryer cartridge' },
      { categoryId: categories[0].id, displayName: 'brake inspection' },
    ]);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].jobs).toEqual([
      expect.objectContaining({ catalogJobId: '00000000-0000-4000-8000-000000000901', displayName: 'Air dryer cartridge' }),
      expect.objectContaining({ catalogJobId: catalogJobs[0].id, displayName: 'Brake Inspection' }),
      expect.objectContaining({ displayName: 'Mirror bracket', customDescription: 'Mirror bracket' }),
    ]);
    expect(bodies[0].jobs[0]).not.toHaveProperty('customDescription');
    expect(bodies[0].jobs[2]).not.toHaveProperty('catalogJobId');
  });

  test('Manager sets the owner of a Job from the Work Plan (LTR-154 / D11)', async ({ page }) => {
    await mockWorkPlanApi(page, emptyPlan());
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);
    await page.getByRole('button', { name: 'Add work' }).first().click();
    await page.getByRole('radio', { name: 'Air & Brake System' }).click();
    await page.getByRole('button', { name: 'Add Brake Inspection' }).click();
    await page.getByRole('button', { name: 'Add to Work Plan' }).click();

    const planList = page.getByRole('list', { name: 'Jobs in this Work Order' });
    // LTR-174: the Truck only offers Assign for a Job with no owner; Stage 4: it opens the mechanic picker.
    await planList.getByRole('button', { name: 'Mechanic for Brake Inspection' }).click();
    await page.getByTestId('mechanic-picker').getByRole('option', { name: /Alex Mechanic/ }).click();
    await expect(page.getByText('Job assigned.').first()).toBeVisible();
    await expect(planList.getByText('Assigned to: Alex Mechanic')).toBeVisible();
  });

  test('Manager chooses who does each Job while adding Hallazgos to an open Work Order (D14)', async ({ page }) => {
    const plan = emptyPlan();
    plan.inspection.outcome = 'issues_found';
    plan.workOrder = { id: '00000000-0000-4000-8000-00000000bbb1', displayId: 'WO-WP1', status: 'created', version: 3, primaryCategoryName: categories[0].name };
    const bodies: AddJobsBody[] = [];
    await mockWorkPlanApi(page, plan, bodies);
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);

    // Issues found with no Jobs yet: the add form is already open.
    await page.getByRole('radio', { name: 'Air & Brake System' }).click();
    await page.getByRole('button', { name: 'Add Brake Inspection' }).click();
    await page.getByLabel('Custom job name').fill('Air leak at tank');
    await page.getByRole('button', { name: 'Add custom job' }).click();

    const brakeOwner = page.getByLabel('Who does Brake Inspection?');
    await expect(brakeOwner).toHaveValue('');
    await expect(brakeOwner.locator('option:checked')).toHaveText('Who does it?');
    await brakeOwner.selectOption({ label: 'Alex Mechanic' });
    await page.getByRole('button', { name: 'Add to Work Plan' }).click();

    await expect(page.getByText('Work Plan updated.').first()).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].expectedVersion).toBe(3);
    expect(bodies[0].jobs).toEqual([
      expect.objectContaining({ displayName: 'Brake Inspection', assignedMechanicId: mechanicAlex.id }),
      expect.not.objectContaining({ assignedMechanicId: expect.anything() }),
    ]);
    const planList = page.getByRole('list', { name: 'Jobs in this Work Order' });
    await expect(planList.getByText('Assigned to: Alex Mechanic')).toHaveCount(1);
    await expect(planList.getByRole('button', { name: /^Mechanic for / })).toHaveCount(1);
  });

  test('Next step closes the Work Order and returns the Truck to service from the Truck (LTR-158)', async ({ page }) => {
    const plan = structuredClone(emptyPlan());
    plan.inspection.outcome = 'issues_found';
    plan.workOrder = { id: '00000000-0000-4000-8000-00000000bbb1', displayId: 'WO-WP1', status: 'in_progress', version: 4, primaryCategoryName: categories[0].name };
    let step: Record<string, unknown> = { kind: 'close', workOrderId: plan.workOrder.id };
    let closed = false;
    let rtsBody: Record<string, unknown> | null = null;
    await page.route('**/api/admin/trucks/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === `/api/admin/trucks/${truckId}` && route.request().method() === 'GET') {
        return json(route, { ...truckDetail(plan), nextStep: step });
      }
      return route.continue();
    });
    await page.route('**/api/admin/work-orders/*/complete', async (route) => {
      closed = true;
      plan.workOrder!.status = 'completed';
      step = { kind: 'return_to_service', workOrderId: plan.workOrder!.id };
      return json(route, { id: plan.workOrder!.id, version: 5 });
    });
    await page.route('**/api/admin/work-orders/*/return-to-service', async (route) => {
      rtsBody = route.request().postDataJSON();
      step = { kind: 'create_work_order' };
      return json(route, { id: plan.workOrder!.id, version: 6 });
    });

    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);
    const card = page.getByTestId('truck-next-step');
    await expect(card).toHaveAttribute('data-kind', 'close');
    await card.getByRole('button', { name: 'Close Work Order' }).click();
    // Owner decision (2026-10-05): closing confirms in a dialog.
    await page.getByTestId('close-work-order-dialog').getByRole('button', { name: 'Close Work Order' }).click();
    await expect.poll(() => closed).toBe(true);
    await expect(card).toHaveAttribute('data-kind', 'return_to_service');

    // D7: Return to Service confirms in a dialog; the reason is optional.
    await card.getByRole('button', { name: 'Return to Service' }).click();
    await page.getByTestId('return-to-service-dialog').getByRole('button', { name: 'Confirm Return to Service' }).click();
    await expect.poll(() => rtsBody).toMatchObject({ expectedVersion: 4 });
    expect(rtsBody).not.toHaveProperty('reason');
    await expect(card).toHaveAttribute('data-kind', 'create_work_order');
  });

  // LTR-200 / D32 (PC-4): Overview · Costs for the Shop Manager.
  test('Truck → Costs: totals, bars by month, movements with a voided reversal, labor amount and hours', async ({ page }) => {
    await mockWorkPlanApi(page, emptyPlan());
    const periods: string[] = [];
    await page.route('**/api/admin/parts-costs/trucks/**', async (route) => {
      periods.push(new URL(route.request().url()).search);
      await json(route, {
        truck: { id: truckId, truckNumber: 'Y-WP1' },
        from: null,
        to: null,
        totals: { partsCents: 4820, outsideCents: 184000, laborCents: 57000, totalCents: 245820 },
        months: [{ month: '2026-09', partsCents: 4820, outsideCents: 0, laborCents: 0 }, { month: '2026-10', partsCents: 0, outsideCents: 184000, laborCents: 57000 }],
        entries: [
          { id: 'e3', occurredOn: '2026-10-08', kind: 'outside_repair', amountCents: 184000, description: 'Diesel Pro · 7712 · Radiator recore', sourceType: 'outside_repair', sourceId: 'r1', workOrder: { id: 'wo1', displayId: 'WO-001' }, reversal: null },
          { id: 'e2', occurredOn: '2026-09-20', kind: 'part_purchase', amountCents: -1200, description: 'TruckPro · 55 · Mud flaps × 1', sourceType: 'part_purchase', sourceId: 'p2', workOrder: null, reversal: 'voided' },
          { id: 'e1', occurredOn: '2026-09-20', kind: 'part_purchase', amountCents: 1200, description: 'TruckPro · 55 · Mud flaps × 1', sourceType: 'part_purchase', sourceId: 'p2', workOrder: null, reversal: null },
        ],
        laborHours: 44.75,
        laborRateSet: true,
      });
    });
    await loginManager(page);
    await page.goto(`/admin/trucks/${truckId}`);
    await page.getByTestId('truck-tabs').getByRole('link', { name: 'Costs' }).click();
    await expect(page).toHaveURL(/tab=costs/);
    await expect(page.getByRole('heading', { name: 'Costs of Truck Y-WP1' })).toBeVisible();
    await expect(page.getByTestId('truck-costs-total')).toHaveText('$2,458.20');
    // LTR-201 / D34: labor has an amount once the shop has a rate.
    await expect(page.getByTestId('truck-costs-labor-tile')).toContainText('$570.00');
    await expect(page.getByTestId('truck-costs-labor')).toHaveText('44.75 h recorded in this period');
    await expect(page.getByTestId('truck-costs-entries').getByText('Voided')).toBeVisible();
    await expect(page.getByTestId('truck-costs-entries')).toContainText('-$12.00');
    await expect(page.getByRole('link', { name: 'Add purchase' })).toHaveAttribute('href', `/admin/parts/purchases?new=1&forTruck=${truckId}&from=${encodeURIComponent(`/admin/trucks/${truckId}?tab=costs`)}`);
    await page.getByRole('radio', { name: 'All time' }).click();
    await expect.poll(() => periods.at(-1)).toBe('');
    expect(periods[0]).toMatch(/^\?from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}$/);
    await page.getByTestId('truck-tabs').getByRole('link', { name: 'Overview' }).click();
    await expect(page.getByRole('heading', { name: 'Work Plan' }).first()).toBeVisible();
  });
});
