import {
  JobStatus,
  ReadinessRequirementOutcome,
  WorkOrderStatus,
  WorkPlanInspectionOutcome,
  WorkPlanJobLane,
  WorkPlanJobUiStatus,
  WorkPlanMandatoryStatus,
  WorkPlanNotReadyReason,
  WorkPlanPhase,
  WorkPlanReadiness,
  isPmCategory,
  isQualityCheckJob,
  laneForSystemKey,
  jobWorkStatus,
  type JobExternalDto,
  type JobExternalKind,
  type WorkPlanJobDto,
  type WorkPlanMandatoryPhaseDto,
} from '@ltl-shop/shared';

export type WorkPlanDerivationJob = {
  id: string;
  catalogJobId: string | null;
  displayName: string;
  customDescription: string | null;
  category: { id: string; name: string };
  status: JobStatus | `${JobStatus}`;
  /** LTR-154 / D11: the Job's one owner (absent on callers that do not load it). */
  assignedMechanic?: { id: string; name: string } | null;
  startedAt?: Date | null;
  /** LTR-155 / D17: the Job has an unresolved mechanic blocker. */
  blocked?: boolean;
  /** LTR-188 / D23: the Job this one helps. */
  helperOfJobId?: string | null;
  /** LTR-188 / D24: the Job is at an external shop while `externalSince` is set. */
  externalSince?: Date | null;
  externalKind?: string | null;
  externalNote?: string | null;
  /** LTR-197 / D28: the step whose team queue the Job waits in (only for a Job born in a queue). */
  workflowStepKey?: string | null;
  /** LTR-198 / SW5: the System Job's key; the lane follows it, not the name. */
  systemKey?: string | null;
};

/** LTR-188 / D24: the Job's external-shop state as the DTOs carry it (null when it is in the shop). */
export function toJobExternalDto(job: {
  status?: string;
  externalSince?: Date | null;
  externalKind?: string | null;
  externalNote?: string | null;
}): JobExternalDto | null {
  if (!job.externalSince || !job.externalKind) return null;
  if (job.status !== undefined && job.status !== JobStatus.TO_DO) return null;
  return {
    kind: job.externalKind as JobExternalKind,
    note: job.externalNote ?? '',
    since: job.externalSince.toISOString(),
  };
}

export type WorkPlanDerivationWorkOrder = {
  id: string;
  displayId: string;
  status: WorkOrderStatus | `${WorkOrderStatus}`;
  version: number;
  primaryCategoryName: string;
};

export type WorkPlanDerivationInput = {
  workOrder: WorkPlanDerivationWorkOrder | null;
  jobs: WorkPlanDerivationJob[];
  /** LTR-154 / D18: labor sessions; when present a Job is In Progress only while its assignee works. */
  sessions?: { endedAt: Date | null; userId: string | null }[];
  inspectionRequirementOutcome?: ReadinessRequirementOutcome | `${ReadinessRequirementOutcome}` | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/** LTR-35 / LTR-41 catalog keys. UUIDs are per-environment; match by these stable names. */
export const DETAILING_CATALOG_CATEGORY_NAME = 'Detailing';
export const DETAILING_CATALOG_JOB_NAME = 'Detailing';
export const QUALITY_CHECK_CATALOG_CATEGORY_NAME = 'Quality Check';
export const QUALITY_CHECK_CATALOG_JOB_NAME = 'Quality Check';

/**
 * Match the seeded Detailing catalog category/job by name, plus LTR-34 custom jobs.
 */
export function isDetailingWorkPlanJob(categoryName: string, displayName: string) {
  const category = normalize(categoryName);
  const name = normalize(displayName);
  return (
    category === normalize(DETAILING_CATALOG_CATEGORY_NAME)
    || name === normalize(DETAILING_CATALOG_JOB_NAME)
    || category.includes('detailing')
    || name.includes('detailing')
  );
}

/**
 * The Work Plan lane of a Job. LTR-198 / SW5: a Job made from a System Job carries its key (`systemKey`) and is
 * placed by it, so renaming the catalog Job does not move it. Without a key the name rules below still apply.
 */
export function classifyWorkPlanLane(
  categoryName: string,
  displayName: string,
  systemKey?: string | null,
): WorkPlanJobLane {
  const bySystemKey = laneForSystemKey(systemKey);
  if (bySystemKey) return bySystemKey;
  const category = normalize(categoryName);
  const name = normalize(displayName);
  if (isDetailingWorkPlanJob(categoryName, displayName)) {
    return WorkPlanJobLane.DETAILING;
  }
  // LTR-144: PM A / PM B Service live in the PM Category.
  if (isPmCategory(categoryName)) {
    return WorkPlanJobLane.PM;
  }
  if (category.includes('alignment') || name === 'alignment') {
    return WorkPlanJobLane.ALIGNMENT;
  }
  // Only the Inspection Category: a repair Job named "... Inspection" in another
  // Category (e.g. Air & Brake "Brake Inspection") stays Shop Work.
  if (category === 'inspection') {
    return WorkPlanJobLane.INSPECTION;
  }
  if (isQualityCheckJob(categoryName, displayName)) {
    return WorkPlanJobLane.QUALITY_CHECK;
  }
  return WorkPlanJobLane.SHOP_WORK;
}

export function toWorkPlanJobUiStatus(
  status: JobStatus | `${JobStatus}`,
  workOrderStatus: WorkOrderStatus | `${WorkOrderStatus}` | null,
): WorkPlanJobUiStatus {
  if (status === JobStatus.CANCELLED) return WorkPlanJobUiStatus.CANCELLED;
  if (status === JobStatus.COMPLETED) return WorkPlanJobUiStatus.COMPLETED;
  if (
    workOrderStatus === WorkOrderStatus.IN_PROGRESS
    || workOrderStatus === WorkOrderStatus.WAITING_PAUSED
  ) {
    return WorkPlanJobUiStatus.IN_PROGRESS;
  }
  return WorkPlanJobUiStatus.PENDING;
}

const WORK_STATUS_TO_UI: Record<ReturnType<typeof jobWorkStatus>, WorkPlanJobUiStatus> = {
  pending: WorkPlanJobUiStatus.PENDING,
  in_progress: WorkPlanJobUiStatus.IN_PROGRESS,
  blocked: WorkPlanJobUiStatus.BLOCKED,
  completed: WorkPlanJobUiStatus.COMPLETED,
  cancelled: WorkPlanJobUiStatus.CANCELLED,
};

export function toWorkPlanJobDto(
  job: WorkPlanDerivationJob,
  workOrderStatus: WorkOrderStatus | `${WorkOrderStatus}` | null,
  sessions?: WorkPlanDerivationInput['sessions'],
): WorkPlanJobDto {
  const uiStatus = sessions
    ? WORK_STATUS_TO_UI[jobWorkStatus({
        status: job.status,
        assignedMechanicId: job.assignedMechanic?.id ?? null,
        startedAt: job.startedAt,
        isPm: isPmCategory(job.category.name),
        blocked: job.blocked,
      }, sessions)]
    : toWorkPlanJobUiStatus(job.status, workOrderStatus);
  const external = toJobExternalDto(job);
  return {
    id: job.id,
    catalogJobId: job.catalogJobId,
    displayName: job.displayName,
    customDescription: job.customDescription,
    category: job.category,
    status: job.status as JobStatus,
    // LTR-188 / D24: a Job at an external shop reads "At external shop", not Pending.
    uiStatus: external ? WorkPlanJobUiStatus.EXTERNAL : uiStatus,
    lane: classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey),
    ...(job.assignedMechanic !== undefined ? { assignedMechanic: job.assignedMechanic } : {}),
    helperOfJobId: job.helperOfJobId ?? null,
    external,
    // LTR-197 / D28: unowned and in its step's team queue — waiting to be taken, not "unassigned".
    teamQueueStepKey: job.workflowStepKey && !job.assignedMechanic && job.status === 'to_do' ? job.workflowStepKey : null,
  };
}

function mandatoryPhase(
  jobs: WorkPlanJobDto[],
  required: boolean,
  options: { cancelledMeansNotApplicable?: boolean } = {},
): WorkPlanMandatoryPhaseDto {
  const active = jobs.filter((job) => job.status !== JobStatus.CANCELLED);
  const remainingCount = active.filter((job) => job.status === JobStatus.TO_DO).length;
  const completedCount = active.filter((job) => job.status === JobStatus.COMPLETED).length;
  if (!required && jobs.length === 0) {
    return { required: false, status: WorkPlanMandatoryStatus.NOT_APPLICABLE, jobCount: 0, remainingCount: 0 };
  }
  // LTR-144: the Manager cancelled every Job of this step with a reason ("No aplica").
  if (options.cancelledMeansNotApplicable && jobs.length > 0 && active.length === 0) {
    return { required, status: WorkPlanMandatoryStatus.NOT_APPLICABLE, jobCount: 0, remainingCount: 0 };
  }
  // LTR-164 (#3): a step is In Progress once someone works on it (or part of it is done), not just because a Job exists.
  const started = active.some((job) => (
    job.status === JobStatus.TO_DO
    && (job.uiStatus === WorkPlanJobUiStatus.IN_PROGRESS || job.uiStatus === WorkPlanJobUiStatus.BLOCKED)
  ));
  let status = WorkPlanMandatoryStatus.PENDING;
  if (completedCount > 0 && remainingCount === 0) status = WorkPlanMandatoryStatus.COMPLETE;
  else if (remainingCount > 0 && (started || completedCount > 0)) status = WorkPlanMandatoryStatus.IN_PROGRESS;
  return { required, status, jobCount: active.length, remainingCount };
}

export function deriveInspectionOutcome(
  jobs: WorkPlanJobDto[],
  inspectionRequirementOutcome?: ReadinessRequirementOutcome | `${ReadinessRequirementOutcome}` | null,
): WorkPlanInspectionOutcome {
  const activeInspectionJobs = jobs.filter(
    (job) => job.lane === WorkPlanJobLane.INSPECTION && job.status !== JobStatus.CANCELLED,
  );
  // LTR-89: while an Inspection Job is still to do, discovery is not finished.
  if (activeInspectionJobs.some((job) => job.status === JobStatus.TO_DO)) {
    return WorkPlanInspectionOutcome.NOT_STARTED;
  }
  const shopJobs = jobs.filter((job) => job.lane === WorkPlanJobLane.SHOP_WORK);
  const hasShopWork = shopJobs.some((job) => job.status !== JobStatus.CANCELLED);
  if (hasShopWork) return WorkPlanInspectionOutcome.ISSUES_FOUND;
  if (inspectionRequirementOutcome === ReadinessRequirementOutcome.COMPLETED
    || inspectionRequirementOutcome === ReadinessRequirementOutcome.WAIVED
    || inspectionRequirementOutcome === ReadinessRequirementOutcome.NOT_REQUIRED) {
    return WorkPlanInspectionOutcome.NO_ISSUES_FOUND;
  }
  if (inspectionRequirementOutcome === ReadinessRequirementOutcome.REQUIRED) {
    return WorkPlanInspectionOutcome.ISSUES_FOUND;
  }
  // A completed Inspection Job with no Shop Work on the plan found nothing to repair.
  if (activeInspectionJobs.length > 0) {
    return WorkPlanInspectionOutcome.NO_ISSUES_FOUND;
  }
  return WorkPlanInspectionOutcome.NOT_STARTED;
}

/** Resolved = done, or not applicable (every Job of the step cancelled with a reason). */
function unresolved(step: WorkPlanMandatoryPhaseDto) {
  return step.status !== WorkPlanMandatoryStatus.COMPLETE && step.status !== WorkPlanMandatoryStatus.NOT_APPLICABLE;
}

/**
 * LTR-144: a legacy PM Work Order (PM Category, no Jobs) is the PM phase while
 * open — not "Inspection pending" (LTR-91) — and the whole service once completed.
 */
function deriveLegacyPmWorkPlan(input: WorkPlanDerivationInput) {
  const open = input.workOrder?.status !== WorkOrderStatus.COMPLETED;
  const notApplicable = { required: false, status: WorkPlanMandatoryStatus.NOT_APPLICABLE, jobCount: 0, remainingCount: 0 };
  const pm = { required: true, status: open ? WorkPlanMandatoryStatus.IN_PROGRESS : WorkPlanMandatoryStatus.COMPLETE, jobCount: 0, remainingCount: 0 };
  return {
    inspection: { outcome: WorkPlanInspectionOutcome.NO_ISSUES_FOUND },
    jobs: [] as WorkPlanJobDto[],
    remainingJobCount: 0,
    shopWorkRemainingCount: 0,
    readiness: open ? WorkPlanReadiness.NOT_READY : WorkPlanReadiness.READY,
    readyReason: open ? WorkPlanNotReadyReason.PM_PENDING : WorkPlanNotReadyReason.PLAN_COMPLETE,
    phase: open ? WorkPlanPhase.PM : WorkPlanPhase.READY_TO_GO,
    mandatory: { pm, alignment: notApplicable, detailing: notApplicable, qualityCheck: notApplicable },
  };
}

export function deriveWorkPlan(input: WorkPlanDerivationInput) {
  if (input.workOrder && isPmCategory(input.workOrder.primaryCategoryName)) {
    return deriveLegacyPmWorkPlan(input);
  }
  const jobs = input.jobs.map((job) => toWorkPlanJobDto(job, input.workOrder?.status ?? null, input.sessions));
  const inspectionOutcome = deriveInspectionOutcome(jobs, input.inspectionRequirementOutcome);
  const byLane = (lane: WorkPlanJobLane) => jobs.filter((job) => job.lane === lane);
  const stepOptions = { cancelledMeansNotApplicable: true };
  const pm = mandatoryPhase(byLane(WorkPlanJobLane.PM), true, stepOptions);
  const alignment = mandatoryPhase(byLane(WorkPlanJobLane.ALIGNMENT), true, stepOptions);
  const detailing = mandatoryPhase(byLane(WorkPlanJobLane.DETAILING), true, stepOptions);
  const qualityJobs = byLane(WorkPlanJobLane.QUALITY_CHECK);
  // LTR-144: QC is always required (Cristian, 2026-09-25).
  const qualityCheck = mandatoryPhase(qualityJobs, true, stepOptions);
  const remainingJobs = jobs.filter((job) => job.status === JobStatus.TO_DO);
  const remainingJobCount = remainingJobs.length;
  const shopRemaining = remainingJobs.filter((job) => job.lane === WorkPlanJobLane.SHOP_WORK).length;
  const shopPresent = byLane(WorkPlanJobLane.SHOP_WORK).some((job) => job.status !== JobStatus.CANCELLED);
  const needsAddWork = inspectionOutcome === WorkPlanInspectionOutcome.ISSUES_FOUND && !shopPresent;

  let readyReason = WorkPlanNotReadyReason.PLAN_COMPLETE;
  if (inspectionOutcome === WorkPlanInspectionOutcome.NOT_STARTED) {
    readyReason = WorkPlanNotReadyReason.INSPECTION_PENDING;
  } else if (needsAddWork || shopRemaining > 0) {
    readyReason = WorkPlanNotReadyReason.JOBS_REMAINING;
  } else if (unresolved(pm)) {
    readyReason = WorkPlanNotReadyReason.PM_PENDING;
  } else if (unresolved(alignment)) {
    readyReason = WorkPlanNotReadyReason.ALIGNMENT_PENDING;
  } else if (unresolved(detailing)) {
    readyReason = WorkPlanNotReadyReason.DETAILING_PENDING;
  } else if (unresolved(qualityCheck)) {
    readyReason = WorkPlanNotReadyReason.QC_PENDING;
  } else if (input.workOrder && input.workOrder.status !== WorkOrderStatus.COMPLETED) {
    // LTR-90 / D1: Ready to Go only after the Manager completes the Work Order.
    readyReason = WorkPlanNotReadyReason.WORK_ORDER_OPEN;
  }

  const readiness = readyReason === WorkPlanNotReadyReason.PLAN_COMPLETE
    ? WorkPlanReadiness.READY
    : WorkPlanReadiness.NOT_READY;

  let phase = WorkPlanPhase.READY_TO_GO;
  if (inspectionOutcome === WorkPlanInspectionOutcome.NOT_STARTED) {
    phase = WorkPlanPhase.INSPECTION;
  } else if (needsAddWork || shopRemaining > 0) {
    phase = WorkPlanPhase.SHOP_WORK;
  } else if (unresolved(pm)) {
    phase = WorkPlanPhase.PM;
  } else if (unresolved(alignment)) {
    phase = WorkPlanPhase.ALIGNMENT;
  } else if (unresolved(detailing)) {
    phase = WorkPlanPhase.DETAILING;
  } else if (unresolved(qualityCheck)) {
    phase = WorkPlanPhase.QUALITY_CHECK;
  } else if (readyReason === WorkPlanNotReadyReason.WORK_ORDER_OPEN) {
    phase = WorkPlanPhase.READY_TO_CLOSE;
  }

  return {
    inspection: { outcome: inspectionOutcome },
    jobs,
    remainingJobCount,
    /** Shop Work Jobs still to do (the Yard card's "N Jobs pending" — not PM/Alignment/Detailing/QC). */
    shopWorkRemainingCount: shopRemaining,
    readiness,
    readyReason,
    phase,
    mandatory: { pm, alignment, detailing, qualityCheck },
  };
}
