import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AppCapability } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Capabilities } from '../auth/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/capabilities.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard, CapabilitiesGuard)
@Capabilities(AppCapability.ADMIN_ACCESS)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
}
