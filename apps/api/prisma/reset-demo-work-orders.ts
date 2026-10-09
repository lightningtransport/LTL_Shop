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
 * `--demo` (used by `prisma:demo-local`): the local `ltl_shop_demo` database (DEMO_DATABASE_URL), more trucks, the
 * extra scenarios of the mockups (official pause, external shop, helper, cancelled Job and Work Order, missing steps,
 * work request, Quality Check by Safety, team queue, a clock left running yesterday), about four months of finished
 * visits (`demo-history.ts`) and Parts & costs in use (`demo-parts-costs.ts`). Some open Work Orders are moved a few
 * days back (`demo-time.ts`). It also wipes Parts & costs first. It refuses any host other than this machine.
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
import { ShopWorkflowService } from '../src/admin/shop-workflow.service';
import { LaborClockService } from '../src/work-orders/labor-clock.service';
import { QualityCheckService } from '../src/quality-check/quality-check.service';
import { PurchasesService } from '../src/parts-costs/purchases.service';
import { OutsideRepairsService } from '../src/parts-costs/outside-repairs.service';
import { PartsCatalogService } from '../src/parts-costs/parts-catalog.service';
import { InvoiceFiles } from '../src/parts-costs/invoice-files';
import { toSharedCapability } from '../src/auth/capabilities';
import type { AuthUser } from '../src/auth/auth.guard';
import { TEST_ROSTER } from '../src/admin/test-roster-plan';
import { WORK_ORDER_ACTIVITY_WHERE, wipeWorkOrders } from './wipe-work-orders';
import { wipePartsCosts } from './wipe-parts-costs';
import type { Actors, DemoKit, ShopJobInput, TruckRow } from './demo-kit';
import { buildHistory } from './demo-history';
import { buildPartsCosts, type CurrentJobs } from './demo-parts-costs';
import { retime, shopMinutesNow, shopToday, workdaysAgo } from './demo-time';

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
// --demo: the day close and one clock per mechanic, as the API runs them (D20, D21).
const clock = demo ? new LaborClockService(prisma, activity) : undefined;
const workOrders = new WorkOrdersService(prisma, activity, clock);
const yardOperations = new YardOperationsService(prisma, new TrucksService(prisma), activity);
const admin = new AdminService(prisma, activity, workOrders, yardOperations, clock);
const workPlan = new YardWorkPlanService(prisma, workOrders, yardOperations, clock);
const qualityCheck = new QualityCheckService(prisma, activity);
const shopWorkflow = new ShopWorkflowService(prisma);

type Scenario = {
  key: string;
  title: string;
  check: string;
  needsFinishedPm?: boolean;
  /** --demo: the Work Order happened this many workdays ago (`retime`), from `startMinutes` (shop time). */
  backdate?: { workdays: number; startMinutes?: number };
  build: (truck: TruckRow, actors: Actors) => Promise<string>;
};

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
    backdate: { workdays: 2 },
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
    backdate: { workdays: 2 },
    build: async (truck, actors) => {
      // Not the mechanic of "Trabajo en curso": a clock runs on one truck at a time (D21).
      const mechanic = actors.generals[1] ?? actors.general;
      const id = await createWorkOrder(actors, truck, {
        priority: Priority.CRITICAL,
        notes: 'Tiene carga programada para mañana.',
      });
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [
        { category: 'Suspension & Steering', job: 'Air Bag Replacement', assignee: mechanic },
        { category: 'Electrical & Starting', job: 'Battery', assignee: mechanic },
      ]);
      await assignMandatory(actors, id);
      await workOrders.start(mechanic, id);
      await workOrders.completeJob(mechanic, id, await jobId(id, 'Battery'), { notes: 'Batería nueva instalada.' });
      await workOrders.reportBlocker(mechanic, id, {
        jobId: await jobId(id, 'Air Bag Replacement'),
        reason: BlockerReason.WAITING_FOR_PARTS,
        notes: 'Falta la bolsa de aire trasera del lado del conductor.',
      });
      const blocker = await prisma.pauseEvent.findFirstOrThrow({
        where: { workOrderId: id, isOfficialPause: false, resolvedAt: null },
      });
      await workOrders.addBlockerNote(mechanic, id, blocker.id, { body: 'Pedida al proveedor; dicen que llega mañana.' });
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
    backdate: { workdays: 1 },
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
    check: 'Yard: "Out of shop · Air Bag Replacement"; la WO dice "Truck out". Outside repairs: su factura está ligada al Job.',
    backdate: { workdays: 3 },
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
    backdate: { workdays: 1 },
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
  {
    key: 'DEMO-qc-critical',
    title: 'Solo falta QC (Critical)',
    check: 'Safety: primero en "To review" por ser Critical; Take y Approve o Return.',
    needsFinishedPm: true,
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, { priority: Priority.CRITICAL, notes: 'Sale mañana temprano.' });
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await finishAllButQc(actors, truck, id);
      return id;
    },
  },
  {
    key: 'DEMO-qc-high',
    title: 'Solo falta QC (High)',
    check: 'Safety: segundo en "To review".',
    needsFinishedPm: true,
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, { priority: Priority.HIGH });
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      // Not Anthony: his clock runs on "Trabajo en curso" (D21).
      const mechanic = actors.generals[1] ?? actors.general;
      await addShopJobs(actors, truck, [{ category: 'Tires & Wheels', job: 'Tire Rotation', assignee: mechanic }]);
      await assignMandatory(actors, id);
      await finishAllButQc(actors, truck, id);
      await workOrders.start(mechanic, id);
      await workOrders.completeJob(mechanic, id, await jobId(id, 'Tire Rotation'), { notes: 'Rotación hecha, presión ajustada.' });
      return id;
    },
  },
  {
    key: 'DEMO-qc-taken',
    title: 'QC tomado por Safety 2',
    check: 'Safety 2 lo tiene como suyo (Approve, Return, Let go); Safety 1 lo ve tomado por otra persona.',
    needsFinishedPm: true,
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await finishAllButQc(actors, truck, id);
      await qualityCheck.take(actors.safety[1] ?? actors.safety[0], id);
      return id;
    },
  },
  {
    key: 'DEMO-qc-returned',
    title: 'Devuelto por Safety',
    check: 'Safety 1 lo devolvió por la alineación: Safety lo ve en "Returned"; el Manager lo ve bloqueado con la nota y lo resuelve.',
    needsFinishedPm: true,
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await finishAllButQc(actors, truck, id);
      await qualityCheck.take(actors.safety[0], id);
      await qualityCheck.returnTruck(actors.safety[0], id, {
        notes: 'Sigue jalando a la derecha en la prueba de manejo.',
        jobId: await laneJobId(id, WorkPlanJobLane.ALIGNMENT),
      });
      return id;
    },
  },
  {
    key: 'DEMO-qc-approved',
    title: 'QC aprobado por Safety: listo para cerrar',
    check: 'Dashboard "Ready to close"; el Manager cierra la WO desde el Truck o la WO.',
    needsFinishedPm: true,
    build: async (truck, actors) => {
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id);
      await finishAllButQc(actors, truck, id);
      await qualityCheck.take(actors.safety[0], id);
      await qualityCheck.approve(actors.safety[0], id);
      return id;
    },
  },
  {
    key: 'DEMO-yesterday-running',
    title: 'Reloj que quedó corriendo ayer',
    check: 'El mecánico ve "Ayer quedó en curso": el cierre del día cortó su tiempo a las 5:00 p.m.; Continue lo retoma.',
    backdate: { workdays: 1, startMinutes: 8 * 60 },
    build: async (truck, actors) => {
      const mechanic = actors.generals[2] ?? actors.generals[1] ?? actors.general;
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.ISSUES_FOUND);
      await addShopJobs(actors, truck, [{ category: 'Air & Brake System', job: 'Air Lines', assignee: mechanic }]);
      await assignMandatory(actors, id);
      await workOrders.start(mechanic, id);
      return id;
    },
  },
  {
    key: 'DEMO-team-queue',
    title: 'Detailing en la cola del equipo',
    check: 'Setup: Detailing tiene equipo de dos. Los dos ven el Job en "Team queue" y cualquiera lo toma.',
    build: async (truck, actors) => {
      await shopWorkflow.update(actors.manager, { steps: [{ stepKey: ShopWorkflowStepKey.DETAILING, memberIds: [actors.detailing.id, actors.general.id] }] });
      const id = await createWorkOrder(actors, truck, {});
      await inspect(actors, truck, WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
      await assignMandatory(actors, id, [WorkPlanJobLane.DETAILING]);
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
  { truckNumber: '611', make: 'Volvo', model: 'VNL 860', year: 2023, mileage: 254300, vin: '4V4NC9EH0PN000611', location: null },
  { truckNumber: '612', make: 'Freightliner', model: 'Cascadia', year: 2024, mileage: 132700, vin: '3AKJHHDR0RS000612', location: 'Orient Rd, Tampa, FL 33610' },
  { truckNumber: '613', make: 'Mack', model: 'Anthem', year: 2023, mileage: 298400, vin: '1M1AN4GY0PM000613', location: null },
  { truckNumber: '614', make: 'Volvo', model: 'VNL 760', year: 2024, mileage: 118900, vin: '4V4NC9EH0RN000614', location: null },
  { truckNumber: '615', make: 'Freightliner', model: 'Cascadia', year: 2022, mileage: 377100, vin: '3AKJHHDR0NS000615', location: null },
  { truckNumber: '616', make: 'Mack', model: 'Anthem', year: 2025, mileage: 76500, vin: '1M1AN4GY0SM000616', location: null },
  { truckNumber: '617', make: 'Kenworth', model: 'T680', year: 2024, mileage: 165800, vin: '1XKYD49X0RJ000617', location: null },
];

/** --demo: a mechanic who left (People → inactive). Not in any scenario. */
const DEMO_INACTIVE_MECHANIC = { email: 'luis@lightning.local', name: 'Luis' };

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
  jobs: ShopJobInput[],
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
async function assignMandatory(actors: Actors, workOrderId: string, skip: WorkPlanJobLane[] = []) {
  const owners: Array<[WorkPlanJobLane, AuthUser]> = [
    [WorkPlanJobLane.PM, actors.pm],
    [WorkPlanJobLane.ALIGNMENT, actors.alignment],
    [WorkPlanJobLane.DETAILING, actors.detailing],
  ];
  for (const [lane, owner] of owners) {
    if (skip.includes(lane)) continue;
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

async function finishPm(actors: Actors, truck: TruckRow, workOrderId: string, options: { observedMileage?: number; categories?: number } = {}) {
  const pmJobId = await laneJobId(workOrderId, WorkPlanJobLane.PM);
  await workOrders.startPmJob(actors.pm, workOrderId, pmJobId);
  const service = await workOrders.getPmService(actors.pm, workOrderId);
  const categories = service.categories.filter((item) => item.parts.length).slice(0, options.categories ?? 1);
  if (!categories.length) throw new Error(`No PM part fits truck ${truck.truckNumber}`);
  await workOrders.updatePmService(actors.pm, workOrderId, {
    observedMileage: options.observedMileage ?? truck.mileage ?? 0,
    selections: categories.map((category) => ({ partCategoryId: category.id, partId: category.parts[0].id })),
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
  // Anthony first when he is there: the demo's general mechanic (docs/reference/DEMO.md). Cristian (the owner) last.
  const rank = (user: UserRow) => (user.email.startsWith('anthony@') ? 0 : user.email.startsWith('cristian@') ? 2 : 1);
  const generals = standard
    .filter((user) => user.id !== alignment?.id && user.id !== detailing?.id && user.role === 'mechanic')
    .sort((left, right) => rank(left) - rank(right));
  const general = generals[0];
  const safety = users.filter((user) => user.role === 'mechanic' && has(user, 'QUALITY_CHECK_PERFORM'));

  const missing = Object.entries({ manager, pm, alignment, detailing, general }).filter(([, user]) => !user).map(([role]) => role);
  if (demo && !safety.length) missing.push('safety');
  if (missing.length) throw new Error(`Cannot find an active user for: ${missing.join(', ')}`);
  return {
    manager: toAuthUser(manager!),
    pm: toAuthUser(pm!),
    alignment: toAuthUser(alignment!),
    detailing: toAuthUser(detailing!),
    general: toAuthUser(general!),
    generals: generals.map(toAuthUser),
    safety: safety.map(toAuthUser),
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

const demoKit: DemoKit = {
  prisma, workOrders, admin, workPlan, qualityCheck, shopWorkflow,
  purchases: new PurchasesService(prisma, activity, new InvoiceFiles(null)),
  outsideRepairs: new OutsideRepairsService(prisma, activity),
  partsCatalog: new PartsCatalogService(prisma, activity),
  meta, version, createWorkOrder, inspect, addShopJobs, jobId, laneJobId, assignMandatory, finishJob, finishPm,
};

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
  for (const [role, value] of Object.entries(actors)) {
    for (const user of [value].flat()) console.log(`  ${role.padEnd(10)} ${user.name} <${user.email}>`);
  }

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

  await prisma.$transaction(async (tx) => {
    if (demo) await wipePartsCosts(tx);
    await wipeWorkOrders(tx);
  }, { timeout: 60_000 });
  console.log(demo ? '\nDeleted (and Parts & costs).' : '\nDeleted.');

  let history: Awaited<ReturnType<typeof buildHistory>> | null = null;
  if (demo) {
    await prisma.user.upsert({
      where: { email: DEMO_INACTIVE_MECHANIC.email },
      update: { name: DEMO_INACTIVE_MECHANIC.name, role: 'mechanic', active: false },
      create: { ...DEMO_INACTIVE_MECHANIC, role: 'mechanic', active: false, capabilities: { create: [{ capability: 'MECHANIC_STANDARD' }] } },
    });
    // The step teams start empty (Quality Check keeps Safety); DEMO-team-queue gives Detailing a team.
    await shopWorkflow.update(actors.manager, {
      steps: [ShopWorkflowStepKey.PM, ShopWorkflowStepKey.ALIGNMENT, ShopWorkflowStepKey.DETAILING].map((stepKey) => ({ stepKey, memberIds: [] })),
    });
    const scenarios = activeScenarios();
    const spare = (await prisma.truck.findMany({
      where: { mileage: { not: null }, id: { notIn: trucks.map((truck) => truck.id) } },
      select: { id: true, truckNumber: true, make: true, model: true, mileage: true },
      orderBy: { truckNumber: 'asc' },
    }));
    const withHistory = [...trucks, ...spare].filter((truck) => truck.truckNumber !== '610');
    const recent = [
      ...spare,
      ...['M04-in-service', 'DEMO-helper'].map((key) => trucks[scenarios.findIndex((scenario) => scenario.key === key)]),
    ].filter(Boolean);
    console.log('\nHistory (about four months)');
    history = await buildHistory(demoKit, actors, withHistory, recent);
  }

  console.log('\nDemo');
  const current: CurrentJobs = {};
  const todaySince = new Date();
  for (const [index, scenario] of activeScenarios().entries()) {
    const truck = trucks[index];
    try {
      const since = new Date();
      const id = await scenario.build(truck, actors);
      if (demo && scenario.backdate) {
        await retime(prisma, since, workdaysAgo(scenario.backdate.workdays), { startMinutes: scenario.backdate.startMinutes ?? 7 * 60 + 40 });
      }
      if (scenario.key === 'DEMO-external-truck') current.truckOut = { truck, jobId: await jobId(id, 'Air Bag Replacement') };
      if (scenario.key === 'M03-blocked') current.waitingForParts = { truck };
      const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id }, select: { displayId: true, status: true } });
      console.log(`  ✓ Truck ${truck.truckNumber} · ${wo.displayId} · ${wo.status} · ${scenario.title}`);
      console.log(`      ${scenario.check}`);
    } catch (error) {
      console.error(`  ✗ Truck ${truck.truckNumber} · ${scenario.key}: ${describe(error)}`);
      process.exitCode = 1;
    }
  }

  if (demo) {
    // Today's Work Orders happened this morning, not in the same second: spread from 7:00 up to now.
    const end = shopMinutesNow() - 2;
    await retime(prisma, todaySince, shopToday(), { startMinutes: Math.max(0, Math.min(7 * 60, end - 60)), endMinutes: end });
  }

  if (demo && history) {
    // The API closes yesterday's clock on its first read; do it now so the data is as the app shows it.
    await clock!.closeDue();
    const summary = await buildPartsCosts(demoKit, actors, history, current);
    console.log('\nParts & costs');
    console.log(`  ${summary.vendors} vendors (1 inactive), ${summary.partsPriced} parts priced (${summary.partsWithVendor} with a usual vendor), ${summary.purchases} purchases (1 corrected, 1 voided), ${summary.outsideRepairs} outside repairs`);
    const trucksWithoutWorkOrder = await prisma.truck.findMany({
      where: { workOrders: { none: { status: { in: ['created', 'in_progress', 'waiting_paused'] } } } },
      select: { truckNumber: true },
      orderBy: { truckNumber: 'asc' },
    });
    console.log(`\nNo open Work Order: ${trucksWithoutWorkOrder.map((truck) => truck.truckNumber).join(', ')}`);
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
