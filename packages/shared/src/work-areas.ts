import { normalizeCatalogText } from './catalog';
import { ShopWorkflowStepKey, WorkPlanJobLane } from './enums';

/**
 * D57 (LTR-300): the one order of a Work Order's areas, written once. Inspection is first and Quality Check last;
 * PM, Alignment, Shop Work and Detailing have no order between them (the shop does them as the day goes). This is
 * the order they are painted in and the Yard's columns — never "first" and "after".
 */
export const WORK_AREA_ORDER: readonly WorkPlanJobLane[] = [
  WorkPlanJobLane.INSPECTION,
  WorkPlanJobLane.PM,
  WorkPlanJobLane.ALIGNMENT,
  WorkPlanJobLane.SHOP_WORK,
  WorkPlanJobLane.DETAILING,
  WorkPlanJobLane.QUALITY_CHECK,
];

/** D57: the areas between the inspection and the Quality Check, with no order between them. */
export const SHOP_AREAS: readonly WorkPlanJobLane[] = [
  WorkPlanJobLane.PM,
  WorkPlanJobLane.ALIGNMENT,
  WorkPlanJobLane.SHOP_WORK,
  WorkPlanJobLane.DETAILING,
];

const STEP_AREAS: Record<string, WorkPlanJobLane> = {
  [ShopWorkflowStepKey.PM]: WorkPlanJobLane.PM,
  [ShopWorkflowStepKey.ALIGNMENT]: WorkPlanJobLane.ALIGNMENT,
  [ShopWorkflowStepKey.DETAILING]: WorkPlanJobLane.DETAILING,
};

/**
 * D54 §3 / D57 §4: the tire machine is in Alignment, so these two Jobs are Alignment's (the rest of the category is
 * not). Found by their catalog seed key, which a rename keeps (D30); by name only when the caller has no key.
 */
const ALIGNMENT_TIRE_SEED_KEYS = new Set(['job:tireswheels/tires', 'job:tireswheels/flatrepair']);
const ALIGNMENT_TIRE_JOBS = new Set(['tires', 'flatrepair']);
const TIRES_CATEGORY = 'tireswheels';

export function workAreaRank(area: WorkPlanJobLane | `${WorkPlanJobLane}` | string): number {
  const rank = WORK_AREA_ORDER.indexOf(area as WorkPlanJobLane);
  return rank === -1 ? WORK_AREA_ORDER.length : rank;
}

/**
 * D57 (LTR-300): the area a Job shows in and is worked from. `lane` (the kind of step, `classifyWorkPlanLane`) is
 * unchanged — the step rules read it (a missing mandatory Job, the inspection's outcome, the QC). Only Shop Work
 * repairs can sit in another area: a Job waiting in a step's team queue (D28) is that step's, and Tires and Flat
 * Repair are Alignment's (D54).
 */
export function workAreaOf(job: {
  lane: WorkPlanJobLane | `${WorkPlanJobLane}`;
  categoryName: string;
  displayName: string;
  workflowStepKey?: string | null;
  /** The catalog Job's `seed_key`, when the caller loaded it (survives a rename). */
  catalogSeedKey?: string | null;
}): WorkPlanJobLane {
  const lane = job.lane as WorkPlanJobLane;
  if (lane !== WorkPlanJobLane.SHOP_WORK) return lane;
  const byStep = job.workflowStepKey ? STEP_AREAS[job.workflowStepKey] : undefined;
  if (byStep) return byStep;
  const isAlignmentTire = job.catalogSeedKey
    ? ALIGNMENT_TIRE_SEED_KEYS.has(job.catalogSeedKey)
    : normalizeCatalogText(job.categoryName) === TIRES_CATEGORY && ALIGNMENT_TIRE_JOBS.has(normalizeCatalogText(job.displayName));
  return isAlignmentTire ? WorkPlanJobLane.ALIGNMENT : WorkPlanJobLane.SHOP_WORK;
}

/** A Job's area as the web reads it: `area` from the API, or its lane while an older API answers (deploy skew). */
export function jobArea(job: { area?: WorkPlanJobLane | `${WorkPlanJobLane}` | null; lane: WorkPlanJobLane | `${WorkPlanJobLane}` }): WorkPlanJobLane {
  return (job.area ?? job.lane) as WorkPlanJobLane;
}
