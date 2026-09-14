import type { AdminTruckDetailDto, JobStatus, WorkOrderStatus } from '@ltl-shop/shared';
import type { AdminMessages } from './admin-messages';
import type { ChipVariant } from './status-chips';
import { phaseLabel } from './status-chips';

/**
 * LTR-33 / LTR-34 Slice 1 Work Plan DTOs.
 * Mirrors PR #103 (`@ltl-shop/shared`) so this UI can merge before the API
 * branch. Switch imports to shared after that PR lands.
 */
export type WorkPlanInspectionOutcome = 'not_started' | 'issues_found' | 'no_issues_found';
export type WorkPlanJobUiStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type WorkPlanJobLane = 'shop_work' | 'alignment' | 'detailing' | 'quality_check';
export type WorkPlanMandatoryStatus = 'pending' | 'in_progress' | 'complete' | 'not_applicable';
export type WorkPlanReadiness = 'not_ready' | 'ready';
export type WorkPlanNotReadyReason =
  | 'inspection_pending'
  | 'jobs_remaining'
  | 'alignment_pending'
  | 'detailing_pending'
  | 'qc_pending'
  | 'plan_complete';
export type WorkPlanPhase =
  | 'inspection'
  | 'shop_work'
  | 'alignment'
  | 'detailing'
  | 'quality_check'
  | 'ready_to_go';

export interface WorkPlanJobDto {
  id: string;
  catalogJobId: string | null;
  displayName: string;
  customDescription: string | null;
  category: { id: string; name: string };
  status: JobStatus | `${JobStatus}`;
  uiStatus: WorkPlanJobUiStatus;
  lane: WorkPlanJobLane;
}

export interface WorkPlanMandatoryPhaseDto {
  required: boolean;
  status: WorkPlanMandatoryStatus;
  jobCount: number;
  remainingCount: number;
}

export interface WorkPlanCapabilitiesDto {
  canRead: boolean;
  canAddWork: boolean;
  canRecordInspection: boolean;
}

export interface TruckWorkPlanDto {
  sliceEnabled: boolean;
  inspection: { outcome: WorkPlanInspectionOutcome };
  workOrder: {
    id: string;
    displayId: string;
    status: WorkOrderStatus | `${WorkOrderStatus}`;
    version: number;
    primaryCategoryName: string;
  } | null;
  jobs: WorkPlanJobDto[];
  remainingJobCount: number;
  readiness: WorkPlanReadiness;
  readyReason: WorkPlanNotReadyReason;
  phase: WorkPlanPhase;
  mandatory: {
    alignment: WorkPlanMandatoryPhaseDto;
    detailing: WorkPlanMandatoryPhaseDto;
    qualityCheck: WorkPlanMandatoryPhaseDto;
  };
  capabilities: WorkPlanCapabilitiesDto;
  phase1: {
    assessmentId: string | null;
    gatesRemainDefault: true;
  };
}

export type AdminTruckDetailWithWorkPlan = AdminTruckDetailDto & {
  workPlan?: TruckWorkPlanDto;
};

export type WorkPlanJobDraft = {
  key: string;
  catalogJobId?: string;
  categoryId: string;
  categoryName: string;
  displayName: string;
  customDescription?: string;
};

export function isWorkPlanSliceEnabled(
  detail: Pick<AdminTruckDetailWithWorkPlan, 'workPlan'> | null | undefined,
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

export function shouldShowQualityCheckMandatory(plan: TruckWorkPlanDto) {
  return plan.mandatory.qualityCheck.required || plan.mandatory.qualityCheck.jobCount > 0;
}

function normalizeJobName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function existingWorkPlanCatalogJobIds(plan: TruckWorkPlanDto) {
  return plan.jobs
    .filter((job) => job.status !== 'cancelled' && job.catalogJobId)
    .map((job) => job.catalogJobId as string);
}

export function existingWorkPlanCustomNames(plan: TruckWorkPlanDto) {
  return plan.jobs
    .filter((job) => job.status !== 'cancelled' && !job.catalogJobId)
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
