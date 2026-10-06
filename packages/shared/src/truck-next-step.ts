import { JobExternalKind, WorkPlanInspectionOutcome, WorkPlanJobLane } from './enums';

/**
 * LTR-158 / D14: the one "Next step" rule for a Truck. The first matching kind
 * wins (approved order: blocker first — someone is standing still).
 */
export type TruckNextStepKind =
  | 'resolve_blocker'
  | 'resume'
  | 'inspect'
  | 'add_missing_steps'
  | 'assign'
  | 'external'
  | 'qc'
  | 'close'
  | 'return_to_service'
  | 'work'
  | 'create_work_order';

export interface TruckNextStepDto {
  kind: TruckNextStepKind;
  workOrderId?: string;
  jobId?: string;
  jobName?: string;
  blockerId?: string;
  /** Blocker or official pause reason (mechanic BlockerReason or PauseReason value). */
  reason?: string;
  reportedBy?: string | null;
  reportedAt?: string;
  /** `add_missing_steps`: lanes of the mandatory steps the open Work Order lacks. */
  missingLanes?: WorkPlanJobLane[];
  /** `work`: Jobs still to do. */
  remaining?: number;
  /** `external` (LTR-188 / D24): what went to the external shop. */
  externalKind?: JobExternalKind | `${JobExternalKind}`;
}

export type TruckNextStepInput = {
  workOrder: { id: string; status: string } | null;
  inspectionOutcome: WorkPlanInspectionOutcome | `${WorkPlanInspectionOutcome}`;
  jobs: Array<{
    id: string;
    displayName: string;
    status: string;
    lane: WorkPlanJobLane | `${WorkPlanJobLane}`;
    assignedMechanic?: { id: string; name: string } | null;
    /** LTR-188 / D24: set while the Job is at an external shop (it is not unassigned, and not work here). */
    external?: { kind: JobExternalKind | `${JobExternalKind}` } | null;
  }>;
  activeBlocker?: {
    id: string;
    reason: string;
    blockerReason?: string | null;
    job?: { id: string; displayName: string } | null;
    reportedBy?: { name: string } | null;
    startedAt: string;
  } | null;
  currentPause?: { reason: string } | null;
};

const MANDATORY_LANES: WorkPlanJobLane[] = [
  WorkPlanJobLane.PM,
  WorkPlanJobLane.ALIGNMENT,
  WorkPlanJobLane.DETAILING,
  WorkPlanJobLane.QUALITY_CHECK,
];

const FLOW_ORDER: string[] = [
  WorkPlanJobLane.INSPECTION,
  WorkPlanJobLane.SHOP_WORK,
  WorkPlanJobLane.PM,
  WorkPlanJobLane.ALIGNMENT,
  WorkPlanJobLane.DETAILING,
  WorkPlanJobLane.QUALITY_CHECK,
];

const OPEN = ['created', 'in_progress', 'waiting_paused'];

export function deriveTruckNextStep(input: TruckNextStepInput): TruckNextStepDto | null {
  const wo = input.workOrder;
  if (!wo) return { kind: 'create_work_order' };
  // The plan stays on the completed Work Order until Return to Service (LTR-90 / D1).
  if (wo.status === 'completed') return { kind: 'return_to_service', workOrderId: wo.id };
  if (!OPEN.includes(wo.status)) return null;

  const blocker = input.activeBlocker;
  if (blocker) {
    return {
      kind: 'resolve_blocker',
      workOrderId: wo.id,
      blockerId: blocker.id,
      jobId: blocker.job?.id,
      jobName: blocker.job?.displayName,
      reason: blocker.blockerReason ?? blocker.reason,
      reportedBy: blocker.reportedBy?.name ?? null,
      reportedAt: blocker.startedAt,
    };
  }
  if (wo.status === 'waiting_paused') {
    return { kind: 'resume', workOrderId: wo.id, reason: input.currentPause?.reason };
  }
  if (input.inspectionOutcome === WorkPlanInspectionOutcome.NOT_STARTED) {
    return { kind: 'inspect', workOrderId: wo.id };
  }
  const missingLanes = MANDATORY_LANES.filter((lane) => !input.jobs.some((job) => job.lane === lane));
  if (missingLanes.length) return { kind: 'add_missing_steps', workOrderId: wo.id, missingLanes };

  const pending = input.jobs
    .filter((job) => job.status === 'to_do')
    .sort((left, right) => FLOW_ORDER.indexOf(left.lane) - FLOW_ORDER.indexOf(right.lane));
  // D15: Quality Check has no owner; every other pending Job needs one.
  // LTR-188 / D24: a Job at an external shop has no owner on purpose — it is not "unassigned".
  const unassigned = pending.find((job) => job.lane !== WorkPlanJobLane.QUALITY_CHECK && !job.external && !job.assignedMechanic);
  if (unassigned) return { kind: 'assign', workOrderId: wo.id, jobId: unassigned.id, jobName: unassigned.displayName };

  // LTR-188 / D24: the only work left (besides Quality Check) is at an external shop → wait for it.
  const external = pending.filter((job) => job.external);
  const inShop = pending.filter((job) => !job.external);
  if (external.length && !inShop.some((job) => job.lane !== WorkPlanJobLane.QUALITY_CHECK)) {
    const first = external[0];
    return {
      kind: 'external',
      workOrderId: wo.id,
      jobId: first.id,
      jobName: first.displayName,
      externalKind: first.external!.kind,
    };
  }

  const qc = inShop.find((job) => job.lane === WorkPlanJobLane.QUALITY_CHECK);
  if (qc && inShop.length === 1) return { kind: 'qc', workOrderId: wo.id, jobId: qc.id, jobName: qc.displayName };
  if (!pending.length) return { kind: 'close', workOrderId: wo.id };
  // External Jobs are not work in the shop (D24).
  return { kind: 'work', workOrderId: wo.id, jobId: inShop[0].id, jobName: inShop[0].displayName, remaining: inShop.length };
}
