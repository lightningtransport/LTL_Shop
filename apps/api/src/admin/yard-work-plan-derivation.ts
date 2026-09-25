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
};

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

export function classifyWorkPlanLane(
  categoryName: string,
  displayName: string,
): WorkPlanJobLane {
  const category = normalize(categoryName);
  const name = normalize(displayName);
  if (isDetailingWorkPlanJob(categoryName, displayName)) {
    return WorkPlanJobLane.DETAILING;
  }
  if (category.includes('alignment') || name === 'alignment') {
    return WorkPlanJobLane.ALIGNMENT;
  }
  // Only the Inspection Category: a repair Job named "... Inspection" in another
  // Category (e.g. Air & Brake "Brake Inspection") stays Shop Work.
  if (category === 'inspection') {
    return WorkPlanJobLane.INSPECTION;
  }
  if (
    category === normalize(QUALITY_CHECK_CATALOG_CATEGORY_NAME)
    || name === normalize(QUALITY_CHECK_CATALOG_JOB_NAME)
    || category.includes('quality check')
    || category.includes('quality_check')
    || name === 'qc'
    || name.includes('quality check')
  ) {
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

export function toWorkPlanJobDto(
  job: WorkPlanDerivationJob,
  workOrderStatus: WorkOrderStatus | `${WorkOrderStatus}` | null,
): WorkPlanJobDto {
  return {
    id: job.id,
    catalogJobId: job.catalogJobId,
    displayName: job.displayName,
    customDescription: job.customDescription,
    category: job.category,
    status: job.status as JobStatus,
    uiStatus: toWorkPlanJobUiStatus(job.status, workOrderStatus),
    lane: classifyWorkPlanLane(job.category.name, job.displayName),
  };
}

function mandatoryPhase(
  jobs: WorkPlanJobDto[],
  required: boolean,
): WorkPlanMandatoryPhaseDto {
  const active = jobs.filter((job) => job.status !== JobStatus.CANCELLED);
  const remainingCount = active.filter((job) => job.status === JobStatus.TO_DO).length;
  const completedCount = active.filter((job) => job.status === JobStatus.COMPLETED).length;
  if (!required && jobs.length === 0) {
    return { required: false, status: WorkPlanMandatoryStatus.NOT_APPLICABLE, jobCount: 0, remainingCount: 0 };
  }
  let status = WorkPlanMandatoryStatus.PENDING;
  if (completedCount > 0 && remainingCount === 0) status = WorkPlanMandatoryStatus.COMPLETE;
  else if (remainingCount > 0) status = WorkPlanMandatoryStatus.IN_PROGRESS;
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

export function deriveWorkPlan(input: WorkPlanDerivationInput) {
  const jobs = input.jobs.map((job) => toWorkPlanJobDto(job, input.workOrder?.status ?? null));
  const inspectionOutcome = deriveInspectionOutcome(jobs, input.inspectionRequirementOutcome);
  const byLane = (lane: WorkPlanJobLane) => jobs.filter((job) => job.lane === lane);
  const alignment = mandatoryPhase(byLane(WorkPlanJobLane.ALIGNMENT), true);
  const detailing = mandatoryPhase(byLane(WorkPlanJobLane.DETAILING), true);
  const qualityJobs = byLane(WorkPlanJobLane.QUALITY_CHECK);
  const qualityCheck = mandatoryPhase(qualityJobs, qualityJobs.length > 0);
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
  } else if (alignment.status !== WorkPlanMandatoryStatus.COMPLETE) {
    readyReason = WorkPlanNotReadyReason.ALIGNMENT_PENDING;
  } else if (detailing.status !== WorkPlanMandatoryStatus.COMPLETE) {
    readyReason = WorkPlanNotReadyReason.DETAILING_PENDING;
  } else if (qualityCheck.required && qualityCheck.status !== WorkPlanMandatoryStatus.COMPLETE) {
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
  } else if (alignment.status !== WorkPlanMandatoryStatus.COMPLETE) {
    phase = WorkPlanPhase.ALIGNMENT;
  } else if (detailing.status !== WorkPlanMandatoryStatus.COMPLETE) {
    phase = WorkPlanPhase.DETAILING;
  } else if (qualityCheck.required && qualityCheck.status !== WorkPlanMandatoryStatus.COMPLETE) {
    phase = WorkPlanPhase.QUALITY_CHECK;
  } else if (readyReason === WorkPlanNotReadyReason.WORK_ORDER_OPEN) {
    phase = WorkPlanPhase.READY_TO_CLOSE;
  }

  return {
    inspection: { outcome: inspectionOutcome },
    jobs,
    remainingJobCount,
    readiness,
    readyReason,
    phase,
    mandatory: { alignment, detailing, qualityCheck },
  };
}
