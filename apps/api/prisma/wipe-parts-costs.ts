import type { Prisma } from '@prisma/client';

/**
 * Demo only (`reset-demo-work-orders --demo`): deletes everything Parts & costs wrote — the Truck cost ledger,
 * invoice files, purchases, outside repairs, their Activity Log rows, app-made parts, part prices and vendors — so the
 * demo can build them again with the same vendor names and invoice numbers. Keeps the seed parts and their fits.
 */
export async function wipePartsCosts(tx: Prisma.TransactionClient) {
  // A reversal points at the entry it reverses (RESTRICT): reversals first.
  await tx.truckCostEntry.deleteMany({ where: { reversesEntryId: { not: null } } });
  await tx.truckCostEntry.deleteMany({});
  await tx.attachment.deleteMany({});
  await tx.partPurchase.deleteMany({});
  await tx.outsideRepair.deleteMany({});
  await tx.activityLog.deleteMany({ where: { entityType: { in: ['vendor', 'part', 'part_purchase', 'outside_repair'] } } });
  await tx.part.deleteMany({ where: { source: 'app' } });
  await tx.part.updateMany({ data: { unitCostCents: null, defaultVendorId: null } });
  await tx.vendor.deleteMany({});
}
