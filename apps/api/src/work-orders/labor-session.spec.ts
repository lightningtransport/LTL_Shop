import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { openSessionFor, stopLaborForMechanic, stopLaborWhenNoPendingJobs } from './labor-session';
import { canCompleteJob } from './work-order.timing';
import { WorkOrdersService } from './work-orders.service';

const mechanic: AuthUser = {
  id: 'mech-1',
  email: 'mg@lightning.local',
  name: 'MG',
  role: 'mechanic',
  active: true,
  capabilities: [AppCapability.MECHANIC_STANDARD],
  supabaseAuthId: null,
};

const startedAt = new Date('2026-09-22T14:56:00.000Z');
const now = new Date('2026-09-23T13:53:00.000Z');

type Session = { id: string; startedAt: Date; endedAt: Date | null; userId: string | null };

/**
 * In-memory tx for the labor helpers: jobs and sessions live in arrays so the
 * per-mechanic rules can be checked end to end.
 */
function laborTx(options: {
  jobs: { status: 'to_do' | 'completed'; assignedMechanicId: string | null }[];
  sessions: Session[];
}) {
  const sessions = options.sessions.map((session) => ({ ...session }));
  const matchesSession = (session: Session, where: Record<string, unknown>) => {
    if (where.endedAt === null && session.endedAt !== null) return false;
    if ('userId' in where && session.userId !== where.userId) return false;
    return true;
  };
  return {
    sessions,
    workOrderJob: {
      count: vi.fn(async ({ where }: { where: { status: string; assignedMechanicId?: string } }) => options.jobs.filter((job) => (
        job.status === where.status
        && (where.assignedMechanicId === undefined || job.assignedMechanicId === where.assignedMechanicId)
      )).length),
    },
    workSession: {
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: { endedAt: Date } }) => {
        const hits = sessions.filter((session) => matchesSession(session, where));
        hits.forEach((session) => { session.endedAt = data.endedAt; });
        return { count: hits.length };
      }),
      findMany: vi.fn(async () => sessions),
    },
    pauseEvent: { findMany: vi.fn().mockResolvedValue([]) },
    workOrder: { update: vi.fn() },
  };
}

const HOUR = 60 * 60 * 1000;
const earlier = new Date(now.getTime() - 2 * HOUR);

describe('stopLaborForMechanic (LTR-154 / D18)', () => {
  it('closes only the mechanic who finished their part; the Work Order total is the sum', async () => {
    const tx = laborTx({
      jobs: [
        { status: 'completed', assignedMechanicId: 'mech-a' },
        { status: 'to_do', assignedMechanicId: 'mech-b' },
      ],
      sessions: [
        { id: 'a', startedAt: earlier, endedAt: null, userId: 'mech-a' },
        { id: 'b', startedAt: earlier, endedAt: null, userId: 'mech-b' },
      ],
    });

    await expect(stopLaborForMechanic(tx as never, 'wo-1', 'mech-a', now)).resolves.toBe(true);

    expect(tx.sessions.find((session) => session.id === 'a')?.endedAt).toEqual(now);
    expect(tx.sessions.find((session) => session.id === 'b')?.endedAt).toBeNull();
    // A closed at now (2h) + B still open at now (2h) = 4h of labor.
    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: { totalActiveLaborMs: BigInt(4 * HOUR), totalWaitingMs: 0n },
    });
  });

  it('keeps the mechanic running while they still have a pending Job', async () => {
    const tx = laborTx({
      jobs: [
        { status: 'completed', assignedMechanicId: 'mech-a' },
        { status: 'to_do', assignedMechanicId: 'mech-a' },
      ],
      sessions: [{ id: 'a', startedAt: earlier, endedAt: null, userId: 'mech-a' }],
    });

    await expect(stopLaborForMechanic(tx as never, 'wo-1', 'mech-a', now)).resolves.toBe(false);

    expect(tx.sessions[0].endedAt).toBeNull();
    expect(tx.workOrder.update).not.toHaveBeenCalled();
  });

  it('closes every open session, including one from before per-mechanic labor, when no Job is pending', async () => {
    const tx = laborTx({
      jobs: [{ status: 'completed', assignedMechanicId: 'mech-a' }],
      sessions: [
        { id: 'legacy', startedAt: earlier, endedAt: null, userId: null },
        { id: 'b', startedAt: earlier, endedAt: null, userId: 'mech-b' },
      ],
    });

    await expect(stopLaborWhenNoPendingJobs(tx as never, 'wo-1', now)).resolves.toBe(true);

    expect(tx.sessions.every((session) => session.endedAt?.getTime() === now.getTime())).toBe(true);
  });

  it('does nothing when no session is open', async () => {
    const tx = laborTx({ jobs: [{ status: 'completed', assignedMechanicId: 'mech-a' }], sessions: [] });

    await expect(stopLaborForMechanic(tx as never, 'wo-1', 'mech-a', now)).resolves.toBe(false);

    expect(tx.workOrder.update).not.toHaveBeenCalled();
  });
});

describe('openSessionFor (LTR-154 / D18)', () => {
  it("finds the mechanic's own open session or a legacy one without userId", () => {
    const own = { endedAt: null, userId: 'mech-a' };
    const other = { endedAt: null, userId: 'mech-b' };
    const legacy = { endedAt: null, userId: null };
    expect(openSessionFor([other, own], 'mech-a')).toBe(own);
    expect(openSessionFor([other], 'mech-a')).toBeNull();
    expect(openSessionFor([legacy], 'mech-a')).toBe(legacy);
  });
});

describe('canCompleteJob with stopped labor', () => {
  it('requires Start Work on an In Progress Work Order without an open session', () => {
    expect(canCompleteJob('in_progress', false)).toEqual({
      ok: false,
      code: 'START_REQUIRED',
      message: 'Start Work before completing jobs.',
    });
    expect(canCompleteJob('in_progress', true)).toEqual({ ok: true });
    expect(canCompleteJob('in_progress')).toEqual({ ok: true });
  });
});

function standardWorkOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wo-1',
    displayId: 'WO-001',
    truckId: 'truck-1',
    primaryCategoryId: 'category-inspection',
    status: 'in_progress' as const,
    priority: 'normal' as const,
    notes: null,
    createdAt: startedAt,
    createdById: 'manager-1',
    startedAt,
    completedAt: null,
    completedById: null,
    totalActiveLaborMs: 0n,
    totalWaitingMs: 0n,
    version: 4,
    truck: {
      id: 'truck-1', truckNumber: '277', make: null, model: null, year: null,
      mileage: null, company: null, owner: null,
    },
    primaryCategory: { id: 'category-inspection', name: 'Inspection' },
    pauseEvents: [],
    sessions: [] as { id: string; startedAt: Date; endedAt: Date | null; userId?: string | null }[],
    mechanics: [{ mechanicId: 'mech-1', addedAt: startedAt, removedAt: null, mechanic: { name: 'MG' } }],
    jobs: [{
      id: 'job-new',
      workOrderId: 'wo-1',
      catalogJobId: 'catalog-1',
      categoryId: 'category-inspection',
      category: { id: 'category-inspection', name: 'Inspection' },
      displayName: 'Brake Inspection',
      customDescription: null,
      status: 'to_do' as const,
      completedAt: null,
      completedById: null,
      assignedMechanicId: 'mech-1',
      assignedMechanic: { id: 'mech-1', name: 'MG' },
    }],
    ...overrides,
  };
}

function serviceFor(wo: ReturnType<typeof standardWorkOrder>) {
  const tx = {
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(wo),
      update: vi.fn().mockResolvedValue({ ...wo, version: wo.version + 1, sessions: [...wo.sessions, { id: 'session-2', startedAt: new Date(), endedAt: null, userId: 'mech-1' }] }),
    },
    workSession: { create: vi.fn() },
    jobCategory: { findUnique: vi.fn().mockResolvedValue({ name: wo.primaryCategory.name }) },
    workOrderJob: { findFirst: vi.fn().mockResolvedValue(wo.jobs[0]), update: vi.fn() },
  };
  const activity = { log: vi.fn() };
  const service = new WorkOrdersService({
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as never, activity as never);
  return { service, tx, activity };
}

describe('mechanic Start Work / Continue (LTR-124, LTR-154 / D18)', () => {
  it('reopens labor on an In Progress Work Order with a new pending Job', async () => {
    const { service, tx } = serviceFor(standardWorkOrder());

    await expect(service.start(mechanic, 'wo-1')).resolves.toMatchObject({
      status: 'in_progress',
      laborRunning: true,
    });
    expect(tx.workSession.create).toHaveBeenCalledWith({
      data: { workOrderId: 'wo-1', startedAt: expect.any(Date), userId: 'mech-1' },
    });
  });

  it("opens the mechanic's own session while another mechanic keeps working", async () => {
    const { service, tx } = serviceFor(standardWorkOrder({
      sessions: [{ id: 'session-b', startedAt, endedAt: null, userId: 'mech-2' }],
    }));

    await expect(service.start(mechanic, 'wo-1')).resolves.toMatchObject({ laborRunning: true });
    expect(tx.workSession.create).toHaveBeenCalledWith({
      data: { workOrderId: 'wo-1', startedAt: expect.any(Date), userId: 'mech-1' },
    });
  });

  it('rejects Start Work while the mechanic already has a session open', async () => {
    const { service, tx } = serviceFor(standardWorkOrder({ sessions: [{ id: 'session-1', startedAt, endedAt: null, userId: 'mech-1' }] }));

    await expect(service.start(mechanic, 'wo-1')).rejects.toMatchObject({
      response: { code: 'LABOR_ALREADY_RUNNING' },
    });
    expect(tx.workSession.create).not.toHaveBeenCalled();
  });

  it('rejects Start Work when the mechanic has no pending Job of their own', async () => {
    const wo = standardWorkOrder();
    const { service, tx } = serviceFor(standardWorkOrder({
      jobs: [
        { ...wo.jobs[0], status: 'completed' as const },
        { ...wo.jobs[0], id: 'job-b', assignedMechanicId: 'mech-2', assignedMechanic: { id: 'mech-2', name: 'Jamie' } },
      ],
    }));

    await expect(service.start(mechanic, 'wo-1')).rejects.toMatchObject({
      response: { code: 'NO_PENDING_JOBS' },
    });
    expect(tx.workSession.create).not.toHaveBeenCalled();
  });

  it('rejects completing a Job before Start Work when labor is stopped', async () => {
    const { service, tx } = serviceFor(standardWorkOrder());

    await expect(service.completeJob(mechanic, 'wo-1', 'job-new')).rejects.toMatchObject({
      response: { code: 'START_REQUIRED' },
    });
    expect(tx.workOrderJob.update).not.toHaveBeenCalled();
  });
});

describe('blocked Jobs (LTR-155 / D17)', () => {
  const blocker = {
    id: 'b-1', workOrderId: 'wo-1', jobId: 'job-new', reason: 'waiting_for_parts', notes: null,
    startedAt, endedAt: startedAt, durationMs: 0n, isOfficialPause: false, resolvedAt: null, reportedBy: null,
  };

  it('does not let Continue start labor when every pending Job of mine is blocked', async () => {
    const { service, tx } = serviceFor(standardWorkOrder({ pauseEvents: [blocker] }));
    await expect(service.start(mechanic, 'wo-1')).rejects.toMatchObject({ response: { code: 'NO_PENDING_JOBS' } });
    expect(tx.workSession.create).not.toHaveBeenCalled();
  });

  it('rejects completing a blocked Job until the Manager resolves it', async () => {
    const { service, tx } = serviceFor(standardWorkOrder({
      pauseEvents: [blocker],
      sessions: [{ id: 's-1', startedAt, endedAt: null, userId: 'mech-1' }],
    }));
    await expect(service.completeJob(mechanic, 'wo-1', 'job-new')).rejects.toMatchObject({ response: { code: 'JOB_BLOCKED' } });
    expect(tx.workOrderJob.update).not.toHaveBeenCalled();
  });
});

