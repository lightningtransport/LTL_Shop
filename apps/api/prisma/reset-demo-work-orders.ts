/**
 * Demo Work Orders: wipe every Work Order and the Truck state that hangs off it, then rebuild one
 * Truck per JTBD scenario (docs/LIGHTNING_SHOP_MASTER_PRD.md §4, docs/ux/FLUJOS_Y_MEJORAS_2026-09-27.md §5).
 *
 *   npm run prisma:reset-demo-work-orders --workspace=@ltl-shop/api                      # dry-run, production
 *   npm run prisma:reset-demo-work-orders --workspace=@ltl-shop/api -- --apply           # writes, production
 *   npm run prisma:reset-demo-work-orders --workspace=@ltl-shop/api -- --local --apply   # writes, apps/api/.env
 *   ... -- --trucks=905,968,922,931,944,957,973,986,991                                   # pick the trucks (in scenario order)
 *
 * Production reads apps/api/.env.production.local (gitignored) and refuses to run while any active user is
 * outside the LTR-160 test roster: once real users are live, their Work Orders are not demo data.
 *
 * Deleted: Work Orders (with their Jobs, labor, blockers, notes, team, PM service), Activity Log rows of those
 * Work Orders and of readiness, readiness assessments, Ready to Go / Return to Service events, and PM mileage
 * adjustments. Kept: trucks (odometers included), users, catalog, parts, Shop workflow.
 *
 * The scenarios are built through the same services the API uses, acting as each user, so the data has exactly
 * the shape the app produces. Times start when the script runs.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import {
  BlockerReason,
  Priority,
  ShopWorkflowStepKey,
  WorkPlanInspectionOutcome,
  WorkPlanJobLane,
} from '@ltl-shop/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { ActivityLogService } from '../src/activity-log/activity-log.service';
import { TrucksService } from '../src/trucks/trucks.service';
import { WorkOrdersService } from '../src/work-orders/work-orders.service';
import { AdminService } from '../src/admin/admin.service';
import { YardOperationsService } from '../src/admin/yard-operations.service';
import { YardWorkPlanService } from '../src/admin/yard-work-plan.service';
import { classifyWorkPlanLane } from '../src/admin/yard-work-plan-derivation';
import { toSharedCapability } from '../src/auth/capabilities';
import type { AuthUser } from '../src/auth/auth.guard';
import { TEST_ROSTER } from '../src/admin/test-roster-plan';

const local = process.argv.includes('--local');
const apply = process.argv.includes('--apply');
const trucksArg = process.argv.find((arg) => arg.startsWith('--trucks='))?.slice('--trucks='.length);

const envFile = resolve(__dirname, local ? '../.env' : '../.env.production.local');
if (!existsSync(envFile)) {
  console.error(`Missing ${envFile}. Put the ${local ? 'local' : 'production'} DATABASE_URL (and DIRECT_URL) there.`);
  process.exit(1);
}
config({ path: envFile, override: true });

// The API runs next to the database; this script runs from a laptop, so each interactive transaction
// needs far more than Prisma's 5 s default for the same round trips.
const prisma = new PrismaService({ transactionOptions: { timeout: 60_000, maxWait: 30_000 } });
const activity = new ActivityLogService();
const workOrders = new WorkOrdersService(prisma, activity);
const yardOperations = new YardOperationsService(prisma, new TrucksService(prisma), activity);
const admin = new AdminService(prisma, activity, workOrders, yardOperations);
const workPlan = new YardWorkPlanService(prisma, workOrders, yardOperations);

type Actors = { manager: AuthUser; general: AuthUser; pm: AuthUser; alignment: AuthUser; detailing: AuthUser };

type Scenario = {
  key: string;
  title: string;
  check: string;
  needsFinishedPm?: boolean;
  build: (truck: TruckRow, actors: Actors) => Promise<string>;
};

type TruckRow = { id: string; truckNumber: string; make: string | null; model: string | null; mileage: number | null };

const SCENARIOS: Scenario[] = [
  {
    key: 'M01-inspect',
    title: 'Recién llegado: falta la inspección',
    check: 'Manager: el Truck pide registrar la inspección. Mecánicos: todavía nada que empezar.',
    build: async (truck, actors) => {
      return createWorkOrder(actors, truck, {
        priority: Priority.NORMAL,
        notes: 'Llegó de ruta. El conductor reporta vibración al frenar.',
      });
    },
  },
  {
    key: 'M02-assign',
    title: 'Inspección con hallazgos: trabajo extra sin asignar',
    check: 'Manager: "Siguiente paso" pide asignar Brake Inspection y Lights. Needs attention lo marca.',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, { priority: Priority.HIGH });
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [
        { category: 'Air & Brake System', job: 'Brake Inspection' },
        { category: 'Electrical & Starting', job: 'Lights' },
      ]);
      return id;
    },
  },
  {
    key: 'MECH01-ready',
    title: 'Sin hallazgos: cada mecánico tiene su job por empezar',
    check: 'MA ve Alignment y MD ve Detailing en "Your Jobs", con Start. MPM ve el PM por empezar.',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      return id;
    },
  },
  {
    key: 'MECH02-in-progress',
    title: 'Trabajo en curso',
    check: 'MG tiene Air Leak en curso con el tiempo corriendo. MA ya terminó Alignment. MD tiene Detailing pendiente.',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [{ category: 'Air & Brake System', job: 'Air Leak', assignee: actors.general }]);
      await assignMandatory(actors, id);
      await finishJob(actors.alignment, id, WorkPlanJobLane.ALIGNMENT, 'Alineación dentro de especificación.');
      await workOrders.start(actors.general, id);
      return id;
    },
  },
  {
    key: 'M03-blocked',
    title: 'Bloqueado: esperando piezas',
    check: 'MG terminó Battery y bloqueó Air Bag Replacement (Waiting for Parts); su tiempo se detuvo. '
      + 'Manager lo ve en Needs attention, el Truck y la WO, con la nota, y lo resuelve.',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {
        priority: Priority.CRITICAL,
        notes: 'Tiene carga programada para mañana.',
      });
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [
        { category: 'Suspension & Steering', job: 'Air Bag Replacement', assignee: actors.general },
        { category: 'Electrical & Starting', job: 'Battery', assignee: actors.general },
      ]);
      await assignMandatory(actors, id);
      await workOrders.start(actors.general, id);
      await workOrders.completeJob(actors.general, id, await jobId(id, 'Battery'), { notes: 'Batería nueva instalada.' });
      await workOrders.reportBlocker(actors.general, id, {
        jobId: await jobId(id, 'Air Bag Replacement'),
        reason: BlockerReason.WAITING_FOR_PARTS,
        notes: 'Falta la bolsa de aire trasera del lado del conductor.',
      });
      const blocker = await prisma.pauseEvent.findFirstOrThrow({
        where: { workOrderId: id, isOfficialPause: false, resolvedAt: null },
      });
      await workOrders.addBlockerNote(actors.general, id, blocker.id, { body: 'Pedida al proveedor; dicen que llega mañana.' });
      return id;
    },
  },
  {
    key: 'M04-qc',
    title: 'Todo terminado menos QC: listo para cerrar',
    check: 'Manager: "Mark complete" en Quality Check desde el Truck, luego cerrar. MPM, MA y MD ya terminaron su parte.',
    needsFinishedPm: true,
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await finishAllButQc(actors, truck, id);
      return id;
    },
  },
  {
    key: 'M04-ready-to-go',
    title: 'Cerrada: Ready to Go, esperando Return to Service',
    check: 'Dashboard y Yard lo cuentan como Ready to Go. Manager: Return to Service desde el Truck o el Yard.',
    needsFinishedPm: true,
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await finishAllButQc(actors, truck, id);
      await managerCompleteQcAndClose(actors, id);
      return id;
    },
  },
  {
    key: 'M04-in-service',
    title: 'De vuelta en servicio',
    check: 'El Truck dice In Service, sin WO abierta; la WO queda en el historial.',
    needsFinishedPm: true,
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await finishAllButQc(actors, truck, id);
      await managerCompleteQcAndClose(actors, id);
      await admin.returnToService(actors.manager, id, meta(await version(id)));
      return id;
    },
  },
  // Last: D2 allows one running PM per PM mechanic, and the scenarios above finish theirs.
  {
    key: 'PM-in-progress',
    title: 'PM en curso',
    check: 'MPM tiene el PM empezado con el millaje cargado; le faltan las piezas para terminar.',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await workOrders.startPmJob(actors.pm, id, await laneJobId(id, WorkPlanJobLane.PM));
      await workOrders.updatePmService(actors.pm, id, { observedMileage: truck.mileage ?? 0, selections: [] });
      return id;
    },
  },
];

function meta(expectedVersion: number) {
  return { expectedVersion, idempotencyKey: randomUUID() };
}

async function version(workOrderId: string) {
  return (await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId }, select: { version: true } })).version;
}

async function createWorkOrder(actors: Actors, truck: TruckRow, input: { priority?: Priority; notes?: string }) {
  const created = await admin.createWorkOrder(actors.manager, { truckId: truck.id, ...input, idempotencyKey: randomUUID() });
  return created.id;
}

async function inspect(actors: Actors, truck: TruckRow, outcome: WorkPlanInspectionOutcome) {
  await workPlan.recordInspection(actors.manager, truck.id, { outcome, idempotencyKey: randomUUID() });
}

async function addShopJobs(
  actors: Actors,
  truck: TruckRow,
  jobs: Array<{ category: string; job: string; assignee?: AuthUser }>,
) {
  const rows = [];
  for (const item of jobs) {
    const catalogJob = await prisma.catalogJob.findFirst({
      where: { displayName: item.job, status: 'active', category: { name: item.category, status: 'active' } },
    });
    if (!catalogJob) throw new Error(`Catalog job "${item.category} / ${item.job}" not found or inactive`);
    rows.push({
      catalogJobId: catalogJob.id,
      categoryId: catalogJob.categoryId,
      displayName: catalogJob.displayName,
      // D14: the Manager picks who does each Job as it is added.
      ...(item.assignee ? { assignedMechanicId: item.assignee.id } : {}),
    });
  }
  const open = await prisma.workOrder.findFirstOrThrow({
    where: { truckId: truck.id, status: { in: ['created', 'in_progress', 'waiting_paused'] } },
    select: { version: true },
  });
  await workPlan.addJobs(actors.manager, truck.id, { idempotencyKey: randomUUID(), expectedVersion: open.version, jobs: rows });
}

async function jobsOf(workOrderId: string) {
  return prisma.workOrderJob.findMany({
    where: { workOrderId, status: { not: 'cancelled' } },
    include: { category: { select: { name: true } } },
  });
}

async function jobId(workOrderId: string, displayName: string) {
  const job = (await jobsOf(workOrderId)).find((item) => item.displayName === displayName);
  if (!job) throw new Error(`Job "${displayName}" not found on the Work Order`);
  return job.id;
}

async function laneJobId(workOrderId: string, lane: WorkPlanJobLane) {
  const job = (await jobsOf(workOrderId)).find((item) => classifyWorkPlanLane(item.category.name, item.displayName) === lane);
  if (!job) throw new Error(`No ${lane} job on the Work Order`);
  return job.id;
}

/** PM, Alignment and Detailing go to their owners when the Shop workflow has no default owner (local seed). */
async function assignMandatory(actors: Actors, workOrderId: string) {
  const owners: Array<[WorkPlanJobLane, AuthUser]> = [
    [WorkPlanJobLane.PM, actors.pm],
    [WorkPlanJobLane.ALIGNMENT, actors.alignment],
    [WorkPlanJobLane.DETAILING, actors.detailing],
  ];
  for (const [lane, owner] of owners) {
    const id = await laneJobId(workOrderId, lane);
    const job = await prisma.workOrderJob.findUniqueOrThrow({ where: { id } });
    if (job.assignedMechanicId) continue;
    await admin.assignJob(actors.manager, workOrderId, id, { ...meta(await version(workOrderId)), mechanicId: owner.id });
  }
}

async function finishJob(mechanic: AuthUser, workOrderId: string, lane: WorkPlanJobLane, notes: string) {
  await workOrders.start(mechanic, workOrderId);
  await workOrders.completeJob(mechanic, workOrderId, await laneJobId(workOrderId, lane), { notes });
}

async function finishPm(actors: Actors, truck: TruckRow, workOrderId: string) {
  const pmJobId = await laneJobId(workOrderId, WorkPlanJobLane.PM);
  await workOrders.startPmJob(actors.pm, workOrderId, pmJobId);
  const service = await workOrders.getPmService(actors.pm, workOrderId);
  const category = service.categories.find((item) => item.parts.length);
  if (!category) throw new Error(`No PM part fits truck ${truck.truckNumber}`);
  await workOrders.updatePmService(actors.pm, workOrderId, {
    observedMileage: truck.mileage ?? 0,
    selections: [{ partCategoryId: category.id, partId: category.parts[0].id }],
  });
  await workOrders.completeJob(actors.pm, workOrderId, pmJobId, { notes: 'PM completo.' });
}

async function finishAllButQc(actors: Actors, truck: TruckRow, workOrderId: string) {
  await finishPm(actors, truck, workOrderId);
  await finishJob(actors.alignment, workOrderId, WorkPlanJobLane.ALIGNMENT, 'Alineación dentro de especificación.');
  await finishJob(actors.detailing, workOrderId, WorkPlanJobLane.DETAILING, 'Cabina y exterior limpios.');
}

async function managerCompleteQcAndClose(actors: Actors, workOrderId: string) {
  const qcJobId = await laneJobId(workOrderId, WorkPlanJobLane.QUALITY_CHECK);
  await admin.completeJob(actors.manager, qcJobId, { ...meta(await version(workOrderId)), notes: 'QC aprobado.' });
  await admin.completeWorkOrder(actors.manager, workOrderId, meta(await version(workOrderId)));
}

type UserRow = Awaited<ReturnType<typeof loadUsers>>[number];

async function loadUsers() {
  return prisma.user.findMany({
    where: { active: true },
    include: { capabilities: { select: { capability: true } } },
    orderBy: { name: 'asc' },
  });
}

function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    pmAuthorized: user.pmAuthorized,
    capabilities: user.capabilities.map(({ capability }) => toSharedCapability(capability)),
    supabaseAuthId: user.supabaseAuthId,
  };
}

async function resolveActors(users: UserRow[]): Promise<Actors> {
  const has = (user: UserRow, capability: string) => user.capabilities.some((item) => item.capability === capability);
  const steps = await prisma.shopWorkflowStep.findMany({ where: { active: true } });
  const defaultOwner = (key: ShopWorkflowStepKey, capability: string) => {
    const ownerId = steps.find((step) => step.stepKey === key)?.defaultMechanicId;
    return users.find((user) => user.id === ownerId && has(user, capability));
  };

  const manager = users.find((user) => user.role === 'manager' && has(user, 'WORK_ORDERS_MANAGE') && has(user, 'YARD_OPERATIONS_MANAGE'))
    ?? users.find((user) => has(user, 'WORK_ORDERS_MANAGE') && has(user, 'YARD_OPERATIONS_MANAGE'));
  const pm = defaultOwner(ShopWorkflowStepKey.PM, 'MECHANIC_PM') ?? users.find((user) => user.role === 'mechanic' && has(user, 'MECHANIC_PM'));
  const standard = users.filter((user) => user.role === 'mechanic' && has(user, 'MECHANIC_STANDARD'));
  const alignment = defaultOwner(ShopWorkflowStepKey.ALIGNMENT, 'MECHANIC_STANDARD') ?? standard[0];
  const detailing = defaultOwner(ShopWorkflowStepKey.DETAILING, 'MECHANIC_STANDARD')
    ?? standard.find((user) => user.id !== alignment?.id);
  const general = standard.find((user) => user.id !== alignment?.id && user.id !== detailing?.id);

  const missing = Object.entries({ manager, pm, alignment, detailing, general }).filter(([, user]) => !user).map(([role]) => role);
  if (missing.length) throw new Error(`Cannot find an active user for: ${missing.join(', ')}`);
  return {
    manager: toAuthUser(manager!),
    pm: toAuthUser(pm!),
    alignment: toAuthUser(alignment!),
    detailing: toAuthUser(detailing!),
    general: toAuthUser(general!),
  };
}

async function pickTrucks(): Promise<TruckRow[]> {
  const select = { id: true, truckNumber: true, make: true, model: true, mileage: true } as const;
  if (trucksArg) {
    const numbers = trucksArg.split(',').map((value) => value.trim()).filter(Boolean);
    if (numbers.length !== SCENARIOS.length) throw new Error(`--trucks needs ${SCENARIOS.length} truck numbers, got ${numbers.length}`);
    const rows = await prisma.truck.findMany({ where: { truckNumber: { in: numbers } }, select });
    const missing = numbers.filter((number) => !rows.some((row) => row.truckNumber === number));
    if (missing.length) throw new Error(`Trucks not found: ${missing.join(', ')}`);
    return numbers.map((number) => rows.find((row) => row.truckNumber === number)!);
  }

  // Trucks with an odometer, so the PM keeps it unchanged; a finished PM also needs a part that fits.
  const candidates = await prisma.truck.findMany({ where: { mileage: { not: null } }, select, orderBy: { truckNumber: 'asc' } });
  const parts = await prisma.part.findMany({ where: { active: true, category: { active: true } }, include: { fitments: true } });
  const fits = (truck: TruckRow) => parts.some((part) =>
    (workOrders as unknown as { partFitsTruck: (f: unknown, t: unknown) => boolean }).partFitsTruck(part.fitments, truck));
  const picked: TruckRow[] = [];
  for (const scenario of SCENARIOS) {
    const truck = candidates.find((row) => !picked.includes(row) && (!scenario.needsFinishedPm || fits(row)));
    if (!truck) throw new Error(`Not enough trucks with mileage (and a fitting PM part) for scenario ${scenario.key}`);
    picked.push(truck);
  }
  return picked;
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://unknown').hostname;
  console.log(`Database host: ${host} (${local ? 'local' : 'production'})`);
  console.log(apply ? 'Mode: APPLY' : 'Mode: dry-run (pass --apply to write)');

  const users = await loadUsers();
  if (!local) {
    const roster = new Set(TEST_ROSTER.map((target) => target.email.toLowerCase()));
    const outside = users.filter((user) => !roster.has(user.email.trim().toLowerCase()));
    if (outside.length) {
      console.error(`Refusing: active users outside the test roster (${outside.map((user) => user.email).join(', ')}).`);
      console.error('Their Work Orders may be real. Run prisma:reset-test-roster first, or stop here.');
      process.exitCode = 1;
      return;
    }
  }

  const actors = await resolveActors(users);
  console.log('\nActors');
  for (const [role, user] of Object.entries(actors)) console.log(`  ${role.padEnd(10)} ${user.name} <${user.email}>`);

  const trucks = await pickTrucks();
  const [workOrderCount, openCount, assessments, serviceEvents, mileageAdjustments, activityLogs] = await Promise.all([
    prisma.workOrder.count(),
    prisma.workOrder.count({ where: { status: { in: ['created', 'in_progress', 'waiting_paused'] } } }),
    prisma.truckReadinessAssessment.count(),
    prisma.truckServiceStatusEvent.count(),
    prisma.truckMileageAdjustment.count(),
    prisma.activityLog.count({ where: activityWhere }),
  ]);
  console.log('\nDelete');
  console.log(`  Work Orders            ${workOrderCount} (${openCount} open) + their Jobs, labor, blockers, notes, team, PM service`);
  console.log(`  Readiness assessments  ${assessments}`);
  console.log(`  Service status events  ${serviceEvents} (Ready to Go / Return to Service)`);
  console.log(`  Mileage adjustments    ${mileageAdjustments}`);
  console.log(`  Activity Log rows      ${activityLogs}`);

  console.log('\nBuild');
  SCENARIOS.forEach((scenario, index) => {
    const truck = trucks[index];
    console.log(`  Truck ${truck.truckNumber.padEnd(6)} ${scenario.key.padEnd(20)} ${scenario.title}`);
  });

  if (!apply) {
    console.log('\nDry-run only. Nothing was written.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.deleteMany({ where: activityWhere });
    await tx.truckMileageAdjustment.deleteMany({});
    await tx.truckServiceStatusEvent.deleteMany({});
    await tx.truckReadinessAssessment.deleteMany({});
    await tx.workOrder.deleteMany({});
  }, { timeout: 60_000 });
  console.log('\nDeleted.');

  console.log('\nDemo');
  for (const [index, scenario] of SCENARIOS.entries()) {
    const truck = trucks[index];
    try {
      const id = await scenario.build(truck, actors);
      const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id }, select: { displayId: true, status: true } });
      console.log(`  ✓ Truck ${truck.truckNumber} · ${wo.displayId} · ${wo.status} · ${scenario.title}`);
      console.log(`      ${scenario.check}`);
    } catch (error) {
      console.error(`  ✗ Truck ${truck.truckNumber} · ${scenario.key}: ${describe(error)}`);
      process.exitCode = 1;
    }
  }
}

// Every Work Order and readiness entry; nothing else writes the Activity Log.
const activityWhere = {
  OR: [
    { workOrderId: { not: null } },
    {
      entityType: {
        in: ['work_order', 'work_order_job', 'pause_event', 'work_order_note', 'mechanic_assignment', 'pm_service', 'truck', 'readiness_assessment', 'readiness_requirement'],
      },
    },
  ],
};

function describe(error: unknown) {
  const response = (error as { getResponse?: () => unknown }).getResponse?.();
  if (response) return JSON.stringify(response);
  return error instanceof Error ? error.message : String(error);
}

main()
  .catch((error) => {
    console.error(describe(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
