/**
 * Dual-run switch for LTR-34 / LTR-33 Slice 1.
 * Default off: Phase 1 six-gate assessment remains the Yard Operations derivation.
 * When `YARD_WORK_PLAN_SLICE1` is true/1/yes, Truck Detail also returns `workPlan`.
 * Work Plan GET/POST hooks exist in both modes so Frontend can build against them.
 */
export function isYardWorkPlanSlice1Enabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.YARD_WORK_PLAN_SLICE1?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}
