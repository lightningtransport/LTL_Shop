import { describe, expect, it } from 'vitest';
import {
  JobStatus,
  ReadinessRequirementOutcome,
  WorkOrderStatus,
  WorkPlanJobLane,
  WorkPlanMandatoryStatus,
  WorkPlanNotReadyReason,
  WorkPlanPhase,
  WorkPlanReadiness,
} from '@ltl-shop/shared';
import { classifyWorkPlanLane, deriveWorkPlan } from './yard-work-plan-derivation';

const job = (id: string, displayName: string, categoryName: string, status: JobStatus = JobStatus.TO_DO) => ({
  id, catalogJobId: null, displayName, customDescription: null,
  category: { id: `cat-${categoryName}`, name: categoryName }, status,
});
const workOrder = (status: WorkOrderStatus = WorkOrderStatus.IN_PROGRESS, primaryCategoryName = 'Inspection') => ({
  id: 'wo-1', displayId: 'WO-1', status, version: 1, primaryCategoryName,
});
const done = JobStatus.COMPLETED;
const inspected = ReadinessRequirementOutcome.COMPLETED;
const fullPlan = (overrides: Partial<Record<'pm' | 'alignment' | 'detailing' | 'qc', JobStatus>> = {}) => [
  job('pm', 'PM A Service', 'PM', overrides.pm ?? JobStatus.TO_DO),
  job('al', 'Alignment', 'Suspension & Steering', overrides.alignment ?? JobStatus.TO_DO),
  job('de', 'Detailing', 'Detailing', overrides.detailing ?? JobStatus.TO_DO),
  job('qc', 'Quality Check', 'Quality Check', overrides.qc ?? JobStatus.TO_DO),
];

describe('Work Plan PM phase (LTR-144, WORK_PLAN_PM_PHASE)', () => {
  it('classifies PM Category Jobs into the PM lane', () => {
    expect(classifyWorkPlanLane('PM', 'PM A Service')).toBe(WorkPlanJobLane.PM);
    expect(classifyWorkPlanLane('PM', 'PM B Service')).toBe(WorkPlanJobLane.PM);
  });

  it('puts PM between Shop Work and Alignment', () => {
    const shop = deriveWorkPlan({
      workOrder: workOrder(), inspectionRequirementOutcome: inspected, pmPhase: true,
      jobs: [job('s1', 'Brake Repair', 'Air & Brake'), ...fullPlan()],
    });
    expect(shop.phase).toBe(WorkPlanPhase.SHOP_WORK);

    const pm = deriveWorkPlan({
      workOrder: workOrder(), inspectionRequirementOutcome: inspected, pmPhase: true,
      jobs: [job('s1', 'Brake Repair', 'Air & Brake', done), ...fullPlan()],
    });
    expect(pm.phase).toBe(WorkPlanPhase.PM);
    expect(pm.readyReason).toBe(WorkPlanNotReadyReason.PM_PENDING);
    expect(pm.mandatory.pm).toMatchObject({ required: true, status: WorkPlanMandatoryStatus.IN_PROGRESS });

    const alignment = deriveWorkPlan({
      workOrder: workOrder(), inspectionRequirementOutcome: inspected, pmPhase: true,
      jobs: fullPlan({ pm: done }),
    });
    expect(alignment.phase).toBe(WorkPlanPhase.ALIGNMENT);
  });

  it('requires PM even when it was never added, and QC always', () => {
    const noPm = deriveWorkPlan({
      workOrder: workOrder(), inspectionRequirementOutcome: inspected, pmPhase: true,
      jobs: [job('al', 'Alignment', 'Suspension & Steering', done), job('de', 'Detailing', 'Detailing', done)],
    });
    expect(noPm.phase).toBe(WorkPlanPhase.PM);
    expect(noPm.mandatory.pm?.status).toBe(WorkPlanMandatoryStatus.PENDING);

    const noQc = deriveWorkPlan({
      workOrder: workOrder(), inspectionRequirementOutcome: inspected, pmPhase: true,
      jobs: fullPlan({ pm: done, alignment: done, detailing: done }).filter((item) => item.id !== 'qc'),
    });
    expect(noQc.phase).toBe(WorkPlanPhase.QUALITY_CHECK);
    expect(noQc.mandatory.qualityCheck.required).toBe(true);
  });

  it('treats a step whose Jobs were all cancelled as not applicable', () => {
    const result = deriveWorkPlan({
      workOrder: workOrder(), inspectionRequirementOutcome: inspected, pmPhase: true,
      jobs: fullPlan({ pm: done, alignment: done, detailing: JobStatus.CANCELLED, qc: done }),
    });
    expect(result.mandatory.detailing.status).toBe(WorkPlanMandatoryStatus.NOT_APPLICABLE);
    expect(result.phase).toBe(WorkPlanPhase.READY_TO_CLOSE);
  });

  it('is Ready to Go only with every step resolved and the Work Order completed', () => {
    const result = deriveWorkPlan({
      workOrder: workOrder(WorkOrderStatus.COMPLETED), inspectionRequirementOutcome: inspected, pmPhase: true,
      jobs: fullPlan({ pm: done, alignment: done, detailing: done, qc: done }),
    });
    expect(result.phase).toBe(WorkPlanPhase.READY_TO_GO);
    expect(result.readiness).toBe(WorkPlanReadiness.READY);
  });

  it('shows a legacy PM Work Order in the PM phase, not Inspection (LTR-91)', () => {
    const open = deriveWorkPlan({ workOrder: workOrder(WorkOrderStatus.IN_PROGRESS, 'PM'), jobs: [], pmPhase: true });
    expect(open.phase).toBe(WorkPlanPhase.PM);
    expect(open.readyReason).toBe(WorkPlanNotReadyReason.PM_PENDING);
    const completed = deriveWorkPlan({ workOrder: workOrder(WorkOrderStatus.COMPLETED, 'PM'), jobs: [], pmPhase: true });
    expect(completed.phase).toBe(WorkPlanPhase.READY_TO_GO);
  });

  it('keeps the flag-off behavior unchanged', () => {
    const legacyPm = deriveWorkPlan({ workOrder: workOrder(WorkOrderStatus.IN_PROGRESS, 'PM'), jobs: [] });
    expect(legacyPm.phase).toBe(WorkPlanPhase.INSPECTION);
    const withoutQc = deriveWorkPlan({
      workOrder: workOrder(WorkOrderStatus.COMPLETED), inspectionRequirementOutcome: inspected,
      jobs: [job('al', 'Alignment', 'Suspension & Steering', done), job('de', 'Detailing', 'Detailing', done)],
    });
    expect(withoutQc.phase).toBe(WorkPlanPhase.READY_TO_GO);
    expect(withoutQc.mandatory).not.toHaveProperty('pm');
    const cancelledDetailing = deriveWorkPlan({
      workOrder: workOrder(), inspectionRequirementOutcome: inspected,
      jobs: [job('al', 'Alignment', 'Suspension & Steering', done), job('de', 'Detailing', 'Detailing', JobStatus.CANCELLED)],
    });
    expect(cancelledDetailing.phase).toBe(WorkPlanPhase.DETAILING);
  });
});
