import { WorkPlanJobLane, type TruckNextStepDto } from '@ltl-shop/shared';
import { adminPauseReasonLabel, type AdminMessages } from './admin-messages';
import { fillPlaceholders } from './admin-next-step';

const LANE_NAME: Partial<Record<WorkPlanJobLane, string>> = {
  [WorkPlanJobLane.PM]: 'PM',
  [WorkPlanJobLane.ALIGNMENT]: 'Alignment',
  [WorkPlanJobLane.DETAILING]: 'Detailing',
  [WorkPlanJobLane.QUALITY_CHECK]: 'Quality Check',
};

/**
 * LTR-159: the one sentence for a Truck's Next step on every Admin surface
 * (Dashboard, Work Order list and detail, Yard card, Truck list, Truck Detail).
 * The rule is the API's `nextStep`; this only words it.
 */
export function truckNextStepText(step: TruckNextStepDto | null | undefined, messages: AdminMessages): string | null {
  if (!step) return null;
  switch (step.kind) {
    case 'resolve_blocker': {
      const reason = step.reason ? adminPauseReasonLabel(step.reason, messages) : '';
      return step.jobName
        ? fillPlaceholders(messages.blockedJobReason, { job: step.jobName, reason })
        : `${messages.blocked} · ${reason}`;
    }
    case 'resume':
      return fillPlaceholders(messages.truckNextStepResume, { reason: step.reason ? adminPauseReasonLabel(step.reason, messages) : '' });
    case 'inspect':
      return messages.truckNextStepInspect;
    case 'add_missing_steps':
      return fillPlaceholders(messages.truckNextStepMissingSteps, {
        steps: (step.missingLanes ?? []).map((lane) => LANE_NAME[lane] ?? lane).join(', '),
      });
    case 'assign':
      return fillPlaceholders(messages.truckNextStepAssign, { job: step.jobName ?? '' });
    case 'qc':
      return messages.truckNextStepQc;
    case 'close':
      return messages.truckNextStepClose;
    case 'return_to_service':
      return messages.truckNextStepReturnToService;
    case 'work':
      return fillPlaceholders(messages.truckNextStepWork, { count: String(step.remaining ?? 0), job: step.jobName ?? '' });
    case 'create_work_order':
      return messages.truckNextStepCreate;
    default:
      return null;
  }
}

/** The button label that takes the Manager to the action (on the Truck, or inline). */
export function truckNextStepActionLabel(step: TruckNextStepDto | null | undefined, messages: AdminMessages): string | null {
  switch (step?.kind) {
    case 'resolve_blocker': return messages.resolveBlocker;
    case 'resume': return messages.resumeWorkOrderAction;
    case 'inspect': return messages.truckNextStepInspectAction;
    case 'add_missing_steps': return messages.truckNextStepMissingStepsAction;
    case 'assign': return messages.truckNextStepAssignAction;
    case 'qc': return messages.truckNextStepQcAction;
    case 'close': return messages.truckNextStepCloseAction;
    case 'return_to_service': return messages.returnToServiceTitle;
    case 'create_work_order': return messages.truckNextStepCreateAction;
    default: return null;
  }
}
