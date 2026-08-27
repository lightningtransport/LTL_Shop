import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { JobCatalogService } from './job-catalog.service';

@Controller('catalog')
@UseGuards(AuthGuard)
export class JobCatalogController {
  constructor(private readonly catalog: JobCatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Get('jobs')
  jobs(
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
  ) {
    return this.catalog.listJobs(categoryId, q);
  }

  @Get('aliases')
  aliases(
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
  ) {
    return this.catalog.listAliases(categoryId, q);
  }
}
