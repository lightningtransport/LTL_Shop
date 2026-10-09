import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TrucksModule } from './trucks/trucks.module';
import { JobCatalogModule } from './job-catalog/job-catalog.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthController } from './health.controller';
import { RequestTimingInterceptor } from './observability/request-timing.interceptor';
import { SentryHttpFilter } from './observability/sentry-http.filter';
import { PartsCostsModule } from './parts-costs/parts-costs.module';
import { AdminModule } from './admin/admin.module';
import { QualityCheckModule } from './quality-check/quality-check.module';

@Module({
  imports: [
    SentryModule.forRoot(),
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
    AdminModule,
    QualityCheckModule,
    PartsCostsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryHttpFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTimingInterceptor,
    },
  ],
})
export class AppModule {}
