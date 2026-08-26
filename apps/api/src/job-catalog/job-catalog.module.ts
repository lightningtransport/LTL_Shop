import { Module } from '@nestjs/common';
import { JobCatalogController } from './job-catalog.controller';
import { JobCatalogService } from './job-catalog.service';

@Module({
  controllers: [JobCatalogController],
  providers: [JobCatalogService],
  exports: [JobCatalogService],
})
export class JobCatalogModule {}
