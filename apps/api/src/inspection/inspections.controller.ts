import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { InspectionService } from './inspection.service';

/**
 * D41 / HU-ME7: the inspection for a mechanic with "Can inspect trucks" (`inspection.perform`). The service checks
 * the permission on every call; the Manager uses the same service through `/admin`.
 */
@Controller('inspections')
@UseGuards(AuthGuard)
export class InspectionsController {
  constructor(private readonly inspections: InspectionService) {}

  @Get('queue')
  queue(@Req() request: Request) {
    return this.inspections.queue(request.user!);
  }

  @Get('trucks/:truckId')
  state(@Req() request: Request, @Param('truckId') truckId: string) {
    return this.inspections.getState(request.user!, truckId);
  }

  @Post('trucks/:truckId')
  save(@Req() request: Request, @Param('truckId') truckId: string, @Body() body: unknown) {
    return this.inspections.save(request.user!, truckId, body);
  }

  @Post('trucks/:truckId/defects')
  addDefects(@Req() request: Request, @Param('truckId') truckId: string, @Body() body: unknown) {
    return this.inspections.addDefects(request.user!, truckId, body);
  }
}
