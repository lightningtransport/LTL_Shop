import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { QualityCheckController } from './quality-check.controller';
import { QualityCheckService } from './quality-check.service';

@Module({
  imports: [AuthModule, ActivityLogModule],
  controllers: [QualityCheckController],
  providers: [QualityCheckService],
})
export class QualityCheckModule {}
