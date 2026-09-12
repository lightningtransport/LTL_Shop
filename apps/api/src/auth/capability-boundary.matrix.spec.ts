import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AppCapability, PauseReason } from '@ltl-shop/shared';
import { AdminController } from '../admin/admin.controller';
import { WorkOrdersController } from '../work-orders/work-orders.controller';
import type { AuthUser } from './auth.guard';
import { CapabilitiesGuard } from './capabilities.guard';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import {
  ADMIN_MUTATION_BOUNDARIES,
  ADMIN_READ_BOUNDARIES,
  WORK_ORDER_MUTATION_BOUNDARIES,
  adminHandler,
  declaredHttpCapabilities,
} from './capability-boundary.matrix';

const WO_ID = '11111111-1111-4111-8111-111111111111';
const JOB_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const TRUCK_ID = '44444444-4444-4444-8444-444444444444';

function user(capabilities: AppCapability[], id = 'actor-1'): AuthUser {
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

function httpContext(
  handler: (...args: never[]) => unknown,
  controller: object,
  capabilities: AppCapability[],
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: { capabilities } }) }),
  } as unknown as ExecutionContext;
}

function assignedStandardWorkOrder(status = 'in_progress') {
  return {
    id: WO_ID,
    createdById: 'mechanic-1',
    primaryCategory: { name: 'Brakes' },
    mechanics: [{ mechanicId: 'mechanic-1', removedAt: null }],
    status,
    jobs: [{ status: 'to_do' }],
    notes: null,
  };
}

function assignedPmWorkOrder(status = 'in_progress') {
  return {
    id: WO_ID,
    createdById: 'pm-1',
    primaryCategory: { name: 'PM' },
    mechanics: [{ mechanicId: 'pm-1', removedAt: null }],
    status,
    truck: { make: 'Volvo', model: 'VNL' },
  };
}

function workOrderService(workOrder: object) {
  const tx = {
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(workOrder),
    },
    workOrderMutation: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
  return new WorkOrdersService(
    {
      workOrder: { findUnique: vi.fn().mockResolvedValue(workOrder) },
      workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never,
    { log: vi.fn() } as never,
  );
}

describe('TARGET capability boundary matrix', () => {
  const reflector = new Reflector();
  const guard = new CapabilitiesGuard(reflector);

  it('keeps class-level Admin access as the Admin read default', () => {
    expect(declaredHttpCapabilities(AdminController, undefined)).toEqual([AppCapability.ADMIN_ACCESS]);
  });

  it.each(ADMIN_READ_BOUNDARIES)(
    'declares $method $path as $expected',
    ({ handler, expected }) => {
      expect(declaredHttpCapabilities(AdminController, adminHandler(handler))).toEqual(expected);
    },
  );

  it.each(ADMIN_MUTATION_BOUNDARIES)(
    'declares $method $path as $expected',
    ({ handler, expected }) => {
      expect(declaredHttpCapabilities(AdminController, adminHandler(handler))).toEqual(expected);
    },
  );

  it.each(ADMIN_MUTATION_BOUNDARIES)(
    'allows $method $path when every expected capability is present',
    ({ handler, expected }) => {
      expect(guard.canActivate(httpContext(adminHandler(handler), AdminController, expected))).toBe(true);
    },
  );

  it.each(ADMIN_MUTATION_BOUNDARIES)(
    'denies $method $path when a mechanic has no Admin capability',
    ({ handler }) => {
      expect(() =>
        guard.canActivate(
          httpContext(adminHandler(handler), AdminController, [AppCapability.MECHANIC_STANDARD]),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it.each(ADMIN_MUTATION_BOUNDARIES.filter((entry) => entry.expected.length > 1))(
    'denies $method $path when admin.access is present but the extra capability is missing',
    ({ handler }) => {
      expect(() =>
        guard.canActivate(
          httpContext(adminHandler(handler), AdminController, [AppCapability.ADMIN_ACCESS]),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it.each(ADMIN_MUTATION_BOUNDARIES.filter((entry) => entry.expected.includes(AppCapability.WORK_ORDERS_MANAGE)))(
    'denies $method $path when only work_orders.manage is present',
    ({ handler }) => {
      expect(() =>
        guard.canActivate(
          httpContext(adminHandler(handler), AdminController, [AppCapability.WORK_ORDERS_MANAGE]),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it.each(ADMIN_MUTATION_BOUNDARIES.filter((entry) => entry.expected.includes(AppCapability.YARD_OPERATIONS_MANAGE)))(
    'denies $method $path when only yard.operations.manage is present',
    ({ handler }) => {
      expect(() =>
        guard.canActivate(
          httpContext(adminHandler(handler), AdminController, [AppCapability.YARD_OPERATIONS_MANAGE]),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it('does not put a Capabilities decorator on the mechanic Work Order controller', () => {
    expect(declaredHttpCapabilities(WorkOrdersController, undefined)).toEqual([]);
    for (const entry of WORK_ORDER_MUTATION_BOUNDARIES) {
      const handler = WorkOrdersController.prototype[entry.handler as keyof WorkOrdersController] as (
        ...args: never[]
      ) => unknown;
      expect(declaredHttpCapabilities(WorkOrdersController, handler)).toEqual([]);
    }
  });

  it('re-declares admin.access on every method that adds a second capability', () => {
    const overrides = ADMIN_MUTATION_BOUNDARIES.filter((entry) => entry.expected.length > 1);
    expect(overrides.length).toBeGreaterThan(0);
    for (const entry of overrides) {
      expect(entry.expected[0]).toBe(AppCapability.ADMIN_ACCESS);
    }
  });
});

describe('Mechanic Work Order mutation capability enforcement', () => {
  const standard = user([AppCapability.MECHANIC_STANDARD], 'mechanic-1');
  const adminOnly = user([AppCapability.ADMIN_ACCESS], 'admin-1');
  const managerOnly = user(
    [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE],
    'manager-1',
  );
  const pm = user([AppCapability.MECHANIC_PM], 'pm-1');

  it('lets an assigned Standard mechanic pass Start authorization', async () => {
    const service = workOrderService(assignedStandardWorkOrder('created'));
    try {
      await service.start(standard, WO_ID);
    } catch (error) {
      expect(error).not.toBeInstanceOf(ForbiddenException);
    }
  });

  it.each([
    ['start', (service: WorkOrdersService) => service.start(adminOnly, WO_ID)],
    ['pause', (service: WorkOrdersService) => service.pause(adminOnly, WO_ID, { reason: PauseReason.WAITING_FOR_PARTS })],
    [
      'changePauseReason',
      (service: WorkOrdersService) =>
        service.changePauseReason(adminOnly, WO_ID, { reason: PauseReason.WAITING_FOR_PARTS }),
    ],
    ['resume', (service: WorkOrdersService) => service.resume(adminOnly, WO_ID)],
    [
      'reportBlocker',
      (service: WorkOrdersService) =>
        service.reportBlocker(adminOnly, WO_ID, { reason: PauseReason.WAITING_FOR_PARTS }),
    ],
    ['complete', (service: WorkOrdersService) => service.complete(adminOnly, WO_ID)],
    [
      'addJob',
      (service: WorkOrdersService) =>
        service.addJob(adminOnly, WO_ID, {
          categoryId: CATEGORY_ID,
          displayName: 'Inspect pads',
          expectedVersion: 1,
          idempotencyKey: '55555555-5555-4555-8555-555555555555',
        }),
    ],
    ['updateNotes', (service: WorkOrdersService) => service.updateNotes(adminOnly, WO_ID, { notes: 'Checked' })],
    ['completeJob', (service: WorkOrdersService) => service.completeJob(adminOnly, WO_ID, JOB_ID)],
  ] as const)('denies %s for an Admin-only user', async (_name, invoke) => {
    const service = workOrderService(assignedStandardWorkOrder());
    await expect(invoke(service)).rejects.toThrow(ForbiddenException);
  });

  it.each([
    ['start', (service: WorkOrdersService) => service.start(managerOnly, WO_ID)],
    ['pause', (service: WorkOrdersService) => service.pause(managerOnly, WO_ID, { reason: PauseReason.WAITING_FOR_PARTS })],
    ['resume', (service: WorkOrdersService) => service.resume(managerOnly, WO_ID)],
    [
      'reportBlocker',
      (service: WorkOrdersService) =>
        service.reportBlocker(managerOnly, WO_ID, { reason: PauseReason.WAITING_FOR_PARTS }),
    ],
    ['complete', (service: WorkOrdersService) => service.complete(managerOnly, WO_ID)],
  ] as const)('denies mechanic %s for a Manager without mechanic.standard', async (_name, invoke) => {
    const service = workOrderService(assignedStandardWorkOrder());
    await expect(invoke(service)).rejects.toThrow(ForbiddenException);
  });

  it('denies Standard create for an Admin-only user', async () => {
    const service = new WorkOrdersService(
      {
        workOrder: { findUnique: vi.fn().mockResolvedValue(null) },
        truck: { findUnique: vi.fn().mockResolvedValue({ id: TRUCK_ID }) },
        jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: CATEGORY_ID, name: 'Brakes' }) },
      } as never,
      { log: vi.fn() } as never,
    );
    await expect(
      service.create(adminOnly, {
        truckId: TRUCK_ID,
        primaryCategoryId: CATEGORY_ID,
        jobs: [{ categoryId: CATEGORY_ID, displayName: 'Inspect pads' }],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies PM service updates for a Standard mechanic', async () => {
    const service = workOrderService(assignedPmWorkOrder());
    await expect(
      service.updatePmService(standard, WO_ID, { observedMileage: 1000, selections: [] }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets an assigned PM mechanic pass PM-update authorization', async () => {
    const service = workOrderService(assignedPmWorkOrder('created'));
    await expect(
      service.updatePmService(pm, WO_ID, { observedMileage: 1000, selections: [] }),
    ).rejects.toThrow('Start or resume the PM Work Order before updating service details');
  });

  it('blocks an assigned Standard mechanic from a Work Order they do not own', async () => {
    const service = workOrderService({
      ...assignedStandardWorkOrder(),
      createdById: 'other',
      mechanics: [{ mechanicId: 'other', removedAt: null }],
    });
    await expect(service.start(standard, WO_ID)).rejects.toThrow('This Work Order is not assigned to you.');
  });

  it('denies Standard create for an assigned Standard mechanic', async () => {
    const service = new WorkOrdersService(
      {
        workOrder: { findUnique: vi.fn().mockResolvedValue(null) },
        truck: { findUnique: vi.fn().mockResolvedValue({ id: TRUCK_ID }) },
        jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: CATEGORY_ID, name: 'Brakes' }) },
      } as never,
      { log: vi.fn() } as never,
    );
    await expect(
      service.create(standard, {
        truckId: TRUCK_ID,
        primaryCategoryId: CATEGORY_ID,
        jobs: [{ categoryId: CATEGORY_ID, displayName: 'Inspect pads' }],
      }),
    ).rejects.toThrow('Standard Work Orders are created by a Shop Manager.');
  });

  it.each([
    ['pause', (service: WorkOrdersService) => service.pause(standard, WO_ID, { reason: PauseReason.WAITING_FOR_PARTS })],
    [
      'changePauseReason',
      (service: WorkOrdersService) =>
        service.changePauseReason(standard, WO_ID, { reason: PauseReason.WAITING_FOR_PARTS }),
    ],
    ['resume', (service: WorkOrdersService) => service.resume(standard, WO_ID)],
    ['complete', (service: WorkOrdersService) => service.complete(standard, WO_ID)],
    [
      'addJob',
      (service: WorkOrdersService) =>
        service.addJob(standard, WO_ID, {
          categoryId: CATEGORY_ID,
          displayName: 'Inspect pads',
          expectedVersion: 1,
          idempotencyKey: '55555555-5555-4555-8555-555555555555',
        }),
    ],
  ] as const)('denies Standard %s for an assigned Standard mechanic', async (_name, invoke) => {
    const service = workOrderService(assignedStandardWorkOrder());
    await expect(invoke(service)).rejects.toThrow(ForbiddenException);
  });

  it('still lets an assigned PM mechanic pass PM pause authorization', async () => {
    const service = workOrderService(assignedPmWorkOrder());
    try {
      await service.pause(pm, WO_ID, { reason: PauseReason.WAITING_FOR_PARTS });
    } catch (error) {
      expect(error).not.toBeInstanceOf(ForbiddenException);
    }
  });
});
