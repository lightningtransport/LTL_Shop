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

// LTR-144: PM and QC are mandatory steps of every truck Work Plan.
const pmDone = job('pm', 'PM A Service', 'PM', JobStatus.COMPLETED);
const qcDone = job('qc', 'Quality Check', 'Quality Check', JobStatus.COMPLETED);

describe('work plan lane classification', () => {
  it('treats the LTR-24 Alignment catalog job as the Alignment lane', () => {
    expect(classifyWorkPlanLane('Suspension & Steering', 'Alignment')).toBe(WorkPlanJobLane.ALIGNMENT);
  });

  it('treats the LTR-35 Detailing catalog category and job as the Detailing lane', () => {
    expect(classifyWorkPlanLane('Detailing', 'Detailing')).toBe(WorkPlanJobLane.DETAILING);
    expect(isDetailingWorkPlanJob('Detailing', 'Detailing')).toBe(true);
  });

  it('treats the LTR-41 Quality Check catalog category and job as the QC lane', () => {
    expect(classifyWorkPlanLane('Quality Check', 'Quality Check')).toBe(WorkPlanJobLane.QUALITY_CHECK);
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
    // LTR-144: PM and QC are always required.
    expect(result.mandatory.pm.required).toBe(true);
    expect(result.mandatory.qualityCheck.required).toBe(true);
    expect(result.mandatory.qualityCheck.status).toBe(WorkPlanMandatoryStatus.PENDING);
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

  it('does not invent Shop Work after No issues found; PM is next and always required', () => {
    const result = deriveWorkPlan({
      workOrder: null,
      jobs: [],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(result.inspection.outcome).toBe(WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
    expect(result.phase).toBe(WorkPlanPhase.PM);
    expect(result.readiness).toBe(WorkPlanReadiness.NOT_READY);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.PM_PENDING);
  });

  it('auto-marks Ready when the plan is clear and PM, Alignment, Detailing and QC are complete', () => {
    const result = deriveWorkPlan({
      workOrder: {
        id: 'wo-1',
        displayId: 'WO-1',
        status: WorkOrderStatus.COMPLETED,
        version: 4,
        primaryCategoryName: 'Suspension & Steering',
      },
      jobs: [
        job('j1', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j2', 'Detailing', 'Other', JobStatus.COMPLETED),
        pmDone,
        qcDone,
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
        status: WorkOrderStatus.COMPLETED,
        version: 4,
        primaryCategoryName: 'Detailing',
      },
      jobs: [
        job('j1', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j2', 'Detailing', 'Detailing', JobStatus.COMPLETED, 'catalog-detailing'),
        pmDone,
        qcDone,
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(result.jobs[1].catalogJobId).toBe('catalog-detailing');
    expect(result.jobs[1].lane).toBe(WorkPlanJobLane.DETAILING);
    expect(result.phase).toBe(WorkPlanPhase.READY_TO_GO);
    expect(result.readiness).toBe(WorkPlanReadiness.READY);
    expect(result.mandatory.detailing.status).toBe(WorkPlanMandatoryStatus.COMPLETE);
  });

  it('always requires QC, even when no QC job is on the plan (LTR-144)', () => {
    const withoutQc = deriveWorkPlan({
      workOrder: {
        id: 'wo-1', displayId: 'WO-1', status: WorkOrderStatus.COMPLETED, version: 1, primaryCategoryName: 'Other',
      },
      jobs: [
        job('j1', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j2', 'Detailing', 'Other', JobStatus.COMPLETED),
        pmDone,
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(withoutQc.phase).toBe(WorkPlanPhase.QUALITY_CHECK);
    expect(withoutQc.readiness).toBe(WorkPlanReadiness.NOT_READY);

    const withQc = deriveWorkPlan({
      workOrder: {
        id: 'wo-1', displayId: 'WO-1', status: WorkOrderStatus.CREATED, version: 1, primaryCategoryName: 'Other',
      },
      jobs: [
        job('j1', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j2', 'Detailing', 'Other', JobStatus.COMPLETED),
        job('j3', 'Quality Check', 'Other'),
        pmDone,
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
        id: 'wo-1', displayId: 'WO-1', status: WorkOrderStatus.COMPLETED, version: 3, primaryCategoryName: 'Air & Brake System',
      },
      jobs: [
        job('j1', 'Brake Inspection', 'Air & Brake System', JobStatus.CANCELLED),
        job('j2', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
        job('j3', 'Detailing', 'Other', JobStatus.COMPLETED),
        pmDone,
        qcDone,
      ],
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });
    expect(result.remainingJobCount).toBe(0);
    expect(result.readiness).toBe(WorkPlanReadiness.READY);
  });
});

describe('Inspection Category Jobs (LTR-89)', () => {
  const inProgress = {
    id: 'wo-906',
    displayId: 'WO-003',
    status: WorkOrderStatus.CREATED,
    version: 1,
    primaryCategoryName: 'Inspection',
  };

  it('classifies only the Inspection Category as the Inspection lane', () => {
    expect(classifyWorkPlanLane('Inspection', 'General Inspection')).toBe(WorkPlanJobLane.INSPECTION);
    expect(classifyWorkPlanLane('Air & Brake System', 'Brake Inspection')).toBe(WorkPlanJobLane.SHOP_WORK);
  });

  it('stays in Inspection while the Inspection Job is to do, even with repairs already planned (prod truck 906)', () => {
    const result = deriveWorkPlan({
      workOrder: inProgress,
      jobs: [
        job('j1', 'DPF/DEF Service', 'Engine & Emissions'),
        job('j2', 'Flat Repair', 'Tires & Wheels'),
        job('j3', 'General Inspection', 'Inspection'),
      ],
    });
    expect(result.inspection.outcome).toBe(WorkPlanInspectionOutcome.NOT_STARTED);
    expect(result.phase).toBe(WorkPlanPhase.INSPECTION);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.INSPECTION_PENDING);
    expect(result.remainingJobCount).toBe(3);
  });

  it('moves to Shop Work once the Inspection Job is done and repairs remain', () => {
    const result = deriveWorkPlan({
      workOrder: { ...inProgress, status: WorkOrderStatus.IN_PROGRESS },
      jobs: [
        job('j1', 'Fuel Leak', 'Fuel System'),
        job('j2', 'General Inspection', 'Inspection', JobStatus.COMPLETED),
      ],
    });
    expect(result.inspection.outcome).toBe(WorkPlanInspectionOutcome.ISSUES_FOUND);
    expect(result.phase).toBe(WorkPlanPhase.SHOP_WORK);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.JOBS_REMAINING);
  });

  it('treats a completed Inspection Job with no repairs as No issues found', () => {
    const result = deriveWorkPlan({
      workOrder: { ...inProgress, status: WorkOrderStatus.IN_PROGRESS },
      jobs: [job('j1', 'General Inspection', 'Inspection', JobStatus.COMPLETED)],
    });
    expect(result.inspection.outcome).toBe(WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
    expect(result.phase).toBe(WorkPlanPhase.PM);
  });

  it('ignores a cancelled Inspection Job', () => {
    const result = deriveWorkPlan({
      workOrder: { ...inProgress, status: WorkOrderStatus.IN_PROGRESS },
      jobs: [job('j1', 'General Inspection', 'Inspection', JobStatus.CANCELLED)],
    });
    expect(result.inspection.outcome).toBe(WorkPlanInspectionOutcome.NOT_STARTED);
    expect(result.phase).toBe(WorkPlanPhase.INSPECTION);
  });
});

describe('Ready to Go needs a completed Work Order (LTR-90 / D1)', () => {
  const planDone = [
    job('j1', 'General Inspection', 'Inspection', JobStatus.COMPLETED),
    job('j2', 'Alignment', 'Suspension & Steering', JobStatus.COMPLETED),
    job('j3', 'Detailing', 'Detailing', JobStatus.COMPLETED),
    pmDone,
    qcDone,
  ];
  const wo = (status: WorkOrderStatus) => ({
    id: 'wo-277', displayId: 'WO-001', status, version: 7, primaryCategoryName: 'Inspection',
  });

  it('shows Ready to close while the Work Order is still In Progress (prod truck 277)', () => {
    const result = deriveWorkPlan({ workOrder: wo(WorkOrderStatus.IN_PROGRESS), jobs: planDone });
    expect(result.phase).toBe(WorkPlanPhase.READY_TO_CLOSE);
    expect(result.readiness).toBe(WorkPlanReadiness.NOT_READY);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.WORK_ORDER_OPEN);
    expect(result.remainingJobCount).toBe(0);
  });

  it('keeps Ready to close while the Work Order is paused', () => {
    expect(deriveWorkPlan({ workOrder: wo(WorkOrderStatus.WAITING_PAUSED), jobs: planDone }).phase)
      .toBe(WorkPlanPhase.READY_TO_CLOSE);
  });

  it('is Ready to Go once the Work Order is Completed', () => {
    const result = deriveWorkPlan({ workOrder: wo(WorkOrderStatus.COMPLETED), jobs: planDone });
    expect(result.phase).toBe(WorkPlanPhase.READY_TO_GO);
    expect(result.readiness).toBe(WorkPlanReadiness.READY);
    expect(result.readyReason).toBe(WorkPlanNotReadyReason.PLAN_COMPLETE);
  });

  it('still reports the missing step on a completed Work Order without Detailing', () => {
    const result = deriveWorkPlan({ workOrder: wo(WorkOrderStatus.COMPLETED), jobs: planDone.filter((item) => item.id !== 'j3') });
    expect(result.phase).toBe(WorkPlanPhase.DETAILING);
  });
});
