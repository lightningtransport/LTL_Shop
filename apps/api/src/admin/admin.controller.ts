import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AppCapability, adminRepairHistoryQuerySchema } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Capabilities } from '../auth/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/capabilities.guard';
import { ManagerWritesGuard, canDoManagerWrites } from '../auth/manager-writes.guard';
import { TrucksService } from '../trucks/trucks.service';
import { AdminService } from './admin.service';
import { YardOperationsService } from './yard-operations.service';
import { YardWorkPlanService } from './yard-work-plan.service';
import { YardDataBoundaryService } from './yard-data-boundary.service';
import { SamsaraPairingService } from './samsara-pairing.service';
import { SamsaraSyncService } from './samsara-sync.service';
import { TruckFaultsService } from './truck-faults.service';
import { SamsaraFaultJobsService } from './samsara-fault-jobs.service';
import { SystemAdminWritesService } from './system-admin-writes.service';
import { ShopWorkflowService } from './shop-workflow.service';
import { CatalogAdminService } from './catalog-admin.service';
import { PeopleAdminService } from './people-admin.service';
import { TrucksAdminService } from './trucks-admin.service';
import { TruckSamsaraService } from './truck-samsara.service';
import { CustomJobsReviewService } from './custom-jobs-review.service';
import { LaborClockService } from '../work-orders/labor-clock.service';
import { InspectionService } from '../inspection/inspection.service';
import { SafetyMaskInterceptor, ShowSafetyPeople } from '../quality-check/safety-mask.interceptor';

@Controller('admin')
@UseGuards(AuthGuard, CapabilitiesGuard)
// D46 / SQ-1: the Shop sees "Safety", never which Safety person did a Quality Check.
@UseInterceptors(SafetyMaskInterceptor)
@Capabilities(AppCapability.ADMIN_ACCESS)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly trucks: TrucksService,
    private readonly yardOperations: YardOperationsService,
    private readonly workPlan: YardWorkPlanService,
    private readonly dataBoundary: YardDataBoundaryService,
    private readonly systemAdminWrites: SystemAdminWritesService,
    private readonly shopWorkflow: ShopWorkflowService,
    private readonly catalogAdmin: CatalogAdminService,
    private readonly people: PeopleAdminService,
    private readonly customJobsReview: CustomJobsReviewService,
    private readonly clock: LaborClockService,
    private readonly inspections: InspectionService,
    private readonly samsara: SamsaraPairingService,
    private readonly samsaraSync: SamsaraSyncService,
    private readonly truckFaults: TruckFaultsService,
    private readonly faultJobs: SamsaraFaultJobsService,
    private readonly trucksAdmin: TrucksAdminService,
    private readonly truckSamsara: TruckSamsaraService,
  ) {}

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
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
  async workOrder(@Req() request: Request, @Param('id') id: string) {
    const detail = await this.admin.detail(id);
    // LTR-200 / D-PC7: money is for the Shop Manager and the System Admin only.
    if (canDoManagerWrites(request.user)) return detail;
    const { costs: _costs, ...rest } = detail;
    return {
      ...rest,
      jobs: detail.jobs.map(({ outsideInvoices: _invoices, parts, stockParts, tires, ...job }) => ({
        ...job,
        tires: tires?.map(({ valueCents: _value, ...tire }) => tire),
        // D45 / ST-1, ST-3: what was bought or taken from stock for the Job, without its cost.
        parts: parts?.map(({ lineTotalCents: _cost, ...part }) => part),
        stockParts: stockParts?.map(({ valueCents: _value, ...part }) => part),
      })),
    };
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
  resolveBlocker(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('blockerId') blockerId: string,
    @Body() body: unknown,
  ) {
    return this.admin.resolveBlocker(request.user!, id, blockerId, body);
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

  @Post('work-orders/:id/notes/:noteId/unhandle')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  unhandleWorkRequest(@Req() request: Request, @Param('id') id: string, @Param('noteId') noteId: string) {
    return this.admin.unhandleWorkRequest(request.user!, id, noteId);
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

  @Post('work-orders/:id/jobs/:jobId/pm-service')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  changePmService(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    return this.admin.changePmService(request.user!, id, jobId, body);
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

  /** LTR-188 / D23: another Standard mechanic helps on a Job — a helper Job of their own. */
  @Post('work-orders/:id/jobs/:jobId/helper')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  addHelperJob(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    return this.admin.addHelperJob(request.user!, id, jobId, body);
  }

  /** LTR-188 / D24: the part or the truck goes to an external shop. */
  @Post('work-orders/:id/jobs/:jobId/external')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  sendJobExternal(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    return this.admin.sendJobExternal(request.user!, id, jobId, body);
  }

  /** LTR-188 / D24: back from the external shop — complete it or give it to a mechanic. */
  @Post('work-orders/:id/jobs/:jobId/external/return')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  returnJobExternal(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    return this.admin.returnJobExternal(request.user!, id, jobId, body);
  }

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Get('mechanics')
  mechanics(@Query() query: Record<string, unknown>) {
    return this.admin.listMechanics(query);
  }

  // D22 / LTR-187: the Shop Manager manages the roster; the System Admin keeps role access.
  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Post('mechanics')
  @UseGuards(ManagerWritesGuard)
  createMechanic(@Req() request: Request, @Body() body: unknown) {
    return this.systemAdminWrites.createMechanic(request.user!, body);
  }

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Patch('mechanics/:id')
  @UseGuards(ManagerWritesGuard)
  updateMechanic(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.systemAdminWrites.updateMechanic(request.user!, id, body);
  }

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Post('mechanics/:id/reset-password')
  @UseGuards(ManagerWritesGuard)
  resetMechanicPassword(@Param('id') id: string) {
    return this.systemAdminWrites.resetPassword(id);
  }

  // LTR-199 / D31: Remove from Shop, delete (never did anything) and send queue Jobs back to their team queue.
  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Post('mechanics/:id/remove')
  @UseGuards(ManagerWritesGuard)
  removeMechanic(@Req() request: Request, @Param('id') id: string) {
    return this.people.remove(request.user!, id);
  }

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Delete('mechanics/:id')
  @UseGuards(ManagerWritesGuard)
  deleteMechanic(@Param('id') id: string) {
    return this.people.delete(id);
  }

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Post('mechanics/:id/send-to-queue')
  @UseGuards(ManagerWritesGuard)
  sendMechanicJobsToQueue(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.people.sendJobsToQueue(request.user!, id, body);
  }

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Get('mechanics/:id')
  mechanic(@Param('id') id: string) {
    return this.admin.mechanicDetail(id);
  }

  @Get('history')
  history(@Query() query: Record<string, unknown>) {
    return this.admin.listHistory(query);
  }

  // LTR-157 / D16: Setup → Shop workflow. Writes: work_orders.manage or System Admin (service check).
  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Get('setup/workflow-steps')
  workflowSteps() {
    return this.shopWorkflow.list();
  }

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Put('setup/workflow-steps')
  updateWorkflowSteps(@Req() request: Request, @Body() body: unknown) {
    return this.shopWorkflow.update(request.user!, body);
  }

  // LTR-186 / D20: Setup → Shop workflow → Shop hours (day close). Writes: same gate as the workflow steps.
  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Get('setup/shop-hours')
  shopHours() {
    return this.clock.getShopHours();
  }

  // D46: People and Setup manage the Safety accounts and teams by name.
  @ShowSafetyPeople()
  @Put('setup/shop-hours')
  updateShopHours(@Req() request: Request, @Body() body: unknown) {
    return this.clock.updateShopHours(request.user!, body);
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
  @UseGuards(ManagerWritesGuard)
  createCatalogJob(@Req() request: Request, @Body() body: unknown) {
    return this.systemAdminWrites.createCatalogJob(request.user!, body);
  }

  @Patch('catalog/jobs/:id')
  @UseGuards(ManagerWritesGuard)
  updateCatalogJob(@Param('id') id: string, @Body() body: unknown) {
    return this.systemAdminWrites.updateCatalogJob(id, body);
  }

  // LTR-198 / D30: Categories, deleting Jobs, aliases and the search across Jobs and aliases.
  // LTR-57 / D25: the Custom Jobs review inbox (static paths before `catalog/categories/:id`).
  @Get('catalog/custom-jobs')
  customJobs(@Query() query: Record<string, unknown>) {
    return this.customJobsReview.list(query);
  }

  @Post('catalog/custom-jobs/review')
  @UseGuards(ManagerWritesGuard)
  reviewCustomJobs(@Req() request: Request, @Body() body: unknown) {
    return this.customJobsReview.review(request.user!, body);
  }

  @Post('catalog/custom-jobs/undo')
  @UseGuards(ManagerWritesGuard)
  undoCustomJobs(@Req() request: Request, @Body() body: unknown) {
    return this.customJobsReview.undo(request.user!, body);
  }

  @Get('catalog/search')
  searchCatalog(@Query('q') q?: string) {
    return this.catalogAdmin.search(q);
  }

  @Post('catalog/categories')
  @UseGuards(ManagerWritesGuard)
  createCatalogCategory(@Body() body: unknown) {
    return this.catalogAdmin.createCategory(body);
  }

  @Patch('catalog/categories/:id')
  @UseGuards(ManagerWritesGuard)
  updateCatalogCategory(@Param('id') id: string, @Body() body: unknown) {
    return this.catalogAdmin.updateCategory(id, body);
  }

  @Delete('catalog/categories/:id')
  @UseGuards(ManagerWritesGuard)
  deleteCatalogCategory(@Param('id') id: string) {
    return this.catalogAdmin.deleteCategory(id);
  }

  @Delete('catalog/jobs/:id')
  @UseGuards(ManagerWritesGuard)
  deleteCatalogJob(@Param('id') id: string) {
    return this.catalogAdmin.deleteJob(id);
  }

  @Post('catalog/jobs/:id/aliases')
  @UseGuards(ManagerWritesGuard)
  addCatalogAlias(@Param('id') id: string, @Body() body: unknown) {
    return this.catalogAdmin.addAlias(id, body);
  }

  @Delete('catalog/jobs/:id/aliases/:aliasId')
  @UseGuards(ManagerWritesGuard)
  removeCatalogAlias(@Param('id') id: string, @Param('aliasId') aliasId: string) {
    return this.catalogAdmin.removeAlias(id, aliasId);
  }

  @Get('trucks')
  listTrucks(@Query() query: Record<string, unknown>) {
    return this.admin.listTrucks(query);
  }

  // D44 / LTR-215: the Manager and the System Admin add, edit, deactivate and delete trucks (like People, D22/D31).
  @Post('trucks')
  @UseGuards(ManagerWritesGuard)
  createTruck(@Body() body: unknown) {
    return this.trucksAdmin.create(body);
  }

  @Patch('trucks/:id')
  @UseGuards(ManagerWritesGuard)
  updateTruck(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.trucksAdmin.update(request.user!, id, body);
  }

  @Delete('trucks/:id')
  @UseGuards(ManagerWritesGuard)
  deleteTruck(@Param('id') id: string) {
    return this.trucksAdmin.delete(id);
  }

  /** D44 §3: Samsara vehicles no other truck has, the VIN or number match first (live from Samsara). */
  @Get('trucks/:id/samsara/candidates')
  @UseGuards(ManagerWritesGuard)
  truckSamsaraCandidates(@Param('id') id: string) {
    return this.truckSamsara.candidates(id);
  }

  /** D44 §4: connect; empty fields are filled from Samsara, differing ones need the Manager's choice. */
  @Post('trucks/:id/samsara/connect')
  @UseGuards(ManagerWritesGuard)
  connectTruckSamsara(@Param('id') id: string, @Body() body: unknown) {
    return this.truckSamsara.connect(id, body);
  }

  @Post('trucks/:id/samsara/disconnect')
  @UseGuards(ManagerWritesGuard)
  disconnectTruckSamsara(@Param('id') id: string) {
    return this.truckSamsara.disconnect(id);
  }

  @Get('yard-operations')
  yardOperationsList(@Query() query: Record<string, unknown>) {
    return this.yardOperations.list(query);
  }

  @Get('yard/data-boundary')
  yardDataBoundary() {
    return this.dataBoundary.get();
  }

  /** D35 / S-1: which Samsara vehicles are our trucks. Read-only; nothing is saved. */
  @Get('integrations/samsara/pairing')
  samsaraPairing() {
    return this.samsara.get();
  }

  /** D35 / S-2: "Sync now" on Setup → Samsara. Writes only Samsara's columns and faults, so Manager writes. */
  @Post('integrations/samsara/sync')
  @UseGuards(ManagerWritesGuard)
  runSamsaraSync() {
    return this.samsaraSync.run('manual');
  }

  /** D35 / S-3: Truck → Faults. */
  @Get('trucks/:id/faults')
  truckFaultsList(@Param('id') id: string) {
    return this.truckFaults.get(id);
  }

  /** D42 / S-6: Samsara faults recommended as Jobs in Add work. */
  @Get('trucks/:id/fault-recommendations')
  truckFaultRecommendations(@Param('id') id: string) {
    return this.faultJobs.recommendations(id);
  }

  /** D42 / S-6: tie faults to a Job already on the open Work Order. */
  @Post('trucks/:id/faults/link')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  linkTruckFaults(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.faultJobs.link(request.user!, id, body);
  }

  /** D42 / S-6: "not now", with the reason. */
  @Post('trucks/:id/faults/:faultId/dismiss')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  dismissTruckFault(@Req() request: Request, @Param('id') id: string, @Param('faultId') faultId: string, @Body() body: unknown) {
    return this.faultJobs.dismiss(request.user!, id, faultId, body);
  }

  @Get('trucks/:id')
  async yardTruck(@Req() request: Request, @Param('id') id: string) {
    const manager = canDoManagerWrites(request.user);
    const [detail, workPlan, admin] = await Promise.all([
      this.yardOperations.detail(id),
      this.workPlan.get(request.user!, id),
      // D44: delete and the Samsara connection, for whoever can edit the truck.
      manager ? this.trucksAdmin.adminInfo(id).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    // LTR-158 / LTR-159: `detail.nextStep` comes from the one helper every surface uses.
    return { ...detail, workPlan, ...(admin ? { admin } : {}) };
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

  // LTR-158: "Add missing steps" for an open Work Order created before the mandatory steps.
  @Post('trucks/:id/work-plan/backfill-mandatory')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE)
  backfillMandatorySteps(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workPlan.backfillMandatory(request.user!, id, body);
  }

  @Post('trucks/:id/work-plan/inspection')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE)
  recordWorkPlanInspection(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.workPlan.recordInspection(request.user!, id, body);
  }

  // D41 / HU-M16: the inspection sheet of the Truck's current visit.
  @Get('trucks/:id/inspection')
  truckInspection(@Req() request: Request, @Param('id') id: string) {
    return this.inspections.getState(request.user!, id);
  }

  @Post('trucks/:id/inspection')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE, AppCapability.WORK_ORDERS_MANAGE)
  saveTruckInspection(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.inspections.save(request.user!, id, body);
  }

  // D41 point 6: after saving, defects can only be added.
  @Post('trucks/:id/inspection/defects')
  @Capabilities(AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE, AppCapability.WORK_ORDERS_MANAGE)
  addTruckInspectionDefects(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.inspections.addDefects(request.user!, id, body);
  }

  // D41 / HU-M17: Setup → Inspection checklist (read by Admin access, edited by the Manager or System Admin).
  @Get('inspection-checklist')
  inspectionChecklist(@Req() request: Request) {
    return this.inspections.getChecklist(request.user!);
  }

  @Put('inspection-checklist')
  @UseGuards(ManagerWritesGuard)
  saveInspectionChecklist(@Req() request: Request, @Body() body: unknown) {
    return this.inspections.saveChecklist(request.user!, body);
  }

  @Get('trucks/:id/repair-history')
  repairHistory(@Param('id') id: string, @Query() rawQuery: Record<string, unknown>) {
    const parsed = adminRepairHistoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { categoryId, excludeWorkOrderId, limit, cursor } = parsed.data;
    return this.trucks.getRepairHistory(id, categoryId, { excludeWorkOrderId, limit, cursor });
  }
}
