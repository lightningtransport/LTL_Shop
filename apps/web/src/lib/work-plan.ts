import { JobStatus, type TruckWorkPlanDto } from '@ltl-shop/shared';
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
  /** D14: who does the Job, chosen as it is added; unset stays Unassigned. */
  assignedMechanicId?: string;
};

export function workPlanJobUiStatusVariant(status: string): ChipVariant {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'default';
  if (status === 'blocked') return 'warning';
  // LTR-188 / D24: at an external shop.
  if (status === 'external') return 'warning';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

export function workPlanJobUiStatusLabel(status: string, messages: AdminMessages) {
  if (status === 'pending') return messages.workPlanJobPending;
  if (status === 'in_progress') return messages.workPlanJobInProgress;
  if (status === 'blocked') return messages.blocked;
  if (status === 'completed') return messages.jobStatusCompleted;
  if (status === 'cancelled') return messages.jobStatusCancelled;
  if (status === 'external') return messages.externalStatus;
  return status;
}

export function workPlanPhaseLabel(phase: string, messages: AdminMessages) {
  if (phase === 'shop_work') return messages.shopWork;
  if (phase === 'ready_to_close') return messages.readyToClose;
  return phaseLabel(phase, messages);
}

export function workPlanReadyReasonMessage(reason: string, messages: AdminMessages) {
  if (reason === 'inspection_pending') return messages.workPlanReadyReasonInspection;
  if (reason === 'jobs_remaining') return messages.workPlanReadyReasonJobs;
  if (reason === 'pm_pending') return messages.workPlanReadyReasonPm;
  if (reason === 'alignment_pending') return messages.workPlanReadyReasonAlignment;
  if (reason === 'detailing_pending') return messages.workPlanReadyReasonDetailing;
  if (reason === 'qc_pending') return messages.workPlanReadyReasonQc;
  if (reason === 'work_order_open') return messages.workPlanReadyReasonWorkOrderOpen;
  if (reason === 'plan_complete') return messages.workPlanReadyReasonComplete;
  return reason;
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
