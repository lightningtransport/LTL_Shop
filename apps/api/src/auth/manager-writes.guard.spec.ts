import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AppCapability, UserRole } from '@ltl-shop/shared';
import { AdminController } from '../admin/admin.controller';
import { ManagerWritesGuard, canDoManagerWrites } from './manager-writes.guard';

function contextFor(user?: { role?: string; capabilities?: AppCapability[] }): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;
}

describe('ManagerWritesGuard (D22 roster, D25 catalog)', () => {
  const guard = new ManagerWritesGuard();

  it('lets the Shop Manager (admin.access + work_orders.manage) and the System Admin by role through', () => {
    expect(canDoManagerWrites({ role: UserRole.MANAGER, capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE, AppCapability.YARD_OPERATIONS_MANAGE] })).toBe(true);
    expect(guard.canActivate(contextFor({ role: UserRole.ADMIN, capabilities: [AppCapability.ADMIN_ACCESS] }))).toBe(true);
  });

  it('refuses a mechanic, Safety, a read-only admin.access holder and a missing user', () => {
    expect(() => guard.canActivate(contextFor({ role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD] }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor({ role: UserRole.MECHANIC, capabilities: [AppCapability.QUALITY_CHECK_PERFORM] }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor({ role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD, AppCapability.ADMIN_ACCESS] }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor({ role: UserRole.MANAGER, capabilities: [AppCapability.ADMIN_ACCESS] }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });

  it('is attached to the three roster writes and the two catalog Job writes', () => {
    for (const handler of [
      AdminController.prototype.createMechanic,
      AdminController.prototype.updateMechanic,
      AdminController.prototype.resetMechanicPassword,
      AdminController.prototype.createCatalogJob,
      AdminController.prototype.updateCatalogJob,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([ManagerWritesGuard]);
    }
  });
});
