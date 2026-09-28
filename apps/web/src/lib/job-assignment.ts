export type JobAssignee = { id: string; name: string } | null | undefined;

/** LTR-154 / D11: a Job is mine only when it is assigned to me; unassigned work waits for the Manager. */
export function isMyJob(assignedMechanic: JobAssignee, currentUserId: string): boolean {
  return Boolean(currentUserId && assignedMechanic && assignedMechanic.id === currentUserId);
}

/**
 * LTR-154 / D11: only the Job's assignee completes it from the Work Order
 * (LTR-151 already applied this to the PM job; the API rejects anyone else).
 */
export function canCompleteJobFromWorkOrder(
  job: { assignedMechanic: JobAssignee },
  currentUserId: string,
): boolean {
  return isMyJob(job.assignedMechanic, currentUserId);
}

type SplittableJob = { id: string; status: string; assignedMechanic: JobAssignee };

/**
 * LTR-154: the viewer's Jobs, the rest of the truck's work, and whether the
 * viewer finished their part. Uses the API split when present (falls back for
 * older responses during deploy skew).
 */
export function splitMyJobs<J extends SplittableJob>(
  wo: { jobs: J[]; myJobs?: J[]; otherJobs?: J[]; myPartDone?: boolean },
  currentUserId: string,
): { mine: J[]; others: J[]; partDone: boolean } {
  const active = wo.jobs.filter((job) => job.status !== 'cancelled');
  const mine = wo.myJobs ?? active.filter((job) => isMyJob(job.assignedMechanic, currentUserId));
  const others = wo.otherJobs ?? active.filter((job) => !mine.includes(job));
  const partDone = wo.myPartDone ?? (mine.length > 0 && mine.every((job) => job.status !== 'to_do'));
  return { mine, others, partDone };
}

export function jobAssignmentLabel(
  assignedMechanic: JobAssignee,
  currentUserId: string,
  copy: {
    assignedToYou: string;
    assignedTo: (name: string) => string;
    jobUnassigned: string;
  },
): string {
  if (!assignedMechanic) return copy.jobUnassigned;
  if (assignedMechanic.id === currentUserId) return copy.assignedToYou;
  return copy.assignedTo(assignedMechanic.name);
}

/**
 * LTR-127: a completed Job shows who completed it; the assignment line only
 * applies to Jobs still to do.
 */
export function jobPersonLabel(
  job: { status: string; assignedMechanic: JobAssignee; completedBy?: JobAssignee },
  currentUserId: string,
  copy: {
    assignedToYou: string;
    assignedTo: (name: string) => string;
    jobUnassigned: string;
    completedByYou: string;
    completedBy: (name: string) => string;
  },
): string {
  if (job.status === 'completed' && job.completedBy) {
    return job.completedBy.id === currentUserId ? copy.completedByYou : copy.completedBy(job.completedBy.name);
  }
  return jobAssignmentLabel(job.assignedMechanic, currentUserId, copy);
}

/**
 * LTR-154 / D18: on the mechanic Home a Standard Work Order in progress moves to
 * "Waiting on Manager" once every Job of mine is done, even if others still work.
 */
export function isMyPartDone(
  wo: { status: string; primaryCategoryName: string; jobs: Array<{ status: string; assignedMechanic: JobAssignee }> },
  currentUserId: string,
): boolean {
  if (wo.primaryCategoryName === 'PM' || wo.status !== 'in_progress') return false;
  const mine = wo.jobs.filter((job) => job.status !== 'cancelled' && isMyJob(job.assignedMechanic, currentUserId));
  return mine.length > 0 && mine.every((job) => job.status !== 'to_do');
}

/** Standard jobs are done; the Work Order stays in progress until a Manager closes it. */
export function isStandardWorkWaitingOnManager(wo: {
  status: string;
  primaryCategoryName: string;
  jobs: Array<{ status: string }>;
}): boolean {
  if (wo.primaryCategoryName === 'PM') return false;
  if (wo.status !== 'in_progress') return false;
  return wo.jobs.every((job) => job.status !== 'to_do');
}
