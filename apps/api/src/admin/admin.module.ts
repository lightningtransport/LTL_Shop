import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { TrucksModule } from '../trucks/trucks.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { YardOperationsService } from './yard-operations.service';
import { YardWorkPlanService } from './yard-work-plan.service';
import { YardDataBoundaryService } from './yard-data-boundary.service';

@Module({
  imports: [AuthModule, TrucksModule, ActivityLogModule, WorkOrdersModule],
  controllers: [AdminController],
  providers: [AdminService, YardOperationsService, YardWorkPlanService, YardDataBoundaryService],
})
export class AdminModule {}
