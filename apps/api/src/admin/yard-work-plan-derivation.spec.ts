import { describe, expect, it } from 'vitest';
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
} from '@ltl-shop/shared';
import {
  classifyWorkPlanLane,
  deriveWorkPlan,
  isDetailingWorkPlanJob,
  toWorkPlanJobUiStatus,
} from './yard-work-plan-derivation';

const job = (
  id: string,
  displayName: string,
  categoryName: string,
  status: JobStatus = JobStatus.TO_DO,
  catalogJobId: string | null = null,
) => ({
  id,
  catalogJobId,
  displayName,
  customDescription: null,
  category: { id: `cat-${categoryName}`, name: categoryName },
  status,
});

describe('work plan lane classification', () => {
  it('treats the LTR-24 Alignment catalog job as the Alignment lane', () => {
    expect(classifyWorkPlanLane('Suspension & Steering', 'Alignment')).toBe(WorkPlanJobLane.ALIGNMENT);
  });

  it('treats the LTR-35 Detailing catalog category and job as the Detailing lane', () => {
    expect(classifyWorkPlanLane('Detailing', 'Detailing')).toBe(WorkPlanJobLane.DETAILING);
    expect(isDetailingWorkPlanJob('Detailing', 'Detailing')).toBe(true);
  });

  it('still treats custom Detailing names as the Detailing lane', () => {
    expect(classifyWorkPlanLane('Other', 'Detailing')).toBe(WorkPlanJobLane.DETAILING);
    expect(classifyWorkPlanLane('Detailing', 'Wash')).toBe(WorkPlanJobLane.DETAILING);
  });

  it('puts repair and PM-adjacent jobs in Shop Work', () => {
    expect(classifyWorkPlanLane('Air & Brake System', 'Brake Inspection')).toBe(WorkPlanJobLane.SHOP_WORK);
    expect(classifyWorkPlanLane('Engine & Emissions', 'Engine Repair')).toBe(WorkPlanJobLane.SHOP_WORK);
  });
});

describe('work plan derivation', () => {
  it('starts in Inspection and is Not Ready until discovery is recorded', () => {
    const result = deriveWorkPlan({ workOrder: null, jobs: [] });
    expect(result.phase).toBe(WorkPlanPhase.INSPECTION);
    expect(result.readiness).toBe(WorkPlanReadiness.NOT_READY);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.INSPECTION_PENDING);
    expect(result.mandatory.alignment.required).toBe(true);
    expect(result.mandatory.detailing.required).toBe(true);
    expect(result.mandatory.alignment.status).toBe(WorkPlanMandatoryStatus.PENDING);
    expect(result.mandatory.detailing.status).toBe(WorkPlanMandatoryStatus.PENDING);
    expect(result.mandatory.qualityCheck.required).toBe(false);
    expect(result.mandatory.qualityCheck.status).toBe(WorkPlanMandatoryStatus.NOT_APPLICABLE);
  });

  it('uses Shop Work as the phase while repair jobs remain', () => {
    const result = deriveWorkPlan({
      workOrder: {
        id: 'wo-1',
        displayId: 'WO-1',
        status: WorkOrderStatus.IN_PROGRESS,
        version: 2,
        primaryCategoryName: 'Air & Brake System',
      },
      jobs: [
        job('j1', 'Brake Inspection', 'Air & Brake System'),
        job('j2', 'Alignment', 'Suspension & Steering'),
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.REQUIRED,
    });
    expect(result.phase).toBe(WorkPlanPhase.SHOP_WORK);
    expect(result.inspection.outcome).toBe(WorkPlanInspectionOutcome.ISSUES_FOUND);
    expect(result.remainingJobCount).toBe(2);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.JOBS_REMAINING);
    expect(result.jobs[0].uiStatus).toBe(WorkPlanJobUiStatus.IN_PROGRESS);
    expect(result.jobs[0].lane).toBe(WorkPlanJobLane.SHOP_WORK);
  });

  it('does not invent Shop Work after No issues found; Alignment is next and always required', () => {
    const result = deriveWorkPlan({
      workOrder: null,
      jobs: [],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(result.inspection.outcome).toBe(WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
    expect(result.phase).toBe(WorkPlanPhase.ALIGNMENT);
    expect(result.readiness).toBe(WorkPlanReadiness.NOT_READY);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.ALIGNMENT_PENDING);
  });

  it('auto-marks Ready when the plan is clear and Alignment + Detailing jobs are complete', () => {
    const result = deriveWorkPlan({
      workOrder: {
        id: 'wo-1',
        displayId: 'WO-1',
        status: WorkOrderStatus.IN_PROGRESS,
        version: 4,
        primaryCategoryName: 'Suspension & Steering',
      },
      jobs: [
        job('j1', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j2', 'Detailing', 'Other', JobStatus.COMPLETED),
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(result.phase).toBe(WorkPlanPhase.READY_TO_GO);
    expect(result.readiness).toBe(WorkPlanReadiness.READY);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.PLAN_COMPLETE);
    expect(result.remainingJobCount).toBe(0);
    expect(result.mandatory.alignment.status).toBe(WorkPlanMandatoryStatus.COMPLETE);
    expect(result.mandatory.detailing.status).toBe(WorkPlanMandatoryStatus.COMPLETE);
  });

  it('auto-marks Ready from the LTR-35 Detailing catalog job, not only a custom name', () => {
    const result = deriveWorkPlan({
      workOrder: {
        id: 'wo-1',
        displayId: 'WO-1',
        status: WorkOrderStatus.IN_PROGRESS,
        version: 4,
        primaryCategoryName: 'Detailing',
      },
      jobs: [
        job('j1', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j2', 'Detailing', 'Detailing', JobStatus.COMPLETED, 'catalog-detailing'),
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(result.jobs[1].catalogJobId).toBe('catalog-detailing');
    expect(result.jobs[1].lane).toBe(WorkPlanJobLane.DETAILING);
    expect(result.phase).toBe(WorkPlanPhase.READY_TO_GO);
    expect(result.readiness).toBe(WorkPlanReadiness.READY);
    expect(result.mandatory.detailing.status).toBe(WorkPlanMandatoryStatus.COMPLETE);
  });

  it('does not require QC unless QC jobs are on the plan', () => {
    const withoutQc = deriveWorkPlan({
      workOrder: {
        id: 'wo-1', displayId: 'WO-1', status: WorkOrderStatus.CREATED, version: 1, primaryCategoryName: 'Other',
      },
      jobs: [
        job('j1', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j2', 'Detailing', 'Other', JobStatus.COMPLETED),
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(withoutQc.readiness).toBe(WorkPlanReadiness.READY);

    const withQc = deriveWorkPlan({
      workOrder: {
        id: 'wo-1', displayId: 'WO-1', status: WorkOrderStatus.CREATED, version: 1, primaryCategoryName: 'Other',
      },
      jobs: [
        job('j1', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j2', 'Detailing', 'Other', JobStatus.COMPLETED),
        job('j3', 'Quality Check', 'Other'),
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(withQc.phase).toBe(WorkPlanPhase.QUALITY_CHECK);
    expect(withQc.readiness).toBe(WorkPlanReadiness.NOT_READY);
    expect(withQc.readyReason).toBe(WorkPlanNotReadyReason.QC_PENDING);
    expect(withQc.mandatory.qualityCheck.required).toBe(true);
  });

  it('maps to_do on a created Work Order to Pending for LTR-33', () => {
    expect(toWorkPlanJobUiStatus(JobStatus.TO_DO, WorkOrderStatus.CREATED)).toBe(WorkPlanJobUiStatus.PENDING);
    expect(toWorkPlanJobUiStatus(JobStatus.TO_DO, WorkOrderStatus.IN_PROGRESS)).toBe(WorkPlanJobUiStatus.IN_PROGRESS);
    expect(toWorkPlanJobUiStatus(JobStatus.COMPLETED, WorkOrderStatus.IN_PROGRESS)).toBe(WorkPlanJobUiStatus.COMPLETED);
  });

  it('ignores cancelled jobs for remaining count and Ready', () => {
    const result = deriveWorkPlan({
      workOrder: {
        id: 'wo-1', displayId: 'WO-1', status: WorkOrderStatus.CREATED, version: 3, primaryCategoryName: 'Air & Brake System',
      },
      jobs: [
        job('j1', 'Brake Inspection', 'Air & Brake System', JobStatus.CANCELLED),
        job('j2', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j3', 'Detailing', 'Other', JobStatus.COMPLETED),
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(result.remainingJobCount).toBe(0);
    expect(result.readiness).toBe(WorkPlanReadiness.READY);
  });
});
