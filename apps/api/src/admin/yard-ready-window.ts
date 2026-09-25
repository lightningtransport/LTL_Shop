/**
 * LTR-90 / D1: Ready to Go needs a completed Work Order, so the Work Plan keeps
 * deriving from the truck's last completed Work Order until the truck is
 * Returned to Service (or a new Work Order opens).
 *
 * Only Work Orders completed on or after `YARD_READY_TO_GO_SINCE` (ISO date)
 * count, so historical completions do not flood the board. Unset = off.
 */
export function yardReadyToGoSince(env: NodeJS.ProcessEnv = process.env): Date | null {
  const raw = env.YARD_READY_TO_GO_SINCE?.trim();
  if (!raw) return null;
  const since = new Date(raw);
  return Number.isNaN(since.getTime()) ? null : since;
}

/** True when the truck was Returned to Service after this Work Order completed. */
export function returnedToServiceAfter(
  latestServiceEvent: { status: string; occurredAt: Date } | null | undefined,
  completedAt: Date | null,
): boolean {
  if (!latestServiceEvent || !completedAt) return false;
  return latestServiceEvent.status === 'in_service'
    && latestServiceEvent.occurredAt.getTime() >= completedAt.getTime();
}
