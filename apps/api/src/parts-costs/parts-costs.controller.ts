import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AppCapability } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Capabilities } from '../auth/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/capabilities.guard';
import { ManagerWritesGuard } from '../auth/manager-writes.guard';
import { PartsCatalogService } from './parts-catalog.service';

/**
 * LTR-200 / D32, D-PC7: Parts & costs is for the Shop Manager and the System Admin only — reading too, because it
 * shows money. Mechanics and Safety get 403 everywhere here.
 */
@Controller('admin/parts-costs')
@UseGuards(AuthGuard, CapabilitiesGuard, ManagerWritesGuard)
@Capabilities(AppCapability.ADMIN_ACCESS)
export class PartsCostsController {
  constructor(private readonly catalog: PartsCatalogService) {}

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
}
