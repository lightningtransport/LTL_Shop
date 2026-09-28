import { JobStatus, type WorkOrderDetailDto, type WorkOrderJobDto } from '@ltl-shop/shared';

/**
 * LTR-164 (#7): the Work Order a mechanic sees while "Complete job" is in
 * flight. `myJobs`, `myPartDone` and `laborRunning` come from the API next to
 * `jobs`, so they change together: otherwise the Job shows under Your Jobs and
 * Completed at once, and the time keeps running until the response lands.
 * Like the API (LTR-154 / D18), the mechanic's labor stops when none of their
 * Jobs is left to work on; a blocked Job waits for the Manager.
 */
export function optimisticCompleteJob(
  current: WorkOrderDetailDto,
  jobId: string,
  userId: string | null,
  notes: string | null,
  completedAt: string,
): WorkOrderDetailDto {
  const complete = (job: WorkOrderJobDto): WorkOrderJobDto =>
    job.id === jobId
      ? {
          ...job,
          status: JobStatus.COMPLETED,
          workStatus: job.workStatus ? 'completed' : job.workStatus,
          completedAt,
          completedById: userId,
          completionNotes: notes,
        }
      : job;
  const jobs = current.jobs.map(complete);
  const myJobs = current.myJobs?.map(complete);
  const mine = myJobs ?? jobs.filter((job) => job.assignedMechanic?.id === userId);
  const workable = mine.filter((job) => job.status === JobStatus.TO_DO && !job.activeBlocker);
  return {
    ...current,
    jobs,
    ...(myJobs ? { myJobs } : {}),
    ...(current.myPartDone === undefined ? {} : { myPartDone: mine.every((job) => job.status !== JobStatus.TO_DO) }),
    laborRunning: workable.length > 0 ? current.laborRunning : false,
    jobsCompleted: jobs.filter((job) => job.status === JobStatus.COMPLETED).length,
    version: current.version + 1,
  };
}
