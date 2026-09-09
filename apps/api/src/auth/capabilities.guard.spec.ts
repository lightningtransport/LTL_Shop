import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import { AdminController } from '../admin/admin.controller';
import { CAPABILITIES_KEY } from './capabilities.decorator';
import { CapabilitiesGuard } from './capabilities.guard';

function contextFor(capabilities: AppCapability[] = []) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user: { capabilities } }) }),
  } as unknown as ExecutionContext;
}

describe('CapabilitiesGuard', () => {
  it('allows a user with every required capability', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue([AppCapability.ADMIN_ACCESS]) } as unknown as Reflector;
    expect(new CapabilitiesGuard(reflector).canActivate(contextFor([AppCapability.ADMIN_ACCESS]))).toBe(true);
  });

  it('denies a user without the required capability', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue([AppCapability.ADMIN_ACCESS]) } as unknown as Reflector;
    expect(() => new CapabilitiesGuard(reflector).canActivate(contextFor([AppCapability.MECHANIC_STANDARD]))).toThrow(ForbiddenException);
  });

  it('does not change authenticated routes without capability metadata', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    expect(new CapabilitiesGuard(reflector).canActivate(contextFor())).toBe(true);
  });

  it('declares Admin access on the Admin controller', () => {
    expect(Reflect.getMetadata(CAPABILITIES_KEY, AdminController)).toEqual([AppCapability.ADMIN_ACCESS]);
  });

  it('requires both Admin access and Yard Operations management for mutations', () => {
    expect(Reflect.getMetadata(CAPABILITIES_KEY, AdminController.prototype.startReadinessAssessment))
      .toEqual([AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE]);
  });
});
