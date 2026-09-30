import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AppCapability } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Capabilities } from '../auth/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/capabilities.guard';
import { QualityCheckService } from './quality-check.service';

/** LTR-185 / D19: the Safety workspace. */
@Controller('qc')
@UseGuards(AuthGuard, CapabilitiesGuard)
@Capabilities(AppCapability.QUALITY_CHECK_PERFORM)
export class QualityCheckController {
  constructor(private readonly qualityCheck: QualityCheckService) {}

  @Get('queue')
  queue(@Req() req: Request) {
    return this.qualityCheck.getQueue(req.user!);
  }

  @Post(':workOrderId/take')
  take(@Req() req: Request, @Param('workOrderId') workOrderId: string) {
    return this.qualityCheck.take(req.user!, workOrderId);
  }

  @Post(':workOrderId/approve')
  approve(@Req() req: Request, @Param('workOrderId') workOrderId: string) {
    return this.qualityCheck.approve(req.user!, workOrderId);
  }

  @Post(':workOrderId/return')
  returnTruck(@Req() req: Request, @Param('workOrderId') workOrderId: string, @Body() body: unknown) {
    return this.qualityCheck.returnTruck(req.user!, workOrderId, body);
  }
}
