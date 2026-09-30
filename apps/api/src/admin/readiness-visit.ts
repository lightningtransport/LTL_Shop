import type { Prisma } from '@prisma/client';
import { ActivityEventType } from '@ltl-shop/shared';
import type { ActivityLogService } from '../activity-log/activity-log.service';

/**
 * LTR-177: the inspection lives on the truck's readiness assessment, and that
 * assessment must belong to ONE visit. A new Work Order is a new visit, so any
 * assessment still open from the previous one is closed here and the next
 * "Issues found / No issues found" starts a fresh one. A cancelled Work Order
 * closes its assessment too; reopening the Work Order brings it back.
 */
export async function closeActiveAssessments(
  tx: Prisma.TransactionClient,
  activity: ActivityLogService,
  input: { truckId: string; userId: string; reason: 'new_work_order' | 'work_order_cancelled'; workOrderId?: string },
  now: Date = new Date(),
): Promise<number> {
  const active = await tx.truckReadinessAssessment.findMany({
    where: { truckId: input.truckId, status: { in: ['under_review', 'ready'] } },
    select: { id: true, status: true, version: true },
  });
  for (const assessment of active) {
    await tx.truckReadinessAssessment.update({
      where: { id: assessment.id },
      data: { status: 'closed', closedAt: now, closedById: input.userId, closedReason: input.reason, version: { increment: 1 } },
    });
    await activity.log(tx, {
      eventType: ActivityEventType.READINESS_ASSESSMENT_CLOSED,
      entityType: 'readiness_assessment',
      entityId: assessment.id,
      userId: input.userId,
      previousValue: { status: assessment.status, version: assessment.version },
      newValue: { status: 'closed', version: assessment.version + 1, closedReason: input.reason },
      relevantValue: { truckId: input.truckId, workOrderId: input.workOrderId ?? null },
    });
  }
  return active.length;
}

/** Reopening a cancelled Work Order brings its visit's inspection back (unless another visit started since). */
export async function reopenAssessmentOfWorkOrder(
  tx: Prisma.TransactionClient,
  activity: ActivityLogService,
  input: { truckId: string; assessmentId: string | null; userId: string; workOrderId: string },
): Promise<boolean> {
  if (!input.assessmentId) return false;
  const assessment = await tx.truckReadinessAssessment.findUnique({
    where: { id: input.assessmentId },
    select: { id: true, status: true, version: true, closedReason: true },
  });
  if (!assessment || assessment.status !== 'closed' || assessment.closedReason !== 'work_order_cancelled') return false;
  const another = await tx.truckReadinessAssessment.count({
    where: { truckId: input.truckId, status: { in: ['under_review', 'ready'] } },
  });
  if (another) return false;
  await tx.truckReadinessAssessment.update({
    where: { id: assessment.id },
    data: { status: 'under_review', closedAt: null, closedById: null, closedReason: null, readyAt: null, approvedById: null, version: { increment: 1 } },
  });
  await activity.log(tx, {
    eventType: ActivityEventType.READINESS_ASSESSMENT_STARTED,
    entityType: 'readiness_assessment',
    entityId: assessment.id,
    userId: input.userId,
    previousValue: { status: 'closed', version: assessment.version },
    newValue: { status: 'under_review', version: assessment.version + 1 },
    relevantValue: { reason: 'work_order_reopened', workOrderId: input.workOrderId },
  });
  return true;
}
