import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AppCapability, UserRole } from '@ltl-shop/shared';
import { AdminController } from '../admin/admin.controller';
import { SystemAdminGuard } from './system-admin.guard';

const MANAGER_CAPS = [
  AppCapability.ADMIN_ACCESS,
  AppCapability.WORK_ORDERS_MANAGE,
  AppCapability.YARD_OPERATIONS_MANAGE,
];

function contextFor(user?: { role?: string; capabilities?: AppCapability[] }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('SystemAdminGuard', () => {
  const guard = new SystemAdminGuard();

  it('allows a System Admin (role admin) even without work_orders.manage', () => {
    expect(guard.canActivate(contextFor({
      role: UserRole.ADMIN,
      capabilities: [AppCapability.ADMIN_ACCESS],
    }))).toBe(true);
  });

  it('denies a Shop Manager who has admin.access plus operational caps', () => {
    expect(() => guard.canActivate(contextFor({
      role: UserRole.MANAGER,
      capabilities: MANAGER_CAPS,
    }))).toThrow(ForbiddenException);
  });

  it('denies a mechanic and a missing user', () => {
    expect(() => guard.canActivate(contextFor({
      role: UserRole.MECHANIC,
      capabilities: [AppCapability.MECHANIC_STANDARD, AppCapability.ADMIN_ACCESS],
    }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });

  it('is attached to roster and catalog writes without replacing class guards', () => {
    const writes = [
      AdminController.prototype.createMechanic,
      AdminController.prototype.updateMechanic,
      AdminController.prototype.createCatalogJob,
      AdminController.prototype.updateCatalogJob,
    ];
    for (const handler of writes) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([SystemAdminGuard]);
    }
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual(
      expect.arrayContaining([expect.any(Function)]),
    );
  });
});
