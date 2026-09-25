import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { stopLaborWhenNoPendingJobs } from './labor-session';
import { canCompleteJob } from './work-order.timing';
import { WorkOrdersService } from './work-orders.service';

const mechanic: AuthUser = {
  id: 'mech-1',
  email: 'mg@lightning.local',
  name: 'MG',
  role: 'mechanic',
  active: true,
  pmAuthorized: false,
  capabilities: [AppCapability.MECHANIC_STANDARD],
  supabaseAuthId: null,
};

const startedAt = new Date('2026-09-22T14:56:00.000Z');
const now = new Date('2026-09-23T13:53:00.000Z');

function laborTx(options: { pending: number; openSession: boolean }) {
  const open = options.openSession ? { id: 'session-1', startedAt, endedAt: null } : null;
  return {
    workOrderJob: { count: vi.fn().mockResolvedValue(options.pending) },
    workSession: {
      findFirst: vi.fn().mockResolvedValue(open),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue(open ? [{ ...open, endedAt: now }] : []),
    },
    pauseEvent: { findMany: vi.fn().mockResolvedValue([]) },
    workOrder: { update: vi.fn() },
  };
}

describe('stopLaborWhenNoPendingJobs (LTR-124)', () => {
  it('closes the open session and persists totals when no Job is pending', async () => {
    const tx = laborTx({ pending: 0, openSession: true });

    await expect(stopLaborWhenNoPendingJobs(tx as never, 'wo-1', now)).resolves.toBe(true);

    expect(tx.workSession.update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { endedAt: now } });
    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: {
        totalActiveLaborMs: BigInt(now.getTime() - startedAt.getTime()),
        totalWaitingMs: 0n,
      },
    });
  });

  it('keeps labor running while a Job is still pending', async () => {
    const tx = laborTx({ pending: 1, openSession: true });

    await expect(stopLaborWhenNoPendingJobs(tx as never, 'wo-1', now)).resolves.toBe(false);

    expect(tx.workSession.update).not.toHaveBeenCalled();
    expect(tx.workOrder.update).not.toHaveBeenCalled();
  });

  it('does nothing when no session is open', async () => {
    const tx = laborTx({ pending: 0, openSession: false });

    await expect(stopLaborWhenNoPendingJobs(tx as never, 'wo-1', now)).resolves.toBe(false);

    expect(tx.workOrder.update).not.toHaveBeenCalled();
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
    sessions: [] as { id: string }[],
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
      assignedMechanic: { id: 'mech-1', name: 'MG' },
    }],
    ...overrides,
  };
}

function serviceFor(wo: ReturnType<typeof standardWorkOrder>) {
  const tx = {
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(wo),
      update: vi.fn().mockResolvedValue({ ...wo, version: wo.version + 1, sessions: [{ id: 'session-2' }] }),
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

describe('mechanic Start Work after labor stopped (LTR-124)', () => {
  it('reopens labor on an In Progress Work Order with a new pending Job', async () => {
    const { service, tx } = serviceFor(standardWorkOrder());

    await expect(service.start(mechanic, 'wo-1')).resolves.toMatchObject({
      status: 'in_progress',
      laborRunning: true,
    });
    expect(tx.workSession.create).toHaveBeenCalledWith({
      data: { workOrderId: 'wo-1', startedAt: expect.any(Date) },
    });
  });

  it('rejects Start Work while labor is already running', async () => {
    const { service, tx } = serviceFor(standardWorkOrder({ sessions: [{ id: 'session-1' }] }));

    await expect(service.start(mechanic, 'wo-1')).rejects.toThrow(
      'Work Order can only be started from created status',
    );
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
