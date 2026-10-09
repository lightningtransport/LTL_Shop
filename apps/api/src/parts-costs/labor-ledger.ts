import { formatCents, laborAmount } from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import { liveEntries, reverseSource, writeEntries } from './cost-ledger';

/**
 * LTR-201 / D34 (LB-1): the labor of a Work Order in the Truck cost ledger. Only a **completed** Work Order has
 * labor: hours of its closed sessions × the shop rate in effect the day each started. Called after anything that
 * can change it (complete, reopen, cancel, time correction, a new rate); it compares what the ledger holds with
 * what it should hold and, when they differ, writes reversals and the new row. Calling it twice changes nothing.
 */
export const LABOR_SOURCE = 'work_order_labor' as const;

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export async function syncWorkOrderLabor(tx: Prisma.TransactionClient, workOrderId: string, actorId: string) {
  const workOrder = await tx.workOrder.findUnique({
    where: { id: workOrderId },
    select: { id: true, displayId: true, status: true, truckId: true, completedAt: true },
  });
  if (!workOrder) return;
  const source = { sourceType: LABOR_SOURCE, sourceId: workOrder.id } as const;
  const live = await liveEntries(tx, source);

  let wanted: { amountCents: number; occurredOn: Date; description: string } | null = null;
  if (workOrder.status === 'completed' && workOrder.completedAt) {
    const [sessions, rates] = await Promise.all([
      tx.workSession.findMany({ where: { workOrderId, endedAt: { not: null } }, select: { startedAt: true, endedAt: true } }),
      tx.laborRate.findMany({ select: { rateCentsPerHour: true, effectiveFrom: true } }),
    ]);
    const labor = laborAmount(
      sessions.map((session) => ({ startedAt: session.startedAt, endedAt: session.endedAt! })),
      rates.map((rate) => ({ rateCentsPerHour: rate.rateCentsPerHour, effectiveFrom: dateOnly(rate.effectiveFrom) })),
    );
    if (labor.amountCents > 0) {
      const hours = (labor.ratedMinutes / 60).toFixed(2);
      const rate = labor.rateCents.length === 1 ? ` × ${formatCents(labor.rateCents[0])}/h` : '';
      wanted = { amountCents: labor.amountCents, occurredOn: new Date(`${dateOnly(workOrder.completedAt)}T00:00:00.000Z`), description: `${workOrder.displayId} · ${hours} h${rate}` };
    }
  }

  const same = wanted
    ? live.length === 1 && live[0].amountCents === wanted.amountCents && live[0].truckId === workOrder.truckId
      && dateOnly(live[0].occurredOn) === dateOnly(wanted.occurredOn) && live[0].description === wanted.description
    : live.length === 0;
  if (same) return;
  await reverseSource(tx, source, actorId);
  if (wanted) {
    await writeEntries(tx, {
      ...source,
      kind: 'labor',
      occurredOn: wanted.occurredOn,
      vendorId: null,
      workOrderId: workOrder.id,
      actorId,
    }, [{ truckId: workOrder.truckId, amountCents: wanted.amountCents, description: wanted.description }]);
  }
}
