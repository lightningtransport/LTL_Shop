import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AppCapability, UserRole } from '@ltl-shop/shared';

/**
 * D22 / LTR-187 gate for the roster (`POST/PATCH /admin/mechanics`, reset-password).
 *
 * The Shop Manager manages the people of the shop, so the write opens to whoever holds the same
 * pair that opens Work Order writes (`admin.access` + `work_orders.manage`). The System Admin
 * keeps its role-based access (`role === admin`) even when its row holds only `admin.access`.
 * Catalog writes stay on `SystemAdminGuard`.
 */
export const ROSTER_WRITE_CAPABILITIES = [
  AppCapability.ADMIN_ACCESS,
  AppCapability.WORK_ORDERS_MANAGE,
] as const;

export function canWriteRoster(user: { role?: string; capabilities?: AppCapability[] } | undefined): boolean {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  const capabilities = user.capabilities ?? [];
  return ROSTER_WRITE_CAPABILITIES.every((capability) => capabilities.includes(capability));
}

@Injectable()
export class RosterWritesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request>().user;
    if (!canWriteRoster(user)) {
      throw new ForbiddenException('Only the Shop Manager or a System Admin can change the roster.');
    }
    return true;
  }
}

type Request = { user?: { role?: string; capabilities?: AppCapability[] } };
