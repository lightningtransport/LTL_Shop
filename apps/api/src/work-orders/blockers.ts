import type { Prisma } from '@prisma/client';
import { ActivityEventType } from '@ltl-shop/shared';
import type { ActivityLogService } from '../activity-log/activity-log.service';

/**
 * LTR-176 / D17: a blocker belongs to one Job. When that Job stops existing as
 * pending work (cancelled, or completed by the Manager) or the whole Work Order
 * is cancelled, its blockers are resolved too, so the Next step never keeps
 * asking to resolve a blocker on work that is gone. Each resolution is logged
 * like a Manager resolve, with the note saying why.
 */
export async function resolveActiveBlockers(
  tx: Prisma.TransactionClient,
  activity: ActivityLogService,
  input: { workOrderId: string; jobId?: string; userId: string; note: string },
  now: Date = new Date(),
): Promise<number> {
  const blockers = await tx.pauseEvent.findMany({
    where: {
      workOrderId: input.workOrderId,
      isOfficialPause: false,
      resolvedAt: null,
      ...(input.jobId ? { jobId: input.jobId } : {}),
    },
  });
  for (const blocker of blockers) {
    await tx.pauseEvent.update({ where: { id: blocker.id }, data: { resolvedAt: now, resolvedById: input.userId } });
    await activity.log(tx, {
      workOrderId: input.workOrderId,
      eventType: ActivityEventType.BLOCKER_RESOLVED,
      entityType: 'pause_event',
      entityId: blocker.id,
      userId: input.userId,
      previousValue: { reason: blocker.blockerReason ?? blocker.reason, notes: blocker.notes, jobId: blocker.jobId },
      newValue: { resolved: true, actor: 'manager', notes: input.note },
    });
  }
  return blockers.length;
}
