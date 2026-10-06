import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AppCapability, PauseReason, UserRole } from '@ltl-shop/shared';
import { AdminController } from '../admin/admin.controller';
import { WorkOrdersController } from '../work-orders/work-orders.controller';
import type { AuthUser } from './auth.guard';
import { CAPABILITIES_KEY } from './capabilities.decorator';
import { CapabilitiesGuard } from './capabilities.guard';
import { ManagerWritesGuard } from './manager-writes.guard';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import {
  ADMIN_MUTATION_BOUNDARIES,
  ADMIN_READ_BOUNDARIES,
  MANAGER_WRITES,
  WORK_ORDER_MUTATION_BOUNDARIES,
  WORK_ORDER_READ_BOUNDARIES,
  adminHandler,
  declaredHttpCapabilities,
  workOrderHandler,
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
    capabilities,
    supabaseAuthId: null,
  };
}

function httpContext(
  handler: (...args: never[]) => unknown,
  controller: object,
  capabilities: AppCapability[],
  role: `${UserRole}` = 'manager',
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: { capabilities, role } }) }),
  } as unknown as ExecutionContext;
}

function assignedStandardWorkOrder(status = 'in_progress') {
  return {
    id: WO_ID,
    createdById: 'mechanic-1',
    primaryCategory: { name: 'Brakes' },
    mechanics: [{ mechanicId: 'mechanic-1', removedAt: null }],
    status,
    jobs: [{ status: 'to_do', assignedMechanicId: 'mechanic-1' }],
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
    for (const entry of [...WORK_ORDER_MUTATION_BOUNDARIES, ...WORK_ORDER_READ_BOUNDARIES]) {
      const handler = workOrderHandler(entry.handler);
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

describe('Manager writes: roster (D22) and Job catalog (D25)', () => {
  const reflector = new Reflector();
  const capabilities = new CapabilitiesGuard(reflector);
  const guard = new ManagerWritesGuard();
  const managerCaps = [
    AppCapability.ADMIN_ACCESS,
    AppCapability.WORK_ORDERS_MANAGE,
    AppCapability.YARD_OPERATIONS_MANAGE,
  ];

  it('lists the roster and the two catalog Job writes, and no category write', () => {
    expect(MANAGER_WRITES.map((entry) => entry.handler).sort()).toEqual([
      'createCatalogJob',
      'createMechanic',
      'resetMechanicPassword',
      'updateCatalogJob',
      'updateMechanic',
    ]);
  });

  it.each(MANAGER_WRITES)(
    'opens $method $path to the Shop Manager and keeps the System Admin by role',
    ({ handler, enforcement }) => {
      const method = adminHandler(handler);
      expect(enforcement).toBe('manager_writes_guard');
      expect(Reflect.getMetadata(CAPABILITIES_KEY, method)).toBeUndefined();
      expect(declaredHttpCapabilities(AdminController, method)).toEqual([AppCapability.ADMIN_ACCESS]);

      const managerContext = httpContext(method, AdminController, managerCaps, UserRole.MANAGER);
      expect(capabilities.canActivate(managerContext)).toBe(true);
      expect(guard.canActivate(managerContext)).toBe(true);

      const adminContext = httpContext(method, AdminController, [AppCapability.ADMIN_ACCESS], UserRole.ADMIN);
      expect(capabilities.canActivate(adminContext)).toBe(true);
      expect(guard.canActivate(adminContext)).toBe(true);

      const readOnlyContext = httpContext(method, AdminController, [AppCapability.ADMIN_ACCESS], UserRole.MANAGER);
      expect(() => guard.canActivate(readOnlyContext)).toThrow(ForbiddenException);
      const mechanicContext = httpContext(method, AdminController, [AppCapability.MECHANIC_STANDARD], UserRole.MECHANIC);
      expect(() => capabilities.canActivate(mechanicContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mechanicContext)).toThrow(ForbiddenException);
      const safetyContext = httpContext(method, AdminController, [AppCapability.QUALITY_CHECK_PERFORM], UserRole.MECHANIC);
      expect(() => capabilities.canActivate(safetyContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(safetyContext)).toThrow(ForbiddenException);
    },
  );
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
    [
      'reportBlocker',
      (service: WorkOrdersService) =>
        service.reportBlocker(adminOnly, WO_ID, { jobId: JOB_ID, reason: PauseReason.WAITING_FOR_PARTS }),
    ],
    ['addNote', (service: WorkOrdersService) => service.addNote(adminOnly, WO_ID, { body: 'Checked' })],
    ['completeJob', (service: WorkOrdersService) => service.completeJob(adminOnly, WO_ID, JOB_ID)],
  ] as const)('denies %s for an Admin-only user', async (_name, invoke) => {
    const service = workOrderService(assignedStandardWorkOrder());
    await expect(invoke(service)).rejects.toThrow(ForbiddenException);
  });

  it.each([
    ['start', (service: WorkOrdersService) => service.start(managerOnly, WO_ID)],
    [
      'reportBlocker',
      (service: WorkOrdersService) =>
        service.reportBlocker(managerOnly, WO_ID, { jobId: JOB_ID, reason: PauseReason.WAITING_FOR_PARTS }),
    ],
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
      jobs: [{ status: 'to_do', assignedMechanicId: 'other' }],
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
});
