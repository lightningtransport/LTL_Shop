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
import { SystemAdminGuard } from '../auth/system-admin.guard';
import { TrucksService } from '../trucks/trucks.service';
import { AdminService } from './admin.service';
import { YardOperationsService } from './yard-operations.service';
import { YardWorkPlanService } from './yard-work-plan.service';
import { YardDataBoundaryService } from './yard-data-boundary.service';
import { isYardWorkPlanSlice1Enabled } from './yard-work-plan-flag';
import { SystemAdminWritesService } from './system-admin-writes.service';

@Controller('admin')
@UseGuards(AuthGuard, CapabilitiesGuard)
@Capabilities(AppCapability.ADMIN_ACCESS)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly trucks: TrucksService,
    private readonly yardOperations: YardOperationsService,
    private readonly workPlan: YardWorkPlanService,
    private readonly dataBoundary: YardDataBoundaryService,
    private readonly systemAdminWrites: SystemAdminWritesService,
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

  @Post('work-orders')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  createWorkOrder(@Req() request: Request, @Body() body: unknown) {
    return this.admin.createWorkOrder(request.user!, body);
  }

  @Get('work-orders/:id')
  workOrder(@Param('id') id: string) {
    return this.admin.detail(id);
  }

  @Patch('work-orders/:id')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  patchWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.patchWorkOrder(request.user!, id, body);
  }

  @Post('time-corrections')
  correctTime(@Req() request: Request, @Body() body: unknown) {
    return this.admin.correctTime(request.user!, body);
  }

  @Post('jobs/:id/reopen')
  reopenJob(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.reopenJob(request.user!, id, body);
  }

  @Post('jobs/:id/cancel')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  cancelJob(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.cancelJob(request.user!, id, body);
  }

  @Post('jobs/:id/complete')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  completeJob(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.completeJob(request.user!, id, body);
  }

  @Post('work-orders/:id/reopen')
  reopenWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.reopenWorkOrder(request.user!, id, body);
  }

  @Post('work-orders/:id/return-to-service')
  returnToService(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.returnToService(request.user!, id, body);
  }

  @Post('work-orders/:id/complete')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  completeWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.completeWorkOrder(request.user!, id, body);
  }

  @Post('work-orders/:id/cancel')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  cancelWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.cancelWorkOrder(request.user!, id, body);
  }

  @Post('work-orders/:id/blockers/:blockerId/resolve')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  resolveBlocker(@Req() request: Request, @Param('id') id: string, @Param('blockerId') blockerId: string) {
    return this.admin.resolveBlocker(request.user!, id, blockerId);
  }

  @Post('work-orders/:id/notes')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  addNote(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.addNote(request.user!, id, body);
  }

  @Post('work-orders/:id/notes/:noteId/handle')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  handleWorkRequest(@Req() request: Request, @Param('id') id: string, @Param('noteId') noteId: string) {
    return this.admin.handleWorkRequest(request.user!, id, noteId);
  }

  @Post('work-orders/:id/pause')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  pauseWorkOrder(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.pauseWorkOrder(request.user!, id, body);
  }

  @Post('work-orders/:id/resume')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  resumeWorkOrder(@Req() request: Request, @Param('id') id: string) {
    return this.admin.resumeWorkOrder(request.user!, id);
  }

  @Post('work-orders/:id/jobs')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  addWorkOrderJob(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.addJob(request.user!, id, body);
  }

  @Post('work-orders/:id/mechanics')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  addWorkOrderMechanic(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.addMechanic(request.user!, id, body);
  }

  @Delete('work-orders/:id/mechanics/:mechanicId')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  removeWorkOrderMechanic(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('mechanicId') mechanicId: string,
    @Body() body: unknown,
  ) {
    return this.admin.removeMechanic(request.user!, id, mechanicId, body);
  }

  @Post('work-orders/:id/jobs/:jobId/assign')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  assignJob(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    return this.admin.assignJob(request.user!, id, jobId, body);
  }

  @Post('work-orders/:id/jobs/:jobId/unassign')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  unassignJob(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    return this.admin.unassignJob(request.user!, id, jobId, body);
  }

  @Get('mechanics')
  mechanics(@Query() query: Record<string, unknown>) {
    return this.admin.listMechanics(query);
  }

  @Post('mechanics')
  @UseGuards(SystemAdminGuard)
  createMechanic(@Req() request: Request, @Body() body: unknown) {
    return this.systemAdminWrites.createMechanic(request.user!, body);
  }

  @Patch('mechanics/:id')
  @UseGuards(SystemAdminGuard)
  updateMechanic(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.systemAdminWrites.updateMechanic(request.user!, id, body);
  }

  @Get('mechanics/:id')
  mechanic(@Param('id') id: string) {
    return this.admin.mechanicDetail(id);
  }

  @Get('history')
  history(@Query() query: Record<string, unknown>) {
    return this.admin.listHistory(query);
  }

  @Get('catalog/categories')
  catalogCategories() {
    return this.admin.listCatalogCategories();
  }

  @Get('catalog/categories/:id')
  catalogCategory(@Param('id') id: string) {
    return this.admin.catalogCategoryDetail(id);
  }

  @Post('catalog/jobs')
  @UseGuards(SystemAdminGuard)
  createCatalogJob(@Req() request: Request, @Body() body: unknown) {
    return this.systemAdminWrites.createCatalogJob(request.user!, body);
  }

  @Patch('catalog/jobs/:id')
  @UseGuards(SystemAdminGuard)
  updateCatalogJob(@Param('id') id: string, @Body() body: unknown) {
    return this.systemAdminWrites.updateCatalogJob(id, body);
  }

  @Get('trucks')
  listTrucks(@Query() query: Record<string, unknown>) {
    return this.admin.listTrucks(query);
  }

  @Get('yard-operations')
  yardOperationsList(@Query() query: Record<string, unknown>) {
    return this.yardOperations.list(query);
  }

  @Get('yard/data-boundary')
  yardDataBoundary() {
    return this.dataBoundary.get();
  }

  @Get('trucks/:id')
  async yardTruck(@Req() request: Request, @Param('id') id: string) {
    if (!isYardWorkPlanSlice1Enabled()) return this.yardOperations.detail(id);
    const [detail, workPlan] = await Promise.all([
      this.yardOperations.detail(id),
      this.workPlan.get(request.user!, id),
    ]);
    return { ...detail, workPlan };
  }

  @Get('trucks/:id/work-plan')
  getWorkPlan(@Req() request: Request, @Param('id') id: string) {
    return this.workPlan.get(request.user!, id);
  }

  @Post('trucks/:id/work-plan/jobs')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  addWorkPlanJobs(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workPlan.addJobs(request.user!, id, body);
  }

  @Post('trucks/:id/work-plan/inspection')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE)
  recordWorkPlanInspection(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workPlan.recordInspection(request.user!, id, body);
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
