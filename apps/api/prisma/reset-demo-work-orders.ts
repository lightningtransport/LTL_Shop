/**
 * Demo Work Orders: wipe every Work Order and the Truck state that hangs off it, then rebuild one
 * Truck per JTBD scenario (docs/SYSTEM.md §4).
 *
 *   npm run prisma:reset-demo-work-orders --workspace=@ltl-shop/api                      # dry-run, production
 *   npm run prisma:reset-demo-work-orders --workspace=@ltl-shop/api -- --apply           # writes, production
 *   npm run prisma:reset-demo-work-orders --workspace=@ltl-shop/api -- --local --apply   # writes, apps/api/.env
 *   ... -- --trucks=905,968,922,931,944,957,973,986,991                                   # pick the trucks (in scenario order)
 *   npm run prisma:demo-local --workspace=@ltl-shop/api                                    # local demo database, every scenario
 *
 * `--demo` (used by `prisma:demo-local`): the local `ltl_shop_demo` database (DEMO_DATABASE_URL), more trucks and
 * the extra scenarios of the mockups (official pause, external shop, helper, cancelled Job and Work Order, missing
 * steps, work request). It refuses any host other than this machine.
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
  JobExternalKind,
  PauseReason,
  Priority,
  WorkOrderNoteKind,
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
import { WORK_ORDER_ACTIVITY_WHERE, wipeWorkOrders } from './wipe-work-orders';

const demo = process.argv.includes('--demo');
const local = demo || process.argv.includes('--local');
const apply = process.argv.includes('--apply');
const trucksArg = process.argv.find((arg) => arg.startsWith('--trucks='))?.slice('--trucks='.length);

if (demo) {
  const url = process.env.DEMO_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ltl_shop_demo';
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname) || !/demo/i.test(parsed.pathname)) {
    console.error(`Refusing --demo on ${parsed.hostname}${parsed.pathname}: only a local database whose name contains "demo".`);
    process.exit(1);
  }
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
} else {
  const envFile = resolve(__dirname, local ? '../.env' : '../.env.production.local');
  if (!existsSync(envFile)) {
    console.error(`Missing ${envFile}. Put the ${local ? 'local' : 'production'} DATABASE_URL (and DIRECT_URL) there.`);
    process.exit(1);
  }
  config({ path: envFile, override: true });
}

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

/** `--demo` only: the other situations the mockups show. Inserted before the running PM (D2). */
const DEMO_SCENARIOS: Scenario[] = [
  {
    key: 'DEMO-paused',
    title: 'En pausa oficial: esperando aprobación',
    check: 'Manager: Dashboard "Blocked or paused" con Resume; la WO dice "Paused · Waiting for Approval".',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, { priority: Priority.HIGH, notes: 'El cliente debe aprobar el presupuesto.' });
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await workOrders.start(actors.alignment, id);
      await admin.pauseWorkOrder(actors.manager, id, { reason: PauseReason.WAITING_FOR_APPROVAL, notes: 'Presupuesto enviado al cliente.' });
      return id;
    },
  },
  {
    key: 'DEMO-external-part',
    title: 'Pieza en taller externo',
    check: 'La fila del Job dice "Part out" con la nota y "Returned"; el Truck lo muestra como externo.',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [{ category: 'Electrical & Starting', job: 'Battery', assignee: actors.general }]);
      await assignMandatory(actors, id);
      await finishJob(actors.alignment, id, WorkPlanJobLane.ALIGNMENT, 'Alineación dentro de especificación.');
      await finishJob(actors.detailing, id, WorkPlanJobLane.DETAILING, 'Cabina y exterior limpios.');
      await admin.sendJobExternal(actors.manager, id, await jobId(id, 'Battery'), { kind: JobExternalKind.PART, note: 'Alternador a Diesel Pro, regresa el viernes.', ...meta(await version(id)) });
      return id;
    },
  },
  {
    key: 'DEMO-external-truck',
    title: 'Camión fuera del taller (taller externo)',
    check: 'Yard: "Out of shop · Air Bag Replacement"; la WO dice "Truck out".',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, { priority: Priority.CRITICAL });
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [{ category: 'Suspension & Steering', job: 'Air Bag Replacement', assignee: actors.general }]);
      await assignMandatory(actors, id);
      await admin.sendJobExternal(actors.manager, id, await jobId(id, 'Air Bag Replacement'), { kind: JobExternalKind.TRUCK, note: 'Body shop en la 5ta, regresa el lunes.', ...meta(await version(id)) });
      return id;
    },
  },
  {
    key: 'DEMO-helper',
    title: 'Job con ayudante',
    check: 'Bajo Brake Inspection aparece "Brake Inspection · helper" con "Helps …".',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [{ category: 'Air & Brake System', job: 'Brake Inspection', assignee: actors.general }]);
      await assignMandatory(actors, id);
      await admin.addHelperJob(actors.manager, id, await jobId(id, 'Brake Inspection'), { mechanicId: actors.detailing.id, ...meta(await version(id)) });
      return id;
    },
  },
  {
    key: 'DEMO-cancelled-job-request',
    title: 'Job cancelado y pedido de trabajo abierto',
    check: 'Lights en "Done and cancelled" con su motivo; Notas con un pedido "Work request · Open" y Mark handled.',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [
        { category: 'Electrical & Starting', job: 'Lights', assignee: actors.general },
        { category: 'Air & Brake System', job: 'Air Leak', assignee: actors.general },
      ]);
      await assignMandatory(actors, id);
      await admin.cancelJob(actors.manager, await jobId(id, 'Lights'), { reason: 'Las luces funcionan; fue un fusible.', ...meta(await version(id)) });
      await admin.addNote(actors.manager, id, { body: 'Revisar también la presión de las llantas.' });
      await workOrders.addNote(actors.general, id, { kind: WorkOrderNoteKind.WORK_REQUEST, body: 'El guardafango izquierdo está roto, ¿lo cambiamos?' });
      return id;
    },
  },
  {
    key: 'DEMO-missing-steps',
    title: 'Le falta un paso obligatorio',
    check: 'Truck y WO: "This Work Order is missing: Detailing" con "Add missing steps".',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      // Demo only: a Work Order from before the mandatory steps (the API never removes one).
      await prisma.workOrderJob.delete({ where: { id: await laneJobId(id, WorkPlanJobLane.DETAILING) } });
      return id;
    },
  },
  {
    key: 'DEMO-cancelled',
    title: 'Work Order cancelado',
    check: 'La WO dice "Cancelled" con su motivo; el Truck queda sin WO abierta.',
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await admin.cancelWorkOrder(actors.manager, id, { reason: 'Duplicado: el camión ya tenía otra orden.', ...meta(await version(id)) });
      return id;
    },
  },
];

/** `--demo`: more trucks (a few stay with no Work Order: "No open Work Order"). */
const DEMO_TRUCKS = [
  { truckNumber: '601', make: 'Mack', model: 'Anthem', year: 2024, mileage: 367393, vin: '1M1AN4GY0RM000601', location: 'Orient Rd, Tampa, FL 33610' },
  { truckNumber: '602', make: 'Volvo', model: 'VNL 860', year: 2024, mileage: 212040, vin: '4V4NC9EH0RN000602', location: 'High Desert Rd, Barstow, CA 92347' },
  { truckNumber: '603', make: 'Freightliner', model: 'Cascadia', year: 2023, mileage: 288610, vin: '3AKJHHDR0PS000603', location: 'Orient Rd, Tampa, FL 33610' },
  { truckNumber: '604', make: 'Kenworth', model: 'T680', year: 2025, mileage: 98120, vin: '1XKYD49X0SJ000604', location: null },
  { truckNumber: '605', make: 'Volvo', model: 'VNL 760', year: 2022, mileage: 401200, vin: '4V4NC9EH0NN000605', location: 'I-75 Exit 260, Tampa, FL' },
  { truckNumber: '606', make: 'Freightliner', model: 'Cascadia', year: 2024, mileage: 154300, vin: '3AKJHHDR0RS000606', location: null },
  { truckNumber: '607', make: 'Kenworth', model: 'T680', year: 2023, mileage: 176500, vin: '1XKYD49X0PJ000607', location: null },
  { truckNumber: '608', make: 'Volvo', model: 'VNL 860', year: 2025, mileage: 45200, vin: '4V4NC9EH0SN000608', location: 'Orient Rd, Tampa, FL 33610' },
  { truckNumber: '609', make: 'Freightliner', model: 'Cascadia', year: 2022, mileage: 333000, vin: '3AKJHHDR0NS000609', location: null },
  { truckNumber: '610', make: 'Peterbilt', model: '579', year: 2026, mileage: 21000, vin: '1XPBD49X6TD000610', location: null },
];

async function upsertDemoTrucks() {
  for (const truck of DEMO_TRUCKS) {
    const data = {
      make: truck.make,
      model: truck.model,
      year: truck.year,
      mileage: truck.mileage,
      vin: truck.vin,
      company: 'Lightning',
      owner: 'Demo Fleet LLC',
      samsaraTruckLocation: truck.location,
      samsaraLastConnectedDate: truck.location ? new Date() : null,
    };
    await prisma.truck.upsert({ where: { truckNumber: truck.truckNumber }, update: data, create: { truckNumber: truck.truckNumber, ...data } });
  }
}


function meta(expectedVersion: number) {
  return { expectedVersion, idempotencyKey: randomUUID() };
}

/** With `--demo`, the extra scenarios go before the last one (the running PM, D2). */
function activeScenarios() {
  return demo ? [...SCENARIOS.slice(0, -1), ...DEMO_SCENARIOS, SCENARIOS[SCENARIOS.length - 1]] : SCENARIOS;
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
    if (numbers.length !== activeScenarios().length) throw new Error(`--trucks needs ${activeScenarios().length} truck numbers, got ${numbers.length}`);
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
  for (const scenario of activeScenarios()) {
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

  if (demo && apply) await upsertDemoTrucks();
  const trucks = await pickTrucks();
  const [workOrderCount, openCount, assessments, serviceEvents, mileageAdjustments, activityLogs] = await Promise.all([
    prisma.workOrder.count(),
    prisma.workOrder.count({ where: { status: { in: ['created', 'in_progress', 'waiting_paused'] } } }),
    prisma.truckReadinessAssessment.count(),
    prisma.truckServiceStatusEvent.count(),
    prisma.truckMileageAdjustment.count(),
    prisma.activityLog.count({ where: WORK_ORDER_ACTIVITY_WHERE }),
  ]);
  console.log('\nDelete');
  console.log(`  Work Orders            ${workOrderCount} (${openCount} open) + their Jobs, labor, blockers, notes, team, PM service`);
  console.log(`  Readiness assessments  ${assessments}`);
  console.log(`  Service status events  ${serviceEvents} (Ready to Go / Return to Service)`);
  console.log(`  Mileage adjustments    ${mileageAdjustments}`);
  console.log(`  Activity Log rows      ${activityLogs}`);

  console.log('\nBuild');
  activeScenarios().forEach((scenario, index) => {
    const truck = trucks[index];
    console.log(`  Truck ${truck.truckNumber.padEnd(6)} ${scenario.key.padEnd(20)} ${scenario.title}`);
  });

  if (!apply) {
    console.log('\nDry-run only. Nothing was written.');
    return;
  }

  await prisma.$transaction((tx) => wipeWorkOrders(tx), { timeout: 60_000 });
  console.log('\nDeleted.');

  console.log('\nDemo');
  for (const [index, scenario] of activeScenarios().entries()) {
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
