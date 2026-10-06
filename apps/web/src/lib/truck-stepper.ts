import type { TruckOperationalStatus, TruckWorkPlanDto, WorkPlanMandatoryPhaseDto } from '@ltl-shop/shared';

/**
 * Stage 4 (UX-4-001, T9): the Truck's readiness as one row of steps under the header. It only lays
 * out what the Work Plan DTO already carries (the API derives readiness, D1); nothing new is decided
 * here. Each step's section on the Work Plan has the id `truck-step-<key>`.
 */
export const TRUCK_STEPS = ['inspection', 'shop_work', 'pm', 'alignment', 'detailing', 'quality_check', 'close'] as const;
export type TruckStepKey = (typeof TRUCK_STEPS)[number];
export type TruckStepState = 'done' | 'pending' | 'blocked' | 'external' | 'missing' | 'not_applicable' | 'ready';
export type TruckStep = { key: TruckStepKey; state: TruckStepState; remaining: number };

type Jobs = TruckWorkPlanDto['jobs'];

function liveJobs(jobs: Jobs, lane: string) {
  return jobs.filter((job) => job.lane === lane && job.status !== 'cancelled');
}

/** A blocked or external Job wins over "pending": that is what holds the step. */
function jobState(jobs: Jobs): TruckStepState | null {
  if (jobs.some((job) => job.uiStatus === 'blocked')) return 'blocked';
  if (jobs.some((job) => job.uiStatus === 'external')) return 'external';
  return null;
}

function mandatoryStep(key: TruckStepKey, phase: WorkPlanMandatoryPhaseDto, jobs: Jobs): TruckStep {
  const lane = liveJobs(jobs, key);
  if (phase.status === 'not_applicable') return { key, state: 'not_applicable', remaining: 0 };
  if (phase.status === 'complete') return { key, state: 'done', remaining: 0 };
  if (phase.required && phase.jobCount === 0) return { key, state: 'missing', remaining: 0 };
  return { key, state: jobState(lane) ?? 'pending', remaining: phase.remainingCount };
}

export function truckSteps(plan: TruckWorkPlanDto): TruckStep[] {
  const inspection: TruckStep = {
    key: 'inspection',
    state: plan.inspection.outcome === 'not_started' ? 'pending' : 'done',
    remaining: 0,
  };
  // No Work Order yet: the arrival inspection is the only step that exists (D14).
  if (!plan.workOrder) return [inspection];

  const shop = liveJobs(plan.jobs, 'shop_work');
  const shopRemaining = shop.filter((job) => job.status === 'to_do').length;
  const shopWork: TruckStep = !shop.length
    ? { key: 'shop_work', state: 'not_applicable', remaining: 0 }
    : { key: 'shop_work', state: shopRemaining ? jobState(shop) ?? 'pending' : 'done', remaining: shopRemaining };

  const close: TruckStep = plan.workOrder.status === 'completed'
    ? { key: 'close', state: 'done', remaining: 0 }
    : { key: 'close', state: plan.readyReason === 'work_order_open' ? 'ready' : 'pending', remaining: 0 };

  return [
    inspection,
    shopWork,
    mandatoryStep('pm', plan.mandatory.pm, plan.jobs),
    mandatoryStep('alignment', plan.mandatory.alignment, plan.jobs),
    mandatoryStep('detailing', plan.mandatory.detailing, plan.jobs),
    mandatoryStep('quality_check', plan.mandatory.qualityCheck, plan.jobs),
    close,
  ];
}

/** A finished step starts folded on the Work Plan; the rest start open. */
export function truckStepStartsOpen(step: TruckStep) {
  return step.state !== 'done' && step.state !== 'not_applicable';
}

/** The one status chip of the header (UX-4-001: no second phase badge). */
export type TruckStatusChip = 'ready_to_go' | 'ready_to_close' | 'not_ready' | 'in_service' | 'no_work_order';

export function truckStatusChip(plan: TruckWorkPlanDto, operationalStatus: TruckOperationalStatus | string): TruckStatusChip {
  if (plan.readiness === 'ready') return 'ready_to_go';
  if (!plan.workOrder) return operationalStatus === 'in_service' ? 'in_service' : 'no_work_order';
  if (plan.phase === 'ready_to_close') return 'ready_to_close';
  return 'not_ready';
}
