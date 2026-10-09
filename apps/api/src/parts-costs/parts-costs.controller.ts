import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AppCapability } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Capabilities } from '../auth/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/capabilities.guard';
import { ManagerWritesGuard } from '../auth/manager-writes.guard';
import { PartsCatalogService } from './parts-catalog.service';
import { OutsideRepairsService } from './outside-repairs.service';
import { PurchasesService } from './purchases.service';
import { TruckCostsService } from './truck-costs.service';

/**
 * LTR-200 / D32, D-PC7: Parts & costs is for the Shop Manager and the System Admin only — reading too, because it
 * shows money. Mechanics and Safety get 403 everywhere here.
 */
@Controller('admin/parts-costs')
@UseGuards(AuthGuard, CapabilitiesGuard, ManagerWritesGuard)
@Capabilities(AppCapability.ADMIN_ACCESS)
export class PartsCostsController {
  constructor(
    private readonly catalog: PartsCatalogService,
    private readonly purchases: PurchasesService,
    private readonly repairs: OutsideRepairsService,
    private readonly truckCosts: TruckCostsService,
  ) {}

  @Get('parts')
  parts(@Query() query: Record<string, unknown>) {
    return this.catalog.catalog(query);
  }

  @Post('parts')
  createPart(@Req() request: Request, @Body() body: unknown) {
    return this.catalog.createPart(request.user!, body);
  }

  @Patch('parts/:id')
  updatePart(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.catalog.updatePart(request.user!, id, body);
  }

  @Get('vendors')
  vendors() {
    return this.catalog.vendors();
  }

  @Post('vendors')
  createVendor(@Req() request: Request, @Body() body: unknown) {
    return this.catalog.createVendor(request.user!, body);
  }

  @Patch('vendors/:id')
  updateVendor(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.catalog.updateVendor(request.user!, id, body);
  }

  // PC-2: purchases. Static paths come before `purchases/:id`.
  @Get('purchases/form-data')
  purchaseFormData() {
    return this.purchases.formData();
  }

  @Get('purchases')
  listPurchases(@Query() query: Record<string, unknown>) {
    return this.purchases.list(query);
  }

  @Get('purchases/:id')
  purchase(@Param('id') id: string) {
    return this.purchases.detail(id);
  }

  @Post('purchases')
  createPurchase(@Req() request: Request, @Body() body: unknown, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.purchases.create(request.user!, body, idempotencyKey);
  }

  @Patch('purchases/:id')
  updatePurchase(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.purchases.update(request.user!, id, body);
  }

  @Post('purchases/:id/void')
  voidPurchase(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.purchases.void(request.user!, id, body);
  }

  @Get('invoices/check')
  checkInvoice(@Query() query: Record<string, unknown>) {
    return this.purchases.checkInvoice(query);
  }

  @Post('attachments')
  requestAttachment(@Req() request: Request, @Body() body: unknown) {
    return this.purchases.requestAttachment(request.user!, body);
  }

  @Get('attachments/:id')
  openAttachment(@Param('id') id: string) {
    return this.purchases.openAttachment(id);
  }

  // PC-3: outside repairs. Static paths come before `outside-repairs/:id`.
  @Get('external-jobs')
  externalJobs(@Query() query: Record<string, unknown>) {
    return this.repairs.externalJobs(query);
  }

  @Get('outside-repairs')
  listOutsideRepairs(@Query() query: Record<string, unknown>) {
    return this.repairs.list(query);
  }

  @Get('outside-repairs/:id')
  outsideRepair(@Param('id') id: string) {
    return this.repairs.detail(id);
  }

  @Post('outside-repairs')
  createOutsideRepair(@Req() request: Request, @Body() body: unknown, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.repairs.create(request.user!, body, idempotencyKey);
  }

  @Patch('outside-repairs/:id')
  updateOutsideRepair(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.repairs.update(request.user!, id, body);
  }

  @Post('outside-repairs/:id/void')
  voidOutsideRepair(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.repairs.void(request.user!, id, body);
  }

  // PC-4: Truck → Costs (reads the ledger).
  @Get('trucks/:id/costs')
  costsOfTruck(@Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.truckCosts.costs(id, query);
  }
}
