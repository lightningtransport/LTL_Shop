import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability, PauseReason } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';

function actor(capabilities: AppCapability[], id = 'mechanic-1'): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    role: 'mechanic',
    active: true,
    pmAuthorized: capabilities.includes(AppCapability.MECHANIC_PM),
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

describe('Work Order blocker lifecycle', () => {
  afterEach(() => vi.useRealTimers());

  it('records a mechanic report without pausing or adding waiting time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const open = workOrder();
    const updated = workOrder({
      version: 2,
      pauseEvents: [{
        id: 'report-1',
        workOrderId: open.id,
        reason: PauseReason.WAITING_FOR_PARTS,
        notes: null,
        startedAt: now,
        endedAt: now,
        durationMs: 0n,
        isOfficialPause: false,
        reportedBy: { id: 'mechanic-1', name: 'Alex' },
      }],
    });
    const tx = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(open),
        update: vi.fn().mockResolvedValue(updated),
      },
      pauseEvent: { create: vi.fn() },
    };
    const activity = { log: vi.fn() };
    const service = new WorkOrdersService({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never, activity as never);

    const result = await service.reportBlocker(
      actor([AppCapability.MECHANIC_STANDARD]),
      open.id,
      { reason: PauseReason.WAITING_FOR_PARTS },
    );

    expect(result.status).toBe('in_progress');
    expect(result.currentPause).toBeNull();
    expect(result.currentPauseReason).toBeNull();
    expect(result.totalWaitingMs).toBe(0);
    expect(tx.workOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { version: { increment: 1 } },
    }));
    expect(tx.pauseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isOfficialPause: false,
        durationMs: 0n,
        endedAt: now,
        reportedById: 'mechanic-1',
        createdById: 'mechanic-1',
        reason: PauseReason.WAITING_FOR_PARTS,
      }),
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.BLOCKER_REPORTED,
      userId: 'mechanic-1',
      newValue: { reason: PauseReason.WAITING_FOR_PARTS, notes: null },
    }));
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
      { reason: PauseReason.WAITING_FOR_PARTS },
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
        findMany: vi.fn().mockResolvedValue([{ userId: 'mech-a' }, { userId: 'mech-b' }]),
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
