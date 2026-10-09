import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/** D36: `/api/dev/*` exists only while the local dev bypass is on; everywhere else the route is a plain 404. */
export function devBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_DEV_BYPASS === 'true';
}

@Injectable()
export class DevBypassGuard implements CanActivate {
  canActivate(): boolean {
    if (!devBypassEnabled()) throw new NotFoundException();
    return true;
  }
}
