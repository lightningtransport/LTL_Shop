import type { Prisma } from '@prisma/client';
import { computeTotals } from './work-order.timing';

/**
 * LTR-124 / D7: labor stops when a Standard Work Order has no pending Job.
 * Closes the open labor session and persists totals; the Work Order stays
 * In Progress (waiting on the Manager). If the Manager later adds or reopens a
 * Job, the mechanic taps Start Work again to open a new session.
 */
export async function stopLaborWhenNoPendingJobs(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const pending = await tx.workOrderJob.count({ where: { workOrderId, status: 'to_do' } });
  if (pending > 0) return false;
  const open = await tx.workSession.findFirst({
    where: { workOrderId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (!open) return false;
  await tx.workSession.update({ where: { id: open.id }, data: { endedAt: now } });
  const sessions = await tx.workSession.findMany({ where: { workOrderId } });
  const pauses = await tx.pauseEvent.findMany({ where: { workOrderId } });
  const totals = computeTotals({ sessions, pauses, now });
  await tx.workOrder.update({
    where: { id: workOrderId },
    data: {
      totalActiveLaborMs: BigInt(totals.totalActiveLaborMs),
      totalWaitingMs: BigInt(totals.totalWaitingMs),
    },
  });
  return true;
}
