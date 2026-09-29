/**
 * Helpers for the flow tests: an HTTP client that acts as each seeded user, a database reset, and the
 * steps a Manager, a mechanic and the PM mechanic take in the app.
 *
 * Every helper names its step, so a failure reads "<step>: POST /path → 400 {...}" in the matrix.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { inject } from 'vitest';
import { wipeWorkOrders } from '../prisma/wipe-work-orders';
import { classifyWorkPlanLane } from '../src/admin/yard-work-plan-derivation';

export const USERS = {
  manager: 'manager@lightning.local',
  admin: 'admin@lightning.local',
  pm: 'daniel@lightning.local',
  alignment: 'mechanic@lightning.local',
  detailing: 'anthony@lightning.local',
  general: 'alejandro-2@lightning.local',
  spare: 'john@lightning.local',
} as const;

export type Lane = 'inspection' | 'shop_work' | 'pm' | 'alignment' | 'detailing' | 'quality_check';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;
export type Reply = { status: number; json: Json; method: string; path: string };

export const prisma = new PrismaClient({ datasourceUrl: inject('databaseUrl') });

export function as(email: string) {
  const call = async (method: string, path: string, body?: unknown): Promise<Reply> => {
    const response = await fetch(`${inject('apiUrl')}/api${path}`, {
      method,
      headers: { Authorization: `Bearer dev:${email}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json: Json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: response.status, json, method, path };
  };
  return {
    get: (path: string) => call('GET', path),
    post: (path: string, body?: unknown) => call('POST', path, body ?? {}),
    put: (path: string, body?: unknown) => call('PUT', path, body ?? {}),
    patch: (path: string, body?: unknown) => call('PATCH', path, body ?? {}),
    del: (path: string) => call('DELETE', path),
  };
}

export const manager = as(USERS.manager);
export const admin = as(USERS.admin);

function describeReply(reply: Reply) {
  const body = JSON.stringify(reply.json?.message ? { code: reply.json.code, message: reply.json.message } : reply.json);
  return `${reply.method} ${reply.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')} → ${reply.status} ${body?.slice(0, 300)}`;
}

/** The call must succeed (2xx); returns its body. */
export function ok(step: string, reply: Reply): Json {
  if (reply.status < 200 || reply.status >= 300) throw new Error(`${step}: ${describeReply(reply)}`);
  return reply.json;
}

/** The call must be refused with this status (and code, when given). */
export function refused(step: string, reply: Reply, status: number, code?: string) {
  if (reply.status !== status || (code && reply.json?.code !== code)) {
    throw new Error(`${step}: se esperaba ${status}${code ? ` ${code}` : ''}; ${describeReply(reply)}`);
  }
}

export function same(step: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${step}: se esperaba ${JSON.stringify(expected)}, llegó ${JSON.stringify(actual)}`);
  }
}

export function truthy(step: string, value: unknown, detail?: unknown) {
  if (!value) throw new Error(`${step}${detail === undefined ? '' : `: ${JSON.stringify(detail)?.slice(0, 300)}`}`);
}

const userIds = new Map<string, string>();
export async function userId(email: string) {
  if (!userIds.has(email)) {
    userIds.set(email, (await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id);
  }
  return userIds.get(email)!;
}

export async function truck(truckNumber: string) {
  return prisma.truck.findFirstOrThrow({ where: { truckNumber } });
}

/**
 * Empty shop: no Work Orders, every seeded user active, and the Shop workflow with its default owners
 * (PM → Daniel, Alignment → Alejandro 1, Detailing → Anthony; Quality Check never has one, D15).
 */
export async function resetDb() {
  await prisma.$transaction((tx) => wipeWorkOrders(tx), { timeout: 60_000 });
  await prisma.user.updateMany({ where: { email: { in: Object.values(USERS) } }, data: { active: true } });
  const owners: Record<string, string | null> = {
    pm: await userId(USERS.pm),
    alignment: await userId(USERS.alignment),
    detailing: await userId(USERS.detailing),
    quality_check: null,
  };
  for (const [stepKey, defaultMechanicId] of Object.entries(owners)) {
    await prisma.shopWorkflowStep.updateMany({ where: { stepKey }, data: { defaultMechanicId, active: true } });
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function adminWo(workOrderId: string): Promise<Json> {
  return ok('leer Work Order (Admin)', await manager.get(`/admin/work-orders/${workOrderId}`));
}

export async function truckDetail(truckId: string): Promise<Json> {
  return ok('leer Truck (Admin)', await manager.get(`/admin/trucks/${truckId}`));
}

export async function mechanicWo(email: string, workOrderId: string): Promise<Json> {
  return ok(`leer Work Order (${email})`, await as(email).get(`/work-orders/${workOrderId}`));
}

export function laneOf(job: Json): Lane {
  return (job.lane ?? classifyWorkPlanLane(job.category?.name ?? '', job.displayName)) as Lane;
}

export function laneJob(workOrder: Json, lane: Lane): Json {
  const job = (workOrder.jobs as Json[]).find((item) => laneOf(item) === lane && item.status !== 'cancelled');
  if (!job) throw new Error(`No hay Job de ${lane} en el Work Order`);
  return job;
}

export function namedJob(workOrder: Json, displayName: string): Json {
  const job = (workOrder.jobs as Json[]).find((item) => item.displayName === displayName);
  if (!job) throw new Error(`No hay Job "${displayName}" en el Work Order`);
  return job;
}

export async function meta(workOrderId: string) {
  const { version } = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId }, select: { version: true } });
  return { expectedVersion: version, idempotencyKey: randomUUID() };
}

// ── Manager ──────────────────────────────────────────────────────────────────

export async function createWo(truckNumber: string, input: { priority?: string; notes?: string } = {}) {
  const row = await truck(truckNumber);
  const created = ok('crear Work Order', await manager.post('/admin/work-orders', {
    truckId: row.id,
    idempotencyKey: randomUUID(),
    ...input,
  }));
  return { truck: row, workOrderId: created.id as string, created };
}

export async function inspect(truckId: string, outcome: 'no_issues_found' | 'issues_found') {
  return ok(`inspección ${outcome}`, await manager.post(`/admin/trucks/${truckId}/work-plan/inspection`, {
    outcome,
    idempotencyKey: randomUUID(),
  }));
}

export async function catalogJob(category: string, job: string) {
  return prisma.catalogJob.findFirstOrThrow({
    where: { displayName: job, status: 'active', category: { name: category, status: 'active' } },
  });
}

export async function addShopJobs(
  truckId: string,
  workOrderId: string,
  jobs: Array<{ category: string; job: string; assignee?: string }>,
) {
  const rows = [];
  for (const item of jobs) {
    const row = await catalogJob(item.category, item.job);
    rows.push({
      catalogJobId: row.id,
      categoryId: row.categoryId,
      displayName: row.displayName,
      ...(item.assignee ? { assignedMechanicId: await userId(item.assignee) } : {}),
    });
  }
  return manager.post(`/admin/trucks/${truckId}/work-plan/jobs`, { ...(await meta(workOrderId)), jobs: rows });
}

export async function assign(workOrderId: string, jobId: string, email: string) {
  return manager.post(`/admin/work-orders/${workOrderId}/jobs/${jobId}/assign`, {
    ...(await meta(workOrderId)),
    mechanicId: await userId(email),
  });
}

export async function unassign(workOrderId: string, jobId: string) {
  return manager.post(`/admin/work-orders/${workOrderId}/jobs/${jobId}/unassign`, await meta(workOrderId));
}

export async function adminCompleteJob(workOrderId: string, jobId: string, actor = manager) {
  return actor.post(`/admin/jobs/${jobId}/complete`, { ...(await meta(workOrderId)), notes: 'Hecho.' });
}

export async function closeWo(workOrderId: string) {
  return manager.post(`/admin/work-orders/${workOrderId}/complete`, await meta(workOrderId));
}

export async function cancelWo(workOrderId: string, reason = 'Se canceló la visita.') {
  return manager.post(`/admin/work-orders/${workOrderId}/cancel`, { ...(await meta(workOrderId)), reason });
}

export async function returnToService(workOrderId: string) {
  return manager.post(`/admin/work-orders/${workOrderId}/return-to-service`, await meta(workOrderId));
}

/** A Work Order with its inspection recorded and, when asked, extra Shop Work. */
export async function plannedWo(
  truckNumber: string,
  extra: Array<{ category: string; job: string; assignee?: string }> = [],
) {
  const { truck: row, workOrderId } = await createWo(truckNumber);
  await inspect(row.id, extra.length ? 'issues_found' : 'no_issues_found');
  if (extra.length) ok('agregar Jobs', await addShopJobs(row.id, workOrderId, extra));
  return { truck: row, workOrderId };
}

// ── Mechanics ────────────────────────────────────────────────────────────────

export async function start(email: string, workOrderId: string) {
  return as(email).post(`/work-orders/${workOrderId}/start`);
}

export async function completeJob(email: string, workOrderId: string, jobId: string) {
  return as(email).post(`/work-orders/${workOrderId}/jobs/${jobId}/complete`, { notes: 'Hecho.' });
}

/** Start (or Continue) and complete the mechanic's Job in that step. */
export async function doLane(email: string, workOrderId: string, lane: Lane) {
  ok(`${email} Start`, await start(email, workOrderId));
  const job = laneJob(await adminWo(workOrderId), lane);
  ok(`${email} completa ${lane}`, await completeJob(email, workOrderId, job.id));
}

export async function reportBlocker(email: string, workOrderId: string, jobId: string, reason = 'waiting_for_parts') {
  return as(email).post(`/work-orders/${workOrderId}/blockers`, { jobId, reason, notes: 'Falta la pieza.' });
}

export async function activeBlocker(workOrderId: string) {
  return prisma.pauseEvent.findFirst({
    where: { workOrderId, isOfficialPause: false, resolvedAt: null },
    select: { id: true, jobId: true, blockerReason: true },
  });
}

/** Who has their labor clock running on this Work Order (D18: one session per mechanic). */
export async function openSessionUsers(workOrderId: string) {
  const sessions = await prisma.workSession.findMany({ where: { workOrderId, endedAt: null }, select: { userId: true } });
  return sessions.map((session) => session.userId).sort();
}

// ── PM mechanic ──────────────────────────────────────────────────────────────

export async function pmCategoryId() {
  return (await prisma.jobCategory.findFirstOrThrow({ where: { name: 'PM' } })).id;
}

export async function createPmService(truckId: string, email: string = USERS.pm) {
  return as(email).post('/work-orders', {
    truckId,
    primaryCategoryId: await pmCategoryId(),
    idempotencyKey: randomUUID(),
  });
}

export async function savePm(workOrderId: string, mileage: number, email: string = USERS.pm) {
  const pm = as(email);
  const service = ok('leer PM service', await pm.get(`/work-orders/${workOrderId}/pm`));
  const category = (service.categories as Json[]).find((item) => item.parts?.length);
  if (!category) throw new Error('guardar PM: ninguna parte del catálogo sirve para este Truck');
  return pm.post(`/work-orders/${workOrderId}/pm`, {
    observedMileage: mileage,
    selections: [{ partCategoryId: category.id, partId: category.parts[0].id }],
  });
}

/** The PM mechanic starts the PM Job, records mileage and one part, and finishes it. */
export async function doPm(workOrderId: string, truckId: string) {
  const pmJob = laneJob(await adminWo(workOrderId), 'pm');
  ok('PM start', await as(USERS.pm).post(`/work-orders/${workOrderId}/jobs/${pmJob.id}/pm/start`));
  const { mileage } = await prisma.truck.findUniqueOrThrow({ where: { id: truckId } });
  ok('PM guardar millaje y parte', await savePm(workOrderId, (mileage ?? 0) + 100));
  ok('PM finish', await completeJob(USERS.pm, workOrderId, pmJob.id));
}

// ── One Next step everywhere (row A19) ───────────────────────────────────────

/** Truck detail, Work Order detail, Work Order list, Truck list and the Yard card must name the same step. */
export async function sameNextStepEverywhere(step: string, workOrderId: string, truckId: string, expected?: string) {
  const detail = await truckDetail(truckId);
  const workOrder = await adminWo(workOrderId);
  const list = ok('lista de Work Orders', await manager.get('/admin/work-orders?limit=100'));
  const trucks = ok('lista de Trucks', await manager.get('/admin/trucks'));
  const yard = ok('Yard', await manager.get('/admin/yard-operations?limit=100'));
  const seen: Record<string, string | null> = {
    truck: detail.nextStep?.kind ?? null,
    workOrder: workOrder.nextStep?.kind ?? null,
    workOrderList: (list.items as Json[]).find((item) => item.id === workOrderId)?.nextStep?.kind ?? null,
    truckList: (trucks.items as Json[]).find((item) => item.truck.id === truckId)?.nextStep?.kind ?? null,
  };
  const card = (yard.items as Json[]).find((item) => item.truck.id === truckId);
  if (card) seen.yard = card.nextStep?.kind ?? null;
  const kinds = new Set(Object.values(seen));
  if (kinds.size !== 1) throw new Error(`${step}: las pantallas no dicen el mismo siguiente paso ${JSON.stringify(seen)}`);
  if (expected !== undefined) same(`${step}: siguiente paso`, seen.truck, expected);
  return seen.truck;
}
