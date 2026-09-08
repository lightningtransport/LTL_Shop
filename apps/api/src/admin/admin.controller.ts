import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AppCapability, adminRepairHistoryQuerySchema } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Capabilities } from '../auth/capabilities.decorator';
import { CapabilitiesGuard } from '../auth/capabilities.guard';
import { TrucksService } from '../trucks/trucks.service';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard, CapabilitiesGuard)
@Capabilities(AppCapability.ADMIN_ACCESS)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly trucks: TrucksService,
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

  @Get('trucks/:id/repair-history')
  repairHistory(@Param('id') id: string, @Query() rawQuery: Record<string, unknown>) {
    const parsed = adminRepairHistoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { categoryId, excludeWorkOrderId, limit, cursor } = parsed.data;
    return this.trucks.getRepairHistory(id, categoryId, { excludeWorkOrderId, limit, cursor });
  }
}
