/**
 * LTR-135 / D10: PM observed mileage rules shared by the API and the web app.
 * - Lower than the truck's current mileage is rejected (it would roll back the odometer).
 * - A jump larger than PM_MILEAGE_JUMP_CONFIRM_THRESHOLD needs explicit confirmation.
 */
export const PM_MILEAGE_JUMP_CONFIRM_THRESHOLD = 50_000;

export type PmMileageCheck =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; code: 'MILEAGE_BELOW_CURRENT'; currentMileage: number };

export function checkPmObservedMileage(
  observedMileage: number | null,
  currentTruckMileage: number | null,
): PmMileageCheck {
  if (observedMileage === null || currentTruckMileage === null) {
    return { ok: true, needsConfirmation: false };
  }
  if (observedMileage < currentTruckMileage) {
    return { ok: false, code: 'MILEAGE_BELOW_CURRENT', currentMileage: currentTruckMileage };
  }
  return {
    ok: true,
    needsConfirmation: observedMileage - currentTruckMileage > PM_MILEAGE_JUMP_CONFIRM_THRESHOLD,
  };
}
