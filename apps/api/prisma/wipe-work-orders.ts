import type { Prisma } from '@prisma/client';

// Every Work Order and readiness entry; nothing else writes the Activity Log.
export const WORK_ORDER_ACTIVITY_WHERE: Prisma.ActivityLogWhereInput = {
  OR: [
    { workOrderId: { not: null } },
    {
      entityType: {
        in: ['work_order', 'work_order_job', 'pause_event', 'work_order_note', 'mechanic_assignment', 'pm_service', 'truck', 'readiness_assessment', 'readiness_requirement'],
      },
    },
  ],
};

/**
 * Deletes every Work Order (with its Jobs, labor, blockers, notes, team, PM service) and the Truck state that
 * hangs off it. Keeps trucks (odometers included), users, catalog, parts and the Shop workflow.
 */
export async function wipeWorkOrders(tx: Prisma.TransactionClient) {
  await tx.activityLog.deleteMany({ where: WORK_ORDER_ACTIVITY_WHERE });
  await tx.truckMileageAdjustment.deleteMany({});
  await tx.truckServiceStatusEvent.deleteMany({});
  await tx.truckReadinessAssessment.deleteMany({});
  await tx.workOrder.deleteMany({});
}
