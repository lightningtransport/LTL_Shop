import { WorkPlanJobLane, type TruckNextStepDto } from '@ltl-shop/shared';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from './admin-messages';
import { fillPlaceholders } from './admin-next-step';
import { formatDay, formatShortDateTime, formatTime } from './work-order-view';

const LANE_NAME: Partial<Record<WorkPlanJobLane, string>> = {
  [WorkPlanJobLane.PM]: 'PM',
  [WorkPlanJobLane.ALIGNMENT]: 'Alignment',
  [WorkPlanJobLane.DETAILING]: 'Detailing',
  [WorkPlanJobLane.QUALITY_CHECK]: 'Quality Check',
};

/**
 * D57 (LTR-300): the areas with work left, in WORK_AREA_ORDER — "PM, Alignment, 2 repairs, Detailing". Shop Work
 * reads as its count of repairs. No area is "next": the shop does them in any order. Falls back to the Job's name
 * while an older API sends no `areasLeft`.
 */
export function nextStepAreasText(step: TruckNextStepDto, messages: AdminMessages): string {
  const areas = step.areasLeft ?? [];
  if (!areas.length) return step.jobName ?? '';
  const names: Partial<Record<WorkPlanJobLane, string>> = {
    [WorkPlanJobLane.PM]: messages.pm,
    [WorkPlanJobLane.ALIGNMENT]: messages.alignment,
    [WorkPlanJobLane.DETAILING]: messages.detailing,
  };
  return areas
    .map(({ area, remaining }) => names[area] ?? fillPlaceholders(messages.nextStepRepairs, { count: String(remaining) }))
    .join(', ');
}

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
    case 'external':
      // LTR-188 / D24: waiting on an external shop.
      return fillPlaceholders(messages.truckNextStepExternal, { job: step.jobName ?? '' });
    case 'qc':
      return messages.truckNextStepQc;
    case 'close':
      return messages.truckNextStepClose;
    case 'cancel_work_order':
      return messages.truckNextStepCancelWorkOrder;
    case 'return_to_service': {
      // D52 (LTR-260): Samsara saw it leave the yard after the close, or leave and come back.
      const move = step.yardMove;
      if (!move) return messages.truckNextStepReturnToService;
      const locale = messages.locale as AdminLocale;
      const time = formatDay(move.at, locale) === formatDay(new Date().toISOString(), locale) ? formatTime(move.at, locale) : formatShortDateTime(move.at, locale);
      return fillPlaceholders(move.kind === 'left_yard' ? messages.truckNextStepLeftYard : messages.truckNextStepBackInYard, { time });
    }
    case 'work':
      return fillPlaceholders(messages.truckNextStepWork, { count: String(step.remaining ?? 0), areas: nextStepAreasText(step, messages) });
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
    case 'resume': return messages.resumeShort;
    case 'inspect': return messages.truckNextStepInspectAction;
    case 'add_missing_steps': return messages.truckNextStepMissingStepsAction;
    case 'assign': return messages.truckNextStepAssignAction;
    case 'qc': return messages.truckNextStepQcAction;
    case 'close': return messages.truckNextStepCloseAction;
    case 'cancel_work_order': return messages.cancelWorkOrderTitle;
    case 'return_to_service': return messages.returnToServiceTitle;
    case 'create_work_order': return messages.truckNextStepCreateAction;
    default: return null;
  }
}
