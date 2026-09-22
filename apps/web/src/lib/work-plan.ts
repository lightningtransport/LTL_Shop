import { JobStatus, type AdminTruckDetailDto, type TruckWorkPlanDto } from '@ltl-shop/shared';
import type { AdminMessages } from './admin-messages';
import type { ChipVariant } from './status-chips';
import { phaseLabel } from './status-chips';

export type WorkPlanJobDraft = {
  key: string;
  catalogJobId?: string;
  categoryId: string;
  categoryName: string;
  displayName: string;
  customDescription?: string;
};

export function isWorkPlanSliceEnabled(
  detail: Pick<AdminTruckDetailDto, 'workPlan'> | null | undefined,
) {
  return detail?.workPlan?.sliceEnabled === true;
}

export function workPlanJobUiStatusVariant(status: string): ChipVariant {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'default';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

export function workPlanJobUiStatusLabel(status: string, messages: AdminMessages) {
  if (status === 'pending') return messages.workPlanJobPending;
  if (status === 'in_progress') return messages.workPlanJobInProgress;
  if (status === 'completed') return messages.jobStatusCompleted;
  if (status === 'cancelled') return messages.jobStatusCancelled;
  return status;
}

export function workPlanPhaseLabel(phase: string, messages: AdminMessages) {
  if (phase === 'shop_work') return messages.shopWork;
  return phaseLabel(phase, messages);
}

export function workPlanReadyReasonMessage(reason: string, messages: AdminMessages) {
  if (reason === 'inspection_pending') return messages.workPlanReadyReasonInspection;
  if (reason === 'jobs_remaining') return messages.workPlanReadyReasonJobs;
  if (reason === 'alignment_pending') return messages.workPlanReadyReasonAlignment;
  if (reason === 'detailing_pending') return messages.workPlanReadyReasonDetailing;
  if (reason === 'qc_pending') return messages.workPlanReadyReasonQc;
  if (reason === 'plan_complete') return messages.workPlanReadyReasonComplete;
  return reason;
}

/** Catalog category to pre-select when the next Work Plan step needs Add work. */
export function workPlanNextStepCategoryName(readyReason: string): string | null {
  if (readyReason === 'alignment_pending') return 'Suspension & Steering';
  if (readyReason === 'detailing_pending') return 'Detailing';
  if (readyReason === 'qc_pending') return 'Quality Check';
  return null;
}

export function workPlanNextStepCtaLabel(readyReason: string, messages: AdminMessages): string | null {
  if (readyReason === 'alignment_pending') return messages.workPlanAddAlignmentCta;
  if (readyReason === 'detailing_pending') return messages.workPlanAddDetailingCta;
  if (readyReason === 'qc_pending') return messages.workPlanAddQcCta;
  return null;
}

export function workPlanRemainingSummary(remainingJobCount: number, messages: AdminMessages) {
  return messages.workPlanNotReadyRemaining.replace('{count}', String(remainingJobCount));
}

export function workPlanMandatoryStatusLabel(status: string, messages: AdminMessages) {
  if (status === 'pending') return messages.workPlanMandatoryPending;
  if (status === 'in_progress') return messages.workPlanJobInProgress;
  if (status === 'complete') return messages.workPlanMandatoryComplete;
  if (status === 'not_applicable') return messages.workPlanMandatoryNotApplicable;
  return status;
}

/** Same Badge variants as Work Plan job chips: Pending outline, Complete success. */
export function workPlanMandatoryStatusVariant(status: string): ChipVariant {
  if (status === 'complete') return 'success';
  if (status === 'in_progress') return 'default';
  if (status === 'not_applicable') return 'secondary';
  return 'outline';
}

export function shouldShowQualityCheckMandatory(plan: TruckWorkPlanDto) {
  return plan.mandatory.qualityCheck.required || plan.mandatory.qualityCheck.jobCount > 0;
}

function normalizeJobName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function existingWorkPlanCatalogJobIds(plan: TruckWorkPlanDto) {
  return plan.jobs
    .filter((job) => job.status !== JobStatus.CANCELLED && job.catalogJobId)
    .map((job) => job.catalogJobId as string);
}

export function existingWorkPlanCustomNames(plan: TruckWorkPlanDto) {
  return plan.jobs
    .filter((job) => job.status !== JobStatus.CANCELLED && !job.catalogJobId)
    .map((job) => job.displayName);
}

export function draftContainsCatalogJob(drafts: readonly WorkPlanJobDraft[], catalogJobId: string) {
  return drafts.some((job) => job.catalogJobId === catalogJobId);
}

export function draftContainsCustomName(drafts: readonly WorkPlanJobDraft[], displayName: string) {
  const normalized = normalizeJobName(displayName);
  return drafts.some((job) => !job.catalogJobId && normalizeJobName(job.displayName) === normalized);
}

export function isDuplicateCustomOnPlan(existingNames: readonly string[], displayName: string) {
  const normalized = normalizeJobName(displayName);
  return existingNames.some((name) => normalizeJobName(name) === normalized);
}
