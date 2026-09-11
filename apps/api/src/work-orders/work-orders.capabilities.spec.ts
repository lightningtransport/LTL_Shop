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
  it.each([
    [MechanicMode.STANDARD, AppCapability.MECHANIC_STANDARD, { name: { not: 'PM' } }],
    [MechanicMode.PM, AppCapability.MECHANIC_PM, { name: 'PM' }],
  ] as const)('filters %s lists by category', async (mode, capability, categoryFilter) => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new WorkOrdersService({ workOrder: { findMany } } as never, { log: vi.fn() } as never);

    await expect(service.listForMechanic(user([capability]), mode)).resolves.toEqual({
      created: [], active: [], paused: [], completed: [],
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ primaryCategory: categoryFilter }),
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

  it('requires notes when a reported blocker uses the Other reason', async () => {
    const service = new WorkOrdersService({} as never, { log: vi.fn() } as never);
    await expect(
      service.reportBlocker(user([AppCapability.MECHANIC_STANDARD]), '11111111-1111-4111-8111-111111111111', {
        reason: 'other',
      }),
    ).rejects.toThrow('Notes are required when reason is Other');
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
});
