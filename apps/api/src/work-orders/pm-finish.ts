import { BadRequestException } from '@nestjs/common';
import { ActivityEventType } from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import type { ActivityLogService } from '../activity-log/activity-log.service';
import { assertPmObservedMileage } from './pm-mileage.guard';

/**
 * LTR-146: one definition of "a PM service can be finished" and of the truck
 * mileage update, shared by the legacy PM Work Order finish (mechanic + Admin)
 * and the PM job inside a truck Work Order.
 */
export function assertPmServiceReadyToFinish(
  pmService: { observedMileage: number | null; parts: unknown[] } | null | undefined,
  currentTruckMileage: number | null,
): number {
  const observed = pmService?.observedMileage;
  if (observed == null) {
    throw new BadRequestException('Observed mileage is required to finish a PM service');
  }
  if (!pmService?.parts.length) {
    throw new BadRequestException('Select at least one part before finishing a PM service');
  }
  // The truck mileage can move after the PM draft was saved.
  assertPmObservedMileage(observed, currentTruckMileage, { confirmLargeJump: true });
  return observed;
}

/** Moves the truck odometer to the observed PM mileage, with an adjustment row and an Activity Log entry. */
export async function applyPmObservedMileage(
  tx: Pick<Prisma.TransactionClient, 'truck' | 'truckMileageAdjustment'>,
  activity: Pick<ActivityLogService, 'log'>,
  input: { truckId: string; workOrderId: string; currentMileage: number | null; observedMileage: number; userId: string },
) {
  if (input.observedMileage === input.currentMileage) return;
  await tx.truck.update({ where: { id: input.truckId }, data: { mileage: input.observedMileage } });
  await tx.truckMileageAdjustment.create({
    data: {
      truckId: input.truckId,
      workOrderId: input.workOrderId,
      previousMileage: input.currentMileage,
      observedMileage: input.observedMileage,
      createdById: input.userId,
    },
  });
  await activity.log(tx as never, {
    workOrderId: input.workOrderId,
    eventType: ActivityEventType.TRUCK_MILEAGE_CORRECTED,
    entityType: 'truck',
    entityId: input.truckId,
    userId: input.userId,
    previousValue: { mileage: input.currentMileage },
    newValue: { mileage: input.observedMileage },
  });
}
