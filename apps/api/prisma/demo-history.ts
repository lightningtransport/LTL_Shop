/**
 * Demo only (`reset-demo-work-orders --demo`): about four months of finished visits, so the screens that look back
 * have something to show — Repair history, Truck → Costs by month, labor hours, "Last PM" and "Most used on this model",
 * mileage history, the mechanics' Completed (today, yesterday, earlier), Safety's Done and the Dashboard's last 7 days.
 *
 * Each visit is the whole cycle through the API services: Work Order, arrival inspection, repairs by the general
 * mechanics, PM, Alignment, Detailing, Quality Check by Safety, close and Return to Service. Then `retime` moves it to
 * its day. Visits are built oldest first, so Work Order numbers follow the dates.
 */
import { BlockerReason, JobExternalKind, Priority, WorkPlanInspectionOutcome, WorkPlanJobLane } from '@ltl-shop/shared';
import type { LocalDate } from '../src/common/shop-time';
import type { AuthUser } from '../src/auth/auth.guard';
import type { Actors, DemoKit, TruckRow } from './demo-kit';
import { daysAgo, isoDay, retime, seededRandom, workdaysAgo } from './demo-time';

/** Repairs the history picks from: catalog Job and the mechanic's closing note. */
const REPAIRS: Array<{ category: string; job: string; note: string }> = [
  { category: 'Air & Brake System', job: 'Brake Chambers', note: 'Cambié las dos cámaras del eje trasero.' },
  { category: 'Air & Brake System', job: 'Air Leak', note: 'Fuga en la línea del tanque; conector nuevo.' },
  { category: 'Electrical & Starting', job: 'Alternator', note: 'Alternador nuevo, carga 14.1 V.' },
  { category: 'Electrical & Starting', job: 'Lights', note: 'Dos luces de posición cambiadas.' },
  { category: 'Tires & Wheels', job: 'Tires', note: 'Dos llantas de tracción nuevas.' },
  { category: 'Tires & Wheels', job: 'Wheel Seals', note: 'Retén del eje 2, lado pasajero.' },
  { category: 'Cooling System', job: 'Cooling Hoses', note: 'Manguera superior del radiador.' },
  { category: 'Engine & Emissions', job: 'DPF/DEF Service', note: 'Limpieza de DPF y regeneración forzada.' },
  { category: 'Suspension & Steering', job: 'Shock Replacement', note: 'Amortiguadores delanteros nuevos.' },
  { category: 'Cab, Body & Glass', job: 'Mirrors', note: 'Espejo del conductor nuevo.' },
  { category: 'HVAC / A/C', job: 'A/C', note: 'Recarga de refrigerante y prueba de fugas.' },
  { category: 'Transmission & Drivetrain', job: '5th Wheel', note: 'Engrase y ajuste de la quinta rueda.' },
];

/** The repair a visit sent to an outside shop (tied to an outside repair invoice in `demo-parts-costs.ts`). */
const EXTERNAL_REPAIR = { category: 'Transmission & Drivetrain', job: 'Transmission', note: 'Diesel Pro reconstruyó la transmisión.' };

type Variant = 'plain' | 'blocker' | 'qc-return' | 'external';
type Visit = { truck: TruckRow; day: LocalDate; variant: Variant; observedMileage: number; recent: boolean };

export type HistoryWorkOrder = {
  id: string;
  truck: TruckRow;
  day: string;
  repairs: Array<{ jobId: string; job: string; category: string }>;
};

export type HistoryResult = {
  workOrders: HistoryWorkOrder[];
  /** The visit whose Job went to an outside shop and came back (about a month ago). */
  external: { workOrderId: string; jobId: string; truck: TruckRow; day: string } | null;
};

/**
 * `trucks`: the trucks with history (1–3 visits each, 10 to ~120 days ago). `recentTrucks`: trucks that also had a
 * visit in the last few workdays — none of them may have a Work Order that the demo moves into the past.
 */
export async function buildHistory(kit: DemoKit, actors: Actors, trucks: TruckRow[], recentTrucks: TruckRow[]): Promise<HistoryResult> {
  const random = seededRandom(20261009);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

  // Dates first: every truck's visits, plus the recent ones.
  const plan: Array<Omit<Visit, 'observedMileage'>> = [];
  trucks.forEach((truck, index) => {
    const count = [3, 2, 2, 1][index % 4];
    const days: number[] = [];
    for (let attempt = 0; days.length < count && attempt < 50; attempt += 1) {
      const candidate = 10 + Math.floor(random() * 110);
      if (days.every((day) => Math.abs(day - candidate) >= 18)) days.push(candidate);
    }
    for (const back of days) plan.push({ truck, day: daysAgo(back), variant: 'plain', recent: false });
  });
  recentTrucks.forEach((truck, index) => {
    plan.push({ truck, day: workdaysAgo([1, 1, 2, 3, 4][index % 5]), variant: 'plain', recent: true });
  });
  plan.sort((left, right) => isoDay(left.day).localeCompare(isoDay(right.day)));

  // Variants: one outside repair about a month ago, a few blockers, two returns from Safety (one this week).
  const older = plan.filter((visit) => !visit.recent);
  const monthAgo = isoDay(daysAgo(30));
  const external = older.reduce((best, visit) =>
    Math.abs(Date.parse(isoDay(visit.day)) - Date.parse(monthAgo)) < Math.abs(Date.parse(isoDay(best.day)) - Date.parse(monthAgo)) ? visit : best);
  external.variant = 'external';
  for (const visit of older.filter((item) => item.variant === 'plain').filter((_, index) => index % 5 === 2)) visit.variant = 'blocker';
  const returned = older.filter((item) => item.variant === 'plain');
  if (returned.length) returned[Math.floor(returned.length / 2)].variant = 'qc-return';
  const recentPlain = plan.find((item) => item.recent);
  if (recentPlain) recentPlain.variant = 'qc-return';

  // Mileage climbs a little every visit; the truck ends a bit below its odometer (the next PM reads it again).
  const visits: Visit[] = [];
  for (const truck of new Set(plan.map((visit) => visit.truck))) {
    const ofTruck = plan.filter((visit) => visit.truck === truck);
    const current = truck.mileage ?? 0;
    const step = 7000 + Math.floor(random() * 6000);
    ofTruck.forEach((visit, index) => {
      const observedMileage = Math.max(1000, current - (ofTruck.length - index) * step + Math.floor(step * 0.6));
      visits.push({ ...visit, observedMileage });
    });
    await kit.prisma.truck.update({ where: { id: truck.id }, data: { mileage: Math.max(500, (visits.find((item) => item.truck === truck)?.observedMileage ?? current) - 800) } });
  }
  visits.sort((left, right) => isoDay(left.day).localeCompare(isoDay(right.day)));

  const result: HistoryResult = { workOrders: [], external: null };
  for (const [index, visit] of visits.entries()) {
    const since = new Date();
    const mechanic = actors.generals[index % actors.generals.length];
    const built = await buildVisit(kit, actors, visit, mechanic, pick, random);
    await retime(kit.prisma, since, visit.day, { random, startMinutes: 7 * 60 + 30 + Math.floor(random() * 60) });
    result.workOrders.push({ id: built.id, truck: visit.truck, day: isoDay(visit.day), repairs: built.repairs });
    if (visit.variant === 'external' && built.externalJobId) {
      result.external = { workOrderId: built.id, jobId: built.externalJobId, truck: visit.truck, day: isoDay(visit.day) };
    }
    const wo = await kit.prisma.workOrder.findUniqueOrThrow({ where: { id: built.id }, select: { displayId: true } });
    console.log(`  ✓ ${isoDay(visit.day)} · Truck ${visit.truck.truckNumber} · ${wo.displayId}${visit.variant === 'plain' ? '' : ` · ${visit.variant}`}`);
  }
  return result;
}

async function buildVisit(
  kit: DemoKit,
  actors: Actors,
  visit: Visit,
  mechanic: AuthUser,
  pick: <T>(items: T[]) => T,
  random: () => number,
) {
  const { admin, workOrders, qualityCheck } = kit;
  const priority = random() < 0.15 ? Priority.HIGH : Priority.NORMAL;
  const id = await kit.createWorkOrder(actors, visit.truck, { priority });

  const repairs = visit.variant === 'external'
    ? [EXTERNAL_REPAIR]
    : random() < 0.25 ? [] : [...new Set([pick(REPAIRS), ...(random() < 0.4 ? [pick(REPAIRS)] : [])])];
  await kit.inspect(actors, visit.truck, repairs.length ? WorkPlanInspectionOutcome.ISSUES_FOUND : WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
  if (repairs.length) {
    await kit.addShopJobs(actors, visit.truck, repairs.map((repair) => ({ category: repair.category, job: repair.job, assignee: mechanic })));
  }
  await kit.assignMandatory(actors, id);
  if (random() < 0.3) await admin.addNote(actors.manager, id, { body: pick(['Revisar presión de llantas al salir.', 'El conductor pide revisar el aire acondicionado.', 'Prioridad: carga el lunes.']) });

  // The repairs, by the general mechanic.
  const repairJobs: HistoryWorkOrder['repairs'] = [];
  let externalJobId: string | null = null;
  for (const [index, repair] of repairs.entries()) {
    const jobId = await kit.jobId(id, repair.job);
    repairJobs.push({ jobId, job: repair.job, category: repair.category });
    if (visit.variant === 'external') {
      await admin.sendJobExternal(actors.manager, id, jobId, { kind: JobExternalKind.TRUCK, note: 'Transmisión a Diesel Pro.', ...kit.meta(await kit.version(id)) });
      await admin.returnJobExternal(actors.manager, id, jobId, { outcome: 'complete', ...kit.meta(await kit.version(id)) });
      externalJobId = jobId;
      continue;
    }
    await startIfStopped(kit, mechanic, id);
    if (visit.variant === 'blocker' && index === 0) {
      await workOrders.reportBlocker(mechanic, id, { jobId, reason: BlockerReason.WAITING_FOR_PARTS, notes: 'Falta la pieza; pedida al proveedor.' });
      const blocker = await kit.prisma.pauseEvent.findFirstOrThrow({ where: { workOrderId: id, isOfficialPause: false, resolvedAt: null } });
      await admin.resolveBlocker(actors.manager, id, blocker.id, { notes: 'La pieza llegó.' });
      await startIfStopped(kit, mechanic, id);
    }
    await workOrders.completeJob(mechanic, id, jobId, { notes: repair.note });
  }

  await kit.finishPm(actors, visit.truck, id, { observedMileage: visit.observedMileage, categories: 2 + Math.floor(random() * 2) });
  await kit.finishJob(actors.alignment, id, WorkPlanJobLane.ALIGNMENT, 'Alineación dentro de especificación.');
  await kit.finishJob(actors.detailing, id, WorkPlanJobLane.DETAILING, 'Cabina y exterior limpios.');

  // Quality Check by Safety.
  const [first, second] = [actors.safety[0], actors.safety[1] ?? actors.safety[0]];
  const reviewer = random() < 0.5 ? first : second;
  if (visit.variant === 'qc-return') {
    await qualityCheck.take(first, id);
    const detailing = await kit.laneJobId(id, WorkPlanJobLane.DETAILING);
    await qualityCheck.returnTruck(first, id, { notes: 'Quedó sucio el piso de la cabina.', jobId: detailing });
    const blocker = await kit.prisma.pauseEvent.findFirstOrThrow({ where: { workOrderId: id, blockerReason: BlockerReason.QUALITY_CHECK_FAILED, resolvedAt: null } });
    await admin.resolveBlocker(actors.manager, id, blocker.id, { notes: 'Detailing lo limpió otra vez.' });
    await qualityCheck.take(second, id);
    await qualityCheck.approve(second, id);
  } else {
    await qualityCheck.take(reviewer, id);
    await qualityCheck.approve(reviewer, id);
  }

  await admin.completeWorkOrder(actors.manager, id, kit.meta(await kit.version(id)));
  await admin.returnToService(actors.manager, id, kit.meta(await kit.version(id)));
  return { id, repairs: repairJobs, externalJobId };
}

/** A mechanic's clock keeps running between their Jobs on the same Work Order. */
async function startIfStopped(kit: DemoKit, mechanic: AuthUser, workOrderId: string) {
  const open = await kit.prisma.workSession.findFirst({ where: { workOrderId, userId: mechanic.id, endedAt: null } });
  if (!open) await kit.workOrders.start(mechanic, workOrderId);
}
