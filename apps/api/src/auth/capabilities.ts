import { AppCapability } from '@ltl-shop/shared';
import type { AppCapability as PrismaAppCapability } from '@prisma/client';
import type { AuthUser } from './auth.guard';

const prismaToShared: Record<PrismaAppCapability, AppCapability> = {
  ADMIN_ACCESS: AppCapability.ADMIN_ACCESS,
  MECHANIC_STANDARD: AppCapability.MECHANIC_STANDARD,
  MECHANIC_PM: AppCapability.MECHANIC_PM,
  YARD_OPERATIONS_MANAGE: AppCapability.YARD_OPERATIONS_MANAGE,
  WORK_ORDERS_MANAGE: AppCapability.WORK_ORDERS_MANAGE,
  QUALITY_CHECK_PERFORM: AppCapability.QUALITY_CHECK_PERFORM,
  INSPECTION_PERFORM: AppCapability.INSPECTION_PERFORM,
};

export function toSharedCapability(capability: PrismaAppCapability): AppCapability {
  return prismaToShared[capability];
}

export function hasCapability(
  user: Pick<AuthUser, 'capabilities'>,
  capability: AppCapability,
) {
  return user.capabilities.includes(capability);
}
