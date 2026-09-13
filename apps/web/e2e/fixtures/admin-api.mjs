import { createServer } from 'node:http';

const users = {
  'mechanic@lightning.local': {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'mechanic@lightning.local',
    name: 'Alejandro 1',
    role: 'mechanic',
    active: true,
    pmAuthorized: false,
    capabilities: ['mechanic.standard'],
  },
  'anthony@lightning.local': {
    id: '00000000-0000-4000-8000-000000000006',
    email: 'anthony@lightning.local',
    name: 'Anthony',
    role: 'mechanic',
    active: true,
    pmAuthorized: false,
    capabilities: ['mechanic.standard'],
  },
  'manager@lightning.local': {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'manager@lightning.local',
    name: 'Shop Manager',
    role: 'manager',
    active: true,
    pmAuthorized: false,
    capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'],
  },
  'admin@lightning.local': {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'admin@lightning.local',
    name: 'Shop Administrator',
    role: 'admin',
    active: true,
    pmAuthorized: false,
    capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'],
  },
  'ibrain@ltransl.com': {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'ibrain@ltransl.com',
    name: 'iBrain Admin',
    role: 'admin',
    active: true,
    pmAuthorized: true,
    capabilities: ['admin.access', 'mechanic.standard', 'mechanic.pm'],
  },
  'cristian240588@hotmail.com': {
    id: '00000000-0000-4000-8000-000000000005',
    email: 'cristian240588@hotmail.com',
    name: 'Cristian Perez',
    role: 'admin',
    active: true,
    pmAuthorized: false,
    capabilities: ['admin.access', 'mechanic.standard', 'mechanic.pm'],
  },
};

const workOrders = [
  makeWorkOrder('00000000-0000-4000-8000-000000000101', 'WO-0101', 'T-101', 'critical', 'waiting_paused'),
  makeWorkOrder('00000000-0000-4000-8000-000000000102', 'WO-0102', 'T-102', 'high', 'in_progress'),
  makeWorkOrder('00000000-0000-4000-8000-000000000103', 'WO-0103', 'T-103', 'normal', 'created'),
  makeWorkOrder('00000000-0000-4000-8000-000000000104', 'WO-0104', 'T-104', 'normal', 'completed'),
  makeWorkOrder('00000000-0000-4000-8000-000000000105', 'WO-0105', 'T-105', 'normal', 'cancelled'),
  makeWorkOrder('00000000-0000-4000-8000-000000000106', 'WO-0106', 'T-106', 'high', 'in_progress', { pendingJob: true }),
  makeWorkOrder('00000000-0000-4000-8000-000000000191', 'WO-0009', '9', 'normal', 'in_progress'),
  makeWorkOrder('00000000-0000-4000-8000-000000000192', 'WO-0422', '9644', 'normal', 'in_progress'),
  makeWorkOrder('00000000-0000-4000-8000-000000000193', 'WO-0905', '905', 'normal', 'created'),
  makeWorkOrder('00000000-0000-4000-8000-000000000194', 'WO-0609', '609', 'normal', 'created'),
];

const yardOperations = [
  makeYardItem('00000000-0000-4000-8000-000000001001', 'Y-101', 'needs_evaluation', null, null),
  makeYardItem('00000000-0000-4000-8000-000000001002', 'Y-102', 'inspection', 'high', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001003', 'Y-103', 'required_work', 'critical', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001004', 'Y-104', 'pm', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001005', 'Y-105', 'alignment', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001006', 'Y-106', 'detailing', 'low', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001007', 'Y-107', 'quality_check', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001009', 'Y-109', 'ready_for_approval', null, 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001008', 'Y-108', 'ready_to_go', null, 'ready'),
];

createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const email = request.headers.authorization?.replace(/^Bearer dev:/, '').toLowerCase();
  const user = email ? users[email] : undefined;
  if (!user) {
    json(response, 401, { message: 'Invalid fixture session' });
    return;
  }

  if (request.url === '/api/auth/me') {
    json(response, 200, { user });
    return;
  }
  if (request.url === '/api/admin/access') {
    json(
      response,
      user.capabilities.includes('admin.access') ? 200 : 403,
      user.capabilities.includes('admin.access')
        ? { user }
        : { message: 'You do not have access to Shop Admin.' },
    );
    return;
  }
  if (request.url === '/api/catalog/categories') {
    json(response, 200, [
      { id: '00000000-0000-4000-8000-000000000301', name: 'Brakes', sortOrder: 1 },
      { id: '00000000-0000-4000-8000-000000000302', name: 'Suspension', sortOrder: 2 },
      { id: '00000000-0000-4000-8000-000000000303', name: 'PM', sortOrder: 3 },
    ]);
    return;
  }
  if (request.url?.startsWith('/api/catalog/aliases') || request.url?.startsWith('/api/catalog/jobs')) {
    json(response, 200, [
      {
        aliasText: 'inspect brake chamber',
        catalogJobId: '00000000-0000-4000-8000-000000000801',
        categoryId: '00000000-0000-4000-8000-000000000301',
        displayName: 'Inspect brake chamber',
      },
      {
        aliasText: 'inspect shocks',
        catalogJobId: '00000000-0000-4000-8000-000000000802',
        categoryId: '00000000-0000-4000-8000-000000000302',
        displayName: 'Inspect shocks',
      },
    ]);
    return;
  }
  if (request.url?.startsWith('/api/admin/') && !user.capabilities.includes('admin.access')) {
    json(response, 403, { message: 'You do not have access to Shop Admin.' });
    return;
  }
  const canManageWorkOrders = user.capabilities.includes('work_orders.manage');
  function denyUnlessManage() {
    if (canManageWorkOrders) return false;
    json(response, 403, { message: 'You do not have access to manage Work Orders.' });
    return true;
  }
  if (request.url === '/api/admin/catalog/categories') {
    json(response, 200, [
      {
        id: '00000000-0000-4000-8000-000000000301',
        name: 'Brakes',
        status: 'active',
        sortOrder: 1,
        activeJobCount: 2,
        inactiveJobCount: 1,
        aliasCount: 3,
      },
      {
        id: '00000000-0000-4000-8000-000000000302',
        name: 'Suspension',
        status: 'inactive',
        sortOrder: 2,
        activeJobCount: 0,
        inactiveJobCount: 1,
        aliasCount: 0,
      },
    ]);
    return;
  }
  if (request.url?.startsWith('/api/admin/catalog/categories/')) {
    const id = request.url.slice('/api/admin/catalog/categories/'.length).split('?')[0];
    if (id === '00000000-0000-4000-8000-000000000301') {
      json(response, 200, {
        id,
        name: 'Brakes',
        status: 'active',
        sortOrder: 1,
        activeJobCount: 2,
        inactiveJobCount: 1,
        aliasCount: 3,
        jobs: [
          {
            id: '00000000-0000-4000-8000-000000000801',
            displayName: 'Inspect brake chamber',
            status: 'active',
            aliases: ['Brake chamber', 'Chamber'],
          },
          {
            id: '00000000-0000-4000-8000-000000000802',
            displayName: 'Replace brake pads',
            status: 'active',
            aliases: [],
          },
          {
            id: '00000000-0000-4000-8000-000000000803',
            displayName: 'Retired brake job',
            status: 'inactive',
            aliases: ['Old brakes'],
          },
        ],
      });
      return;
    }
    json(response, 404, { message: 'Category not found' });
    return;
  }
  if (request.url === '/api/admin/dashboard') {
    json(response, 200, {
      generatedAt: '2026-09-06T18:30:00.000Z',
      source: 'supabase_postgres',
      timeZone: 'America/New_York',
      windows: {
        today: { from: '2026-09-06T04:00:00.000Z', to: '2026-09-07T04:00:00.000Z' },
        last7Days: { from: '2026-08-31T04:00:00.000Z', to: '2026-09-07T04:00:00.000Z' },
        openOlderThan24h: { before: '2026-09-05T18:30:00.000Z' },
      },
      counts: { open: 3, waitingPaused: 1, highCriticalOpen: 2, openOlderThan24h: 1, completedToday: 1, completedLast7Days: 1 },
      attention: workOrders.slice(0, 3),
    });
    return;
  }
  if (/^\/api\/admin\/trucks(?:\?|$)/.test(request.url ?? '')) {
    const url = new URL(request.url, 'http://fixture.local');
    const search = url.searchParams.get('search')?.toLowerCase();
    const items = workOrders.map((item) => ({
      truck: item.truck,
      operationalStatus: item.returnedToServiceAt ? 'in_service' : 'unknown',
      operationalStatusAt: item.returnedToServiceAt ?? null,
      openWorkOrder: ['created', 'in_progress', 'waiting_paused'].includes(item.status)
        ? { id: item.id, displayId: item.displayId, status: item.status, primaryCategoryName: item.category.name }
        : null,
    })).filter((item) => {
      if (!search) return true;
      return `${item.truck.truckNumber} ${item.truck.make} ${item.truck.model} ${item.truck.company}`.toLowerCase().includes(search);
    });
    json(response, 200, { items, nextCursor: null });
    return;
  }
  const truckDetailMatch = request.url?.match(/^\/api\/admin\/trucks\/([0-9a-f-]+)$/i);
  if (truckDetailMatch) {
    const item = yardOperations.find((candidate) => candidate.truck.id === truckDetailMatch[1]);
    if (!item) json(response, 404, { message: 'Truck not found' });
    else json(response, 200, { ...item, repairHistory: { items: [], nextCursor: null }, repairHistoryUrl: `/api/admin/trucks/${item.truck.id}/repair-history`, incomingTrucks: { status: 'unavailable', reason: 'integration_not_connected' }, upcomingDepartures: { status: 'unavailable', reason: 'integration_not_connected' } });
    return;
  }
  const startAssessmentMatch = request.url?.match(/^\/api\/admin\/trucks\/([0-9a-f-]+)\/readiness-assessments$/i);
  const requirementMatch = request.url?.match(/^\/api\/admin\/readiness-assessments\/([0-9a-f-]+)\/requirements\/([a-z_]+)$/i);
  const readyMatch = request.url?.match(/^\/api\/admin\/readiness-assessments\/([0-9a-f-]+)\/mark-ready$/i);
  const closeMatch = request.url?.match(/^\/api\/admin\/readiness-assessments\/([0-9a-f-]+)\/close$/i);
  if (startAssessmentMatch || requirementMatch || readyMatch || closeMatch) {
    if (!user.capabilities.includes('yard.operations.manage')) {
      json(response, 403, { message: 'Yard readiness management is not available for this account.' });
      return;
    }
    const body = await readJson(request);
    if (!body?.idempotencyKey) {
      json(response, 400, { message: 'An idempotency key is required.' });
      return;
    }
    if (startAssessmentMatch) {
      const item = yardOperations.find((candidate) => candidate.truck.id === startAssessmentMatch[1]);
      if (!item) { json(response, 404, { message: 'Truck not found' }); return; }
      if (item.assessment) { json(response, 409, { code: 'ACTIVE_READINESS_ASSESSMENT_EXISTS', message: 'Truck already has an active readiness assessment.' }); return; }
      item.assessment = makeAssessment(item);
      item.phase = 'inspection';
      item.blockers = [{ kind: 'unevaluated_requirement', requirementType: 'inspection' }];
      json(response, 200, { assessment: item.assessment, linkedWorkOrderId: item.activeWorkOrder?.id ?? null });
      return;
    }
    const assessmentId = requirementMatch?.[1] ?? readyMatch?.[1] ?? closeMatch?.[1];
    const item = yardOperations.find((candidate) => candidate.assessment?.id === assessmentId);
    if (!item?.assessment) { json(response, 404, { message: 'Readiness assessment not found' }); return; }
    if (requirementMatch) {
      const requirement = item.assessment.requirements.find((candidate) => candidate.type === requirementMatch[2]);
      if (!requirement) { json(response, 404, { message: 'Readiness requirement not found' }); return; }
      if (body.expectedVersion !== requirement.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Readiness requirement version changed.' }); return; }
      if (body.outcome === 'waived' && !body.waiverReason) { json(response, 400, { message: 'A waiver reason is required.' }); return; }
      if (body.outcome === 'completed' && ['pm', 'alignment', 'required_repairs'].includes(requirement.type) && !body.evidenceWorkOrderId) { json(response, 400, { message: 'Completed maintenance requirements need evidence.' }); return; }
      requirement.outcome = body.outcome;
      requirement.waiverReason = body.outcome === 'waived' ? body.waiverReason : null;
      requirement.evidenceWorkOrderId = body.outcome === 'completed' ? (body.evidenceWorkOrderId ?? null) : null;
      requirement.version += 1;
      item.assessment.version += 1;
      json(response, 200, { assessment: item.assessment, requirement });
      return;
    }
    if (body.expectedVersion !== item.assessment.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Readiness assessment version changed.' }); return; }
    if (readyMatch) {
      const unresolved = item.assessment.requirements.some((requirement) => ['not_evaluated', 'required'].includes(requirement.outcome));
      if (unresolved) { json(response, 409, { code: 'READINESS_NOT_READY', message: 'All readiness requirements must be resolved before approval.' }); return; }
      if (item.activeWorkOrder) { json(response, 409, { code: 'OPEN_WORK_ORDER_EXISTS', message: 'An open linked Work Order blocks readiness approval.' }); return; }
      item.assessment.status = 'ready';
      item.assessment.readyAt = '2026-09-06T18:00:00.000Z';
      item.assessment.approvedById = user.id;
      item.assessment.version += 1;
      item.phase = 'ready_to_go';
      item.blockers = [];
      json(response, 200, { assessment: item.assessment });
      return;
    }
    if (!body.reason) { json(response, 400, { message: 'A close reason is required.' }); return; }
    item.assessment.status = 'closed';
    item.assessment.closedAt = '2026-09-06T18:00:00.000Z';
    item.assessment.closedById = user.id;
    item.assessment.closedReason = body.reason;
    item.assessment.version += 1;
    json(response, 200, { assessment: item.assessment });
    return;
  }
  if (request.url?.startsWith('/api/admin/yard-operations')) {
    const url = new URL(request.url, 'http://fixture.local');
    const cursor = url.searchParams.get('cursor');
    const search = url.searchParams.get('search')?.toLowerCase();
    const readiness = url.searchParams.get('readiness')?.split(',');
    const phase = url.searchParams.get('phase')?.split(',');
    const workOrderStatus = url.searchParams.get('workOrderStatus')?.split(',');
    const priority = url.searchParams.get('priority')?.split(',');
    const blocked = url.searchParams.get('blocked');
    let items = yardOperations.filter((item) => {
      if (search && !`${item.truck.truckNumber} ${item.truck.make} ${item.truck.model} ${item.activeWorkOrder?.displayId ?? ''}`.toLowerCase().includes(search)) return false;
      if (readiness?.length && !readiness.includes(item.assessment?.status ?? 'not_started')) return false;
      if (phase?.length && !phase.includes(item.phase)) return false;
      if (workOrderStatus?.length && !workOrderStatus.includes(item.activeWorkOrder?.status ?? '')) return false;
      if (priority?.length && !priority.includes(item.activeWorkOrder?.priority ?? '')) return false;
      if (blocked === 'true' && item.blockers.length === 0) return false;
      if (blocked === 'false' && item.blockers.length > 0) return false;
      return true;
    });
    if (cursor) items = items.slice(4);
    const hasCursor = !cursor && !search && !readiness && !phase && !workOrderStatus && !priority && !blocked;
    json(response, 200, {
      items: hasCursor ? items.slice(0, 4) : items,
      nextCursor: hasCursor ? 'yard-page-2' : null,
      counts: { underReview: 7, readyToGo: 1, blocked: 6, presenceUnknown: 9 },
      incomingTrucks: { status: 'unavailable', reason: 'integration_not_connected' },
      upcomingDepartures: { status: 'unavailable', reason: 'integration_not_connected' },
    });
    return;
  }
  if (request.url === '/api/admin/work-orders' && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const body = await readJson(request);
    if (!body?.truckId || !body?.primaryCategoryId || !body?.jobs?.length) {
      json(response, 400, { message: 'Truck, category, and at least one Job are required.' });
      return;
    }
    const created = makeWorkOrder('00000000-0000-4000-8000-000000000199', 'WO-0199', 'T-199', body.priority ?? 'normal', 'created');
    created.notes = body.notes ?? null;
    created.jobs = body.jobs.map((job, index) => ({
      id: `00000000-0000-4000-8000-0000000008${String(index).padStart(2, '0')}`,
      displayName: job.displayName,
      customDescription: job.customDescription ?? null,
      category: { id: job.categoryId, name: job.categoryId.endsWith('302') ? 'Suspension' : 'Brakes' },
      status: 'to_do',
      assignedMechanic: null,
    }));
    syncJobCounts(created);
    workOrders.unshift(created);
    json(response, 201, created);
    return;
  }
  if (request.url?.startsWith('/api/admin/work-orders?')) {
    const url = new URL(request.url, 'http://fixture.local');
    const cursor = url.searchParams.get('cursor');
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const search = url.searchParams.get('search')?.toLowerCase();
    const createdBefore = url.searchParams.get('createdBefore');
    const completedFrom = url.searchParams.get('completedFrom');
    const completedBefore = url.searchParams.get('completedBefore');
    let items = workOrders.filter((item) => !status || status.split(',').includes(item.status));
    if (priority) items = items.filter((item) => priority.split(',').includes(item.priority));
    if (search) items = items.filter((item) => `${item.displayId} ${item.truck.truckNumber} ${item.category.name} ${item.mechanics.map((mechanic) => mechanic.mechanicName).join(' ')}`.toLowerCase().includes(search));
    if (createdBefore) items = items.filter((item) => new Date(item.createdAt) < new Date(createdBefore));
    if (completedFrom) items = items.filter((item) => item.completedAt && new Date(item.completedAt) >= new Date(completedFrom));
    if (completedBefore) items = items.filter((item) => item.completedAt && new Date(item.completedAt) < new Date(completedBefore));
    const hasFilters = Boolean(status || priority || search || createdBefore || completedFrom || completedBefore);
    if (!hasFilters && !cursor) {
      json(response, 200, { items: items.slice(0, 2), nextCursor: 'fixture-page-2' });
    } else if (cursor) {
      json(response, 200, { items: items.slice(2), nextCursor: null });
    } else {
      json(response, 200, { items, nextCursor: null });
    }
    return;
  }
  if (request.url?.startsWith('/api/admin/mechanics')) {
    const items = Object.values(users)
      .filter((candidate) => candidate.capabilities.includes('mechanic.standard'))
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        role: candidate.role,
        active: candidate.active,
        capabilities: candidate.capabilities,
        openWorkOrderCount: 0,
        currentAssignments: [],
      }));
    json(response, 200, { items, nextCursor: null });
    return;
  }
  if (request.url === '/api/admin/time-corrections' && request.method === 'POST') {
    const body = await readJson(request);
    const summary = workOrders.find((item) => item.id === body?.workOrderId);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (!String(body.reason ?? '').trim()) { json(response, 400, { message: 'A time correction reason is required.' }); return; }
    if (body.expectedVersion !== summary.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    const session = (summary.laborSessions ?? []).find((item) => item.id === body.targetId);
    const pause = (summary.pauseHistory ?? []).find((item) => item.id === body.targetId)
      ?? (summary.currentPause?.id === body.targetId ? summary.currentPause : null);
    if (body.targetType === 'pause_event' && pause?.isOfficialPause === false) {
      json(response, 400, { message: 'Cannot correct a reported blocker' });
      return;
    }
    const segment = body.targetType === 'work_session' ? session : pause;
    if (!segment) { json(response, 404, { message: 'Time segment not found' }); return; }
    if (!segment.endedAt) { json(response, 400, { message: 'Cannot correct an open time segment' }); return; }
    if (body.endedAt) segment.endedAt = body.endedAt;
    if (body.startedAt) segment.startedAt = body.startedAt;
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const cancelJobMatch = request.url?.match(/^\/api\/admin\/jobs\/([0-9a-f-]+)\/cancel$/i);
  if (cancelJobMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const found = findFixtureJob(cancelJobMatch[1]);
    const body = await readJson(request);
    if (!found) { json(response, 404, { message: 'Job not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (!String(body.reason ?? '').trim()) { json(response, 400, { message: 'A job cancellation reason is required.' }); return; }
    if (found.workOrder.category?.name === 'PM') { json(response, 400, { message: 'PM Work Orders do not use jobs' }); return; }
    if (!['created', 'in_progress', 'waiting_paused'].includes(found.workOrder.status)) {
      json(response, 400, { message: 'Cannot change Jobs on a closed Work Order' });
      return;
    }
    if (found.job.status !== 'to_do') { json(response, 400, { message: 'Job is not in To Do status' }); return; }
    if (body.expectedVersion !== found.workOrder.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    found.job.status = 'cancelled';
    found.workOrder.version += 1;
    syncJobCounts(found.workOrder);
    json(response, 200, fixtureWorkOrderDetail(found.workOrder));
    return;
  }
  const reopenJobMatch = request.url?.match(/^\/api\/admin\/jobs\/([0-9a-f-]+)\/reopen$/i);
  if (reopenJobMatch && request.method === 'POST') {
    const found = findFixtureJob(reopenJobMatch[1]);
    const body = await readJson(request);
    if (!found) { json(response, 404, { message: 'Job not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (!String(body.reason ?? '').trim()) { json(response, 400, { message: 'A job reopen reason is required.' }); return; }
    if (found.workOrder.category?.name === 'PM') { json(response, 400, { message: 'PM Work Orders do not use jobs' }); return; }
    if (!['created', 'in_progress', 'waiting_paused'].includes(found.workOrder.status)) {
      json(response, 400, { message: 'Cannot change Jobs on a closed Work Order' });
      return;
    }
    if (found.job.status !== 'cancelled') { json(response, 400, { message: 'Job is not cancelled' }); return; }
    if (body.expectedVersion !== found.workOrder.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    found.job.status = 'to_do';
    found.workOrder.version += 1;
    syncJobCounts(found.workOrder);
    json(response, 200, fixtureWorkOrderDetail(found.workOrder));
    return;
  }
  const reopenMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/reopen$/i);
  if (reopenMatch && request.method === 'POST') {
    const summary = workOrders.find((item) => item.id === reopenMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (!String(body.reason ?? '').trim()) { json(response, 400, { message: 'A reopen reason is required.' }); return; }
    if (!['completed', 'cancelled'].includes(summary.status)) {
      json(response, 400, { message: 'Cannot reopen an open Work Order' });
      return;
    }
    if (workOrders.some((item) => item.id !== summary.id && item.truck.id === summary.truck.id && ['created', 'in_progress', 'waiting_paused'].includes(item.status))) {
      json(response, 400, { message: 'Truck already has an open Work Order.' });
      return;
    }
    if (body.expectedVersion !== summary.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    summary.status = summary.startedAt ? 'in_progress' : 'created';
    summary.completedAt = null;
    summary.currentPause = null;
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const returnToServiceMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/return-to-service$/i);
  if (returnToServiceMatch && request.method === 'POST') {
    const summary = workOrders.find((item) => item.id === returnToServiceMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (!String(body.reason ?? '').trim()) { json(response, 400, { message: 'A Return to Service reason is required.' }); return; }
    if (summary.status !== 'completed') {
      json(response, 400, { message: 'Only a completed Work Order can return a Truck to service' });
      return;
    }
    if (summary.returnedToServiceAt) {
      json(response, 400, { message: 'This Work Order already returned the Truck to service' });
      return;
    }
    if (body.expectedVersion !== summary.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    summary.returnedToServiceAt = '2026-09-10T18:00:00.000Z';
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const completeMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/complete$/i);
  if (completeMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === completeMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (summary.status !== 'in_progress') {
      json(response, 400, { message: 'Work Order must be in progress to finish' });
      return;
    }
    if ((summary.jobsCompleted ?? 0) < (summary.jobsTotal ?? 0)) {
      json(response, 400, { message: 'This Work Order still has incomplete Jobs.' });
      return;
    }
    if (body.expectedVersion !== summary.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    summary.status = 'completed';
    summary.completedAt = '2026-09-06T19:20:00.000Z';
    summary.currentPause = null;
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const cancelMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/cancel$/i);
  if (cancelMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === cancelMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (!String(body.reason ?? '').trim()) { json(response, 400, { message: 'A cancellation reason is required.' }); return; }
    if (!['created', 'in_progress', 'waiting_paused'].includes(summary.status)) {
      json(response, 400, { message: 'Cannot cancel a closed Work Order' });
      return;
    }
    if (body.expectedVersion !== summary.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    summary.status = 'cancelled';
    summary.completedAt = '2026-09-06T19:10:00.000Z';
    summary.currentPause = null;
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const addJobMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/jobs$/i);
  if (addJobMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === addJobMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey || body.expectedVersion === undefined) {
      json(response, 400, { message: 'expectedVersion and idempotencyKey are required.' });
      return;
    }
    if (body.expectedVersion !== summary.version) {
      json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' });
      return;
    }
    if (!['created', 'in_progress', 'waiting_paused'].includes(summary.status)) {
      json(response, 400, { message: 'Cannot add jobs to a closed Work Order' });
      return;
    }
    summary.jobs.push({
      id: `00000000-0000-4000-8000-0000000009${summary.jobs.length}${summary.id.slice(-1)}`,
      displayName: body.displayName ?? 'Added job',
      customDescription: body.customDescription ?? null,
      catalogJobId: body.catalogJobId ?? null,
      category: {
        id: body.categoryId ?? summary.category.id,
        name: body.categoryId?.endsWith('302') ? 'Suspension' : summary.category.name,
      },
      status: 'to_do',
      assignedMechanic: null,
    });
    syncJobCounts(summary);
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const addMechanicMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/mechanics$/i);
  if (addMechanicMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === addMechanicMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (body.expectedVersion !== summary.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    const mechanic = Object.values(users).find((candidate) => candidate.id === body.mechanicId);
    if (!mechanic?.capabilities.includes('mechanic.standard')) {
      json(response, 400, { message: 'One or more selected mechanics cannot perform standard work' });
      return;
    }
    if (summary.mechanics.some((assignment) => assignment.mechanicId === mechanic.id && !assignment.removedAt)) {
      json(response, 409, { code: 'ALREADY_ASSIGNED', message: 'This mechanic is already assigned to the Work Order.' });
      return;
    }
    summary.mechanics.push({ mechanicId: mechanic.id, mechanicName: mechanic.name, addedAt: '2026-09-06T19:00:00.000Z', removedAt: null });
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const removeMechanicMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/mechanics\/([0-9a-f-]+)$/i);
  if (removeMechanicMatch && request.method === 'DELETE') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === removeMechanicMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (body.expectedVersion !== summary.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    const active = summary.mechanics.filter((assignment) => !assignment.removedAt);
    if (active.length <= 1) { json(response, 400, { message: 'A Work Order must keep at least one assigned mechanic' }); return; }
    const assignment = summary.mechanics.find((item) => item.mechanicId === removeMechanicMatch[2] && !item.removedAt);
    if (!assignment) { json(response, 404, { message: 'Mechanic assignment not found' }); return; }
    assignment.removedAt = '2026-09-06T19:05:00.000Z';
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const detailMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)$/i);
  if (detailMatch && request.method === 'PATCH') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === detailMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (body.priority === undefined && body.notes === undefined) {
      json(response, 400, { message: 'At least one of priority or notes is required' });
      return;
    }
    if (!['created', 'in_progress', 'waiting_paused'].includes(summary.status)) {
      json(response, 400, { message: 'Cannot update fields on a closed Work Order' });
      return;
    }
    if (summary.category?.name === 'PM' && body.priority !== undefined && body.priority !== summary.priority) {
      json(response, 400, { message: 'PM Work Order priority cannot be changed' });
      return;
    }
    if (body.expectedVersion !== summary.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    const nextNotes = body.notes === undefined ? undefined : (typeof body.notes === 'string' ? body.notes.trim() || null : body.notes);
    const priorityChanged = body.priority !== undefined && body.priority !== summary.priority;
    const notesChanged = nextNotes !== undefined && nextNotes !== summary.notes;
    if (!priorityChanged && !notesChanged) {
      json(response, 400, { message: 'No allowed fields changed' });
      return;
    }
    if (priorityChanged) summary.priority = body.priority;
    if (notesChanged) summary.notes = nextNotes;
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  if (detailMatch) {
    const summary = workOrders.find((item) => item.id === detailMatch[1]);
    if (!summary) json(response, 404, { message: 'Work Order not found' });
    else json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const historyMatch = request.url?.match(/^\/api\/admin\/trucks\/([0-9a-f-]+)\/repair-history(?:\?(.*))?$/i);
  if (historyMatch) {
    const params = new URLSearchParams(historyMatch[2] ?? '');
    const categoryId = params.get('categoryId');
    const excludeWorkOrderId = params.get('excludeWorkOrderId');
    const truck = workOrders.find((item) => item.truck.id === historyMatch[1])?.truck;
    const historyItems = excludeWorkOrderId === workOrders[3].id ? [] : [{
      workOrderId: workOrders[3].id,
      displayId: workOrders[3].displayId,
      date: workOrders[3].completedAt,
      primaryCategoryName: 'Brakes',
      truckNumber: truck?.truckNumber ?? 'T-101',
      mechanicNames: ['Alejandro 1'],
      mileage: 119500,
      jobs: ['Inspect brake chamber'],
      jobDetails: [{
        id: '00000000-0000-4000-8000-000000000801',
        categoryId: '00000000-0000-4000-8000-000000000301',
        category: { id: '00000000-0000-4000-8000-000000000301', name: 'Brakes' },
        displayName: 'Inspect brake chamber',
        status: 'completed',
      }],
    }];
    json(response, 200, {
      truck: truck ?? { id: historyMatch[1], truckNumber: 'Unknown', make: null, model: null, year: null, mileage: null, company: null, owner: null },
      items: categoryId && categoryId !== '00000000-0000-4000-8000-000000000301' ? [] : historyItems,
      nextCursor: null,
    });
    return;
  }
  const adminPauseMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/pause$/i);
  if (adminPauseMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === adminPauseMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (summary.status !== 'in_progress') { json(response, 400, { message: 'Only in-progress Work Orders can be paused' }); return; }
    const now = '2026-09-11T16:00:00.000Z';
    summary.status = 'waiting_paused';
    summary.currentPause = {
      id: '00000000-0000-4000-8000-000000000411',
      workOrderId: summary.id,
      reason: body?.reason ?? 'waiting_for_parts',
      notes: body?.notes ?? null,
      startedAt: now,
      endedAt: null,
      durationMs: null,
      isOfficialPause: true,
      reportedBy: null,
    };
    summary.pauseHistory = [
      { ...summary.currentPause, createdBy: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name } },
      ...(summary.pauseHistory ?? []),
    ];
    summary.version += 1;
    summary.activityLog = [
      {
        id: '00000000-0000-4000-8000-000000000612',
        eventType: 'work_paused',
        entityType: 'work_order',
        entityId: summary.id,
        user: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name },
        previousValue: null,
        newValue: { reason: summary.currentPause.reason },
        relevantValue: null,
        createdAt: now,
      },
      ...(summary.activityLog ?? []),
    ];
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const adminResumeMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/resume$/i);
  if (adminResumeMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === adminResumeMatch[1]);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (summary.status !== 'waiting_paused') { json(response, 400, { message: 'Only paused Work Orders can be resumed' }); return; }
    const now = '2026-09-11T16:30:00.000Z';
    if (summary.currentPause) {
      const closed = { ...summary.currentPause, endedAt: now, durationMs: 1_800_000 };
      summary.pauseHistory = (summary.pauseHistory ?? []).map((pause) => (
        pause.id === closed.id ? { ...pause, ...closed } : pause
      ));
    }
    summary.status = 'in_progress';
    summary.currentPause = null;
    summary.version += 1;
    summary.activityLog = [
      {
        id: '00000000-0000-4000-8000-000000000613',
        eventType: 'work_resumed',
        entityType: 'work_order',
        entityId: summary.id,
        user: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name },
        previousValue: null,
        newValue: { status: 'in_progress' },
        relevantValue: null,
        createdAt: now,
      },
      ...(summary.activityLog ?? []),
    ];
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const blockerMatch = request.url?.match(/^\/api\/work-orders\/([0-9a-f-]+)\/blockers$/i);
  if (blockerMatch && request.method === 'POST') {
    if (!user.capabilities.includes('mechanic.standard')) {
      json(response, 403, { message: 'standard mechanic required' });
      return;
    }
    const summary = workOrders.find((item) => item.id === blockerMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    if (!['created', 'in_progress', 'waiting_paused'].includes(summary.status)) {
      json(response, 400, { message: 'Cannot report a blocker on a closed Work Order' });
      return;
    }
    const now = '2026-09-11T15:00:00.000Z';
    const report = {
      id: '00000000-0000-4000-8000-000000000902',
      workOrderId: summary.id,
      reason: body?.reason ?? 'waiting_for_parts',
      notes: body?.notes ?? null,
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      isOfficialPause: false,
      reportedBy: { id: user.id, name: user.name },
      createdBy: { id: user.id, name: user.name },
    };
    summary.latestReportedBlocker = report;
    summary.reportedBlockers = [report, ...(summary.reportedBlockers ?? [])];
    summary.version += 1;
    summary.activityLog = [
      {
        id: '00000000-0000-4000-8000-000000000611',
        eventType: 'blocker_reported',
        entityType: 'work_order',
        entityId: summary.id,
        user: { id: user.id, name: user.name },
        previousValue: null,
        newValue: { reason: report.reason, notes: report.notes },
        relevantValue: null,
        createdAt: now,
      },
      ...(summary.activityLog ?? []),
    ];
    json(response, 200, fixtureMechanicWorkOrderDetail(summary));
    return;
  }
  const mechanicPlanningMatch = request.url?.match(/^\/api\/work-orders(?:\/([0-9a-f-]+)\/(pause|pause-reason|resume|complete|jobs))?$/i);
  if (request.method === 'POST' && mechanicPlanningMatch && (request.url === '/api/work-orders' || mechanicPlanningMatch[2])) {
    json(response, 403, { message: 'Standard planning is Manager-owned.' });
    return;
  }
  const mechanicDetailMatch = request.url?.match(/^\/api\/work-orders\/([0-9a-f-]+)$/i);
  if (mechanicDetailMatch && request.method === 'GET') {
    const summary = workOrders.find((item) => item.id === mechanicDetailMatch[1]);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    json(response, 200, fixtureMechanicWorkOrderDetail(summary));
    return;
  }
  if (request.url?.startsWith('/api/work-orders')) {
    const active = workOrders
      .filter((item) => item.status === 'in_progress' && item.displayId === 'WO-0106')
      .map(toMechanicSummary);
    json(response, 200, { created: [], active, paused: [], completed: [] });
    return;
  }

  json(response, 404, { message: 'Fixture route not found' });
}).listen(3101, '127.0.0.1');

function fixtureWorkOrderDetail(summary) {
  return {
    ...summary,
    truck: { ...summary.truck, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport' },
    notes: summary.notes ?? null,
    createdBy: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name },
    completedBy: null,
    totalActiveLaborMs: 5400000,
    totalWaitingMs: 1800000,
    jobs: summary.jobs,
    laborSessions: summary.laborSessions ?? [],
    latestReportedBlocker: summary.latestReportedBlocker ?? null,
    pauseHistory: summary.pauseHistory ?? (summary.currentPause ? [{ ...summary.currentPause, createdBy: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name } }] : []),
    reportedBlockers: summary.reportedBlockers ?? [],
    activityLog: summary.activityLog ?? [{ id: '00000000-0000-4000-8000-000000000601', eventType: 'work_order_created', entityType: 'work_order', entityId: summary.id, user: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name }, previousValue: null, newValue: null, relevantValue: { displayId: summary.displayId }, createdAt: summary.createdAt }],
    returnedToServiceAt: summary.returnedToServiceAt ?? null,
  };
}

function fixtureMechanicWorkOrderDetail(summary) {
  return {
    ...toMechanicSummary(summary),
    notes: summary.notes ?? null,
    createdById: users['mechanic@lightning.local'].id,
    completedAt: summary.completedAt,
    totalActiveLaborMs: 5_400_000,
    totalWaitingMs: summary.totalWaitingMs ?? 1_800_000,
    version: summary.version,
    truck: { ...summary.truck, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport' },
    jobs: (summary.jobs ?? []).map((job) => ({
      id: job.id,
      workOrderId: summary.id,
      catalogJobId: job.catalogJobId ?? null,
      categoryId: job.category.id,
      category: job.category,
      displayName: job.displayName,
      customDescription: job.customDescription ?? null,
      status: job.status,
      completedAt: null,
      completedById: null,
      assignedMechanic: job.assignedMechanic ?? null,
    })),
    currentPause: summary.currentPause,
  };
}

function toMechanicSummary(summary) {
  return {
    id: summary.id,
    displayId: summary.displayId,
    truckId: summary.truck.id,
    truckNumber: summary.truck.truckNumber,
    primaryCategoryId: summary.category.id,
    primaryCategoryName: summary.category.name,
    status: summary.status,
    priority: summary.priority,
    jobsCompleted: summary.jobsCompleted,
    jobsTotal: summary.jobsTotal,
    jobs: (summary.jobs ?? []).map((job) => ({
      id: job.id,
      categoryId: job.category.id,
      category: job.category,
      displayName: job.displayName,
      status: job.status,
      assignedMechanic: job.assignedMechanic ?? null,
    })),
    mechanics: summary.mechanics,
    currentPauseReason: summary.currentPause?.reason ?? null,
    createdAt: summary.createdAt,
    startedAt: summary.startedAt,
  };
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve) => {
    let text = '';
    request.on('data', (chunk) => { text += chunk; });
    request.on('end', () => {
      try { resolve(text ? JSON.parse(text) : null); } catch { resolve(null); }
    });
  });
}

function makeWorkOrder(id, displayId, truckNumber, priority, status, options = {}) {
  const paused = status === 'waiting_paused';
  const pendingJob = options.pendingJob === true;
  const createdAt = displayId === 'WO-0101' ? '2026-09-04T15:00:00.000Z' : '2026-09-06T15:00:00.000Z';
  const completedAt = status === 'completed' ? '2026-09-06T18:00:00.000Z' : null;
  return {
    id, displayId,
    truck: { id: `00000000-0000-4000-8001-${id.slice(-12)}`, truckNumber, make: 'Volvo', model: 'VNL', year: 2024, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport' },
    category: { id: '00000000-0000-4000-8000-000000000301', name: 'Brakes' },
    status, priority, jobsCompleted: pendingJob ? 0 : (status === 'in_progress' || status === 'completed' ? 1 : 0), jobsTotal: 1,
    mechanics: status === 'created' ? [] : [{ mechanicId: users['mechanic@lightning.local'].id, mechanicName: users['mechanic@lightning.local'].name, addedAt: '2026-09-06T16:00:00.000Z', removedAt: null }],
    currentPause: paused ? { id: '00000000-0000-4000-8000-000000000401', workOrderId: id, reason: 'waiting_for_parts', notes: 'Air line ordered', startedAt: '2026-09-06T17:00:00.000Z', endedAt: null, durationMs: null, isOfficialPause: true, reportedBy: null } : null,
    latestReportedBlocker: null,
    reportedBlockers: [],
    pauseHistory: [],
    activityLog: [],
    totalWaitingMs: 1_800_000,
    createdAt, startedAt: status === 'created' ? null : '2026-09-06T16:00:00.000Z', completedAt, updatedAt: '2026-09-06T18:00:00.000Z',
    version: 1,
    notes: 'Inspect brake chamber before release.',
    laborSessions: status === 'created' ? [] : [{
      id: `00000000-0000-4000-8000-0000000007${id.slice(-2)}`,
      startedAt: '2026-09-06T16:00:00.000Z',
      endedAt: '2026-09-06T17:30:00.000Z',
      durationMs: 5_400_000,
    }],
    jobs: [{
      id: `00000000-0000-4000-8000-0000000005${id.slice(-2)}`,
      catalogJobId: '00000000-0000-4000-8000-000000000801',
      displayName: 'Inspect brake chamber',
      customDescription: null,
      category: { id: '00000000-0000-4000-8000-000000000301', name: 'Brakes' },
      status: pendingJob ? 'to_do' : (status === 'in_progress' || status === 'completed' ? 'completed' : 'to_do'),
      assignedMechanic: null,
    }],
    returnedToServiceAt: null,
  };
}

function findFixtureJob(jobId) {
  for (const workOrder of workOrders) {
    const job = workOrder.jobs?.find((item) => item.id === jobId);
    if (job) return { workOrder, job };
  }
  return null;
}

function syncJobCounts(workOrder) {
  const active = (workOrder.jobs ?? []).filter((job) => job.status !== 'cancelled');
  workOrder.jobsTotal = active.length;
  workOrder.jobsCompleted = active.filter((job) => job.status === 'completed').length;
}

function makeYardItem(truckId, truckNumber, phase, priority, assessmentStatus) {
  const hasWorkOrder = Boolean(priority);
  const workOrderId = truckId.replace('100', '200');
  const activeWorkOrder = hasWorkOrder ? makeWorkOrder(workOrderId, `WO-${truckNumber.slice(2)}`, truckNumber, priority, phase === 'required_work' ? 'in_progress' : 'created') : null;
  if (activeWorkOrder) activeWorkOrder.truck.id = truckId;
  const now = '2026-09-06T18:00:00.000Z';
  const requirementType = phase === 'inspection' ? 'inspection' : phase === 'required_work' ? 'required_repairs' : phase === 'pm' ? 'pm' : phase === 'alignment' ? 'alignment' : phase === 'detailing' ? 'detailing' : phase === 'quality_check' ? 'quality_check' : null;
  const assessment = assessmentStatus ? { id: truckId.replace('100', '300'), truckId, status: assessmentStatus, version: 1, startedAt: '2026-09-06T12:00:00.000Z', startedById: users['manager@lightning.local'].id, readyAt: assessmentStatus === 'ready' ? now : null, approvedById: assessmentStatus === 'ready' ? users['manager@lightning.local'].id : null, closedAt: null, closedById: null, closedReason: null, requirements: requirementType ? [{ id: truckId.replace('100', '400'), type: requirementType, outcome: 'required', waiverReason: null, evidenceWorkOrderId: null, evaluatedById: null, evaluatedAt: null, version: 1 }] : [] } : null;
  const blockers = phase === 'ready_to_go' || !assessment ? [] : [{ kind: activeWorkOrder ? 'open_work_order' : 'unevaluated_requirement', requirementType, workOrderId: activeWorkOrder?.id, status: activeWorkOrder?.status, priority: activeWorkOrder?.priority, categoryName: activeWorkOrder?.category.name, message: activeWorkOrder ? 'Open Work Order remains linked.' : 'Assessment requires evaluation.' }];
  return { truck: { id: truckId, truckNumber, make: 'Volvo', model: 'VNL', year: 2024, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport', vin: '4V4NC9EH0RN123456', location: '4802 Orient Road, Tampa, FL', locationUpdatedOn: '2026-09-11' }, presence: { state: 'unknown', provenance: 'phase_1_unavailable' }, operationalStatus: 'unknown', operationalStatusAt: null, assessment, phase, blockers, activeWorkOrder };
}

function makeAssessment(item) {
  const requirements = ['inspection', 'required_repairs', 'pm', 'alignment', 'detailing', 'quality_check'].map((type, index) => ({ id: `${item.truck.id.slice(0, -3)}${String(500 + index).padStart(3, '0')}`, type, outcome: 'not_evaluated', waiverReason: null, evidenceWorkOrderId: null, evaluatedById: null, evaluatedAt: null, version: 1 }));
  return { id: `${item.truck.id.slice(0, -3)}600`, truckId: item.truck.id, status: 'under_review', version: 1, startedAt: '2026-09-06T12:00:00.000Z', startedById: users['manager@lightning.local'].id, readyAt: null, approvedById: null, closedAt: null, closedById: null, closedReason: null, requirements };
}
