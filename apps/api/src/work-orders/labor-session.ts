import type { Prisma } from '@prisma/client';
import { computeTotals } from './work-order.timing';

type SessionLike = { endedAt: Date | null; userId?: string | null };

/**
 * LTR-154 / D18: the open labor session that belongs to this mechanic. A session
 * without userId predates per-mechanic labor (LTR-153) and counts for whoever
 * works the Work Order until it closes.
 */
export function openSessionFor<S extends SessionLike>(sessions: S[] | undefined, userId: string): S | null {
  return (sessions ?? []).find((session) => session.endedAt === null && (session.userId === userId || !session.userId)) ?? null;
}

/**
 * LTR-154 / D18: labor is per mechanic. After a Job completes (or is taken away
 * from a mechanic), close that mechanic's session when they have no pending Job
 * left on the Work Order. The Work Order stays In Progress; other mechanics keep
 * working. When the Work Order has no pending Job at all, every open session
 * closes (this also retires sessions opened before per-mechanic labor).
 * Persists the Work Order totals (sum of all sessions) when anything closed.
 */
export async function stopLaborForMechanic(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  userId: string | null,
  now: Date = new Date(),
): Promise<boolean> {
  const woPending = await tx.workOrderJob.count({ where: { workOrderId, status: 'to_do' } });
  const minePending = userId && woPending > 0
    ? await tx.workOrderJob.count({ where: { workOrderId, status: 'to_do', assignedMechanicId: userId } })
    : 0;
  if (woPending > 0 && (!userId || minePending > 0)) return false;
  const where: Prisma.WorkSessionWhereInput = woPending === 0
    ? { workOrderId, endedAt: null }
    : { workOrderId, endedAt: null, userId };
  const closed = await tx.workSession.updateMany({ where, data: { endedAt: now } });
  if (closed.count === 0) return false;
  await persistTotals(tx, workOrderId, now);
  return true;
}

/** LTR-124 kept for callers that only care about the Work Order as a whole. */
export async function stopLaborWhenNoPendingJobs(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  now: Date = new Date(),
): Promise<boolean> {
  return stopLaborForMechanic(tx, workOrderId, null, now);
}

async function persistTotals(tx: Prisma.TransactionClient, workOrderId: string, now: Date) {
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
}
