import type { AdminChargedOnDto } from '@ltl-shop/shared';
import type { Prisma, TruckCostKind } from '@prisma/client';

/**
 * LTR-200 / D32: the Truck cost ledger (`truck_cost_entries`). Rows are only ever added: a change to a purchase or
 * an outside repair writes a reversal (same amount, negative, `reverses_entry_id`) for each of its live rows, then
 * the new rows. The Truck's costs (PC-4) and, later, labor and the internal invoice read it as it is.
 */

export { allocateExtra, truckAmounts } from '@ltl-shop/shared';

// D45 / ST-3: `stock_issue` = a part that left the Shop's stock for a Job (kind `part_purchase`, at the average cost).
type Source = { sourceType: 'part_purchase' | 'outside_repair' | 'work_order_labor' | 'stock_issue'; sourceId: string };

/** The rows of a source that still count: not reversals, and not reversed yet. */
export async function liveEntries(tx: Prisma.TransactionClient, source: Source) {
  return tx.truckCostEntry.findMany({
    where: { ...source, reversesEntryId: null, reversals: { none: {} } },
    orderBy: { createdAt: 'asc' },
  });
}

/** Writes a reversal for every live row of the source. */
export async function reverseSource(tx: Prisma.TransactionClient, source: Source, actorId: string) {
  const live = await liveEntries(tx, source);
  for (const entry of live) {
    await tx.truckCostEntry.create({
      data: {
        truckId: entry.truckId,
        kind: entry.kind,
        amountCents: -entry.amountCents,
        currency: entry.currency,
        occurredOn: entry.occurredOn,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        workOrderId: entry.workOrderId,
        vendorId: entry.vendorId,
        description: entry.description,
        reversesEntryId: entry.id,
        createdById: actorId,
      },
    });
  }
  return live.length;
}

export async function writeEntries(
  tx: Prisma.TransactionClient,
  source: Source & { kind: TruckCostKind; occurredOn: Date; vendorId: string | null; workOrderId?: string | null; actorId: string },
  rows: Array<{ truckId: string; amountCents: number; description: string }>,
) {
  for (const row of rows) {
    await tx.truckCostEntry.create({
      data: {
        truckId: row.truckId,
        kind: source.kind,
        amountCents: row.amountCents,
        occurredOn: source.occurredOn,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        workOrderId: source.workOrderId ?? null,
        vendorId: source.vendorId,
        description: row.description.slice(0, 300),
        createdById: source.actorId,
      },
    });
  }
}

type Db = { internalInvoiceLine: Prisma.TransactionClient['internalInvoiceLine'] };

/** PCA4 (UX-10-002): the internal invoices (drafts included) that charge the live rows of a purchase or a repair. */
export async function chargedOnBySource(db: Db, source: Pick<Source, 'sourceType' | 'sourceId'>): Promise<AdminChargedOnDto[]> {
  const lines = await db.internalInvoiceLine.findMany({
    where: { active: true, costEntry: { sourceType: source.sourceType, sourceId: source.sourceId, reversesEntryId: null } },
    select: { invoice: { select: { id: true, number: true, status: true } } },
  });
  const seen = new Map<string, AdminChargedOnDto>();
  for (const line of lines) if (line.invoice.status !== 'void') seen.set(line.invoice.id, line.invoice);
  return [...seen.values()].sort((left, right) => (left.number ?? '').localeCompare(right.number ?? ''));
}

/** PCA4: for each ledger row id, the internal invoice that charges it (active line, invoice not void). */
export async function chargedOnByEntry(db: Db, entryIds: string[]): Promise<Map<string, AdminChargedOnDto>> {
  if (!entryIds.length) return new Map();
  const lines = await db.internalInvoiceLine.findMany({
    where: { active: true, costEntryId: { in: entryIds }, invoice: { status: { not: 'void' } } },
    select: { costEntryId: true, invoice: { select: { id: true, number: true, status: true } } },
  });
  return new Map(lines.map((line) => [line.costEntryId, line.invoice]));
}
