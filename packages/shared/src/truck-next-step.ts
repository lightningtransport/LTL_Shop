import { JobExternalKind, WorkPlanInspectionOutcome, WorkPlanJobLane } from './enums';
import type { ReadyToGoYardMove } from './samsara';
import { jobArea, workAreaRank } from './work-areas';

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
  | 'cancel_work_order'
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
  /** `work` (D57, LTR-300): the areas with Jobs still to do in the shop, in `WORK_AREA_ORDER` (no order is implied). */
  areasLeft?: Array<{ area: WorkPlanJobLane; remaining: number }>;
  /** `external` (LTR-188 / D24): what went to the external shop. */
  externalKind?: JobExternalKind | `${JobExternalKind}`;
  /** `return_to_service` (D52, LTR-260): Samsara saw the truck leave the yard after the close, or leave and come back. */
  yardMove?: ReadyToGoYardMove;
}

export type TruckNextStepInput = {
  workOrder: { id: string; status: string } | null;
  inspectionOutcome: WorkPlanInspectionOutcome | `${WorkPlanInspectionOutcome}`;
  jobs: Array<{
    id: string;
    displayName: string;
    status: string;
    lane: WorkPlanJobLane | `${WorkPlanJobLane}`;
    /** D57: the area the Job is worked from (`workAreaOf`); the lane when absent. */
    area?: WorkPlanJobLane | `${WorkPlanJobLane}`;
    assignedMechanic?: { id: string; name: string } | null;
    /** LTR-188 / D24: set while the Job is at an external shop (it is not unassigned, and not work here). */
    external?: { kind: JobExternalKind | `${JobExternalKind}` } | null;
    /** LTR-197 / D28: set while the Job waits in its step's team queue (it is not unassigned). */
    teamQueueStepKey?: string | null;
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
  // D55 R15 (LTR-295): every Job outside the Quality Check was cancelled — there is nothing to inspect, check or
  // close; the visit is cancelled. (A PM Work Order comes without Jobs and never lands here.)
  const besidesQc = input.jobs.filter((job) => job.lane !== WorkPlanJobLane.QUALITY_CHECK);
  if (besidesQc.length && besidesQc.every((job) => job.status === 'cancelled')) {
    return { kind: 'cancel_work_order', workOrderId: wo.id };
  }
  if (input.inspectionOutcome === WorkPlanInspectionOutcome.NOT_STARTED) {
    return { kind: 'inspect', workOrderId: wo.id };
  }
  const missingLanes = MANDATORY_LANES.filter((lane) => !input.jobs.some((job) => job.lane === lane));
  if (missingLanes.length) return { kind: 'add_missing_steps', workOrderId: wo.id, missingLanes };

  // D57: areas are listed in WORK_AREA_ORDER (painting order, not a sequence); the sort is stable.
  const pending = input.jobs
    .filter((job) => job.status === 'to_do')
    .sort((left, right) => workAreaRank(jobArea(left)) - workAreaRank(jobArea(right)));
  // D15: Quality Check has no owner; every other pending Job needs one.
  // LTR-188 / D24: a Job at an external shop has no owner on purpose — it is not "unassigned".
  // LTR-197 / D28: neither is a Job waiting in its team queue.
  const unassigned = pending.find((job) => job.lane !== WorkPlanJobLane.QUALITY_CHECK && !job.external && !job.teamQueueStepKey && !job.assignedMechanic);
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
  // External Jobs are not work in the shop (D24). D57: say which areas are left, not a "next" one.
  const areasLeft: Array<{ area: WorkPlanJobLane; remaining: number }> = [];
  for (const job of inShop) {
    const area = jobArea(job);
    if (area === WorkPlanJobLane.QUALITY_CHECK) continue;
    const entry = areasLeft.find((item) => item.area === area);
    if (entry) entry.remaining += 1;
    else areasLeft.push({ area, remaining: 1 });
  }
  return { kind: 'work', workOrderId: wo.id, jobId: inShop[0].id, jobName: inShop[0].displayName, remaining: inShop.length, areasLeft };
}
