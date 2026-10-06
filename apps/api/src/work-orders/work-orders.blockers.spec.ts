import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability, BlockerReason, PauseReason } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';

function actor(capabilities: AppCapability[], id = 'mechanic-1'): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    role: 'mechanic',
    active: true,
    capabilities,
    supabaseAuthId: null,
  };
}

const now = new Date('2026-09-11T15:00:00.000Z');

function workOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    displayId: 'WO-0106',
    truckId: 'truck-1',
    primaryCategoryId: 'category-brakes',
    status: 'in_progress' as const,
    priority: 'high' as const,
    notes: null,
    createdAt: new Date('2026-09-11T14:00:00.000Z'),
    createdById: 'mechanic-1',
    startedAt: new Date('2026-09-11T14:05:00.000Z'),
    completedAt: null,
    completedById: null,
    totalActiveLaborMs: 0n,
    totalWaitingMs: 0n,
    version: 1,
    truck: {
      id: 'truck-1', truckNumber: '106', make: null, model: null, year: null,
      mileage: null, company: null, owner: null,
    },
    primaryCategory: { id: 'category-brakes', name: 'Brakes' },
    jobs: [{
      id: 'job-1',
      workOrderId: '11111111-1111-4111-8111-111111111111',
      catalogJobId: 'catalog-1',
      categoryId: 'category-brakes',
      category: { id: 'category-brakes', name: 'Brakes' },
      displayName: 'Inspect brakes',
      customDescription: null,
      status: 'to_do' as const,
      completedAt: null,
      completedById: null,
      assignedMechanicId: 'mechanic-1',
      assignedMechanic: { id: 'mechanic-1', name: 'Alex' },
    }],
    pauseEvents: [],
    mechanics: [{
      mechanicId: 'mechanic-1',
      addedAt: new Date('2026-09-11T14:00:00.000Z'),
      removedAt: null,
      mechanic: { name: 'Alex' },
    }],
    ...overrides,
  };
}

const WO_ID = '11111111-1111-4111-8111-111111111111';
const J1 = '22222222-2222-4222-8222-000000000001';
const J2 = '22222222-2222-4222-8222-000000000002';
const J3 = '22222222-2222-4222-8222-000000000003';

/** Mechanic-1 owns J1 and J2; J3 belongs to mechanic-2. `workableLeft` = mechanic-1's unblocked pending Jobs after the report. */
function reportSetup(options: { workableLeft: number; alreadyBlocked?: string }) {
  const base = workOrder().jobs[0];
  const job = (id: string, owner: string, name: string) => ({
    ...base, id, displayName: name, assignedMechanicId: owner, assignedMechanic: { id: owner, name: owner },
  });
  const wo = workOrder({
    jobs: [job(J1, 'mechanic-1', 'Inspect brakes'), job(J2, 'mechanic-1', 'Replace pads'), job(J3, 'mechanic-2', 'ABS sensor')],
    sessions: [{ id: 's-1', startedAt: now, endedAt: null, userId: 'mechanic-1' }],
    pauseEvents: options.alreadyBlocked ? [{
      id: 'b-old', workOrderId: WO_ID, jobId: options.alreadyBlocked, reason: PauseReason.WAITING_FOR_PARTS, notes: null,
      startedAt: now, endedAt: now, durationMs: 0n, isOfficialPause: false, resolvedAt: null, reportedBy: null,
    }] : [],
  });
  const tx = {
    workOrder: { findUnique: vi.fn().mockResolvedValue(wo), update: vi.fn().mockResolvedValue(wo) },
    pauseEvent: { create: vi.fn().mockResolvedValue({ id: 'blocker-new' }), findMany: vi.fn().mockResolvedValue([]) },
    workOrderJob: {
      count: vi.fn(async ({ where }: { where: { assignedMechanicId?: string } }) => (where.assignedMechanicId ? options.workableLeft : 2)),
    },
    workSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([{ startedAt: now, endedAt: now }]),
    },
  };
  const activity = { log: vi.fn() };
  const service = new WorkOrdersService({
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as never, activity as never);
  return { service, tx, activity };
}

describe('Work Order blocker lifecycle', () => {
  afterEach(() => vi.useRealTimers());

  it('records a per-Job blocker without pausing the Work Order or adding waiting time (LTR-155)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { service, tx, activity } = reportSetup({ workableLeft: 1 });

    const result = await service.reportBlocker(
      actor([AppCapability.MECHANIC_STANDARD]),
      WO_ID,
      { jobId: J1, reason: BlockerReason.WAITING_FOR_PARTS },
    );

    expect(result.status).toBe('in_progress');
    expect(result.currentPause).toBeNull();
    expect(result.totalWaitingMs).toBe(0);
    expect(tx.pauseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: J1,
        blockerReason: BlockerReason.WAITING_FOR_PARTS,
        reason: PauseReason.WAITING_FOR_PARTS,
        isOfficialPause: false,
        durationMs: 0n,
        reportedById: 'mechanic-1',
      }),
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.BLOCKER_REPORTED,
      entityType: 'pause_event',
      entityId: 'blocker-new',
      newValue: expect.objectContaining({ jobId: J1, jobName: 'Inspect brakes', reason: BlockerReason.WAITING_FOR_PARTS }),
    }));
  });

  it('keeps labor running while another Job is workable (J1 blocked)', async () => {
    const { service, tx } = reportSetup({ workableLeft: 1 });
    await service.reportBlocker(actor([AppCapability.MECHANIC_STANDARD]), WO_ID, { jobId: J1, reason: BlockerReason.WAITING_FOR_BAY });
    expect(tx.workSession.updateMany).not.toHaveBeenCalled();
  });

  it("stops the mechanic's labor when their last workable Job is blocked (J2 blocked)", async () => {
    const { service, tx } = reportSetup({ workableLeft: 0 });
    await service.reportBlocker(actor([AppCapability.MECHANIC_STANDARD]), WO_ID, { jobId: J2, reason: BlockerReason.WAITING_FOR_PARTS });
    expect(tx.workSession.updateMany).toHaveBeenCalledWith({
      where: { workOrderId: WO_ID, endedAt: null, userId: 'mechanic-1' },
      data: { endedAt: expect.any(Date) },
    });
  });

  it('rejects Manager-only reasons such as Break (400)', async () => {
    const { service, tx } = reportSetup({ workableLeft: 1 });
    await expect(service.reportBlocker(
      actor([AppCapability.MECHANIC_STANDARD]), WO_ID, { jobId: J1, reason: PauseReason.BREAK },
    )).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reportBlocker(
      actor([AppCapability.MECHANIC_STANDARD]), WO_ID, { reason: BlockerReason.WAITING_FOR_PARTS },
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.pauseEvent.create).not.toHaveBeenCalled();
  });

  it("rejects blocking another mechanic's Job (403) and a Job already blocked (409)", async () => {
    const other = reportSetup({ workableLeft: 1 });
    await expect(other.service.reportBlocker(
      actor([AppCapability.MECHANIC_STANDARD]), WO_ID, { jobId: J3, reason: BlockerReason.WAITING_FOR_PARTS },
    )).rejects.toMatchObject({ status: 403 });

    const blocked = reportSetup({ workableLeft: 1, alreadyBlocked: J1 });
    await expect(blocked.service.reportBlocker(
      actor([AppCapability.MECHANIC_STANDARD]), WO_ID, { jobId: J1, reason: BlockerReason.WAITING_FOR_PARTS },
    )).rejects.toMatchObject({ response: { code: 'BLOCKER_ALREADY_ACTIVE' } });
    expect(blocked.tx.pauseEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a blocker report on a closed Work Order', async () => {
    const closed = workOrder({ status: 'completed' });
    const tx = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(closed) },
      pauseEvent: { create: vi.fn() },
    };
    const service = new WorkOrdersService({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never, { log: vi.fn() } as never);

    await expect(service.reportBlocker(
      actor([AppCapability.MECHANIC_STANDARD]),
      closed.id,
      { jobId: J1, reason: BlockerReason.WAITING_FOR_PARTS },
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.pauseEvent.create).not.toHaveBeenCalled();
  });

  it('officially pauses the Work Order and writes an auditable work_paused event', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const open = workOrder();
    const paused = workOrder({
      status: 'waiting_paused',
      version: 2,
      pauseEvents: [{
        id: 'pause-1',
        workOrderId: open.id,
        reason: PauseReason.WAITING_FOR_APPROVAL,
        notes: null,
        startedAt: now,
        endedAt: null,
        durationMs: null,
        isOfficialPause: true,
        reportedBy: null,
      }],
    });
    const tx = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(open),
        update: vi.fn().mockResolvedValue(paused),
      },
      workSession: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-1', startedAt: open.startedAt }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      pauseEvent: { create: vi.fn() },
    };
    const activity = { log: vi.fn() };
    const service = new WorkOrdersService({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never, activity as never);

    const result = await service.pauseByManager(
      actor([AppCapability.WORK_ORDERS_MANAGE, AppCapability.ADMIN_ACCESS], 'manager-1'),
      open.id,
      { reason: PauseReason.WAITING_FOR_APPROVAL },
    );

    expect(result.status).toBe('waiting_paused');
    expect(result.currentPause).toMatchObject({
      reason: PauseReason.WAITING_FOR_APPROVAL,
      isOfficialPause: true,
    });
    expect(tx.workOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'waiting_paused' }),
    }));
    expect(tx.pauseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isOfficialPause: true,
        reason: PauseReason.WAITING_FOR_APPROVAL,
        createdById: 'manager-1',
      }),
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.WORK_PAUSED,
      userId: 'manager-1',
      newValue: { reason: PauseReason.WAITING_FOR_APPROVAL },
    }));
  });

  it('resumes labor for exactly the mechanics the official pause stopped (LTR-154 / D18)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const pausedAt = new Date(now.getTime() - 60 * 60 * 1000);
    const paused = workOrder({
      status: 'waiting_paused',
      pauseEvents: [{
        id: 'pause-1', workOrderId: 'wo-1', reason: PauseReason.WAITING_FOR_APPROVAL, notes: null,
        startedAt: pausedAt, endedAt: null, durationMs: null, isOfficialPause: true, reportedBy: null,
      }],
    });
    const tx = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(paused),
        update: vi.fn().mockResolvedValue(workOrder({ status: 'in_progress', version: 2 })),
      },
      pauseEvent: {
        findFirst: vi.fn().mockResolvedValue({ id: 'pause-1', startedAt: pausedAt }),
        update: vi.fn(),
      },
      workSession: {
        // Mechanic A and B were working when the Manager paused; C had already finished.
        findMany: vi.fn().mockResolvedValue([{ userId: 'mech-a' }, { userId: 'mech-b' }, { userId: 'mech-d' }]),
        // LTR-186 / D21: D's clock now runs on another Truck, so resuming does not pull it back here.
        findFirst: vi.fn(async ({ where }: { where: { userId: string } }) => (where.userId === 'mech-d' ? { id: 'elsewhere' } : null)),
        create: vi.fn(),
      },
    };
    const service = new WorkOrdersService({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never, { log: vi.fn() } as never);

    await service.resumeByManager(actor([AppCapability.WORK_ORDERS_MANAGE, AppCapability.ADMIN_ACCESS], 'manager-1'), 'wo-1');

    expect(tx.workSession.findMany).toHaveBeenCalledWith({
      where: { workOrderId: 'wo-1', endedAt: pausedAt }, select: { userId: true },
    });
    expect(tx.workSession.create.mock.calls.map(([args]) => args.data.userId)).toEqual(['mech-a', 'mech-b']);
    vi.useRealTimers();
  });
});
