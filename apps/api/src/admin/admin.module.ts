import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { TrucksModule } from '../trucks/trucks.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { YardOperationsService } from './yard-operations.service';

@Module({
  imports: [AuthModule, TrucksModule, ActivityLogModule],
  controllers: [AdminController],
  providers: [AdminService, YardOperationsService],
})
export class AdminModule {}
