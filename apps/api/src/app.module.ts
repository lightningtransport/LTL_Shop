import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TrucksModule } from './trucks/trucks.module';
import { JobCatalogModule } from './job-catalog/job-catalog.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TrucksModule,
    JobCatalogModule,
    WorkOrdersModule,
    ActivityLogModule,
    IntegrationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
