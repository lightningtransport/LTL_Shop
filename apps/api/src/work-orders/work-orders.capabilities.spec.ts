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
