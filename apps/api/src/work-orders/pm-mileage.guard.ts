import { BadRequestException } from '@nestjs/common';
import { checkPmObservedMileage, PM_MILEAGE_JUMP_CONFIRM_THRESHOLD } from '@ltl-shop/shared';

/** LTR-135 / D10: never roll back the truck odometer from a PM service. */
export function assertPmObservedMileage(
  observedMileage: number | null,
  currentTruckMileage: number | null,
  options: { confirmLargeJump: boolean },
) {
  const check = checkPmObservedMileage(observedMileage, currentTruckMileage);
  if (!check.ok) {
    throw new BadRequestException({
      code: check.code,
      message: `Observed mileage cannot be lower than the truck's current mileage (${check.currentMileage.toLocaleString('en-US')} mi).`,
      currentMileage: check.currentMileage,
    });
  }
  if (check.needsConfirmation && !options.confirmLargeJump) {
    throw new BadRequestException({
      code: 'MILEAGE_JUMP_CONFIRMATION_REQUIRED',
      message: `Observed mileage is more than ${PM_MILEAGE_JUMP_CONFIRM_THRESHOLD.toLocaleString('en-US')} mi above the truck's current mileage. Confirm it before saving.`,
    });
  }
}
