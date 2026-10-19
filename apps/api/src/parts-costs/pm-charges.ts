import { formatCents } from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import { liveEntries, reverseSource, writeEntries } from './cost-ledger';
import { balance, issueToJob, lockPart, outValue, undoIssue } from './stock-ledger';

/**
 * D45 / ST-5 (LTR-225, P29): what a PM costs the truck besides labor. Like labor (D34), it is written when the Work
 * Order is **completed** and undone when it is reopened or cancelled; calling it twice changes nothing.
 *
 * - **Parts:** each part the mechanic picked leaves the shelf (one unit) at the average cost (P27). A part that is not
 *   on the shelf is not charged: it came from a purchase already charged to that truck (or was not put). A part
 *   already charged to the PM Job is not charged again (LTR-242): a live purchase line to the truck tied to that Job,
 *   or a "Parts from stock" issue to that Job. A truck purchase with no Job does not count: nothing says it was for
 *   this PM, so the Manager ties it to the PM Job when it was.
 * - **Oil:** a flat "Oil change" price (`pm_oil_prices`, the one in effect the day the Work Order was completed), as a
 *   shop charges it; bulk oil is bought as Shop supplies, not counted by the gallon.
 */
export const OIL_SOURCE = 'pm_oil_change' as const;

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

/** LTR-242 (P29): the picked parts the truck already pays for on the PM Job, bought for it or taken from stock by hand. */
async function chargedToPmJob(tx: Prisma.TransactionClient, pmJobId: string | null, partIds: string[]) {
  if (!pmJobId || partIds.length === 0) return new Set<string>();
  const [bought, issued] = await Promise.all([
    tx.partPurchaseLine.findMany({
      where: { workOrderJobId: pmJobId, partId: { in: partIds }, destination: 'truck', quantity: { gt: 0 }, purchase: { voidedAt: null } },
      select: { partId: true },
    }),
    tx.stockMovement.findMany({
      where: { workOrderJobId: pmJobId, partId: { in: partIds }, kind: 'issue', pmServiceId: null, reversals: { none: {} } },
      select: { partId: true },
    }),
  ]);
  return new Set([...bought, ...issued].map((row) => row.partId!));
}

export type PmPreviewStatus = 'from_stock' | 'bought_for_job' | 'taken_for_job' | 'not_in_stock';

/**
 * D47 / LTR-247: what completing this PM will charge, per part the mechanic picked, with the same rule as
 * `syncWorkOrderPmCharges` (P29, LTR-242): bought for the PM Job or taken from stock by hand → not again; on the
 * shelf → one unit at the average; not on the shelf → nothing. Also the truck's purchases with no Job that carry a
 * picked part (the case LTR-242 does not catch: the Manager ties them to the PM Job if they were for it).
 */
export async function previewPmCharges(tx: Prisma.TransactionClient, pmJobId: string) {
  const job = await tx.workOrderJob.findUnique({
    where: { id: pmJobId },
    select: {
      id: true,
      workOrder: { select: { truckId: true, createdAt: true } },
      pmService: { select: { parts: { select: { partId: true, part: { select: { displayName: true, partNumber: true } } } } } },
    },
  });
  if (!job) return null;
  if (!job.pmService) return 'not_pm' as const;
  const parts = job.pmService.parts;
  const ids = parts.map((row) => row.partId);
  const [bought, taken] = await Promise.all([
    tx.partPurchaseLine.findMany({ where: { workOrderJobId: job.id, partId: { in: ids }, destination: 'truck', quantity: { gt: 0 }, purchase: { voidedAt: null } }, select: { partId: true } }),
    tx.stockMovement.findMany({ where: { workOrderJobId: job.id, partId: { in: ids }, kind: 'issue', pmServiceId: null, reversals: { none: {} } }, select: { partId: true } }),
  ]);
  const boughtIds = new Set(bought.map((row) => row.partId!));
  const takenIds = new Set(taken.map((row) => row.partId));
  const rows = [];
  for (const row of parts) {
    let status: PmPreviewStatus;
    let unitCostCents: number | null = null;
    if (boughtIds.has(row.partId)) status = 'bought_for_job';
    else if (takenIds.has(row.partId)) status = 'taken_for_job';
    else {
      const onHand = await balance(tx, row.partId);
      if (onHand.hundredths >= 100) { status = 'from_stock'; unitCostCents = outValue(onHand, 100); } else status = 'not_in_stock';
    }
    rows.push({ partId: row.partId, displayName: row.part.displayName, partNumber: row.part.partNumber, status, unitCostCents });
  }
  const today = new Date(`${dateOnly(new Date())}T00:00:00.000Z`);
  const price = await tx.pmOilPrice.findFirst({ where: { effectiveFrom: { lte: today } }, orderBy: { effectiveFrom: 'desc' } });
  // The truck's purchases with no Job that carry a picked part, from a month before the Work Order on.
  const since = new Date(job.workOrder.createdAt.getTime() - 30 * 24 * 3600 * 1000);
  const loose = await tx.partPurchaseLine.findMany({
    where: { partId: { in: ids }, destination: 'truck', truckId: job.workOrder.truckId, workOrderJobId: null, quantity: { gt: 0 }, purchase: { voidedAt: null, invoiceDate: { gte: since } } },
    select: { partId: true, purchase: { select: { id: true, invoiceNumber: true } } },
  });
  return {
    parts: rows,
    oilCents: price && price.amountCents > 0 ? price.amountCents : null,
    truckPurchasesWithoutJob: loose.map((row) => ({ purchaseId: row.purchase.id, invoiceNumber: row.purchase.invoiceNumber, partId: row.partId! })),
  };
}

export async function syncWorkOrderPmCharges(tx: Prisma.TransactionClient, workOrderId: string, actorId: string) {
  const workOrder = await tx.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true, displayId: true, status: true, truckId: true, completedAt: true,
      pmService: {
        select: {
          id: true, workOrderJobId: true,
          workOrderJob: { select: { displayName: true, status: true } },
          parts: { select: { partId: true, part: { select: { id: true, displayName: true, partNumber: true } } } },
        },
      },
    },
  });
  if (!workOrder) return;
  const service = workOrder.pmService;
  // A PM Job that was cancelled took nothing.
  const active = Boolean(service) && service!.workOrderJob?.status !== 'cancelled';
  const completed = workOrder.status === 'completed' && Boolean(workOrder.completedAt) && active;

  // Parts.
  if (service) {
    const live = await tx.stockMovement.findMany({ where: { pmServiceId: service.id, kind: 'issue', reversals: { none: {} } } });
    const covered = completed ? await chargedToPmJob(tx, service.workOrderJobId, service.parts.map((row) => row.partId)) : new Set<string>();
    const wanted = completed ? service.parts.filter((row) => !covered.has(row.partId)) : [];
    const wantedIds = new Set(wanted.map((row) => row.partId));
    for (const issue of live.filter((row) => !wantedIds.has(row.partId))) {
      await undoIssue(tx, issue, actorId, completed ? 'PM part changed' : `${workOrder.displayId} ${workOrder.status === 'cancelled' ? 'cancelled' : 'reopened'}`);
    }
    const issued = new Set(live.map((row) => row.partId));
    for (const row of wanted.filter((item) => !issued.has(item.partId))) {
      await lockPart(tx, row.partId);
      if ((await balance(tx, row.partId)).hundredths < 100) continue;
      await issueToJob(tx, actorId, row.part, 100, {
        id: service.workOrderJobId, displayName: service.workOrderJob?.displayName ?? 'PM', workOrderId: workOrder.id, truckId: workOrder.truckId,
      }, service.id);
    }
  }

  // Oil.
  const source = { sourceType: OIL_SOURCE, sourceId: workOrder.id } as const;
  const liveOil = await liveEntries(tx, source);
  let wanted: { amountCents: number; occurredOn: Date; description: string } | null = null;
  if (completed && service) {
    const day = dateOnly(workOrder.completedAt!);
    const price = await tx.pmOilPrice.findFirst({ where: { effectiveFrom: { lte: new Date(`${day}T00:00:00.000Z`) } }, orderBy: { effectiveFrom: 'desc' } });
    if (price && price.amountCents > 0) {
      wanted = { amountCents: price.amountCents, occurredOn: new Date(`${day}T00:00:00.000Z`), description: `${workOrder.displayId} · Oil change ${formatCents(price.amountCents)}` };
    }
  }
  const same = wanted
    ? liveOil.length === 1 && liveOil[0].amountCents === wanted.amountCents && liveOil[0].truckId === workOrder.truckId && dateOnly(liveOil[0].occurredOn) === dateOnly(wanted.occurredOn)
    : liveOil.length === 0;
  if (same) return;
  await reverseSource(tx, source, actorId);
  if (wanted) {
    await writeEntries(tx, { ...source, kind: 'part_purchase', occurredOn: wanted.occurredOn, vendorId: null, workOrderId: workOrder.id, actorId }, [
      { truckId: workOrder.truckId, amountCents: wanted.amountCents, description: wanted.description },
    ]);
  }
}
