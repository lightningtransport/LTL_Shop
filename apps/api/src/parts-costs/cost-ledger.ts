import type { Prisma, TruckCostKind } from '@prisma/client';

/**
 * LTR-200 / D32: the Truck cost ledger (`truck_cost_entries`). Rows are only ever added: a change to a purchase or
 * an outside repair writes a reversal (same amount, negative, `reverses_entry_id`) for each of its live rows, then
 * the new rows. The Truck's costs (PC-4) and, later, labor and the internal invoice read it as it is.
 */

export type TruckGroup = { truckId: string | null; baseCents: number };

/**
 * D-PC2: tax and freight are shared among the invoice's groups (each truck, and "no truck") in proportion to their
 * lines, whole cents only; the cents left go one by one to the biggest groups. The shares always add up to `extra`.
 */
export function allocateExtra(groups: TruckGroup[], extraCents: number): Map<string | null, number> {
  const shares = new Map<string | null, number>(groups.map((group) => [group.truckId, 0]));
  if (!extraCents || !groups.length) return shares;
  const subtotal = groups.reduce((sum, group) => sum + group.baseCents, 0);
  const ordered = [...groups].sort((left, right) => right.baseCents - left.baseCents);
  if (subtotal === 0) {
    shares.set(ordered[0].truckId, extraCents);
    return shares;
  }
  let given = 0;
  for (const group of groups) {
    const share = Math.floor((extraCents * group.baseCents) / subtotal);
    shares.set(group.truckId, share);
    given += share;
  }
  for (let index = 0; given < extraCents; index = (index + 1) % ordered.length, given += 1) {
    shares.set(ordered[index].truckId, shares.get(ordered[index].truckId)! + 1);
  }
  return shares;
}

/** Lines grouped by truck (null = no truck), each group with its share of tax and freight. */
export function truckAmounts(lines: Array<{ truckId: string | null; lineTotalCents: number }>, extraCents: number) {
  const bases = new Map<string | null, number>();
  for (const line of lines) bases.set(line.truckId, (bases.get(line.truckId) ?? 0) + line.lineTotalCents);
  const groups = [...bases.entries()].map(([truckId, baseCents]) => ({ truckId, baseCents }));
  const extra = allocateExtra(groups, extraCents);
  return groups.map((group) => ({ truckId: group.truckId, amountCents: group.baseCents + (extra.get(group.truckId) ?? 0) }));
}

type Source = { sourceType: 'part_purchase' | 'outside_repair'; sourceId: string };

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
