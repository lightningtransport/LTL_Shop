/**
 * D57 §3 (LTR-306): a truck is worked by one area at a time. The mechanic who starts a Job takes the truck; while
 * they have it, the other mechanics cannot start there. Completing the Job, reporting a blocker or sending it to an
 * external shop lets it go. The day close (D20) does not: the Job stays started (`startedAt`) overnight.
 *
 * Computed, never stored. A helper (D23) works with the owner of the Job they help, so the two never block each other.
 */
export type TruckHolderJob = {
  id: string;
  status: string;
  assignedMechanicId: string | null;
  /** Set by Start/Continue (and by the PM start) on the mechanic's pending Jobs; cleared when the owner changes. */
  startedAt?: Date | string | null;
  /** An unresolved blocker (D17). */
  blocked?: boolean;
  /** At an external shop (D24). */
  external?: boolean;
  helperOfJobId?: string | null;
  /** Quality Check never holds the truck: Safety takes it only when every other Job is done (D55). */
  isQualityCheck?: boolean;
};

/**
 * The Jobs that hold the truck right now: pending, owned, not blocked, not out, and started by their owner. Only the
 * Job's own start counts (Start always sets it), not an open clock: a helper's clock runs, but their other Jobs here
 * are not started until the truck is free.
 */
export function holdingJobs<J extends TruckHolderJob>(jobs: J[]): J[] {
  return jobs.filter((job) => job.status === 'to_do'
    && job.assignedMechanicId
    && !job.blocked
    && !job.external
    && !job.isQualityCheck
    && Boolean(job.startedAt));
}

/** Two Jobs that work together: one helps the other, or both help the same Job (D23). */
function workTogether(left: TruckHolderJob, right: TruckHolderJob) {
  return left.helperOfJobId === right.id
    || right.helperOfJobId === left.id
    || (Boolean(left.helperOfJobId) && left.helperOfJobId === right.helperOfJobId);
}

/**
 * The Job of someone else that keeps `userId` from starting on this truck, or null. A helper, the owner of the Job
 * they help, and the other helpers of that Job are not "someone else" to each other.
 */
export function truckBusyFor<J extends TruckHolderJob>(userId: string, jobs: J[]): J | null {
  const mine = jobs.filter((job) => job.assignedMechanicId === userId);
  return holdingJobs(jobs).find((job) => job.assignedMechanicId !== userId && !mine.some((own) => workTogether(own, job))) ?? null;
}

/**
 * The Jobs that Start marks as started for `userId`: all their pending, workable Jobs when the truck is free; only
 * their helper Jobs when someone else has it (they came to help, their own area waits).
 */
export function jobsToStart<J extends TruckHolderJob>(userId: string, jobs: J[]): J[] {
  const others = holdingJobs(jobs).filter((job) => job.assignedMechanicId !== userId);
  return jobs.filter((job) => job.status === 'to_do' && job.assignedMechanicId === userId && !job.startedAt
    && !job.blocked && !job.external && !job.isQualityCheck
    && (!others.length || others.some((held) => workTogether(job, held))));
}
