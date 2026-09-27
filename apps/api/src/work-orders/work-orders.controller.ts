import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';
import type { Request } from 'express';

@Controller('work-orders')
@UseGuards(AuthGuard)
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

  @Post(':id/pause')
  pause(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workOrders.pause(req.user!, id, body);
  }

  @Post(':id/pause-reason')
  changePauseReason(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.workOrders.changePauseReason(req.user!, id, body);
  }

  @Post(':id/resume')
  resume(@Req() req: Request, @Param('id') id: string) {
    return this.workOrders.resume(req.user!, id);
  }

  @Post(':id/blockers')
  reportBlocker(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workOrders.reportBlocker(req.user!, id, body);
  }

  @Post(':id/blockers/:blockerId/resolve')
  resolveBlocker(@Req() req: Request, @Param('id') id: string, @Param('blockerId') blockerId: string) {
    return this.workOrders.resolveBlocker(req.user!, id, blockerId);
  }

  @Post(':id/complete')
  complete(@Req() req: Request, @Param('id') id: string) {
    return this.workOrders.complete(req.user!, id);
  }

  @Post(':id/jobs')
  addJob(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workOrders.addJob(req.user!, id, body);
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
