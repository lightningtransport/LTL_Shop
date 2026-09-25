/**
 * LTR-105: the Admin Work Order detail states the next step and who owns it,
 * including when the viewer cannot act (no work_orders.manage).
 */
export type AdminNextStepKey =
  | 'nextStepAssignMechanic'
  | 'nextStepMechanicStart'
  | 'nextStepPaused'
  | 'nextStepPmFinish'
  | 'nextStepJobsInProgress'
  | 'nextStepAddJobs'
  | 'nextStepWaitingManagerClose'
  | 'nextStepReturnToService';

export type AdminNextStep = {
  key: AdminNextStepKey;
  values: Record<string, string>;
  /** True when the Shop Manager (work_orders.manage) must act. */
  managerOwned: boolean;
};

export function adminNextStep(input: {
  status: string;
  categoryName: string;
  jobs: { status: string }[];
  mechanicNames: string[];
  canManageWorkOrders: boolean;
  returnedToServiceAt: string | null;
  pauseReasonLabel?: string | null;
}): AdminNextStep | null {
  const isPm = input.categoryName === 'PM';
  const names = input.mechanicNames.join(', ');
  const active = input.jobs.filter((job) => job.status !== 'cancelled');
  const done = active.filter((job) => job.status === 'completed').length;
  const todo = active.length - done;

  switch (input.status) {
    case 'created':
      if (!isPm && !input.mechanicNames.length) return { key: 'nextStepAssignMechanic', values: {}, managerOwned: true };
      return { key: 'nextStepMechanicStart', values: { names }, managerOwned: false };
    case 'waiting_paused':
      return { key: 'nextStepPaused', values: { reason: input.pauseReasonLabel ?? '' }, managerOwned: true };
    case 'in_progress':
      if (isPm) return { key: 'nextStepPmFinish', values: { names }, managerOwned: false };
      if (!active.length) return { key: 'nextStepAddJobs', values: {}, managerOwned: true };
      if (todo > 0) {
        return { key: 'nextStepJobsInProgress', values: { names, done: String(done), total: String(active.length) }, managerOwned: false };
      }
      // A Manager already gets the "Confirm completion" card and sticky bar.
      if (input.canManageWorkOrders) return null;
      return { key: 'nextStepWaitingManagerClose', values: {}, managerOwned: true };
    case 'completed':
      if (input.returnedToServiceAt) return null;
      return { key: 'nextStepReturnToService', values: {}, managerOwned: true };
    default:
      return null;
  }
}

export function fillPlaceholders(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
