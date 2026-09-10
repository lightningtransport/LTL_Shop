import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppCapability, adminRepairHistoryQuerySchema } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Capabilities } from '../auth/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/capabilities.guard';
import { TrucksService } from '../trucks/trucks.service';
import { AdminService } from './admin.service';
import { YardOperationsService } from './yard-operations.service';

@Controller('admin')
@UseGuards(AuthGuard, CapabilitiesGuard)
@Capabilities(AppCapability.ADMIN_ACCESS)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly trucks: TrucksService,
    private readonly yardOperations: YardOperationsService,
  ) {}

  @Get('access')
  access(@Req() request: Request) {
    return { user: request.user };
  }

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('work-orders')
  workOrders(@Query() query: Record<string, unknown>) {
    return this.admin.list(query);
  }

  @Get('work-orders/:id')
  workOrder(@Param('id') id: string) {
    return this.admin.detail(id);
  }

  @Patch('work-orders/:id')
  patchWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.patchWorkOrder(request.user!, id, body);
  }

  @Post('time-corrections')
  correctTime(@Req() request: Request, @Body() body: unknown) {
    return this.admin.correctTime(request.user!, body);
  }

  @Post('work-orders/:id/reopen')
  reopenWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.reopenWorkOrder(request.user!, id, body);
  }

  @Post('work-orders/:id/complete')
  completeWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.completeWorkOrder(request.user!, id, body);
  }

  @Post('work-orders/:id/cancel')
  cancelWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.cancelWorkOrder(request.user!, id, body);
  }

  @Post('work-orders/:id/mechanics')
  addWorkOrderMechanic(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.addMechanic(request.user!, id, body);
  }

  @Delete('work-orders/:id/mechanics/:mechanicId')
  removeWorkOrderMechanic(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('mechanicId') mechanicId: string,
    @Body() body: unknown,
  ) {
    return this.admin.removeMechanic(request.user!, id, mechanicId, body);
  }

  @Get('mechanics')
  mechanics(@Query() query: Record<string, unknown>) {
    return this.admin.listMechanics(query);
  }

  @Get('mechanics/:id')
  mechanic(@Param('id') id: string) {
    return this.admin.mechanicDetail(id);
  }

  @Get('history')
  history(@Query() query: Record<string, unknown>) {
    return this.admin.listHistory(query);
  }

  @Get('trucks')
  listTrucks(@Query() query: Record<string, unknown>) {
    return this.admin.listTrucks(query);
  }

  @Get('yard-operations')
  yardOperationsList(@Query() query: Record<string, unknown>) {
    return this.yardOperations.list(query);
  }

  @Get('trucks/:id')
  yardTruck(@Param('id') id: string) {
    return this.yardOperations.detail(id);
  }

  @Post('trucks/:id/readiness-assessments')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE)
  startReadinessAssessment(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.yardOperations.startAssessment(request.user!, id, body);
  }

  @Patch('readiness-assessments/:id/requirements/:type')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE)
  updateReadinessRequirement(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('type') type: string,
    @Body() body: unknown,
  ) {
    return this.yardOperations.updateRequirement(request.user!, id, type, body);
  }

  @Post('readiness-assessments/:id/mark-ready')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE)
  markReadinessReady(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.yardOperations.markReady(request.user!, id, body);
  }

  @Post('readiness-assessments/:id/close')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE)
  closeReadinessAssessment(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.yardOperations.closeAssessment(request.user!, id, body);
  }

  @Get('trucks/:id/repair-history')
  repairHistory(@Param('id') id: string, @Query() rawQuery: Record<string, unknown>) {
    const parsed = adminRepairHistoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { categoryId, excludeWorkOrderId, limit, cursor } = parsed.data;
    return this.trucks.getRepairHistory(id, categoryId, { excludeWorkOrderId, limit, cursor });
  }
}
