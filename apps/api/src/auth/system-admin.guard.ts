import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@ltl-shop/shared';

/**
 * LTR-77 / LTR-78 gate.
 *
 * Shop Manager and System Admin both hold `admin.access` (Manager also holds
 * `work_orders.manage` and `yard.operations.manage`). That capability still
 * opens Admin reads. Roster and catalog writes are System Admin only, and
 * CURRENT distinguishes those personas by `users.role`:
 *
 * - allow: `role === admin` (System Admin)
 * - deny: `role === manager` (Shop Manager) and every other role
 *
 * No new capability is introduced. A full permissions matrix stays out of scope.
 */
@Injectable()
export class SystemAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const role = context.switchToHttp().getRequest<Request>().user?.role;
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a System Admin can change the mechanic roster or job catalog.');
    }
    return true;
  }
}

type Request = { user?: { role?: string } };
