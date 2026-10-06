import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { LaborClockService } from './labor-clock.service';
import { DayCloseController } from './day-close.controller';

@Module({
  imports: [ActivityLogModule],
  controllers: [WorkOrdersController, DayCloseController],
  providers: [WorkOrdersService, LaborClockService],
  exports: [WorkOrdersService, LaborClockService],
})
export class WorkOrdersModule {}
