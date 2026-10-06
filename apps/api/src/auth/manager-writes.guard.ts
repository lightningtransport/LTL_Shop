import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AppCapability, UserRole } from '@ltl-shop/shared';

/**
 * Gate for the Admin writes that belong to the Shop Manager as well as the System Admin:
 * the roster (D22 / LTR-187: `POST/PATCH /admin/mechanics`, reset-password) and the Job
 * catalog (D25: `POST /admin/catalog/jobs`, `PATCH /admin/catalog/jobs/:id`).
 *
 * The write opens to whoever holds the same pair that opens Work Order writes
 * (`admin.access` + `work_orders.manage`). The System Admin keeps its role-based access
 * (`role === admin`) even when its row holds only `admin.access`. Categories have no write.
 */
export const MANAGER_WRITE_CAPABILITIES = [
  AppCapability.ADMIN_ACCESS,
  AppCapability.WORK_ORDERS_MANAGE,
] as const;

export function canDoManagerWrites(user: { role?: string; capabilities?: AppCapability[] } | undefined): boolean {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  const capabilities = user.capabilities ?? [];
  return MANAGER_WRITE_CAPABILITIES.every((capability) => capabilities.includes(capability));
}

@Injectable()
export class ManagerWritesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request>().user;
    if (!canDoManagerWrites(user)) {
      throw new ForbiddenException('Only the Shop Manager or a System Admin can change this.');
    }
    return true;
  }
}

type Request = { user?: { role?: string; capabilities?: AppCapability[] } };
