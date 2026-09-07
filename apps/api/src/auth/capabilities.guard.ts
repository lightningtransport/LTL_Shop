import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppCapability } from '@ltl-shop/shared';
import { CAPABILITIES_KEY } from './capabilities.decorator';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppCapability[]>(CAPABILITIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const capabilities = context.switchToHttp().getRequest<Request>().user?.capabilities ?? [];
    if (!required.every((capability) => capabilities.includes(capability))) {
      throw new ForbiddenException('You do not have access to this Shop workspace.');
    }
    return true;
  }
}

type Request = { user?: { capabilities?: AppCapability[] } };
