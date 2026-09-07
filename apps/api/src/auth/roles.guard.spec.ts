import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@ltl-shop/shared';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';
import { AdminController } from '../admin/admin.controller';

function contextFor(role?: UserRole) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const allowed = [UserRole.MANAGER, UserRole.ADMIN];

  it.each([UserRole.MANAGER, UserRole.ADMIN])('allows %s', (role) => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(allowed) } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(contextFor(role))).toBe(true);
  });

  it('denies mechanics', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(allowed) } as unknown as Reflector;
    expect(() => new RolesGuard(reflector).canActivate(contextFor(UserRole.MECHANIC))).toThrow(
      ForbiddenException,
    );
  });

  it('denies a request without an authenticated user', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(allowed) } as unknown as Reflector;
    expect(() => new RolesGuard(reflector).canActivate(contextFor())).toThrow(ForbiddenException);
  });

  it('does not change authenticated routes without role metadata', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(contextFor(UserRole.MECHANIC))).toBe(true);
  });

  it('declares Manager and Admin access on the Admin controller', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(allowed);
  });
});
