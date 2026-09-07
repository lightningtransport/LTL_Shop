import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ltl-shop/shared';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowedRoles?.length) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const role = request.user?.role;
    if (!role || !allowedRoles.some((allowedRole) => allowedRole === role)) {
      throw new ForbiddenException('You do not have access to Shop Admin.');
    }

    return true;
  }
}

type Request = {
  user?: { role?: `${UserRole}` };
};
