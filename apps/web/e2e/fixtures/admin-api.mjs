import { createServer } from 'node:http';

const users = {
  'mechanic@lightning.local': {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'mechanic@lightning.local',
    name: 'Alejandro 1',
    role: 'mechanic',
    active: true,
    capabilities: ['mechanic.standard'],
  },
  'anthony@lightning.local': {
    id: '00000000-0000-4000-8000-000000000006',
    email: 'anthony@lightning.local',
    name: 'Anthony',
    role: 'mechanic',
    active: true,
    capabilities: ['mechanic.standard'],
  },
  'manager@lightning.local': {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'manager@lightning.local',
    name: 'Shop Manager',
    role: 'manager',
    active: true,
    capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'],
  },
  'admin@lightning.local': {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'admin@lightning.local',
    name: 'Shop Administrator',
    role: 'admin',
    active: true,
    capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'],
  },
  'system-admin@lightning.local': {
    id: '00000000-0000-4000-8000-000000000008',
    email: 'system-admin@lightning.local',
    name: 'System Admin',
    role: 'admin',
    active: true,
    capabilities: ['admin.access'],
  },
  'ibrain@ltransl.com': {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'ibrain@ltransl.com',
    name: 'iBrain Admin',
    role: 'admin',
    active: true,
    capabilities: ['admin.access', 'mechanic.standard', 'mechanic.pm'],
  },
  'cristian240588@hotmail.com': {
    id: '00000000-0000-4000-8000-000000000005',
    email: 'cristian240588@hotmail.com',
    name: 'Cristian Perez',
    role: 'admin',
    active: true,
    capabilities: ['admin.access', 'mechanic.standard', 'mechanic.pm'],
  },
  'daniel@lightning.local': {
    id: '00000000-0000-4000-8000-000000000009',
    email: 'daniel@lightning.local',
    name: 'Daniel PM',
    role: 'mechanic',
    active: true,
    capabilities: ['mechanic.pm'],
  },
  // D36: the demo roster (packages/shared/src/demo-roster.ts); the person accounts above stay for the other specs.
  'ms@lightning.local': { id: '00000000-0000-4000-8000-000000000101', email: 'ms@lightning.local', name: 'MS · Manager Shop', role: 'manager', active: true, capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'] },
  'as@lightning.local': { id: '00000000-0000-4000-8000-000000000102', email: 'as@lightning.local', name: 'AS · Admin Shop', role: 'admin', active: true, capabilities: ['admin.access', 'yard.operations.manage', 'work_orders.manage'] },
  'mg1@lightning.local': { id: '00000000-0000-4000-8000-000000000103', email: 'mg1@lightning.local', name: 'MG1 · Mecánico General', role: 'mechanic', active: true, capabilities: ['mechanic.standard'] },
  'mpm@lightning.local': { id: '00000000-0000-4000-8000-000000000104', email: 'mpm@lightning.local', name: 'MPM · Mecánico PM', role: 'mechanic', active: true, capabilities: ['mechanic.pm'] },
  'retired@lightning.local': {
    id: '00000000-0000-4000-8000-000000000007',
    email: 'retired@lightning.local',
    name: 'Retired Mechanic',
    role: 'mechanic',
    active: false,
    capabilities: ['mechanic.standard'],
  },
};

const adminCatalog = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    name: 'Brakes',
    status: 'active',
    sortOrder: 1,
    jobs: [
      { id: '00000000-0000-4000-8000-000000000801', displayName: 'Inspect brake chamber', status: 'active', aliases: ['Brake chamber', 'Chamber'] },
      { id: '00000000-0000-4000-8000-000000000802', displayName: 'Replace brake pads', status: 'active', aliases: [] },
      { id: '00000000-0000-4000-8000-000000000803', displayName: 'Retired brake job', status: 'inactive', aliases: ['Old brakes'] },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    name: 'Suspension',
    status: 'inactive',
    sortOrder: 2,
    jobs: [
      { id: '00000000-0000-4000-8000-000000000804', displayName: 'Retired suspension job', status: 'inactive', aliases: [] },
    ],
  },
];

// LTR-157 / D15, D16: Setup → Shop workflow. LTR-197 / D28: each step has a team (`memberIds`).
const workflowSteps = [
  { stepKey: 'pm', sortOrder: 10, catalogJob: { id: '00000000-0000-4000-8000-000000000851', displayName: 'PM A Service', categoryId: '00000000-0000-4000-8000-000000000303', categoryName: 'PM' }, memberIds: [], requiredCapability: 'mechanic.pm' },
  { stepKey: 'alignment', sortOrder: 20, catalogJob: { id: '00000000-0000-4000-8000-000000000852', displayName: 'Alignment', categoryId: '00000000-0000-4000-8000-000000000302', categoryName: 'Suspension' }, memberIds: [], requiredCapability: 'mechanic.standard' },
  { stepKey: 'detailing', sortOrder: 30, catalogJob: { id: '00000000-0000-4000-8000-000000000853', displayName: 'Detailing', categoryId: '00000000-0000-4000-8000-000000000304', categoryName: 'Detailing' }, memberIds: [], requiredCapability: 'mechanic.standard' },
  { stepKey: 'quality_check', sortOrder: 40, catalogJob: { id: '00000000-0000-4000-8000-000000000854', displayName: 'Quality Check', categoryId: '00000000-0000-4000-8000-000000000305', categoryName: 'Quality Check' }, memberIds: [], requiredCapability: 'quality_check.perform' },
];

// LTR-158: a reduced copy of deriveTruckNextStep (the API uses the shared rule).
function fixtureNextStep(item, workPlan) {
  const wo = item.activeWorkOrder;
  if (!wo) return { kind: 'create_work_order' };
  if (wo.latestReportedBlocker) return { kind: 'resolve_blocker', workOrderId: wo.id, blockerId: wo.latestReportedBlocker.id };
  if (wo.status === 'waiting_paused') return { kind: 'resume', workOrderId: wo.id, reason: wo.currentPause?.reason };
  if (workPlan?.inspection?.outcome === 'not_started') return { kind: 'inspect', workOrderId: wo.id };
  const pending = (workPlan?.jobs ?? []).filter((job) => job.status === 'to_do');
  if (!pending.length) return { kind: 'close', workOrderId: wo.id };
  return { kind: 'work', workOrderId: wo.id, jobId: pending[0].id, jobName: pending[0].displayName, remaining: pending.length };
}

function userById(id) {
  return Object.values(users).find((item) => item.id === id) ?? null;
}

function isTeamEligible(step, person) {
  return Boolean(person?.active && step.requiredCapability && person.capabilities.includes(step.requiredCapability));
}

/** D28: the one eligible member owns new Jobs; two or more (or QC) share a queue; none leaves them unassigned. */
function teamOwner(step) {
  const eligible = step.memberIds.map(userById).filter((person) => isTeamEligible(step, person));
  if (!eligible.length) return { mode: 'none', owner: null };
  if (step.stepKey === 'quality_check' || eligible.length > 1) return { mode: 'queue', owner: null };
  return { mode: 'direct', owner: eligible[0] };
}

function workflowStepDto(step) {
  const members = step.memberIds.map(userById).filter(Boolean).map((person) => ({
    id: person.id, name: person.name, active: person.active, eligible: isTeamEligible(step, person), pendingJobCount: 0,
  }));
  return {
    stepKey: step.stepKey,
    sortOrder: step.sortOrder,
    active: true,
    catalogJob: { id: step.catalogJob.id, displayName: step.catalogJob.displayName, categoryName: step.catalogJob.categoryName, active: step.catalogJob.active !== false },
    defaultMechanic: members.length === 1 ? { id: members[0].id, name: members[0].name, active: members[0].active, eligible: members[0].eligible } : null,
    members,
    assignment: teamOwner(step).mode,
    allowsDefaultMechanic: step.stepKey !== 'quality_check',
    requiredCapability: step.requiredCapability,
    updatedAt: '2026-09-28T12:00:00.000Z',
    updatedBy: null,
  };
}

// LTR-186 / D20: Setup → Shop hours (day close).
const shopHours = { cutoff: '17:00', workdays: [1, 2, 3, 4, 5], timeZone: 'America/New_York', updatedAt: '2026-09-01T12:00:00.000Z', updatedBy: null };
let catalogWriteSeq = 900;
// Work Plan picker list (`/api/catalog/jobs`). D25: Jobs the Manager adds to the catalog join it.
const catalogJobs = [
  {
    id: '00000000-0000-4000-8000-000000000801',
    categoryId: '00000000-0000-4000-8000-000000000301',
    displayName: 'Inspect brake chamber',
    aliases: ['inspect brake chamber', 'Brake chamber'],
  },
  {
    id: '00000000-0000-4000-8000-000000000803',
    categoryId: '00000000-0000-4000-8000-000000000301',
    displayName: 'Brake Inspection',
    aliases: ['brake inspect'],
  },
  {
    id: '00000000-0000-4000-8000-000000000802',
    categoryId: '00000000-0000-4000-8000-000000000302',
    displayName: 'Inspect shocks',
    aliases: ['inspect shocks'],
  },
  {
    id: '00000000-0000-4000-8000-000000000804',
    categoryId: '00000000-0000-4000-8000-000000000302',
    displayName: 'Suspension Inspection',
    aliases: ['suspension inspect'],
  },
  {
    id: '00000000-0000-4000-8000-000000000805',
    categoryId: '00000000-0000-4000-8000-000000000302',
    displayName: '3 in 1',
    aliases: ['3in1', '3-in-1'],
  },
  {
    id: '00000000-0000-4000-8000-000000000806',
    categoryId: '00000000-0000-4000-8000-000000000302',
    displayName: 'Alignment',
    aliases: ['alignment'],
  },
];
let createdCatalogJobs = [];
let rosterWriteSeq = 20;

function fixtureUuid(seq) {
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

function catalogSummary(category) {
  return {
    id: category.id,
    name: category.name,
    status: category.status,
    sortOrder: category.sortOrder,
    activeJobCount: category.jobs.filter((job) => job.status === 'active').length,
    inactiveJobCount: category.jobs.filter((job) => job.status !== 'active').length,
    aliasCount: category.jobs.reduce((count, job) => count + job.aliases.length, 0),
    systemKey: category.systemKey ?? null,
    inactiveReason: category.inactiveReason ?? null,
    holdsSystemJob: false,
  };
}

// LTR-198 / D30: the detail carries alias ids, "Used by" and how many Work Orders use each Job.
function catalogDetail(category) {
  return {
    ...catalogSummary(category),
    jobs: category.jobs.map((job) => ({
      ...job,
      systemKey: null,
      aliasItems: job.aliases.map((text, index) => ({ id: fixtureUuid(5000 + index + Number(job.id.slice(-3))), text })),
      workOrderCount: 0,
      usedByStep: null,
    })),
  };
}

function foldCatalogText(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function rosterSummary(candidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    role: candidate.role,
    active: candidate.active,
    capabilities: candidate.capabilities,
    openWorkOrderCount: 0,
    currentAssignments: [],
  };
}

function rosterDetail(candidate) {
  const defaultOwnerOfSteps = workflowSteps
    .filter((step) => step.memberIds.includes(candidate.id))
    .map((step) => ({ stepKey: step.stepKey, jobDisplayName: step.catalogJob.displayName }));
  return { ...rosterSummary(candidate), completedJobCount: 0, recentClosedWorkOrders: [], pendingJobs: [], runningSession: false, defaultOwnerOfSteps };
}

const ROSTER_CAPABILITIES = ['mechanic.standard', 'mechanic.pm', 'quality_check.perform'];

function modeToCapability(mode) {
  if (mode === 'standard') return 'mechanic.standard';
  if (mode === 'pm') return 'mechanic.pm';
  // D22: Safety is created from the roster like the others.
  if (mode === 'safety') return 'quality_check.perform';
  return null;
}

function applyRosterMode(candidate, mode) {
  const capability = modeToCapability(mode);
  if (!capability) return false;
  candidate.capabilities = [
    ...candidate.capabilities.filter((cap) => !ROSTER_CAPABILITIES.includes(cap)),
    capability,
  ];
  return true;
}

/** D22: Alejandro 1 has a pending Job and his clock running on WO-0102, so deactivating him is refused. */
function rosterOpenWork(candidate) {
  if (candidate.email !== 'mechanic@lightning.local') return null;
  return {
    code: 'MECHANIC_HAS_OPEN_WORK',
    message: "Reassign this person's pending Jobs and stop their labor time before deactivating.",
    pendingJobs: [
      { workOrderId: '00000000-0000-4000-8000-000000000102', workOrderDisplayId: 'WO-0102', truckNumber: 'T-102', jobDisplayName: 'Brake pads' },
    ],
    runningSession: true,
  };
}

/** Same shape as the API: 14 readable characters, letters and digits, no 0/O/1/l/I. Deterministic per call. */
function fixtureTemporaryPassword(seq) {
  const base = 'TempKMNP2345abcdefghjk';
  const start = seq % 5;
  return base.slice(start, start + 14);
}

function rosterUserDto(candidate) {
  return {
    id: candidate.id,
    email: candidate.email,
    name: candidate.name,
    role: candidate.role,
    active: candidate.active,
    capabilities: candidate.capabilities,
  };
}

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
  makeYardItem('00000000-0000-4000-8000-000000001001', 'Y-101', 'inspection', null, null),
  makeYardItem('00000000-0000-4000-8000-000000001002', 'Y-102', 'inspection', 'high', 'under_review', { make: 'PETERBILT', model: 'PETERBILT 579' }),
  makeYardItem('00000000-0000-4000-8000-000000001003', 'Y-103', 'shop_work', 'critical', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001004', 'Y-104', 'pm', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001005', 'Y-105', 'alignment', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001006', 'Y-106', 'detailing', 'low', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001007', 'Y-107', 'quality_check', 'normal', 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001009', 'Y-109', 'ready_to_close', null, 'under_review'),
  makeYardItem('00000000-0000-4000-8000-000000001008', 'Y-108', 'ready_to_go', null, 'ready'),
];

const workPlanByTruck = new Map();

function fixtureRepairHistory(truckId) {
  const completed = workOrders.filter((item) => item.truck.id === truckId && item.status === 'completed');
  const rows = completed.length ? completed : [{ id: '00000000-0000-4000-8000-000000000190', displayId: 'WO-0090', truck: { truckNumber: '' }, category: { name: 'Brakes' }, completedAt: '2026-08-20T15:00:00.000Z', jobs: [], mechanics: [] }];
  return rows.map((item) => ({
    workOrderId: item.id,
    displayId: item.displayId,
    date: item.completedAt,
    primaryCategoryName: item.category.name,
    truckNumber: item.truck.truckNumber,
    mechanicNames: (item.mechanics ?? []).map((mechanic) => mechanic.mechanicName),
    mileage: 118_500,
    jobs: (item.jobs ?? []).map((job) => job.displayName),
    jobDetails: (item.jobs ?? []).map((job) => ({ id: job.id, categoryId: job.category.id, category: job.category, displayName: job.displayName, status: job.status })),
  }));
}

function emptyFixtureWorkPlan() {
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
    pmPhaseEnabled: true,
    capabilities: { canRead: true, canAddWork: false, canRecordInspection: false },
    phase1: { assessmentId: null, gatesRemainDefault: true },
  };
}

function fixtureWorkPlan(item, currentUser) {
  const current = workPlanByTruck.get(item.truck.id) ?? emptyFixtureWorkPlan();
  current.capabilities = {
    canRead: true,
    canAddWork: currentUser.capabilities.includes('work_orders.manage'),
    canRecordInspection: currentUser.capabilities.includes('yard.operations.manage'),
  };
  current.phase1 = { assessmentId: item.assessment?.id ?? null, gatesRemainDefault: true };
  workPlanByTruck.set(item.truck.id, current);
  return current;
}

// LTR-162: every test starts from the same data. Specs call POST /__test/reset (see e2e/support/test.ts);
// without it one test's cancel/create/assign leaked into the next test and into the other browser project.
// LTR-200 / D32 (PC-1): the PM part catalog with cost and usual vendor, and the vendors.
function freshPartsState() {
  return {
    vendors: [
      { id: '00000000-0000-4000-8000-00000000f001', name: 'FleetPride', doesParts: true, doesRepairs: false, phone: '(760) 555-0142', email: null, accountNumber: null, notes: null, active: true, partCount: 1 },
    ],
    // LB-1: no labor rate yet.
    laborRates: [],
    // PC-3: one Job of truck 606 is at an external shop; no outside repairs yet.
    externalJobs: [{ jobId: '00000000-0000-4000-8000-0000000e0001', displayName: 'Radiator Repair', workOrderId: 'wo-606', workOrderDisplayId: 'WO-001', kind: 'part', sentAt: '2026-10-06T15:00:00.000Z', returnedAt: null, out: true, truckId: 'truck-606' }],
    repairs: [],
    // PC-2: one purchase already saved, to show the list and the repeated-invoice warning.
    purchases: [
      {
        id: '00000000-0000-4000-8000-00000000b001',
        vendor: { id: '00000000-0000-4000-8000-00000000f001', name: 'FleetPride' },
        invoiceNumber: '88412093',
        invoiceNorm: '88412093',
        invoiceDate: '2026-10-06',
        lines: [{ id: 'l1', partId: '00000000-0000-4000-8000-00000000a001', description: 'Fuel Filter 4 Micron', partNumber: 'LFF8897', quantity: '2.00', unitCostCents: 2410, lineTotalCents: 4820, truck: { id: 'truck-606', truckNumber: '606' } }],
        subtotalCents: 4820, taxCents: 0, freightCents: 0, totalCents: 4820,
        notes: null, attachment: null, voidedAt: null, voidedBy: null, voidReason: null,
        createdBy: { id: 'manager', name: 'Shop Manager' }, createdAt: '2026-10-06T15:00:00.000Z',
      },
    ],
    categories: [
      {
        id: '00000000-0000-4000-8000-00000000c001',
        name: 'Fuel Filter',
        parts: [
          { id: '00000000-0000-4000-8000-00000000a001', categoryId: '00000000-0000-4000-8000-00000000c001', partNumber: 'LFF8897', displayName: 'Fuel Filter 4 Micron', active: true, source: 'seed', unitCostCents: 2410, defaultVendor: { id: '00000000-0000-4000-8000-00000000f001', name: 'FleetPride' }, fits: [], usedInPmCount: 38, lastUsedAt: '2026-10-06T15:00:00.000Z', openPms: [], lastPaid: null },
          { id: '00000000-0000-4000-8000-00000000a002', categoryId: '00000000-0000-4000-8000-00000000c001', partNumber: 'WF10447', displayName: 'Fuel Filter Volvo', active: true, source: 'seed', unitCostCents: null, defaultVendor: null, fits: [{ make: 'Volvo', model: null }], usedInPmCount: 4, lastUsedAt: '2026-10-07T15:00:00.000Z', openPms: [{ workOrderId: 'wo-968', displayId: 'WO-968-1', truckId: 'truck-968', truckNumber: '968' }], lastPaid: null },
        ],
      },
    ],
  };
}
let partsState = freshPartsState();

const initialState = structuredClone({ users, adminCatalog, workOrders, yardOperations, workPlanByTruck: [...workPlanByTruck], workflowSteps });

function resetFixtureState() {
  const fresh = structuredClone(initialState);
  for (const key of Object.keys(users)) delete users[key];
  Object.assign(users, fresh.users);
  adminCatalog.splice(0, adminCatalog.length, ...fresh.adminCatalog);
  workOrders.splice(0, workOrders.length, ...fresh.workOrders);
  yardOperations.splice(0, yardOperations.length, ...fresh.yardOperations);
  workPlanByTruck.clear();
  for (const [key, value] of fresh.workPlanByTruck) workPlanByTruck.set(key, value);
  workflowSteps.splice(0, workflowSteps.length, ...fresh.workflowSteps);
  catalogWriteSeq = 900;
  createdCatalogJobs = [];
  rosterWriteSeq = 20;
  partsState = freshPartsState();
}

createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  if (request.url === '/__test/reset' && request.method === 'POST') {
    resetFixtureState();
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
  // D36: the local demo panel lists the accounts it can switch to (active ones only).
  if (request.url === '/api/dev/demo/users') {
    json(response, 200, { users: Object.values(users).filter((item) => item.active && !item.removedAt) });
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
      { id: '00000000-0000-4000-8000-000000000304', name: 'Alignment', sortOrder: 4 },
    ]);
    return;
  }
  if (request.url?.startsWith('/api/catalog/jobs')) {
    const url = new URL(request.url, 'http://fixture.local');
    const categoryId = url.searchParams.get('categoryId');
    const jobs = [...catalogJobs, ...createdCatalogJobs]
      .filter((job) => !categoryId || job.categoryId === categoryId);
    json(response, 200, jobs);
    return;
  }
  if (request.url?.startsWith('/api/catalog/aliases')) {
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
  if (request.url === '/api/trucks') {
    const trucks = [...new Map(workOrders.map((item) => [item.truck.id, item.truck])).values()];
    json(response, 200, trucks);
    return;
  }
  const openWorkOrderMatch = request.url?.match(/^\/api\/trucks\/([0-9a-f-]+)\/open-work-order$/i);
  if (openWorkOrderMatch) {
    const open = workOrders.find((item) => (
      item.truck.id === openWorkOrderMatch[1]
      && ['created', 'in_progress', 'waiting_paused'].includes(item.status)
    ));
    json(response, 200, open
      ? { exists: true, workOrder: toMechanicSummary(open) }
      : { exists: false });
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
  // D22 roster and D25 Job catalog: open to the Shop Manager (admin.access + work_orders.manage) and role admin.
  function denyUnlessManagerWriter() {
    if (user.role === 'admin' || (user.capabilities.includes('admin.access') && canManageWorkOrders)) return false;
    json(response, 403, { message: 'Only the Shop Manager or a System Admin can change this.' });
    return true;
  }
  // LTR-200 / D-PC7: Parts & costs is Manager and System Admin only, reading too.
  if (request.url?.startsWith('/api/admin/parts-costs/')) {
    if (denyUnlessManagerWriter()) return;
    const path = request.url.split('?')[0];
    const allParts = () => partsState.categories.flatMap((category) => category.parts);
    if (path === '/api/admin/parts-costs/parts' && request.method === 'GET') {
      const includeInactive = request.url.includes('includeInactive=true');
      const categories = partsState.categories.map((category) => ({ ...category, parts: category.parts.filter((part) => includeInactive || part.active) }));
      json(response, 200, { categories, truckMakes: ['Freightliner', 'Volvo'], costedPartCount: allParts().filter((part) => part.unitCostCents !== null).length });
      return;
    }
    const partPatch = path.match(/^\/api\/admin\/parts-costs\/parts\/([0-9a-f-]+)$/i);
    if (partPatch && request.method === 'PATCH') {
      const body = await readJson(request);
      const part = allParts().find((item) => item.id === partPatch[1]);
      if (!part) { json(response, 404, { message: 'Part not found' }); return; }
      if (body?.active === false && part.openPms.length) {
        json(response, 409, { code: 'PART_IN_OPEN_PM', message: 'Used in a PM in progress.', openPms: part.openPms });
        return;
      }
      if (body?.unitCostCents !== undefined) part.unitCostCents = body.unitCostCents;
      if (body?.displayName !== undefined) part.displayName = body.displayName;
      if (body?.partNumber !== undefined) part.partNumber = body.partNumber;
      if (body?.fits !== undefined) part.fits = body.fits;
      if (body?.active !== undefined) part.active = body.active;
      if (body?.defaultVendorId !== undefined) {
        const vendor = partsState.vendors.find((item) => item.id === body.defaultVendorId);
        part.defaultVendor = vendor ? { id: vendor.id, name: vendor.name } : null;
      }
      json(response, 200, { id: part.id });
      return;
    }
    if (path === '/api/admin/parts-costs/vendors' && request.method === 'GET') {
      json(response, 200, partsState.vendors);
      return;
    }
    if (path === '/api/admin/parts-costs/vendors' && request.method === 'POST') {
      const body = await readJson(request);
      const name = String(body?.name ?? '').trim();
      const taken = partsState.vendors.find((vendor) => vendor.name.toLowerCase() === name.toLowerCase());
      if (taken) { json(response, 409, { code: 'VENDOR_NAME_TAKEN', vendorId: taken.id, vendorName: taken.name }); return; }
      const vendor = { id: `00000000-0000-4000-8000-0000000f${String(partsState.vendors.length + 1).padStart(4, '0')}`, name, doesParts: body?.doesParts ?? true, doesRepairs: body?.doesRepairs ?? false, phone: body?.phone || null, email: body?.email || null, accountNumber: body?.accountNumber || null, notes: body?.notes || null, active: true, partCount: 0 };
      partsState.vendors.push(vendor);
      json(response, 201, { id: vendor.id });
      return;
    }
    // LB-1 (LTR-201 / D34): the shop's labor rate.
    if (path === '/api/admin/parts-costs/labor-rates' && request.method === 'GET') {
      const sorted = [...partsState.laborRates].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
      const today = new Date().toISOString().slice(0, 10);
      json(response, 200, { rates: sorted, current: sorted.find((rate) => rate.effectiveFrom <= today) ?? null });
      return;
    }
    if (path === '/api/admin/parts-costs/labor-rates' && request.method === 'POST') {
      const body = await readJson(request);
      if (partsState.laborRates.some((rate) => rate.effectiveFrom === body.effectiveFrom)) {
        json(response, 409, { code: 'LABOR_RATE_DATE_TAKEN' });
        return;
      }
      const rate = { id: `rate-${partsState.laborRates.length + 1}`, rateCentsPerHour: body.rateCentsPerHour, effectiveFrom: body.effectiveFrom, notes: null, createdBy: { id: 'manager', name: 'Shop Manager' }, createdAt: new Date().toISOString() };
      partsState.laborRates.push(rate);
      json(response, 201, { id: rate.id, recalculatedWorkOrders: 3 });
      return;
    }
    // PC-3: outside repairs.
    if (path === '/api/admin/parts-costs/external-jobs') {
      const truckId = new URL(request.url, 'http://fixture').searchParams.get('truckId');
      json(response, 200, partsState.externalJobs.filter((job) => job.truckId === truckId).map(({ truckId: _truck, ...job }) => job));
      return;
    }
    if (path === '/api/admin/parts-costs/outside-repairs' && request.method === 'GET') {
      const items = [...partsState.repairs].reverse();
      const live = items.filter((item) => !item.voidedAt);
      json(response, 200, { items, totals: { count: live.length, totalCents: live.reduce((sum, item) => sum + item.amountCents, 0) } });
      return;
    }
    if (path === '/api/admin/parts-costs/outside-repairs' && request.method === 'POST') {
      if (!request.headers['idempotency-key']) { json(response, 400, { code: 'IDEMPOTENCY_KEY_REQUIRED' }); return; }
      const body = await readJson(request);
      const normRepair = String(body.invoiceNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const purchaseClash = partsState.purchases.find((item) => item.vendor.id === body.vendorId && item.invoiceNorm === normRepair && !item.voidedAt);
      if (purchaseClash) {
        json(response, 409, { code: 'DUPLICATE_INVOICE', exists: true, kind: 'part_purchase', id: purchaseClash.id, invoiceNumber: purchaseClash.invoiceNumber, invoiceDate: purchaseClash.invoiceDate, totalCents: purchaseClash.totalCents, vendorName: purchaseClash.vendor.name });
        return;
      }
      const vendor = partsState.vendors.find((item) => item.id === body.vendorId);
      const job = partsState.externalJobs.find((item) => item.jobId === body.workOrderJobId);
      const repair = {
        id: `00000000-0000-4000-8000-0000000d${String(partsState.repairs.length + 1).padStart(4, '0')}`,
        truck: { id: body.truckId, truckNumber: body.truckId === 'truck-918' ? '918' : '606' },
        vendor: { id: vendor.id, name: vendor.name },
        invoiceNumber: body.invoiceNumber, invoiceDate: body.invoiceDate, description: body.description, amountCents: body.amountCents,
        job: job ? { id: job.jobId, displayName: job.displayName, workOrderId: job.workOrderId, workOrderDisplayId: job.workOrderDisplayId, kind: job.kind } : null,
        hasFile: false, voidedAt: null, notes: body.notes || null, attachment: null,
        createdBy: { id: 'manager', name: 'Shop Manager' }, createdAt: new Date().toISOString(), voidedBy: null, voidReason: null,
      };
      partsState.repairs.push(repair);
      json(response, 201, { id: repair.id, replayed: false });
      return;
    }
    const repairGet = path.match(/^\/api\/admin\/parts-costs\/outside-repairs\/([0-9a-f-]+)$/i);
    if (repairGet && request.method === 'GET') {
      const repair = partsState.repairs.find((item) => item.id === repairGet[1]);
      if (!repair) { json(response, 404, { message: 'Outside repair not found' }); return; }
      json(response, 200, repair);
      return;
    }
    // PC-2: purchases.
    const purchaseSummary = (purchase) => {
      const trucks = [...new Map(purchase.lines.filter((line) => line.truck).map((line) => [line.truck.id, line.truck])).values()];
      return {
        id: purchase.id, vendor: purchase.vendor, invoiceNumber: purchase.invoiceNumber, invoiceDate: purchase.invoiceDate,
        lineCount: purchase.lines.length, trucks, hasNoTruckLines: purchase.lines.some((line) => !line.truck),
        totalCents: purchase.totalCents, hasFile: Boolean(purchase.attachment), voidedAt: purchase.voidedAt,
      };
    };
    const purchaseDetail = (purchase) => {
      const byTruck = new Map();
      for (const line of purchase.lines.filter((item) => item.truck)) byTruck.set(line.truck.id, { ...line.truck, amountCents: (byTruck.get(line.truck.id)?.amountCents ?? 0) + line.lineTotalCents });
      const noTruckCents = purchase.lines.filter((line) => !line.truck).reduce((sum, line) => sum + line.lineTotalCents, 0);
      return { ...purchaseSummary(purchase), ...purchase, truckShares: [...byTruck.values()], noTruckCents };
    };
    const normInvoice = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const invoiceMatch = (vendorId, number, excludeId) => {
      const found = partsState.purchases.find((item) => item.vendor.id === vendorId && item.invoiceNorm === normInvoice(number) && !item.voidedAt && item.id !== excludeId);
      return found ? { exists: true, kind: 'part_purchase', id: found.id, invoiceNumber: found.invoiceNumber, invoiceDate: found.invoiceDate, totalCents: found.totalCents, vendorName: found.vendor.name } : null;
    };
    if (path === '/api/admin/parts-costs/purchases/form-data') {
      json(response, 200, {
        trucks: [{ id: 'truck-606', truckNumber: '606', make: 'Freightliner', model: 'Cascadia' }, { id: 'truck-918', truckNumber: '918', make: 'Peterbilt', model: '579' }],
        lastPaid: [{ partId: '00000000-0000-4000-8000-00000000a001', unitCostCents: 2410, invoiceDate: '2026-10-06', vendorId: '00000000-0000-4000-8000-00000000f001', vendorName: 'FleetPride' }],
        filesEnabled: false,
      });
      return;
    }
    if (path === '/api/admin/parts-costs/invoices/check') {
      const params = new URL(request.url, 'http://fixture').searchParams;
      json(response, 200, invoiceMatch(params.get('vendorId'), params.get('number'), params.get('excludeId')) ?? { exists: false });
      return;
    }
    if (path === '/api/admin/parts-costs/purchases' && request.method === 'GET') {
      const items = [...partsState.purchases].reverse().map(purchaseSummary);
      const live = partsState.purchases.filter((item) => !item.voidedAt);
      json(response, 200, { items, totals: { count: live.length, totalCents: live.reduce((sum, item) => sum + item.totalCents, 0), noTruckCents: live.reduce((sum, item) => sum + purchaseDetail(item).noTruckCents, 0) } });
      return;
    }
    if (path === '/api/admin/parts-costs/purchases' && request.method === 'POST') {
      const key = request.headers['idempotency-key'];
      if (!key) { json(response, 400, { code: 'IDEMPOTENCY_KEY_REQUIRED' }); return; }
      const replay = partsState.purchases.find((item) => item.idempotencyKey === key);
      if (replay) { json(response, 201, { id: replay.id, replayed: true }); return; }
      const body = await readJson(request);
      const match = invoiceMatch(body.vendorId, body.invoiceNumber);
      if (match) { json(response, 409, { code: 'DUPLICATE_INVOICE', ...match }); return; }
      const allPartsList = allParts();
      const trucks = { 'truck-606': { id: 'truck-606', truckNumber: '606' }, 'truck-918': { id: 'truck-918', truckNumber: '918' } };
      const lines = body.lines.map((line, index) => {
        const part = allPartsList.find((item) => item.id === line.partId);
        const hundredths = Math.round(Number(line.quantity) * 100);
        return {
          id: `line-${index}`, partId: part?.id ?? null, description: line.description || part?.displayName, partNumber: part?.partNumber ?? null,
          quantity: (hundredths / 100).toFixed(2), unitCostCents: line.unitCostCents, lineTotalCents: Math.round((hundredths * line.unitCostCents) / 100),
          truck: line.truckId ? trucks[line.truckId] : null,
        };
      });
      const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
      const totalCents = subtotalCents + (body.taxCents ?? 0) + (body.freightCents ?? 0);
      if (body.expectedTotalCents !== undefined && body.expectedTotalCents !== totalCents) { json(response, 400, { code: 'TOTAL_MISMATCH', totalCents }); return; }
      const vendor = partsState.vendors.find((item) => item.id === body.vendorId);
      const purchase = {
        id: `00000000-0000-4000-8000-0000000b${String(partsState.purchases.length + 1).padStart(4, '0')}`,
        idempotencyKey: key, vendor: { id: vendor.id, name: vendor.name }, invoiceNumber: body.invoiceNumber, invoiceNorm: normInvoice(body.invoiceNumber),
        invoiceDate: body.invoiceDate, lines, subtotalCents, taxCents: body.taxCents ?? 0, freightCents: body.freightCents ?? 0, totalCents,
        notes: body.notes || null, attachment: null, voidedAt: null, voidedBy: null, voidReason: null,
        createdBy: { id: 'manager', name: 'Shop Manager' }, createdAt: new Date().toISOString(),
      };
      partsState.purchases.push(purchase);
      json(response, 201, { id: purchase.id, replayed: false });
      return;
    }
    const purchaseVoid = path.match(/^\/api\/admin\/parts-costs\/purchases\/([0-9a-f-]+)\/void$/i);
    if (purchaseVoid && request.method === 'POST') {
      const body = await readJson(request);
      const purchase = partsState.purchases.find((item) => item.id === purchaseVoid[1]);
      if (!purchase) { json(response, 404, { message: 'Purchase not found' }); return; }
      Object.assign(purchase, { voidedAt: new Date().toISOString(), voidedBy: { id: 'manager', name: 'Shop Manager' }, voidReason: body.reason });
      json(response, 201, { id: purchase.id });
      return;
    }
    const purchaseGet = path.match(/^\/api\/admin\/parts-costs\/purchases\/([0-9a-f-]+)$/i);
    if (purchaseGet && request.method === 'GET') {
      const purchase = partsState.purchases.find((item) => item.id === purchaseGet[1]);
      if (!purchase) { json(response, 404, { message: 'Purchase not found' }); return; }
      json(response, 200, purchaseDetail(purchase));
      return;
    }
    json(response, 404, { message: 'Not found' });
    return;
  }
  if (request.url === '/api/admin/catalog/jobs' && request.method === 'POST') {
    if (denyUnlessManagerWriter()) return;
    const body = await readJson(request);
    const category = adminCatalog.find((item) => item.id === body?.categoryId);
    if (!category) { json(response, 404, { message: 'Category not found' }); return; }
    if (category.status !== 'active') { json(response, 400, { message: 'Add jobs only to an active category.' }); return; }
    const displayName = String(body?.displayName ?? '').trim();
    if (!displayName) { json(response, 400, { message: 'Enter a Job name.' }); return; }
    const sameName = (job) => job.displayName.toLowerCase() === displayName.toLowerCase();
    const duplicate = category.jobs.find(sameName)
      ?? [...catalogJobs, ...createdCatalogJobs].find((job) => job.categoryId === category.id && sameName(job));
    if (duplicate) {
      json(response, 409, { code: 'CATALOG_JOB_EXISTS', message: 'A catalog job with this name already exists in the category.', jobId: duplicate.id });
      return;
    }
    catalogWriteSeq += 1;
    const created = {
      id: fixtureUuid(catalogWriteSeq),
      displayName,
      status: body?.status === 'inactive' ? 'inactive' : 'active',
      aliases: [displayName],
    };
    category.jobs.push(created);
    if (created.status === 'active') createdCatalogJobs.push({ id: created.id, categoryId: category.id, displayName, aliases: [displayName] });
    json(response, 200, { ...created, categoryId: category.id });
    return;
  }
  const catalogJobPatch = request.url?.match(/^\/api\/admin\/catalog\/jobs\/([0-9a-f-]+)$/i);
  if (catalogJobPatch && request.method === 'PATCH') {
    if (denyUnlessManagerWriter()) return;
    const body = await readJson(request);
    const displayName = body?.displayName === undefined ? undefined : String(body.displayName).trim();
    const status = body?.status;
    if (displayName === undefined && status === undefined) {
      json(response, 400, { message: 'Provide a display name or status' });
      return;
    }
    const category = adminCatalog.find((item) => item.jobs.some((job) => job.id === catalogJobPatch[1]));
    const job = category?.jobs.find((item) => item.id === catalogJobPatch[1]);
    if (!category || !job) { json(response, 404, { message: 'Catalog job not found' }); return; }
    if (displayName !== undefined) {
      if (!displayName) { json(response, 400, { message: 'Enter a Job name.' }); return; }
      const duplicate = category.jobs.some((item) => item.id !== job.id && item.displayName.toLowerCase() === displayName.toLowerCase());
      if (duplicate) { json(response, 409, { message: 'That job name is already used by another catalog job.' }); return; }
      job.displayName = displayName;
      if (!job.aliases.includes(displayName)) job.aliases = [...job.aliases, displayName];
    }
    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') { json(response, 400, { message: 'Invalid status' }); return; }
      // JC3: a Job of an inactive Category cannot be activated.
      if (status === 'active' && job.status !== 'active' && category.status !== 'active') {
        json(response, 400, { code: 'CATALOG_CATEGORY_INACTIVE', message: 'This Job\'s Category is inactive, so the Job cannot be activated.' });
        return;
      }
      job.status = status;
    }
    json(response, 200, { id: job.id, displayName: job.displayName, status: job.status, aliases: job.aliases, categoryId: category.id });
    return;
  }
  if (request.url === '/api/admin/catalog/categories') {
    json(response, 200, adminCatalog.map(catalogSummary));
    return;
  }
  // LTR-198 / JC2: Jobs and aliases across Categories, accents and capitals ignored.
  if (request.url?.startsWith('/api/admin/catalog/search')) {
    const q = foldCatalogText(new URL(request.url, 'http://fixture').searchParams.get('q') ?? '');
    const hits = q ? adminCatalog.flatMap((category) => category.jobs
      .filter((job) => foldCatalogText(job.displayName).includes(q) || job.aliases.some((alias) => foldCatalogText(alias).includes(q)))
      .map((job) => ({
        jobId: job.id,
        displayName: job.displayName,
        status: job.status,
        categoryId: category.id,
        categoryName: category.name,
        categoryStatus: category.status,
        matchedAlias: foldCatalogText(job.displayName).includes(q) ? null : job.aliases.find((alias) => foldCatalogText(alias).includes(q)) ?? null,
      }))) : [];
    json(response, 200, hits);
    return;
  }
  const categoryPatch = request.url?.match(/^\/api\/admin\/catalog\/categories\/([0-9a-f-]+)$/i);
  if (categoryPatch && request.method === 'PATCH') {
    if (denyUnlessManagerWriter()) return;
    const body = await readJson(request);
    const category = adminCatalog.find((item) => item.id === categoryPatch[1]);
    if (!category) { json(response, 404, { message: 'Category not found' }); return; }
    if (body?.name !== undefined) category.name = String(body.name).trim();
    if (body?.status !== undefined) category.status = body.status;
    category.inactiveReason = category.status === 'active' ? null : (body?.inactiveReason ?? category.inactiveReason ?? null);
    json(response, 200, catalogSummary(category));
    return;
  }
  if (request.url?.startsWith('/api/admin/catalog/categories/')) {
    const id = request.url.slice('/api/admin/catalog/categories/'.length).split('?')[0];
    const category = adminCatalog.find((item) => item.id === id);
    if (!category) { json(response, 404, { message: 'Category not found' }); return; }
    json(response, 200, catalogDetail(category));
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
      attention: [
        workOrders.find((item) => item.displayId === 'WO-0102'),
        workOrders.find((item) => item.displayId === 'WO-0101'),
        workOrders.find((item) => item.displayId === 'WO-0103'),
      ],
      // Stage 3 (D1): every open Work Order and every Truck still Ready to Go, with its Next step.
      queue: workOrders
        .filter((item) => ['created', 'in_progress', 'waiting_paused'].includes(item.status) || (item.status === 'completed' && !item.returnedToServiceAt))
        .map((item) => ({ ...item, nextStep: fixtureNextStepForWorkOrder(item) })),
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
  const workPlanMatch = request.url?.match(/^\/api\/admin\/trucks\/([0-9a-f-]+)\/work-plan(?:\/(inspection|jobs))?$/i);
  if (workPlanMatch) {
    const item = yardOperations.find((candidate) => candidate.truck.id === workPlanMatch[1]);
    if (!item) { json(response, 404, { message: 'Truck not found' }); return; }
    const plan = fixtureWorkPlan(item, user);
    if (request.method === 'GET' && !workPlanMatch[2]) {
      json(response, 200, plan);
      return;
    }
    const body = await readJson(request);
    if (workPlanMatch[2] === 'inspection' && request.method === 'POST') {
      if (!user.capabilities.includes('yard.operations.manage')) {
        json(response, 403, { message: 'Yard readiness management is not available for this account.' });
        return;
      }
      if (body?.outcome !== 'issues_found' && body?.outcome !== 'no_issues_found') {
        json(response, 400, { message: 'Inspection outcome is required.' });
        return;
      }
      plan.inspection.outcome = body.outcome;
      // Stage 8: when it was recorded.
      plan.inspection.recordedAt = '2026-09-06T13:12:00.000Z';
      if (body.outcome === 'no_issues_found') {
        plan.readyReason = 'alignment_pending';
        plan.phase = 'alignment';
      } else {
        plan.readyReason = plan.remainingJobCount ? 'jobs_remaining' : 'alignment_pending';
        plan.phase = plan.jobs.length ? 'shop_work' : 'inspection';
      }
      json(response, 200, plan);
      return;
    }
    if (workPlanMatch[2] === 'jobs' && request.method === 'POST') {
      if (!user.capabilities.includes('work_orders.manage')) {
        json(response, 403, { message: 'Work Order management is not available for this account.' });
        return;
      }
      const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
      if (!jobs.length) { json(response, 400, { message: 'At least one Job is required.' }); return; }
      if (plan.workOrder && body?.expectedVersion !== undefined && body.expectedVersion !== plan.workOrder.version) {
        json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.', version: plan.workOrder.version });
        return;
      }
      if (!plan.workOrder) {
        plan.workOrder = {
          id: '00000000-0000-4000-8000-00000000ccc1',
          displayId: 'WO-WP-FIX',
          status: 'created',
          version: 1,
          primaryCategoryName: jobs[0].displayName ? 'Air & Brake System' : 'Other',
          priority: 'normal',
          completedAt: null,
        };
      }
      for (const job of jobs) {
        const lane = /alignment/i.test(job.displayName ?? '')
          ? 'alignment'
          : /detailing/i.test(job.displayName ?? '')
            ? 'detailing'
            : 'shop_work';
        plan.jobs.push({
          id: `job-${plan.jobs.length + 1}`,
          catalogJobId: job.catalogJobId ?? null,
          displayName: job.displayName,
          customDescription: job.customDescription ?? null,
          category: { id: job.categoryId, name: lane === 'alignment' ? 'Suspension & Steering' : 'Air & Brake System' },
          status: 'to_do',
          uiStatus: 'pending',
          lane,
        });
        if (lane === 'alignment') plan.mandatory.alignment = { required: true, status: 'pending', jobCount: 1, remainingCount: 1 };
        if (lane === 'detailing') plan.mandatory.detailing = { required: true, status: 'pending', jobCount: 1, remainingCount: 1 };
      }
      plan.workOrder.version += 1;
      plan.inspection.outcome = 'issues_found';
      plan.remainingJobCount = plan.jobs.filter((job) => job.status === 'to_do').length;
      plan.readiness = 'not_ready';
      plan.readyReason = 'jobs_remaining';
      plan.phase = 'shop_work';
      json(response, 200, plan);
      return;
    }
    json(response, 405, { message: 'Method not allowed' });
    return;
  }
  if (truckDetailMatch) {
    // LTR-162: Trucks listed under /admin/trucks come from Work Orders, not only from the Yard board.
    let item = yardOperations.find((candidate) => candidate.truck.id === truckDetailMatch[1]);
    const workOrderTruck = workOrders.find((candidate) => candidate.truck.id === truckDetailMatch[1])?.truck;
    if (!item && workOrderTruck) {
      item = makeYardItem(workOrderTruck.id, workOrderTruck.truckNumber, 'inspection', null, null);
      item.truck = { ...item.truck, ...structuredClone(workOrderTruck) };
    }
    if (!item) json(response, 404, { message: 'Truck not found' });
    else {
      const detail = { ...item, repairHistory: { items: fixtureRepairHistory(item.truck.id), nextCursor: null }, repairHistoryUrl: `/api/admin/trucks/${item.truck.id}/repair-history`, incomingTrucks: { status: 'unavailable', reason: 'integration_not_connected' }, upcomingDepartures: { status: 'unavailable', reason: 'integration_not_connected' } };
      const workPlan = fixtureWorkPlan(item, user);
      json(response, 200, { ...detail, workPlan, nextStep: fixtureNextStep(item, workPlan) });
    }
    return;
  }
  if (request.url?.split('?')[0] === '/api/admin/yard/data-boundary') {
    json(response, 200, {
      asOf: '2026-09-21T16:00:00.000Z',
      windows: {
        timeZone: 'America/New_York',
        thisWeek: { from: '2026-09-21', to: '2026-09-27' },
        nextWeek: { from: '2026-09-28', to: '2026-10-04' },
      },
      workLocation: {
        status: 'ok',
        summary: '301 Yard',
        items: [
          { truckNumber: '277', location: '301 Yard' },
          { truckNumber: '905', location: '301 Yard' },
          // Stage 6 (D8): Dispatch says outside while the shop works on Y-103.
          { truckNumber: 'Y-103', location: 'Outside' },
        ],
      },
      // Stage 6: the shop's side of the Trucks Dispatch names.
      shop: [
        { truckNumber: 'Y-101', truckId: '00000000-0000-4000-8000-000000001001', openWorkOrder: null, outOfShop: false, phase: 'inspection', readyToGo: false, jobsLeft: 0 },
        { truckNumber: 'Y-103', truckId: '00000000-0000-4000-8000-000000001003', openWorkOrder: { id: '00000000-0000-4000-8000-000000002003', displayId: 'WO-103' }, outOfShop: false, phase: 'shop_work', readyToGo: false, jobsLeft: 1 },
      ],
      incomingTrucks: {
        status: 'ok',
        items: [
          { truckNumber: '277', returnDate: '2026-09-22', window: 'this_week', drivers: ['Ana', 'Luis'] },
          { truckNumber: 'Y-101', returnDate: '2026-09-28', window: 'next_week' },
        ],
      },
      upcomingDepartures: {
        status: 'ok',
        items: [],
      },
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
    const outOfShop = url.searchParams.get('outOfShop');
    const soonTrucks = (url.searchParams.get('soonTrucks') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const soon = url.searchParams.get('soon');
    const isOpen = (item) => Boolean(item.activeWorkOrder && !['completed', 'cancelled'].includes(item.activeWorkOrder.status));
    const leaving = (item) => isOpen(item) && soonTrucks.includes(item.truck.truckNumber);
    // Stage 6: quick filters (blocked, priority, out of shop) are left out to count them.
    const matches = (item, skipQuick = false) => {
      if (search && !`${item.truck.truckNumber} ${item.truck.make} ${item.truck.model} ${item.activeWorkOrder?.displayId ?? ''}`.toLowerCase().includes(search)) return false;
      if (readiness?.length && !readiness.includes(item.assessment?.status ?? 'not_started')) return false;
      if (phase?.length && !phase.includes(item.phase)) return false;
      if (workOrderStatus?.length && !workOrderStatus.includes(item.activeWorkOrder?.status ?? '')) return false;
      if (skipQuick) return true;
      if (priority?.length && !priority.includes(item.activeWorkOrder?.priority ?? '')) return false;
      if (blocked === 'true' && item.blockers.length === 0) return false;
      if (blocked === 'false' && item.blockers.length > 0) return false;
      if (outOfShop === 'true' && !item.outOfShop) return false;
      if (soon === 'true' && !leaving(item)) return false;
      return true;
    };
    let items = yardOperations.filter((item) => matches(item));
    const quickScope = yardOperations.filter((item) => matches(item, true));
    const quick = {
      all: quickScope.length,
      blocked: quickScope.filter((item) => item.blockers.length > 0).length,
      highPriority: quickScope.filter((item) => ['high', 'critical'].includes(item.activeWorkOrder?.priority ?? '')).length,
      outOfShop: quickScope.filter((item) => item.outOfShop).length,
      leavingSoon: quickScope.filter(leaving).length,
    };
    const byPhase = {};
    for (const item of items) byPhase[item.phase] = (byPhase[item.phase] ?? 0) + 1;
    const matching = items.length;
    if (cursor) items = items.slice(4);
    const hasCursor = !cursor && !search && !readiness && !phase && !workOrderStatus && !priority && !blocked && !outOfShop && !soon;
    json(response, 200, {
      items: hasCursor ? items.slice(0, 4) : items,
      nextCursor: hasCursor ? 'yard-page-2' : null,
      counts: { notStarted: 2, underReview: 6, readyToGo: 1, blocked: 1, presenceUnknown: 9, matching, total: yardOperations.length, quick, byPhase },
      workLocation: {
        status: 'ok',
        total: 2,
        items: [
          { truckNumber: 'Y-102', truckId: '00000000-0000-4000-8000-000000001002', detail: 'WO-0102', scheduledOn: null, source: 'open_work_order' },
          { truckNumber: 'Y-103', truckId: '00000000-0000-4000-8000-000000001003', detail: null, scheduledOn: null, source: 'reported_yard' },
        ],
      },
      incomingTrucks: {
        status: 'ok',
        total: 2,
        items: [
          { truckNumber: '609', truckId: null, detail: 'MARITZA HERNANDEZ', scheduledOn: '2026-09-21', source: 'expected_return' },
          { truckNumber: '828', truckId: null, detail: 'FRANCISCO', scheduledOn: '2026-09-22', source: 'expected_return' },
        ],
      },
      upcomingDepartures: {
        status: 'ok',
        total: 1,
        items: [
          { truckNumber: '614', truckId: null, detail: 'LEYDER ESTRADA', scheduledOn: '2026-09-21', source: 'planned_out' },
        ],
      },
      workPlanBoardCutover: true,
      pmPhaseEnabled: true,
    });
    return;
  }
  // LTR-154 / D11: per-Job owner from the Admin Work Order detail.
  const jobAssignMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/jobs\/([0-9a-f-]+)\/(assign|unassign)$/i);
  if (jobAssignMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === jobAssignMatch[1]);
    const job = summary?.jobs?.find((item) => item.id === jobAssignMatch[2]);
    const body = await readJson(request);
    if (!summary || !job) { json(response, 404, { message: 'Job not found' }); return; }
    const owner = jobAssignMatch[3] === 'assign' ? userById(body?.mechanicId) : null;
    job.assignedMechanic = owner ? { id: owner.id, name: owner.name } : null;
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  // LTR-188 / D23: "Add helper" creates the helper's own Job (same name; the web adds "· helper").
  const helperMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/jobs\/([0-9a-f-]+)\/helper$/i);
  if (helperMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === helperMatch[1]);
    const job = summary?.jobs?.find((item) => item.id === helperMatch[2]);
    const body = await readJson(request);
    if (!summary || !job) { json(response, 404, { message: 'Job not found' }); return; }
    const helper = userById(body?.mechanicId);
    if (!helper || helper.id === job.assignedMechanic?.id) {
      json(response, 400, { code: 'HELPER_INVALID_MECHANIC', message: 'Choose an active Standard mechanic who does not own this Job.' });
      return;
    }
    if (summary.jobs.some((item) => item.helperOfJobId === job.id && item.assignedMechanic?.id === helper.id && item.status !== 'cancelled')) {
      json(response, 400, { code: 'HELPER_ALREADY_ADDED', message: 'This mechanic is already helping on this Job.' });
      return;
    }
    summary.jobs.push({
      ...job,
      id: fixtureUuid(9000 + summary.jobs.length),
      assignedMechanic: { id: helper.id, name: helper.name },
      helperOfJobId: job.id,
      external: null,
      completedAt: null,
      completedBy: null,
      completionNotes: null,
    });
    summary.version += 1;
    syncJobCounts(summary);
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  // LTR-188 / D24: "Send to external shop" and "Returned".
  const externalMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/jobs\/([0-9a-f-]+)\/external(\/return)?$/i);
  if (externalMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === externalMatch[1]);
    const job = summary?.jobs?.find((item) => item.id === externalMatch[2]);
    const body = await readJson(request);
    if (!summary || !job) { json(response, 404, { message: 'Job not found' }); return; }
    if (!externalMatch[3]) {
      if (job.external) { json(response, 400, { code: 'EXTERNAL_ALREADY', message: 'This Job is already at an external shop.' }); return; }
      if (!String(body?.note ?? '').trim()) { json(response, 400, { message: 'A note is required.' }); return; }
      job.assignedMechanic = null;
      job.external = { kind: body.kind, note: String(body.note).trim(), since: '2026-10-05T14:00:00.000Z' };
    } else {
      if (!job.external) { json(response, 400, { code: 'JOB_NOT_EXTERNAL', message: 'This Job is not at an external shop.' }); return; }
      job.external = null;
      if (body?.outcome === 'assign') {
        const owner = userById(body?.mechanicId);
        job.assignedMechanic = owner ? { id: owner.id, name: owner.name } : null;
      } else {
        job.status = 'completed';
        job.completedAt = '2026-10-05T15:00:00.000Z';
        job.completedBy = { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name };
      }
    }
    summary.version += 1;
    syncJobCounts(summary);
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  if (request.url === '/api/admin/setup/shop-hours' && request.method === 'GET') {
    json(response, 200, shopHours);
    return;
  }
  if (request.url === '/api/admin/setup/shop-hours' && request.method === 'PUT') {
    if (!user.capabilities.includes('work_orders.manage') && user.role !== 'admin') {
      json(response, 403, { message: 'Only a Shop Manager or a System Admin can change the shop hours.' });
      return;
    }
    const body = await readJson(request);
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(body?.cutoff ?? '');
    const workdays = Array.isArray(body?.workdays) ? body.workdays : [];
    if (!match || Number(match[1]) < 12 || !workdays.length || workdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
      json(response, 400, { code: 'SHOP_HOURS_INVALID', message: 'Invalid shop hours.' });
      return;
    }
    Object.assign(shopHours, {
      cutoff: body.cutoff,
      workdays: [...workdays].sort((left, right) => left - right),
      updatedAt: new Date().toISOString(),
      updatedBy: { id: user.id, name: user.name },
    });
    json(response, 200, shopHours);
    return;
  }
  if (request.url === '/api/admin/setup/workflow-steps' && request.method === 'GET') {
    json(response, 200, workflowSteps.map(workflowStepDto));
    return;
  }
  if (request.url === '/api/admin/setup/workflow-steps' && request.method === 'PUT') {
    if (!user.capabilities.includes('work_orders.manage') && user.role !== 'admin') {
      json(response, 403, { message: 'Only a Shop Manager or a System Admin can change the shop workflow.' });
      return;
    }
    const body = await readJson(request);
    const teams = [];
    for (const change of body?.steps ?? []) {
      const step = workflowSteps.find((item) => item.stepKey === change.stepKey);
      if (!step) { json(response, 400, { code: 'UNKNOWN_STEP', message: 'Unknown step' }); return; }
      if (step.stepKey === 'quality_check' && change.memberIds === undefined) {
        if (change.defaultMechanicId) { json(response, 400, { code: 'STEP_HAS_NO_OWNER', message: 'Quality Check has no default owner.' }); return; }
        continue;
      }
      const memberIds = [...new Set(change.memberIds ?? (change.defaultMechanicId ? [change.defaultMechanicId] : []))];
      // SW1 / D-SET2: someone already on the team is not re-checked.
      if (memberIds.some((id) => !step.memberIds.includes(id) && !isTeamEligible(step, userById(id)))) {
        json(response, 400, { code: 'OWNER_NOT_ELIGIBLE', message: 'Owner not eligible', stepKey: step.stepKey });
        return;
      }
      teams.push([step, memberIds]);
    }
    for (const [step, memberIds] of teams) step.memberIds = memberIds;
    json(response, 200, workflowSteps.map(workflowStepDto));
    return;
  }
  if (request.url === '/api/admin/work-orders' && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const body = await readJson(request);
    // LTR-157 / D13: only the truck is required; the mandatory steps are added with their default owners.
    if (!body?.truckId) {
      json(response, 400, { message: 'A Truck is required.' });
      return;
    }
    const created = makeWorkOrder('00000000-0000-4000-8000-000000000199', 'WO-0199', 'T-199', body.priority ?? 'normal', 'created');
    // LTR-162: keep the Truck the Manager picked instead of a placeholder.
    const pickedTruck = workOrders.find((item) => item.truck.id === body.truckId)?.truck;
    if (pickedTruck) created.truck = structuredClone(pickedTruck);
    created.notes = body.notes ?? null;
    created.jobs = body.jobs.map((job, index) => ({
      id: `00000000-0000-4000-8000-0000000008${String(index).padStart(2, '0')}`,
      displayName: job.displayName,
      customDescription: job.customDescription ?? null,
      category: { id: job.categoryId, name: job.categoryId.endsWith('302') ? 'Suspension' : 'Brakes' },
      status: 'to_do',
      assignedMechanic: null,
      completedAt: null,
      completedBy: null,
      completionNotes: null,
    }));
    for (const step of workflowSteps) {
      const { owner, mode } = teamOwner(step);
      created.jobs.push({
        id: `00000000-0000-4000-8000-0000000009${String(step.sortOrder).padStart(2, '0')}`,
        catalogJobId: step.catalogJob.id,
        displayName: step.catalogJob.displayName,
        customDescription: null,
        category: { id: step.catalogJob.categoryId, name: step.catalogJob.categoryName },
        status: 'to_do',
        assignedMechanic: owner ? { id: owner.id, name: owner.name } : null,
        workflowStepKey: mode === 'queue' ? step.stepKey : null,
        completedAt: null,
        completedBy: null,
        completionNotes: null,
      });
    }
    created.nextJobName = created.jobs.find((job) => job.status === 'to_do')?.displayName ?? null;
    syncJobCounts(created);
    workOrders.unshift(created);
    json(response, 201, created);
    return;
  }
  // LTR-172: closed Work Orders for Admin History (adminHistoryQuerySchema).
  if (request.url?.startsWith('/api/admin/history') && request.method === 'GET') {
    const url = new URL(request.url, 'http://fixture.local');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search')?.toLowerCase();
    const completedFrom = url.searchParams.get('completedFrom');
    const completedBefore = url.searchParams.get('completedBefore');
    let items = workOrders.filter((item) => ['completed', 'cancelled'].includes(item.status));
    if (status) items = items.filter((item) => status.split(',').includes(item.status));
    if (search) items = items.filter((item) => `${item.displayId} ${item.truck.truckNumber} ${item.category.name}`.toLowerCase().includes(search));
    if (completedFrom) items = items.filter((item) => item.completedAt && new Date(item.completedAt) >= new Date(completedFrom));
    if (completedBefore) items = items.filter((item) => item.completedAt && new Date(item.completedAt) < new Date(completedBefore));
    json(response, 200, { items, nextCursor: null });
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
  if (request.url === '/api/admin/mechanics' && request.method === 'POST') {
    if (denyUnlessManagerWriter()) return;
    const body = await readJson(request);
    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const capability = modeToCapability(body?.mode);
    if (!name) { json(response, 400, { message: 'Enter a name.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { json(response, 400, { message: 'Enter a valid email.' }); return; }
    if (!capability) { json(response, 400, { message: 'Choose Standard, PM or Safety.' }); return; }
    const existing = Object.values(users).find((candidate) => candidate.email.toLowerCase() === email);
    if (existing) { json(response, 409, { code: 'MECHANIC_EMAIL_EXISTS', message: 'That email already belongs to a Shop user.' }); return; }
    rosterWriteSeq += 1;
    const created = {
      id: fixtureUuid(rosterWriteSeq),
      email,
      name,
      role: 'mechanic',
      active: true,
      capabilities: [capability],
    };
    users[email] = created;
    // D22: the access account exists in the fixture, so a temporary password comes back once.
    json(response, 200, { ...rosterUserDto(created), temporaryPassword: fixtureTemporaryPassword(rosterWriteSeq) });
    return;
  }
  const mechanicResetMatch = request.url?.match(/^\/api\/admin\/mechanics\/([0-9a-f-]+)\/reset-password$/i);
  if (mechanicResetMatch && request.method === 'POST') {
    if (denyUnlessManagerWriter()) return;
    const candidate = Object.values(users).find((item) => item.id === mechanicResetMatch[1]);
    if (!candidate || candidate.role !== 'mechanic') { json(response, 404, { message: 'Mechanic not found' }); return; }
    // Retired Mechanic never signed in: no Supabase account to reset.
    if (candidate.email === 'retired@lightning.local') { json(response, 409, { code: 'AUTH_ACCOUNT_MISSING', message: 'This person has no access account yet.' }); return; }
    rosterWriteSeq += 1;
    json(response, 200, { temporaryPassword: fixtureTemporaryPassword(rosterWriteSeq) });
    return;
  }
  const mechanicWriteMatch = request.url?.match(/^\/api\/admin\/mechanics\/([0-9a-f-]+)$/i);
  if (mechanicWriteMatch && request.method === 'PATCH') {
    if (denyUnlessManagerWriter()) return;
    const body = await readJson(request);
    if (body?.name === undefined && body?.mode === undefined && body?.active === undefined) {
      json(response, 400, { message: 'Provide a name, Standard/PM/Safety mode, or active flag' });
      return;
    }
    const candidate = Object.values(users).find((item) => item.id === mechanicWriteMatch[1]);
    if (!candidate || candidate.role !== 'mechanic') { json(response, 404, { message: 'Mechanic not found' }); return; }
    if (body.active === false && candidate.active) {
      const openWork = rosterOpenWork(candidate);
      if (openWork) { json(response, 409, openWork); return; }
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) { json(response, 400, { message: 'Enter a name.' }); return; }
      candidate.name = name;
    }
    if (body.mode !== undefined && !applyRosterMode(candidate, body.mode)) {
      json(response, 400, { message: 'Choose Standard, PM or Safety.' });
      return;
    }
    if (body.active !== undefined) candidate.active = Boolean(body.active);
    json(response, 200, rosterUserDto(candidate));
    return;
  }
  const adminMechanicDetailMatch = request.url?.match(/^\/api\/admin\/mechanics\/([0-9a-f-]+)$/i);
  if (adminMechanicDetailMatch && request.method === 'GET') {
    const candidate = Object.values(users).find((item) => item.id === adminMechanicDetailMatch[1]);
    if (!candidate) { json(response, 404, { message: 'Mechanic not found' }); return; }
    json(response, 200, rosterDetail(candidate));
    return;
  }
  if (request.url?.startsWith('/api/admin/mechanics')) {
    const assignable = new URL(request.url, 'http://fixture').searchParams.get('assignable') === 'true';
    const items = Object.values(users)
      // LTR-185: the roster shows Safety too; Job pickers (`assignable`) do not offer them.
      .filter((candidate) => candidate.capabilities.some((cap) => (assignable ? cap === 'mechanic.standard' || cap === 'mechanic.pm' : ROSTER_CAPABILITIES.includes(cap))))
      .filter((candidate) => !assignable || candidate.role !== 'admin')
      .filter((candidate) => candidate.active || new URL(request.url, 'http://fixture').searchParams.get('includeInactive') === 'true')
      .map(rosterSummary);
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
  const completeJobMatch = request.url?.match(/^\/api\/admin\/jobs\/([0-9a-f-]+)\/complete$/i);
  if (completeJobMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const found = findFixtureJob(completeJobMatch[1]);
    const body = await readJson(request);
    if (!found) { json(response, 404, { message: 'Job not found' }); return; }
    if (!body?.idempotencyKey) { json(response, 400, { message: 'An idempotency key is required.' }); return; }
    if (found.workOrder.category?.name === 'PM') { json(response, 400, { message: 'PM Work Orders do not use jobs' }); return; }
    if (!['created', 'in_progress', 'waiting_paused'].includes(found.workOrder.status)) {
      json(response, 400, { message: 'Cannot change Jobs on a closed Work Order' });
      return;
    }
    if (found.job.status !== 'to_do') { json(response, 400, { message: 'Job is not in To Do status' }); return; }
    if (body.expectedVersion !== found.workOrder.version) { json(response, 409, { code: 'VERSION_CONFLICT', message: 'Work Order was updated.' }); return; }
    found.job.status = 'completed';
    found.job.completedAt = '2026-09-20T02:41:00.000Z';
    found.job.completedBy = { id: users['mechanic@lightning.local'].id, name: users['mechanic@lightning.local'].name };
    found.job.completionNotes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
    found.workOrder.activityLog = [
      {
        id: `log-${found.job.id}`,
        eventType: 'job_completed',
        entityType: 'work_order_job',
        entityId: found.job.id,
        user: found.job.completedBy,
        previousValue: null,
        newValue: { displayName: found.job.displayName, status: 'completed', notes: found.job.completionNotes },
        relevantValue: null,
        createdAt: found.job.completedAt,
      },
      ...(found.workOrder.activityLog ?? []),
    ];
    found.workOrder.version += 1;
    syncJobCounts(found.workOrder);
    json(response, 200, fixtureWorkOrderDetail(found.workOrder));
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
    found.job.completionNotes = null;
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
    // LTR-175: a `created` Work Order with every Job done closes too.
    if (summary.status !== 'in_progress' && summary.status !== 'created') {
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
  // LTR-126: append-only notes and work requests.
  const noteMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/notes$/i);
  if (noteMatch && request.method === 'POST') {
    if (denyUnlessManage()) return;
    const summary = workOrders.find((item) => item.id === noteMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) { json(response, 400, { message: 'A note is required' }); return; }
    const author = users['manager@lightning.local'];
    summary.noteEntries = [...(summary.noteEntries ?? []), {
      id: `00000000-0000-4000-8000-${String(900000000000 + (summary.noteEntries?.length ?? 0)).padStart(12, '0')}`,
      kind: body.kind ?? 'note',
      body: text,
      author: { id: author.id, name: author.name },
      createdAt: new Date().toISOString(),
      handledAt: null,
      handledBy: null,
    }];
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
    // LTR-155 / D17: a blocker belongs to one of the mechanic's pending Jobs.
    const blockedJob = (summary.jobs ?? []).find((job) => job.id === body?.jobId);
    if (!blockedJob) { json(response, 400, { message: 'jobId is required' }); return; }
    if (blockedJob.assignedMechanic?.id !== user.id) { json(response, 403, { code: 'JOB_NOT_ASSIGNED_TO_YOU', message: 'This Job is assigned to another mechanic.' }); return; }
    const now = '2026-09-11T15:00:00.000Z';
    const report = {
      id: '00000000-0000-4000-8000-000000000902',
      workOrderId: summary.id,
      reason: body?.reason ?? 'waiting_for_parts',
      blockerReason: body?.reason ?? 'waiting_for_parts',
      job: { id: blockedJob.id, displayName: blockedJob.displayName },
      blockerNotes: [],
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
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
    blockedJob.activeBlocker = { id: report.id, reason: report.blockerReason, reportedAt: now, reportedBy: report.reportedBy };
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
  // LTR-155 / D17: the mechanic appends notes; only Admin resolves.
  const blockerNoteMatch = request.url?.match(/^\/api\/work-orders\/([0-9a-f-]+)\/blockers\/([0-9a-f-]+)\/notes$/i);
  if (blockerNoteMatch && request.method === 'POST') {
    const summary = workOrders.find((item) => item.id === blockerNoteMatch[1]);
    const blocker = summary?.reportedBlockers?.find((item) => item.id === blockerNoteMatch[2] && !item.resolvedAt);
    const body = await readJson(request);
    if (!summary || !blocker) { json(response, 404, { message: 'Blocker not found' }); return; }
    blocker.blockerNotes = [...(blocker.blockerNotes ?? []), {
      id: `00000000-0000-4000-8000-00000000095${blocker.blockerNotes?.length ?? 0}`,
      body: String(body?.body ?? '').trim(),
      author: { id: user.id, name: user.name },
      createdAt: '2026-09-11T16:00:00.000Z',
    }];
    summary.version += 1;
    json(response, 200, fixtureMechanicWorkOrderDetail(summary));
    return;
  }
  const adminResolveMatch = request.url?.match(/^\/api\/admin\/work-orders\/([0-9a-f-]+)\/blockers\/([0-9a-f-]+)\/resolve$/i);
  if (adminResolveMatch && request.method === 'POST') {
    const summary = workOrders.find((item) => item.id === adminResolveMatch[1]);
    const blocker = summary?.reportedBlockers?.find((item) => item.id === adminResolveMatch[2]);
    const body = await readJson(request);
    if (!summary || !blocker) { json(response, 404, { message: 'Blocker not found' }); return; }
    if (blocker.resolvedAt) { json(response, 400, { code: 'BLOCKER_ALREADY_RESOLVED', message: 'This blocker is already resolved.' }); return; }
    blocker.resolvedAt = '2026-09-11T17:00:00.000Z';
    blocker.resolvedBy = { id: user.id, name: user.name };
    blocker.resolutionNote = body?.notes ?? null;
    summary.latestReportedBlocker = null;
    summary.resolvedBlocker = blocker;
    for (const job of summary.jobs ?? []) if (job.activeBlocker?.id === blocker.id) job.activeBlocker = null;
    summary.version += 1;
    json(response, 200, fixtureWorkOrderDetail(summary));
    return;
  }
  const mechanicPlanningMatch = request.url?.match(/^\/api\/work-orders(?:\/([0-9a-f-]+)\/(pause|pause-reason|resume|complete|jobs))?$/i);
  if (request.method === 'POST' && mechanicPlanningMatch && (request.url === '/api/work-orders' || mechanicPlanningMatch[2])) {
    json(response, 403, { message: 'Standard planning is Manager-owned.' });
    return;
  }
  // LTR-172: the mechanic appends notes and work requests. Without this route the POST fell through to the
  // list catch-all below, and the detail screen crashed on the list-shaped response.
  const mechanicNoteMatch = request.url?.match(/^\/api\/work-orders\/([0-9a-f-]+)\/notes$/i);
  if (mechanicNoteMatch && request.method === 'POST') {
    const summary = workOrders.find((item) => item.id === mechanicNoteMatch[1]);
    const body = await readJson(request);
    if (!summary) { json(response, 404, { message: 'Work Order not found' }); return; }
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) { json(response, 400, { message: 'A note is required' }); return; }
    summary.noteEntries = [...(summary.noteEntries ?? []), {
      id: `00000000-0000-4000-8000-${String(910000000000 + (summary.noteEntries?.length ?? 0)).padStart(12, '0')}`,
      kind: body.kind ?? 'note',
      body: text,
      author: { id: user.id, name: user.name },
      createdAt: new Date().toISOString(),
      handledAt: null,
      handledBy: null,
    }];
    summary.version += 1;
    json(response, 200, fixtureMechanicWorkOrderDetail(summary));
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
    noteEntries: summary.noteEntries ?? [],
    activityLog: summary.activityLog ?? [{ id: '00000000-0000-4000-8000-000000000601', eventType: 'work_order_created', entityType: 'work_order', entityId: summary.id, user: { id: users['manager@lightning.local'].id, name: users['manager@lightning.local'].name }, previousValue: null, newValue: null, relevantValue: { displayId: summary.displayId }, createdAt: summary.createdAt }],
    returnedToServiceAt: summary.returnedToServiceAt ?? null,
  };
}

function fixtureMechanicWorkOrderDetail(summary) {
  return {
    ...toMechanicSummary(summary),
    notes: summary.notes ?? null,
    noteEntries: summary.noteEntries ?? [],
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
      completionNotes: job.completionNotes ?? null,
      assignedMechanic: job.assignedMechanic ?? null,
      activeBlocker: job.activeBlocker ?? null,
    })),
    currentPause: summary.currentPause,
    activeBlockers: (summary.reportedBlockers ?? []).filter((blocker) => !blocker.resolvedAt),
    // LTR-164 (#9): the resolved blocker the mechanic sees until Continue.
    resolvedBlocker: summary.resolvedBlocker ?? null,
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
      // LTR-186: the day close stopped this clock.
      endReason: 'day_close',
    }],
    jobs: [{
      id: `00000000-0000-4000-8000-0000000005${id.slice(-2)}`,
      catalogJobId: '00000000-0000-4000-8000-000000000801',
      displayName: 'Inspect brake chamber',
      customDescription: null,
      category: { id: '00000000-0000-4000-8000-000000000301', name: 'Brakes' },
      status: pendingJob ? 'to_do' : (status === 'in_progress' || status === 'completed' ? 'completed' : 'to_do'),
      // LTR-154 / D11: a pending Job the dev mechanic works has them as its owner.
      assignedMechanic: pendingJob ? { id: users['mechanic@lightning.local'].id, name: users['mechanic@lightning.local'].name } : null,
      completedAt: pendingJob ? null : (status === 'in_progress' || status === 'completed' ? '2026-09-06T17:30:00.000Z' : null),
      completedBy: pendingJob ? null : (status === 'in_progress' || status === 'completed' ? { id: users['mechanic@lightning.local'].id, name: users['mechanic@lightning.local'].name } : null),
      completionNotes: null,
    }],
    returnedToServiceAt: null,
  };
}

/** Stage 3: a reduced Next step rule for Work Orders (the API's is deriveTruckNextStep). */
function fixtureNextStepForWorkOrder(workOrder) {
  const workOrderId = workOrder.id;
  if (workOrder.status === 'completed') return workOrder.returnedToServiceAt ? null : { kind: 'return_to_service', workOrderId };
  const blocker = workOrder.latestReportedBlocker;
  if (blocker && !blocker.resolvedAt) return { kind: 'resolve_blocker', workOrderId, blockerId: blocker.id, jobName: blocker.job?.displayName, reason: blocker.reason };
  if (workOrder.status === 'waiting_paused') return { kind: 'resume', workOrderId, reason: workOrder.currentPause?.reason };
  const pending = (workOrder.jobs ?? []).filter((job) => job.status === 'to_do');
  const unassigned = pending.find((job) => !job.assignedMechanic);
  if (unassigned) return { kind: 'assign', workOrderId, jobId: unassigned.id, jobName: unassigned.displayName };
  if (!pending.length) return { kind: 'close', workOrderId };
  return { kind: 'work', workOrderId, jobId: pending[0].id, jobName: pending[0].displayName, remaining: pending.length };
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

function makeYardItem(truckId, truckNumber, phase, priority, assessmentStatus, vehicle = {}) {
  const hasWorkOrder = Boolean(priority);
  const workOrderId = truckId.replace('100', '200');
  const activeWorkOrder = hasWorkOrder ? makeWorkOrder(workOrderId, `WO-${truckNumber.slice(2)}`, truckNumber, priority, phase === 'shop_work' ? 'in_progress' : 'created') : null;
  if (activeWorkOrder) activeWorkOrder.truck.id = truckId;
  const now = '2026-09-06T18:00:00.000Z';
  const requirementType = phase === 'inspection' ? 'inspection' : phase === 'shop_work' ? 'required_repairs' : phase === 'pm' ? 'pm' : phase === 'alignment' ? 'alignment' : phase === 'detailing' ? 'detailing' : phase === 'quality_check' ? 'quality_check' : null;
  const assessment = assessmentStatus ? { id: truckId.replace('100', '300'), truckId, status: assessmentStatus, version: 1, startedAt: '2026-09-06T12:00:00.000Z', startedById: users['manager@lightning.local'].id, readyAt: assessmentStatus === 'ready' ? now : null, approvedById: assessmentStatus === 'ready' ? users['manager@lightning.local'].id : null, closedAt: null, closedById: null, closedReason: null, requirements: requirementType ? [{ id: truckId.replace('100', '400'), type: requirementType, outcome: 'required', waiverReason: null, evidenceWorkOrderId: null, evaluatedById: null, evaluatedAt: null, version: 1 }] : [] } : null;
  const blockers = phase === 'ready_to_go' || !assessment ? [] : [{ kind: activeWorkOrder ? 'open_work_order' : 'unevaluated_requirement', requirementType, workOrderId: activeWorkOrder?.id, status: activeWorkOrder?.status, priority: activeWorkOrder?.priority, categoryName: activeWorkOrder?.category.name, message: activeWorkOrder ? 'Open Work Order remains linked.' : 'Assessment requires evaluation.' }];
  return { truck: { id: truckId, truckNumber, make: vehicle.make ?? 'Volvo', model: vehicle.model ?? 'VNL', year: vehicle.year ?? 2024, mileage: 120000, company: 'Lightning Transport', owner: 'Lightning Transport', vin: '4V4NC9EH0RN123456', location: '4802 Orient Road, Tampa, FL', locationUpdatedOn: '2026-09-11' }, presence: { state: 'unknown', provenance: 'phase_1_unavailable' }, operationalStatus: 'unknown', operationalStatusAt: null, assessment, phase, blockers, activeWorkOrder };
}

