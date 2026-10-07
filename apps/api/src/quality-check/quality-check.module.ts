import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { QualityCheckController } from './quality-check.controller';
import { QualityCheckService } from './quality-check.service';
import { YardDataBoundaryService } from '../admin/yard-data-boundary.service';

@Module({
  imports: [AuthModule, ActivityLogModule],
  controllers: [QualityCheckController],
  // D-QC5: Dispatch's departures and locations, read the same way the Yard reads them.
  providers: [QualityCheckService, YardDataBoundaryService],
})
export class QualityCheckModule {}
