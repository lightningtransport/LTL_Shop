import { timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { LaborClockService } from './labor-clock.service';

/**
 * LTR-186 / D20: backstop for the lazy day close. Vercel Cron calls it with GET and
 * `Authorization: Bearer $CRON_SECRET`; no user session (it is not behind AuthGuard).
 * Idempotent: a second call closes nothing.
 */
@Controller('internal')
export class DayCloseController {
  constructor(private readonly clock: LaborClockService) {}

  @Get('day-close')
  cron(@Headers('authorization') authorization?: string) {
    return this.run(authorization);
  }

  @Post('day-close')
  @HttpCode(200)
  manual(@Headers('authorization') authorization?: string) {
    return this.run(authorization);
  }

  private async run(authorization: string | undefined) {
    assertCronSecret(authorization, process.env.CRON_SECRET);
    const ranAt = new Date();
    const result = await this.clock.closeDue(undefined, ranAt);
    return { ok: true, ranAt: ranAt.toISOString(), closedSessions: result.closed, workOrders: result.workOrderIds.length };
  }
}

export function assertCronSecret(authorization: string | undefined, secret: string | undefined) {
  if (!secret) throw new ServiceUnavailableException('CRON_SECRET is not configured.');
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization ?? '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new UnauthorizedException('Invalid cron secret.');
  }
}
