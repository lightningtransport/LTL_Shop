import { Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { assertCronSecret } from '../work-orders/day-close.controller';
import { SamsaraSyncService } from './samsara-sync.service';

/**
 * D35 / P12 (OPEN_ISSUES §1x): GitHub Actions calls this every hour of the shop day and once at night with `Authorization: Bearer $CRON_SECRET`
 * (Vercel Hobby only runs crons once a day). No user session, like the day close. Idempotent.
 */
@Controller('internal')
export class SamsaraSyncController {
  constructor(private readonly sync: SamsaraSyncService) {}

  @Get('samsara-sync')
  cron(@Headers('authorization') authorization?: string) {
    return this.run(authorization);
  }

  @Post('samsara-sync')
  @HttpCode(200)
  manual(@Headers('authorization') authorization?: string) {
    return this.run(authorization);
  }

  private run(authorization: string | undefined) {
    assertCronSecret(authorization, process.env.CRON_SECRET);
    return this.sync.run('cron');
  }
}
