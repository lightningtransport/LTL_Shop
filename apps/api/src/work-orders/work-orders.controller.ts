import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';
import type { Request } from 'express';
import { SafetyMaskInterceptor } from '../quality-check/safety-mask.interceptor';

@Controller('work-orders')
@UseGuards(AuthGuard)
// D46 / SQ-1: mechanics see "Safety" too, never the person.
@UseInterceptors(SafetyMaskInterceptor)
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersService) {}

  @Get()
  list(@Req() req: Request, @Query('mode') mode?: string) {
    return this.workOrders.listForMechanic(req.user!, mode);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.workOrders.getById(req.user!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: unknown) {
    return this.workOrders.create(req.user!, body);
  }

  @Post(':id/start')
  start(@Req() req: Request, @Param('id') id: string) {
    return this.workOrders.start(req.user!, id);
  }

  @Post(':id/blockers')
  reportBlocker(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workOrders.reportBlocker(req.user!, id, body);
  }

  // LTR-155 / D17: the mechanic no longer resolves; they add notes. Only Admin resolves.
  @Post(':id/blockers/:blockerId/notes')
  addBlockerNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('blockerId') blockerId: string,
    @Body() body: unknown,
  ) {
    return this.workOrders.addBlockerNote(req.user!, id, blockerId, body);
  }

  // LTR-126: append one note or work request (never overwrites).
  @Post(':id/notes')
  addNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.workOrders.addNote(req.user!, id, body);
  }

  // LTR-148: the assigned PM mechanic switches PM A ↔ PM B.
  @Post(':id/jobs/:jobId/pm-service')
  changePmService(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    return this.workOrders.changePmService(req.user!, id, jobId, body);
  }

  // LTR-146: the PM mechanic starts the PM job of a truck Work Order.
  @Post(':id/jobs/:jobId/pm/start')
  startPmJob(@Req() req: Request, @Param('id') id: string, @Param('jobId') jobId: string) {
    return this.workOrders.startPmJob(req.user!, id, jobId);
  }

  @Post(':id/jobs/:jobId/complete')
  completeJob(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    return this.workOrders.completeJob(req.user!, id, jobId, body ?? {});
  }

  @Get(':id/pm')
  getPm(@Req() req: Request, @Param('id') id: string) {
    return this.workOrders.getPmService(req.user!, id);
  }

  @Post(':id/pm')
  updatePm(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workOrders.updatePmService(req.user!, id, body);
  }
}
