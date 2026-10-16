import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AuthModule } from '../auth/auth.module';
import { PartsCatalogService } from './parts-catalog.service';
import { InvoiceFiles } from './invoice-files';
import { PartsCostsController } from './parts-costs.controller';
import { OutsideRepairsService } from './outside-repairs.service';
import { PurchasesService } from './purchases.service';
import { InternalInvoicesService } from './internal-invoices.service';
import { LaborRatesService } from './labor-rates.service';
import { PmOilPricesService } from './pm-oil-prices.service';
import { StockService } from './stock.service';
import { TruckCostsService } from './truck-costs.service';

/** LTR-200 / D32: Parts & costs, stage 1. PC-1 = the part catalog and the vendors; PC-2 = purchases and invoice files; PC-3 = outside repairs; PC-4 = Truck → Costs. */
@Module({
  imports: [AuthModule, ActivityLogModule],
  controllers: [PartsCostsController],
  providers: [PartsCatalogService, PurchasesService, StockService, PmOilPricesService, OutsideRepairsService, TruckCostsService, LaborRatesService, InternalInvoicesService, { provide: InvoiceFiles, useFactory: () => new InvoiceFiles() }],
})
export class PartsCostsModule {}
