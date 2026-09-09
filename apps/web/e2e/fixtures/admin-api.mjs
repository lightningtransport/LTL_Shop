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
  'manager@lightning.local': {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'manager@lightning.local',
    name: 'Shop Manager',
    role: 'manager',
    active: true,
    pmAuthorized: false,
    capabilities: ['admin.access'],
  },
  'admin@lightning.local': {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'admin@lightning.local',
    name: 'Shop Administrator',
    role: 'admin',
    active: true,
    pmAuthorized: false,
    capabilities: ['admin.access'],
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
];

const yardOperations = [
  makeYardItem('00000000-0000-4000-8000-000000001001', 'Y-101', 'needs_evaluation', null, null),
  makeYardItem('00000000-0000-4000-8000-000000001002', 'Y-102', 'inspection', 'high', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001003', 'Y-103', 'required_work', 'critical', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001004', 'Y-104', 'pm', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001005', 'Y-105', 'alignment', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001006', 'Y-106', 'detailing', 'low', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001007', 'Y-107', 'quality_check', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001008', 'Y-108', 'ready_to_go', null, 'ready'),
];

createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
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
  if (request.url?.startsWith('/api/admin/') && !user.capabilities.includes('admin.access')) {
    json(response, 403, { message: 'You do not have access to Shop Admin.' });
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
      counts: { underReview: 6, readyToGo: 1, blocked: 6, presenceUnknown: 8 },
      incomingTrucks: { status: 'unavailable', reason: 'integration_not_connected' },
      upcomingDepartures: { status: 'unavailable', reason: 'integration_not_connected' },
    });
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
  const detailMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)$/i);
  if (detailMatch) {
    const summary = workOrders.find((item) => item.id === detailMatch[1]);
    if (!summary) json(response, 404, { message: 'Work Order not found' });
    else json(response, 200, {
      ...summary,
      truck: { ...summary.truck, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport' },
      notes: 'Inspect brake chamber before release.',
      createdBy: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name },
      completedBy: null,
      totalActiveLaborMs: 5400000,
      totalWaitingMs: 1800000,
      jobs: [{ id: '00000000-0000-4000-8000-000000000501', displayName: 'Inspect brake chamber', customDescription: null, category: summary.category, status: 'to_do' }],
      pauseHistory: summary.currentPause ? [{ ...summary.currentPause, createdBy: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name } }] : [],
      activityLog: [{ id: '00000000-0000-4000-8000-000000000601', eventType: 'work_order_created', entityType: 'work_order', entityId: summary.id, user: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name }, previousValue: null, newValue: null, relevantValue: { displayId: summary.displayId }, createdAt: summary.createdAt }],
    });
    return;
  }
  const historyMatch = request.url?.match(/^\/api\/admin\/trucks\/([0-9a-f-]+)\/repair-history(?:\?(.*))?$/i);
  if (historyMatch) {
    const params = new URLSearchParams(historyMatch[2] ?? '');
    const categoryId = params.get('categoryId');
    const excludeWorkOrderId = params.get('excludeWorkOrderId');
    const truck = workOrders.find((item) => item.truck.id === historyMatch[1])?.truck;
    const historyItems = excludeWorkOrderId === workOrders[3].id ? [] : [{ workOrderId: workOrders[3].id, displayId: workOrders[3].displayId, date: workOrders[3].completedAt, primaryCategoryName: 'Brakes', truckNumber: truck?.truckNumber ?? 'T-101', mechanicNames: ['Alejandro 1'], mileage: 119500, jobs: ['Inspect brake chamber'] }];
    json(response, 200, {
      truck: truck ?? { id: historyMatch[1], truckNumber: 'Unknown', make: null, model: null, year: null, mileage: null, company: null, owner: null },
      items: categoryId && categoryId !== '00000000-0000-4000-8000-000000000301' ? [] : historyItems,
      nextCursor: null,
    });
    return;
  }
  if (request.url?.startsWith('/api/work-orders')) {
    json(response, 200, { created: [], active: [], paused: [], completed: [] });
    return;
  }

  json(response, 404, { message: 'Fixture route not found' });
}).listen(3101, '127.0.0.1');

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function makeWorkOrder(id, displayId, truckNumber, priority, status) {
  const paused = status === 'waiting_paused';
  const createdAt = displayId === 'WO-0101' ? '2026-09-04T15:00:00.000Z' : '2026-09-06T15:00:00.000Z';
  const completedAt = status === 'completed' ? '2026-09-06T18:00:00.000Z' : null;
  return {
    id, displayId,
    truck: { id: `00000000-0000-4000-8001-${id.slice(-12)}`, truckNumber, make: 'Volvo', model: 'VNL', year: 2024, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport' },
    category: { id: '00000000-0000-4000-8000-000000000301', name: 'Brakes' },
    status, priority, jobsCompleted: 0, jobsTotal: 1,
    mechanics: status === 'created' ? [] : [{ mechanicId: users['mechanic@lightning.local'].id, mechanicName: users['mechanic@lightning.local'].name, addedAt: '2026-09-06T16:00:00.000Z', removedAt: null }],
    currentPause: paused ? { id: '00000000-0000-4000-8000-000000000401', workOrderId: id, reason: 'waiting_for_parts', notes: 'Air line ordered', startedAt: '2026-09-06T17:00:00.000Z', endedAt: null, durationMs: null } : null,
    createdAt, startedAt: status === 'created' ? null : '2026-09-06T16:00:00.000Z', completedAt, updatedAt: '2026-09-06T18:00:00.000Z',
  };
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
  return { truck: { id: truckId, truckNumber, make: 'Volvo', model: 'VNL', year: 2024, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport' }, presence: { state: 'unknown', provenance: 'phase_1_unavailable' }, assessment, phase, blockers, activeWorkOrder };
}
