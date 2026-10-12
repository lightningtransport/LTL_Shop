import { createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/** D36: `/api/dev/*` exists only while the local dev bypass is on; everywhere else the route is a plain 404. */
export function devBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_DEV_BYPASS === 'true';
}

/** D39: the header a published demo sends on every request, with the code that came with the link. */
export const DEMO_ACCESS_HEADER = 'x-demo-access';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * D39 (DP3): a published demo (`DEMO_HOSTED=1`) has the dev bypass on, so without this anyone who knows a demo
 * email would get in. There every `dev:` request must carry the shared code; with no code configured nothing passes.
 * The local demo (no DEMO_HOSTED) is unchanged.
 */
export function demoAccessGranted(header: string | string[] | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DEMO_HOSTED !== '1') return true;
  const code = env.DEMO_ACCESS_CODE?.trim();
  const given = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!code || !given) return false;
  return timingSafeEqual(digest(code), digest(given));
}

@Injectable()
export class DevBypassGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!devBypassEnabled()) throw new NotFoundException();
    const req = context.switchToHttp().getRequest<Request>();
    if (!demoAccessGranted(req.headers[DEMO_ACCESS_HEADER])) {
      throw new UnauthorizedException({ code: 'DEMO_ACCESS', message: 'This demo needs its access code.' });
    }
    return true;
  }
}
