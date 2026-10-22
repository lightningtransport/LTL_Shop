import { ReadinessRequirementOutcome, WorkPlanJobLane } from '@ltl-shop/shared';
import { classifyWorkPlanLane } from '../admin/yard-work-plan-derivation';

/**
 * D55 (P38, LTR-294): the rules a Work Order cannot skip on its way out of the shop.
 * R2 inspection before closing (or skipped with a reason), R9 the Quality Check is never
 * cancelled, R11 the Manager's Quality Check waits for the work like Safety's, R15 closing
 * means some work was done — a visit where everything was cancelled is cancelled, not closed.
 */

type RuleJob = { id: string; status: string; displayName: string; systemKey?: string | null; category: { name: string } };

export function isQualityCheckJob(job: RuleJob): boolean {
  return classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey) === WorkPlanJobLane.QUALITY_CHECK;
}

/** R11: every Job other than the Quality Check is completed or cancelled (the same test as Safety's QC_NOT_READY). */
export function workPendingBesides(jobs: RuleJob[], qcJobId: string): boolean {
  return jobs.some((job) => job.id !== qcJobId && job.status === 'to_do');
}

/** R15: at least one Job outside the Quality Check was completed. */
export function anyWorkDone(jobs: RuleJob[]): boolean {
  return jobs.some((job) => job.status === 'completed' && !isQualityCheckJob(job));
}

const INSPECTED = new Set<string>([
  ReadinessRequirementOutcome.COMPLETED,
  ReadinessRequirementOutcome.REQUIRED,
  ReadinessRequirementOutcome.NOT_REQUIRED,
  ReadinessRequirementOutcome.WAIVED,
]);

/**
 * R2: this visit's inspection was recorded — the sheet (D41) or the two buttons before it — on the
 * truck's active assessment (LTR-177: a new Work Order closes the previous visit's), or a legacy
 * Inspection Job was completed.
 */
export function inspectionRecorded(jobs: RuleJob[], inspectionOutcome: string | null | undefined): boolean {
  if (inspectionOutcome && INSPECTED.has(inspectionOutcome)) return true;
  return jobs.some((job) => job.status === 'completed'
    && classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey) === WorkPlanJobLane.INSPECTION);
}
