import type { Prisma } from '@prisma/client';

/**
 * Demo only (`reset-demo-work-orders --demo`): deletes everything Parts & costs wrote — internal invoices, labor
 * rates, the Truck cost ledger, invoice files, purchases, outside repairs, their Activity Log rows, app-made parts,
 * part prices and vendors — so the demo can build them again with the same vendor names and invoice numbers. Keeps
 * the seed parts and their fits. Runs before the history: with no rate, closing a Work Order writes no labor.
 */
export async function wipePartsCosts(tx: Prisma.TransactionClient) {
  // Invoice lines point at ledger rows (RESTRICT): invoices (and their lines) first.
  await tx.internalInvoice.deleteMany({});
  await tx.laborRate.deleteMany({});
  // A reversal points at the entry it reverses (RESTRICT): reversals first.
  await tx.truckCostEntry.deleteMany({ where: { reversesEntryId: { not: null } } });
  await tx.truckCostEntry.deleteMany({});
  await tx.attachment.deleteMany({});
  await tx.partPurchase.deleteMany({});
  await tx.outsideRepair.deleteMany({});
  await tx.activityLog.deleteMany({ where: { entityType: { in: ['vendor', 'part', 'part_purchase', 'outside_repair', 'labor_rate', 'internal_invoice', 'custom_job_group'] } } });
  await tx.part.deleteMany({ where: { source: 'app' } });
  await tx.part.updateMany({ data: { unitCostCents: null, defaultVendorId: null } });
  await tx.vendor.deleteMany({});
}
