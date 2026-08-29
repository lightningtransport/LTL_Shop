import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TrucksService } from './trucks.service';

@Controller('trucks')
@UseGuards(AuthGuard)
export class TrucksController {
  constructor(private readonly trucks: TrucksService) {}

  @Get()
  list() {
    return this.trucks.list();
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.trucks.search(q ?? '');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.trucks.getById(id);
  }

  @Get(':id/open-work-order')
  openWorkOrder(@Param('id') id: string) {
    return this.trucks.getOpenWorkOrder(id);
  }

  @Get(':id/repair-history')
  repairHistory(
    @Param('id') id: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.trucks.getRepairHistory(id, categoryId);
  }
}
