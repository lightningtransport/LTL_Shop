import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import { idempotencyFingerprint } from '../common/idempotency';
import { AdminService } from './admin.service';

const baseRow = {
  id: '00000000-0000-4000-8000-000000000011',
  displayId: 'WO-0011',
  truckId: '00000000-0000-4000-8000-000000000021',
  primaryCategoryId: '00000000-0000-4000-8000-000000000031',
  status: 'created',
  priority: 'normal',
  notes: null,
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  createdById: '00000000-0000-4000-8000-000000000041',
  startedAt: null,
  completedAt: null,
  completedById: null,
  totalActiveLaborMs: 0n,
  totalWaitingMs: 0n,
  version: 1,
  updatedAt: new Date('2026-09-02T10:00:00.000Z'),
  truck: {
    id: '00000000-0000-4000-8000-000000000021',
    truckNumber: 'T-21',
    make: 'Volvo', model: 'VNL', year: 2024, mileage: null, company: null, owner: null,
  },
  primaryCategory: { id: '00000000-0000-4000-8000-000000000031', name: 'Engine' },
  jobs: [{ status: 'to_do' }],
  mechanics: [],
  pauseEvents: [],
};

function createPrisma() {
  return {
    workOrder: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    workOrderJob: {
      count: vi.fn(),
    },
    truck: {
      findMany: vi.fn(),
    },
    workOrderMutation: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(),
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new AdminService(prisma as never, { log: vi.fn() } as never);
}

describe('AdminService', () => {
  afterEach(() => vi.useRealTimers());

  it('returns current dashboard counts with provenance', async () => {
    const prisma = createPrisma();
    [6, 2, 3, 4, 5, 6].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await expect(service.dashboard()).resolves.toMatchObject({
      source: 'supabase_postgres',
      counts: {
        open: 6, waitingPaused: 2, highCriticalOpen: 3,
        openOlderThan24h: 4, completedToday: 5, completedLast7Days: 6,
      },
      attention: [],
    });
    expect(prisma.workOrder.count).toHaveBeenCalledTimes(6);
    expect(prisma.workOrder.findMany).toHaveBeenCalledTimes(4);
  });

  it('returns the exact UTC cutoff used by the older-than-24-hours count', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T14:45:00.000Z'));
    const prisma = createPrisma();
    [0, 0, 0, 1, 0, 0].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    const result = await service.dashboard();

    expect(result.windows.openOlderThan24h.before).toBe('2026-09-07T14:45:00.000Z');
    expect(prisma.workOrder.count.mock.calls[3][0]).toEqual({
      where: {
        status: { in: ['created', 'in_progress', 'waiting_paused'] },
        createdAt: { lt: new Date('2026-09-07T14:45:00.000Z') },
      },
    });
  });

  it('does not add a status filter when the list query has no status', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await service.list({});

    expect(prisma.workOrder.findMany.mock.calls[0][0].where).toEqual({});
  });

  it('uses a stable sort-value plus UUID cursor without repeating the boundary row', async () => {
    const prisma = createPrisma();
    const nextRow = {
      ...baseRow,
      id: '00000000-0000-4000-8000-000000000012',
      displayId: 'WO-0012',
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };
    prisma.workOrder.findMany.mockResolvedValueOnce([baseRow, nextRow]).mockResolvedValueOnce([nextRow]);
    const service = createService(prisma);

    const first = await service.list({ limit: 1 });
    expect(first.items.map((item) => item.id)).toEqual([baseRow.id]);
    expect(first.nextCursor).toBeTypeOf('string');

    const second = await service.list({ limit: 1, cursor: first.nextCursor });
    expect(second.items.map((item) => item.id)).toEqual([nextRow.id]);
    const secondWhere = prisma.workOrder.findMany.mock.calls[1][0].where;
    expect(JSON.stringify(secondWhere)).toContain(baseRow.id);
    expect(JSON.stringify(secondWhere)).toContain('lt');
  });

  it('rejects malformed or incompatible cursors', async () => {
    const service = createService(createPrisma());
    await expect(service.list({ cursor: 'not-valid' })).rejects.toBeInstanceOf(BadRequestException);
    const mismatched = Buffer.from(JSON.stringify({
      sort: 'createdAt', direction: 'desc', value: '2026-09-01T00:00:00.000Z',
      id: baseRow.id,
    })).toString('base64url');
    await expect(service.list({ cursor: mismatched })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies status, priority, and cross-field search filters', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);
    await service.list({ status: 'completed', priority: 'critical', search: 'T-21' });
    const where = JSON.stringify(prisma.workOrder.findMany.mock.calls[0][0].where);
    expect(where).toContain('completed');
    expect(where).toContain('critical');
    expect(where).toContain('displayId');
    expect(where).toContain('truckNumber');
    expect(where).toContain('primaryCategory');
    expect(where).toContain('mechanics');
  });

  it('applies absolute created and completed date boundaries', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await service.list({
      createdBefore: '2026-09-08T12:00:00.000Z',
      completedFrom: '2026-09-01T00:00:00-04:00',
      completedBefore: '2026-09-09T00:00:00-04:00',
    });

    const where = prisma.workOrder.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      { createdAt: { lt: new Date('2026-09-08T12:00:00.000Z') } },
      { completedAt: { gte: new Date('2026-09-01T04:00:00.000Z') } },
      { completedAt: { lt: new Date('2026-09-09T04:00:00.000Z') } },
    ]));
  });

  it('returns 404 for a missing detail', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findUnique.mockResolvedValue(null);
    const service = createService(prisma);
    await expect(service.detail(baseRow.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists mechanics with open assignments and rejects a missing mechanic', async () => {
    const prisma = createPrisma();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);
    const service = createService(prisma);
    await expect(service.listMechanics({})).resolves.toEqual({ items: [], nextCursor: null });
    await expect(service.mechanicDetail(baseRow.createdById)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('defaults History to completed and cancelled Work Orders', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);
    await service.listHistory({});
    const where = JSON.stringify(prisma.workOrder.findMany.mock.calls[0][0].where);
    expect(where).toContain('completed');
    expect(where).toContain('cancelled');
  });

  it('rejects History filters for open Work Orders', async () => {
    const service = createService(createPrisma());
    await expect(service.listHistory({ status: 'in_progress' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists trucks without inventing Off Duty state', async () => {
    const prisma = createPrisma();
    prisma.truck.findMany.mockResolvedValue([]);
    const service = createService(prisma);
    await expect(service.listTrucks({})).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('adds a standard mechanic, reactivates a removed assignment, and refuses PM or closed Work Orders', async () => {
    const mechanicId = '00000000-0000-4000-8000-000000000001';
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      pmAuthorized: false,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const body = {
      mechanicId,
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000701',
    };
    const wo = detailRow();
    const activity = { log: vi.fn() };
    const tx = assignmentTx(wo, {
      user: { findFirst: vi.fn().mockResolvedValue({ id: mechanicId, name: 'Alejandro 1' }) },
      mechanicAssignment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    });
    tx.workOrder.findUnique
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(detailRow({
        version: 2,
        mechanics: [{ mechanic: { id: mechanicId, name: 'Alejandro 1' }, addedAt: new Date(), removedAt: null }],
      }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never);

    await expect(service.addMechanic(manager, wo.id, body)).resolves.toMatchObject({ version: 2 });
    expect(tx.mechanicAssignment.create).toHaveBeenCalled();
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.MECHANIC_ADDED }));

    const removed = { id: 'asg-1', removedAt: new Date(), mechanicId };
    tx.mechanicAssignment.findUnique.mockResolvedValue(removed);
    tx.workOrder.findUnique.mockReset();
    tx.workOrder.findUnique
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(detailRow({ version: 2 }));
    await service.addMechanic(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000702' });
    expect(tx.mechanicAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'asg-1' },
      data: expect.objectContaining({ removedAt: null }),
    }));

    const pm = assignmentTx(detailRow({ primaryCategory: { ...baseRow.primaryCategory, name: 'PM' } }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof pm) => unknown) => callback(pm));
    await expect(service.addMechanic(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000703' }))
      .rejects.toBeInstanceOf(BadRequestException);

    const closed = assignmentTx(detailRow({ status: 'completed' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof closed) => unknown) => callback(closed));
    await expect(service.addMechanic(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000704' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses the last active assignment, version conflicts, and replays idempotent add', async () => {
    const mechanicId = '00000000-0000-4000-8000-000000000001';
    const otherId = '00000000-0000-4000-8000-000000000099';
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      pmAuthorized: false,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const stored = { id: baseRow.id, version: 3 };
    const prisma = createPrisma();
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: baseRow.id,
      operation: 'admin_add_mechanic',
      payloadHash: idempotencyFingerprint({
        workOrderId: baseRow.id,
        mechanicId,
        expectedVersion: 1,
      }),
      actorId: manager.id,
      result: stored,
    });
    const service = createService(prisma);
    await expect(service.addMechanic(manager, baseRow.id, {
      mechanicId,
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000705',
    })).resolves.toEqual(stored);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    prisma.workOrderMutation.findUnique.mockResolvedValue(null);
    const stale = assignmentTx(detailRow({ version: 4 }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof stale) => unknown) => callback(stale));
    await expect(service.addMechanic(manager, baseRow.id, {
      mechanicId,
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000706',
    })).rejects.toBeInstanceOf(ConflictException);

    const last = assignmentTx(detailRow({
      mechanics: [{ mechanic: { id: mechanicId, name: 'Alejandro 1' }, addedAt: new Date(), removedAt: null }],
    }), {
      mechanicAssignment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'asg-1', removedAt: null, mechanicId }),
        update: vi.fn(),
      },
    });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof last) => unknown) => callback(last));
    await expect(service.removeMechanic(manager, baseRow.id, mechanicId, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000707',
    })).rejects.toBeInstanceOf(BadRequestException);

    const twoRow = detailRow({
      mechanics: [
        { mechanic: { id: mechanicId, name: 'Alejandro 1' }, addedAt: new Date(), removedAt: null },
        { mechanic: { id: otherId, name: 'Anthony' }, addedAt: new Date(), removedAt: null },
      ],
    });
    const two = assignmentTx(twoRow, {
      mechanicAssignment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'asg-2', removedAt: null, mechanicId: otherId }),
        update: vi.fn(),
      },
    });
    two.workOrder.findUnique
      .mockResolvedValueOnce(twoRow)
      .mockResolvedValueOnce(twoRow)
      .mockResolvedValueOnce(detailRow({
        version: 2,
        mechanics: [{ mechanic: { id: mechanicId, name: 'Alejandro 1' }, addedAt: new Date(), removedAt: null }],
      }));
    const activity = { log: vi.fn() };
    const mutating = new AdminService(prisma as never, activity as never);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof two) => unknown) => callback(two));
    await expect(mutating.removeMechanic(manager, baseRow.id, otherId, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000708',
    })).resolves.toMatchObject({ version: 2 });
    expect(two.mechanicAssignment.update).toHaveBeenCalled();
    expect(activity.log).toHaveBeenCalledWith(two, expect.objectContaining({ eventType: ActivityEventType.MECHANIC_REMOVED }));
  });

  it('cancels open Standard and PM Work Orders, closes labor, and refuses closed ones', async () => {
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      pmAuthorized: false,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const body = {
      reason: 'Duplicate Work Order',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000801',
    };
    const wo = detailRow({ status: 'in_progress' });
    const session = { id: 'sess-1', startedAt: new Date('2026-09-06T16:00:00.000Z'), endedAt: null };
    const pause = { id: 'pause-1', startedAt: new Date('2026-09-06T17:00:00.000Z'), endedAt: null };
    const activity = { log: vi.fn() };
    const tx = cancelTx(wo, {
      workSession: {
        findFirst: vi.fn().mockResolvedValue(session),
        findMany: vi.fn().mockResolvedValue([{ ...session, endedAt: new Date() }]),
        update: vi.fn(),
      },
      pauseEvent: {
        findFirst: vi.fn().mockResolvedValue(pause),
        findMany: vi.fn().mockResolvedValue([{ ...pause, endedAt: new Date() }]),
        update: vi.fn(),
      },
    });
    tx.workOrder.findUnique
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(detailRow({ status: 'cancelled', version: 2 }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never);

    await expect(service.cancelWorkOrder(manager, wo.id, body)).resolves.toMatchObject({ status: 'cancelled', version: 2 });
    expect(tx.workSession.update).toHaveBeenCalled();
    expect(tx.pauseEvent.update).toHaveBeenCalled();
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.MANAGER_CORRECTION }));

    const pmRow = detailRow({ primaryCategory: { ...baseRow.primaryCategory, name: 'PM' } });
    const pm = cancelTx(pmRow);
    pm.workOrder.findUnique
      .mockResolvedValueOnce(pmRow)
      .mockResolvedValueOnce(pmRow)
      .mockResolvedValueOnce(detailRow({ status: 'cancelled', version: 2, primaryCategory: pmRow.primaryCategory }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof pm) => unknown) => callback(pm));
    await expect(service.cancelWorkOrder(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000802' }))
      .resolves.toMatchObject({ status: 'cancelled' });

    const closed = cancelTx(detailRow({ status: 'completed' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof closed) => unknown) => callback(closed));
    await expect(service.cancelWorkOrder(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000803' }))
      .rejects.toBeInstanceOf(BadRequestException);

    await expect(service.cancelWorkOrder(manager, wo.id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000804',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replays an idempotent cancel and rejects a stale Work Order version', async () => {
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      pmAuthorized: false,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const stored = { id: baseRow.id, status: 'cancelled', version: 3 };
    const prisma = createPrisma();
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: baseRow.id,
      operation: 'admin_cancel_work_order',
      payloadHash: idempotencyFingerprint({
        workOrderId: baseRow.id,
        reason: 'Duplicate Work Order',
        expectedVersion: 1,
      }),
      actorId: manager.id,
      result: stored,
    });
    const service = createService(prisma);
    await expect(service.cancelWorkOrder(manager, baseRow.id, {
      reason: 'Duplicate Work Order',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000805',
    })).resolves.toEqual(stored);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    prisma.workOrderMutation.findUnique.mockResolvedValue(null);
    const stale = cancelTx(detailRow({ version: 4 }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof stale) => unknown) => callback(stale));
    await expect(service.cancelWorkOrder(manager, baseRow.id, {
      reason: 'Duplicate Work Order',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000806',
    })).rejects.toBeInstanceOf(ConflictException);
  });
});

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    ...baseRow,
    createdBy: { id: baseRow.createdById, name: 'Shop Manager' },
    completedBy: null,
    jobs: [{
      id: '00000000-0000-4000-8000-000000000501',
      displayName: 'Inspect',
      customDescription: null,
      status: 'to_do',
      categoryId: baseRow.primaryCategoryId,
      category: { name: 'Engine' },
    }],
    pauseEvents: [],
    activityLogs: [],
    mechanics: [],
    ...overrides,
  };
}

function assignmentTx(wo: ReturnType<typeof detailRow>, extra: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(wo),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findFirst: vi.fn() },
    mechanicAssignment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    ...extra,
  };
}

function cancelTx(wo: ReturnType<typeof detailRow>, extra: Record<string, unknown> = {}) {
  return assignmentTx(wo, {
    workSession: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    pauseEvent: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    ...extra,
  });
}
