/**
 * LTR-121: one definition of "needs attention" for the Dashboard, the Work Order
 * list and the Yard. Order matters: the first matching reason wins and ranks.
 */
export const WORK_ORDER_ATTENTION_REASONS = [
  'ready_to_close',
  'critical',
  'high',
  'paused',
  'blocker',
  'unassigned',
  'open_over_24h',
  'open',
] as const;

export type WorkOrderAttentionReason = (typeof WORK_ORDER_ATTENTION_REASONS)[number];

export type WorkOrderAttentionInput = {
  status: string;
  priority: string;
  categoryName: string;
  jobsCompleted: number;
  jobsTotal: number;
  /** Unresolved mechanic-reported blocker (LTR-98). */
  hasActiveBlocker: boolean;
  /** LTR-154 / D11: pending Jobs nobody owns; no mechanic sees them until assigned. */
  unassignedJobs?: number;
  createdAt: string | Date;
};

const OPEN_STATUSES = ['created', 'in_progress', 'waiting_paused'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Blocked = the truck is really stopped: official pause or an active reported blocker (D5). */
export function isWorkOrderBlocked(input: { status: string; hasActiveBlocker: boolean }) {
  return input.status === 'waiting_paused' || input.hasActiveBlocker;
}

export function workOrderAttentionReason(input: WorkOrderAttentionInput, now = Date.now()): WorkOrderAttentionReason | null {
  if (!OPEN_STATUSES.includes(input.status)) return null;
  const isPm = input.categoryName === 'PM';
  if (input.status === 'in_progress' && !isPm && input.jobsTotal > 0 && input.jobsCompleted === input.jobsTotal) {
    return 'ready_to_close';
  }
  if (input.priority === 'critical') return 'critical';
  if (input.priority === 'high') return 'high';
  if (input.status === 'waiting_paused') return 'paused';
  if (input.hasActiveBlocker) return 'blocker';
  if ((input.unassignedJobs ?? 0) > 0) return 'unassigned';
  if (now - new Date(input.createdAt).getTime() > DAY_MS) return 'open_over_24h';
  // LTR-116: an open PM service with nothing actionable does not need attention.
  if (isPm) return null;
  return 'open';
}

export function workOrderAttentionRank(reason: WorkOrderAttentionReason | null) {
  return reason === null ? WORK_ORDER_ATTENTION_REASONS.length : WORK_ORDER_ATTENTION_REASONS.indexOf(reason);
}
