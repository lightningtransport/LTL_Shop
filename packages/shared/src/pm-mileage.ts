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

/** D35 / P12: past this many miles between the dashboard and Samsara, the PM screen asks to check (it never blocks). */
export const PM_SAMSARA_DIFF_WARN_MILES = 50;

/**
 * S4-1: the gap between what the PM mechanic typed (from the dashboard) and Samsara's odometer, when it is larger
 * than PM_SAMSARA_DIFF_WARN_MILES. Positive: the dashboard reads more. Null when either value is missing or close.
 */
export function samsaraMileageGap(observedMileage: number | null, samsaraMiles: number | null | undefined): number | null {
  if (observedMileage === null || samsaraMiles === null || samsaraMiles === undefined) return null;
  const gap = observedMileage - samsaraMiles;
  return Math.abs(gap) > PM_SAMSARA_DIFF_WARN_MILES ? gap : null;
}
