import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AppCapability } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Capabilities } from '../auth/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/capabilities.guard';
import { ManagerWritesGuard } from '../auth/manager-writes.guard';
import { PartsCatalogService } from './parts-catalog.service';
import { OutsideRepairsService } from './outside-repairs.service';
import { PurchasesService } from './purchases.service';
import { StockService } from './stock.service';
import { InternalInvoicesService } from './internal-invoices.service';
import { LaborRatesService } from './labor-rates.service';
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
    private readonly stock: StockService,
    private readonly repairs: OutsideRepairsService,
    private readonly truckCosts: TruckCostsService,
    private readonly laborRates: LaborRatesService,
    private readonly invoices: InternalInvoicesService,
  ) {}

  @Get('parts')
  parts(@Query() query: Record<string, unknown>) {
    return this.catalog.catalog(query);
  }

  @Post('parts')
  createPart(@Req() request: Request, @Body() body: unknown) {
    return this.catalog.createPart(request.user!, body);
  }

  // D45 / ST-2: a repair or tire category.
  @Post('part-categories')
  createPartCategory(@Req() request: Request, @Body() body: unknown) {
    return this.catalog.createCategory(request.user!, body);
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

  // PCA6 (UX-10-004): the invoice file on its own; the ledger is not touched.
  @Patch('purchases/:id/attachment')
  setPurchaseAttachment(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.purchases.setAttachment(request.user!, id, body);
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

  // D45 / ST-3: the Shop's stock. Static paths come before `stock/:partId`.
  @Get('stock')
  stockList(@Query() query: Record<string, unknown>) {
    return this.stock.list(query);
  }

  @Post('stock/count')
  stockCount(@Req() request: Request, @Body() body: unknown) {
    return this.stock.count(request.user!, body);
  }

  @Post('stock/issue')
  stockIssue(@Req() request: Request, @Body() body: unknown) {
    return this.stock.issue(request.user!, body);
  }

  @Post('stock/movements/:id/return')
  stockReturn(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.stock.returnToStock(request.user!, id, body);
  }

  // D45 / ST-4: confirm the tires the inspection proposed on a Tires Job.
  @Post('jobs/:jobId/tires')
  confirmTires(@Req() request: Request, @Param('jobId') jobId: string, @Body() body: unknown) {
    return this.stock.confirmTires(request.user!, jobId, body);
  }

  @Get('stock/:partId')
  stockPart(@Param('partId') partId: string) {
    return this.stock.part(partId);
  }

  // D45 / ST-1: the Jobs of a truck a purchase line can be tied to.
  @Get('truck-jobs')
  truckJobs(@Query() query: Record<string, unknown>) {
    return this.purchases.truckJobs(query);
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

  // PCA6 (UX-10-004): the invoice file on its own; the ledger is not touched.
  @Patch('outside-repairs/:id/attachment')
  setOutsideRepairAttachment(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.repairs.setAttachment(request.user!, id, body);
  }

  // PC-4: Truck → Costs (reads the ledger).
  @Get('trucks/:id/costs')
  costsOfTruck(@Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.truckCosts.costs(id, query);
  }

  // LB-1 (LTR-201 / D34): the shop's labor rate.
  @Get('labor-rates')
  listLaborRates() {
    return this.laborRates.list();
  }

  // PCA7 (UX-10-005): what a rate from a date would recalculate, before saving it.
  @Get('labor-rates/preview')
  previewLaborRate(@Query() query: Record<string, unknown>) {
    return this.laborRates.preview(query);
  }

  @Post('labor-rates')
  setLaborRate(@Req() request: Request, @Body() body: unknown) {
    return this.laborRates.set(request.user!, body);
  }

  // PCA7 (UX-10-005): take back the latest rate while nothing invoiced used it.
  @Delete('labor-rates/:id')
  removeLaborRate(@Req() request: Request, @Param('id') id: string) {
    return this.laborRates.remove(request.user!, id);
  }

  // LB-2 (LTR-201 / D34): internal invoices to Finance.
  @Get('internal-invoices')
  listInternalInvoices(@Query() query: Record<string, unknown>) {
    return this.invoices.list(query);
  }

  // PCA16 (D37, P15): the month's close, every truck at once. Declared before `:id` so "month" is not read as one.
  @Get('internal-invoices/month')
  invoiceMonth(@Query() query: Record<string, unknown>) {
    return this.invoices.month(query);
  }

  @Post('internal-invoices/create-all')
  createAllInternalInvoices(@Req() request: Request, @Body() body: unknown) {
    return this.invoices.createAll(request.user!, body);
  }

  @Get('internal-invoices/:id')
  internalInvoice(@Param('id') id: string) {
    return this.invoices.detail(id);
  }

  @Post('internal-invoices')
  createInternalInvoice(@Req() request: Request, @Body() body: unknown) {
    return this.invoices.create(request.user!, body);
  }

  @Post('internal-invoices/:id/refresh')
  refreshInternalInvoice(@Param('id') id: string) {
    return this.invoices.refresh(id);
  }

  @Post('internal-invoices/:id/lines/:lineId/remove')
  removeInternalInvoiceLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.invoices.setLine(id, lineId, false);
  }

  @Post('internal-invoices/:id/lines/:lineId/restore')
  restoreInternalInvoiceLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.invoices.setLine(id, lineId, true);
  }

  @Post('internal-invoices/:id/send')
  sendInternalInvoice(@Req() request: Request, @Param('id') id: string) {
    return this.invoices.send(request.user!, id);
  }

  @Post('internal-invoices/:id/accept')
  acceptInternalInvoice(@Req() request: Request, @Param('id') id: string) {
    return this.invoices.accept(request.user!, id);
  }

  @Post('internal-invoices/:id/void')
  voidInternalInvoice(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.invoices.void(request.user!, id, body);
  }

  @Delete('internal-invoices/:id')
  deleteInternalInvoice(@Param('id') id: string) {
    return this.invoices.deleteDraft(id);
  }
}
