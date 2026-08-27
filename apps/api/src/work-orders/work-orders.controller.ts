import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
  list(@Req() req: Request) {
    return this.workOrders.listForMechanic(req.user!.id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.workOrders.getById(id);
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

  @Post(':id/complete')
  complete(@Req() req: Request, @Param('id') id: string) {
    return this.workOrders.complete(req.user!, id);
  }

  @Post(':id/jobs')
  addJob(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workOrders.addJob(req.user!, id, body);
  }

  @Post(':id/notes')
  updateNotes(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.workOrders.updateNotes(req.user!, id, body);
  }

  @Post(':id/jobs/:jobId/complete')
  completeJob(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
  ) {
    return this.workOrders.completeJob(req.user!, id, jobId);
  }
}
