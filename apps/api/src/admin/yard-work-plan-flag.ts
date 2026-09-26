/**
 * Dual-run switches for Truck Work Plan (LTR-34 / LTR-39).
 *
 * Default off: Phase 1 six-gate assessment remains the Yard Operations derivation.
 *
 * - `YARD_WORK_PLAN_SLICE1`: Truck Detail also returns `workPlan` (Detail-only).
 * - `YARD_WORK_PLAN_SLICE2`: Yard board/list top-level `phase` (+ Ready filters/counts)
 *   use the same Work Plan derivation as Truck Detail. Gate mutation APIs stay live.
 *
 * Work Plan GET/POST hooks exist in both modes so Frontend can build against them.
 */
function envFlagEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

export function isYardWorkPlanSlice1Enabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.YARD_WORK_PLAN_SLICE1);
}

/** Board/list cutover onto Work Plan phase derivation (LTR-39). */
export function isYardWorkPlanSlice2Enabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.YARD_WORK_PLAN_SLICE2);
}

/**
 * LTR-141 / LTR-144: PM is a mandatory phase of the Work Plan (Shop Work → PM →
 * Alignment), QC is always required, and a lane whose Jobs were all cancelled
 * with a reason counts as not applicable. Default off.
 */
export function isWorkPlanPmPhaseEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.WORK_PLAN_PM_PHASE);
}
