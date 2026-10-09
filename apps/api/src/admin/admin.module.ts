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
import { SystemAdminWritesService } from './system-admin-writes.service';
import { CatalogAdminService } from './catalog-admin.service';
import { CustomJobsReviewService } from './custom-jobs-review.service';
import { PeopleAdminService } from './people-admin.service';
import { ShopWorkflowService } from './shop-workflow.service';

@Module({
  imports: [AuthModule, TrucksModule, ActivityLogModule, WorkOrdersModule],
  controllers: [AdminController],
  providers: [AdminService, YardOperationsService, YardWorkPlanService, YardDataBoundaryService, SystemAdminWritesService, ShopWorkflowService, CatalogAdminService, PeopleAdminService, CustomJobsReviewService],
})
export class AdminModule {}
