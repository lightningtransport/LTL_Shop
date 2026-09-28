import { JobStatus } from './enums';

/**
 * LTR-154 / D18: what a Job looks like on the floor. There is no new column:
 * a pending Job is In Progress while its assignee has an open labor session on
 * the Work Order, and Pending otherwise. A started PM job is In Progress.
 */
export type JobWorkStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export function jobWorkStatus(
  job: {
    status: JobStatus | `${JobStatus}`;
    assignedMechanicId: string | null;
    startedAt?: Date | string | null;
    isPm?: boolean;
    /** LTR-155 / D17: an active blocker on this Job wins over labor. */
    blocked?: boolean;
  },
  sessions: { endedAt: Date | string | null; userId?: string | null }[],
): JobWorkStatus {
  if (job.status === JobStatus.COMPLETED) return 'completed';
  if (job.status === JobStatus.CANCELLED) return 'cancelled';
  if (job.blocked) return 'blocked';
  if (job.isPm) return job.startedAt ? 'in_progress' : 'pending';
  if (!job.assignedMechanicId) return 'pending';
  // A session without userId predates per-mechanic labor (LTR-153) and covers every assignee.
  const running = sessions.some((session) => (
    session.endedAt === null && (!session.userId || session.userId === job.assignedMechanicId)
  ));
  return running ? 'in_progress' : 'pending';
}
