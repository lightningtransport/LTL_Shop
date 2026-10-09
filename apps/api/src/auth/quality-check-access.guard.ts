import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AppCapability } from '@ltl-shop/shared';
import type { Request } from 'express';
import { hasCapability } from './capabilities';
import { canDoManagerWrites } from './manager-writes.guard';

/** LTR-185 / D19: Safety's screen. LTR-197 / D29: the Shop Manager and the System Admin use it as backup. */
export function canUseQualityCheck(user: Request['user']): boolean {
  if (!user) return false;
  return hasCapability(user, AppCapability.QUALITY_CHECK_PERFORM) || canDoManagerWrites(user);
}

/** D29: true when the person is not Safety — what they do in Quality Check is recorded as backup. */
export function isQualityCheckBackup(user: Request['user']): boolean {
  return Boolean(user) && !hasCapability(user!, AppCapability.QUALITY_CHECK_PERFORM) && canDoManagerWrites(user);
}

@Injectable()
export class QualityCheckAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request>().user;
    if (!canUseQualityCheck(user)) {
      throw new ForbiddenException('Only Safety, or the Shop Manager as backup, can do Quality Check.');
    }
    return true;
  }
}
