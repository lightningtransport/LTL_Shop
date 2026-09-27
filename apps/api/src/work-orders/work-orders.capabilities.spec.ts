import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppCapability, MechanicMode } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';

function user(capabilities: AppCapability[], id = 'user-1'): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    role: 'admin',
    active: true,
    pmAuthorized: capabilities.includes(AppCapability.MECHANIC_PM),
    capabilities,
    supabaseAuthId: null,
  };
}

describe('Work Order workspace capabilities', () => {
  it('filters standard lists by category', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new WorkOrdersService({ workOrder: { findMany } } as never, { log: vi.fn() } as never);

    await expect(service.listForMechanic(user([AppCapability.MECHANIC_STANDARD]), MechanicMode.STANDARD)).resolves.toEqual({
      created: [], active: [], paused: [], completed: [],
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ primaryCategory: { name: { not: 'PM' } } }),
    }));
  });

  it('lists legacy PM Work Orders and truck Work Orders whose PM job is mine (LTR-146)', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new WorkOrdersService({ workOrder: { findMany } } as never, { log: vi.fn() } as never);
    const pm = user([AppCapability.MECHANIC_PM]);

    await expect(service.listForMechanic(pm, MechanicMode.PM)).resolves.toEqual({
      created: [], active: [], paused: [], completed: [],
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [{
          OR: [
            { primaryCategory: { name: 'PM' } },
            { jobs: { some: { assignedMechanicId: pm.id, status: { not: 'cancelled' }, category: { name: 'PM' } } } },
          ],
        }],
      }),
    }));
  });

  it('denies Admin-only users from mechanic list endpoints', async () => {
    const service = new WorkOrdersService({ workOrder: { findMany: vi.fn() } } as never, { log: vi.fn() } as never);
    await expect(service.listForMechanic(user([AppCapability.ADMIN_ACCESS]), MechanicMode.STANDARD))
      .rejects.toThrow(ForbiddenException);
  });

  it('allows a dual-capability user into both mechanic workspaces', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new WorkOrdersService({ workOrder: { findMany } } as never, { log: vi.fn() } as never);
    const multi = user([
      AppCapability.ADMIN_ACCESS,
      AppCapability.MECHANIC_STANDARD,
      AppCapability.MECHANIC_PM,
    ]);
    await service.listForMechanic(multi, MechanicMode.STANDARD);
    await service.listForMechanic(multi, MechanicMode.PM);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('lets a Manager without mechanic capability create a standard Work Order', async () => {
    const truckId = '11111111-1111-4111-8111-111111111111';
    const categoryId = '22222222-2222-4222-8222-222222222222';
    const prisma = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      jobCategory: {
        findUnique: vi.fn().mockResolvedValue({ id: categoryId, name: 'Brakes' }),
        findMany: vi.fn().mockResolvedValue([{ id: categoryId, name: 'Brakes' }]),
      },
      catalogJob: { findFirst: vi.fn().mockResolvedValue(null) },
      // Prove the capability gate is passed for a Manager by reaching the tx.
      $transaction: vi.fn().mockRejectedValue(new Error('reached-transaction')),
    };
    const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never);

    await expect(
      service.createByManager(user([AppCapability.WORK_ORDERS_MANAGE, AppCapability.ADMIN_ACCESS]), {
        truckId,
        primaryCategoryId: categoryId,
        jobs: [{ categoryId, displayName: 'Custom brake fix', customDescription: 'Bleed lines' }],
      }),
    ).rejects.toThrow('reached-transaction');
  });

  it('rejects a Manager creating a PM service', async () => {
    const truckId = '11111111-1111-4111-8111-111111111111';
    const categoryId = '33333333-3333-4333-8333-333333333333';
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: categoryId, name: 'PM' }) },
    };
    const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never);

    await expect(
      service.createByManager(user([AppCapability.WORK_ORDERS_MANAGE]), {
        truckId,
        primaryCategoryId: categoryId,
        jobs: [],
      }),
    ).rejects.toThrow('PM stays in the mechanic flow');
  });

  it('rejects invalid per-job assignees when a Manager creates a Work Order', async () => {
    const truckId = '11111111-1111-4111-8111-111111111111';
    const categoryId = '33333333-3333-4333-8333-333333333333';
    const mechanicId = '22222222-2222-4222-8222-222222222222';
    const prisma = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      jobCategory: {
        findUnique: vi.fn().mockResolvedValue({ id: categoryId, name: 'Brakes' }),
        findMany: vi.fn().mockResolvedValue([{ id: categoryId, name: 'Brakes' }]),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never);

    await expect(
      service.createByManager(user([AppCapability.WORK_ORDERS_MANAGE, AppCapability.ADMIN_ACCESS]), {
        truckId,
        primaryCategoryId: categoryId,
        jobs: [{
          categoryId,
          displayName: 'Brake inspection',
          assignedMechanicId: mechanicId,
        }],
      }),
    ).rejects.toThrow('One or more selected mechanics cannot perform standard work');
  });

  it('requires notes when a reported blocker uses the Other reason', async () => {
    const service = new WorkOrdersService({} as never, { log: vi.fn() } as never);
    await expect(
      service.reportBlocker(user([AppCapability.MECHANIC_STANDARD]), '11111111-1111-4111-8111-111111111111', {
        reason: 'other',
      }),
    ).rejects.toThrow('Notes are required when reason is Other');
  });

  it('lets an Admin-only user read a PM Work Order they are not assigned to', async () => {
    const workOrder = assignedReadWorkOrder({
      createdById: 'pm-1',
      primaryCategory: { id: 'pm-category', name: 'PM' },
      mechanics: [{ mechanicId: 'pm-1', addedAt: new Date('2026-09-09T12:00:00.000Z'), removedAt: null, mechanic: { name: 'Cristian' } }],
      jobs: [],
    });
    const service = new WorkOrdersService(
      { workOrder: { findUnique: vi.fn().mockResolvedValue(workOrder) } } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.getById(user([AppCapability.ADMIN_ACCESS], 'admin-1'), 'wo-1'))
      .resolves.toMatchObject({ id: 'wo-1', primaryCategoryName: 'PM' });
  });

  it('lets an Admin-only user read PM service details without gaining edit', async () => {
    const workOrder = {
      id: 'wo-1',
      truckId: 'truck-1',
      createdById: 'pm-1',
      status: 'in_progress',
      primaryCategory: { name: 'PM' },
      mechanics: [{ mechanicId: 'pm-1', removedAt: null }],
      truck: { mileage: 142500, make: 'Volvo', model: 'VNL' },
      pmService: { observedMileage: 140000, parts: [] },
    };
    const service = new WorkOrdersService(
      {
        workOrder: { findUnique: vi.fn().mockResolvedValue(workOrder) },
        partCategory: { findMany: vi.fn().mockResolvedValue([]) },
        pmService: { findMany: vi.fn().mockResolvedValue([{
          workOrderId: 'wo-prior',
          observedMileage: 120000,
          workOrder: { displayId: 'WO-001', completedAt: null, createdAt: new Date('2026-08-01T00:00:00.000Z') },
          workOrderJob: null,
        }]) },
      } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.getPmService(user([AppCapability.ADMIN_ACCESS], 'admin-1'), 'wo-1'))
      .resolves.toMatchObject({
        workOrderId: 'wo-1',
        canEdit: false,
        observedMileage: 140000,
        lastCompletedPm: {
          workOrderId: 'wo-prior',
          displayId: 'WO-001',
          completedAt: '2026-08-01T00:00:00.000Z',
          observedMileage: 120000,
        },
      });
  });

  it('returns the PM before this one for a completed PM (LTR-137)', async () => {
    const completedAt = new Date('2026-09-22T15:00:00.000Z');
    // LTR-146: candidates include legacy PM Work Orders and PM jobs; only the ones before this service count.
    const findMany = vi.fn().mockResolvedValue([
      { workOrderId: 'wo-after', observedMileage: 370000, workOrderJob: null,
        workOrder: { displayId: 'WO-9', completedAt: new Date('2026-09-23T10:00:00.000Z'), createdAt: new Date('2026-09-23T09:00:00.000Z') } },
      { workOrderId: 'wo-job', observedMileage: 360000, workOrderJob: { completedAt: new Date('2026-09-10T10:00:00.000Z') },
        workOrder: { displayId: 'WO-7', completedAt: null, createdAt: new Date('2026-09-09T09:00:00.000Z') } },
    ]);
    const service = new WorkOrdersService(
      {
        workOrder: { findUnique: vi.fn().mockResolvedValue({
          id: 'wo-2', truckId: 'truck-601', createdById: 'pm-1', status: 'completed', completedAt,
          primaryCategory: { name: 'PM' }, mechanics: [{ mechanicId: 'pm-1', removedAt: null }],
          truck: { mileage: 365686, make: 'Mack', model: 'Anthem' },
          pmService: { observedMileage: 364400, parts: [] },
        }) },
        partCategory: { findMany: vi.fn().mockResolvedValue([]) },
        pmService: { findMany },
      } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.getPmService(user([AppCapability.ADMIN_ACCESS], 'admin-1'), 'wo-2'))
      .resolves.toMatchObject({
        serviceCompletedAt: completedAt.toISOString(),
        lastCompletedPm: { workOrderId: 'wo-job', displayId: 'WO-7', completedAt: '2026-09-10T10:00:00.000Z' },
      });
    expect(findMany.mock.calls[0][0].where.workOrderId).toEqual({ not: 'wo-2' });
  });

  it('still denies PM service updates for an Admin-only user', async () => {
    const service = new WorkOrdersService(
      {
        workOrder: { findUnique: vi.fn().mockResolvedValue({
          id: 'wo-1',
          createdById: 'pm-1',
          status: 'in_progress',
          primaryCategory: { name: 'PM' },
          mechanics: [{ mechanicId: 'pm-1', removedAt: null }],
          truck: { make: 'Volvo', model: 'VNL' },
        }) },
        $transaction: vi.fn(async (callback: (tx: { workOrder: { findUnique: ReturnType<typeof vi.fn> } }) => unknown) =>
          callback({
            workOrder: { findUnique: vi.fn().mockResolvedValue({
              id: 'wo-1',
              createdById: 'pm-1',
              status: 'in_progress',
              primaryCategory: { name: 'PM' },
              mechanics: [{ mechanicId: 'pm-1', removedAt: null }],
              truck: { make: 'Volvo', model: 'VNL' },
            }) },
          }),
        ),
      } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.updatePmService(user([AppCapability.ADMIN_ACCESS], 'admin-1'), 'wo-1', {
      observedMileage: 1000,
      selections: [],
    })).rejects.toThrow('You do not have access to the PM mechanic workspace.');
  });

  it('blocks direct mechanic access to a Work Order owned by someone else', async () => {
    const workOrder = {
      id: 'wo-1',
      createdById: 'other-user',
      primaryCategory: { name: 'Brakes' },
      mechanics: [{ mechanicId: 'other-user', removedAt: null }],
    };
    const service = new WorkOrdersService(
      { workOrder: { findUnique: vi.fn().mockResolvedValue(workOrder) } } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.getById(user([AppCapability.MECHANIC_STANDARD]), 'wo-1'))
      .rejects.toThrow('This Work Order is not assigned to you.');
  });

  it('lists Work Orders when the mechanic is a per-Job assignee even if not on the general team', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new WorkOrdersService({ workOrder: { findMany } } as never, { log: vi.fn() } as never);

    await service.listForMechanic(user([AppCapability.MECHANIC_STANDARD]), MechanicMode.STANDARD);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { createdById: 'user-1' },
          { mechanics: { some: { mechanicId: 'user-1', removedAt: null } } },
          { jobs: { some: { assignedMechanicId: 'user-1' } } },
        ],
      }),
    }));
  });

  it('allows a team mechanic to read a Work Order when Jobs are assigned to someone else', async () => {
    const workOrder = assignedReadWorkOrder({
      createdById: 'manager-1',
      mechanics: [{ mechanicId: 'user-1', addedAt: new Date('2026-09-09T12:00:00.000Z'), removedAt: null, mechanic: { name: 'Alex' } }],
      jobs: [mappedJob({ assignedMechanic: { id: 'other-mechanic', name: 'Jamie' } })],
    });
    const service = new WorkOrdersService(
      { workOrder: { findUnique: vi.fn().mockResolvedValue(workOrder) } } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.getById(user([AppCapability.MECHANIC_STANDARD]), 'wo-1'))
      .resolves.toMatchObject({
        jobs: [expect.objectContaining({ assignedMechanic: { id: 'other-mechanic', name: 'Jamie' } })],
      });
  });

  it('allows a per-Job assignee to read a Work Order without general-team membership', async () => {
    const workOrder = assignedReadWorkOrder({
      createdById: 'manager-1',
      mechanics: [],
      jobs: [mappedJob({ assignedMechanic: { id: 'user-1', name: 'Alex' } })],
    });
    const service = new WorkOrdersService(
      { workOrder: { findUnique: vi.fn().mockResolvedValue(workOrder) } } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.getById(user([AppCapability.MECHANIC_STANDARD]), 'wo-1'))
      .resolves.toMatchObject({
        jobs: [expect.objectContaining({ assignedMechanic: { id: 'user-1', name: 'Alex' } })],
      });
  });
});

function mappedJob(overrides: { assignedMechanic: { id: string; name: string } | null }) {
  return {
    id: 'job-1',
    workOrderId: 'wo-1',
    catalogJobId: 'catalog-1',
    categoryId: 'category-brakes',
    category: { id: 'category-brakes', name: 'Brakes' },
    displayName: 'Inspect brakes',
    customDescription: null,
    status: 'to_do' as const,
    completedAt: null,
    completedById: null,
    assignedMechanicId: overrides.assignedMechanic?.id ?? null,
    assignedMechanic: overrides.assignedMechanic,
  };
}

function assignedReadWorkOrder(overrides: {
  createdById: string;
  primaryCategory?: { id: string; name: string };
  mechanics: {
    mechanicId: string;
    addedAt: Date;
    removedAt: Date | null;
    mechanic: { name: string };
  }[];
  jobs: ReturnType<typeof mappedJob>[];
}) {
  return {
    id: 'wo-1',
    displayId: 'WO-0001',
    truckId: 'truck-1',
    primaryCategoryId: overrides.primaryCategory?.id ?? 'category-brakes',
    status: 'in_progress' as const,
    priority: 'normal' as const,
    notes: null,
    createdAt: new Date('2026-09-09T12:00:00.000Z'),
    createdById: overrides.createdById,
    startedAt: new Date('2026-09-09T12:05:00.000Z'),
    completedAt: null,
    completedById: null,
    totalActiveLaborMs: 0n,
    totalWaitingMs: 0n,
    version: 1,
    truck: {
      id: 'truck-1', truckNumber: '905', make: null, model: null, year: null,
      mileage: null, company: null, owner: null,
    },
    primaryCategory: overrides.primaryCategory ?? { id: 'category-brakes', name: 'Brakes' },
    pauseEvents: [],
    mechanics: overrides.mechanics,
    jobs: overrides.jobs,
  };
}
