import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AuthModule } from '../auth/auth.module';
import { PartsCatalogService } from './parts-catalog.service';
import { InvoiceFiles } from './invoice-files';
import { PartsCostsController } from './parts-costs.controller';
import { OutsideRepairsService } from './outside-repairs.service';
import { PurchasesService } from './purchases.service';

/** LTR-200 / D32: Parts & costs, stage 1. PC-1 = the part catalog and the vendors; PC-2 = purchases and invoice files; PC-3 = outside repairs. */
@Module({
  imports: [AuthModule, ActivityLogModule],
  controllers: [PartsCostsController],
  providers: [PartsCatalogService, PurchasesService, OutsideRepairsService, { provide: InvoiceFiles, useFactory: () => new InvoiceFiles() }],
})
export class PartsCostsModule {}
