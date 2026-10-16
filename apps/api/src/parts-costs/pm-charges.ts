import { formatCents } from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import { liveEntries, reverseSource, writeEntries } from './cost-ledger';
import { balance, issueToJob, lockPart, undoIssue } from './stock-ledger';

/**
 * D45 / ST-5 (LTR-225, P29): what a PM costs the truck besides labor. Like labor (D34), it is written when the Work
 * Order is **completed** and undone when it is reopened or cancelled; calling it twice changes nothing.
 *
 * - **Parts:** each part the mechanic picked leaves the shelf (one unit) at the average cost (P27). A part that is not
 *   on the shelf is not charged: it came from a purchase already charged to that truck (or was not put).
 * - **Oil:** a flat "Oil change" price (`pm_oil_prices`, the one in effect the day the Work Order was completed), as a
 *   shop charges it; bulk oil is bought as Shop supplies, not counted by the gallon.
 */
export const OIL_SOURCE = 'pm_oil_change' as const;

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

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
    const wanted = completed ? service.parts : [];
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
