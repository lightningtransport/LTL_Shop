import type { WorkOrderSummaryDto } from '@ltl-shop/shared';

type Lists = { created?: WorkOrderSummaryDto[]; active?: WorkOrderSummaryDto[]; paused?: WorkOrderSummaryDto[]; completed?: WorkOrderSummaryDto[] };

export type MyCompletedJobsGroup = { wo: WorkOrderSummaryDto; jobs: WorkOrderSummaryDto['jobs'] };

/**
 * LTR-189 (W11): "Completed" for a Standard mechanic lists the Jobs they finished,
 * on any Work Order they can see (open or closed), newest Work Order first.
 * Closed Work Orders come after open ones, matching the API buckets.
 */
export function myCompletedJobs(lists: Lists | undefined, currentUserId: string): MyCompletedJobsGroup[] {
  if (!lists || !currentUserId) return [];
  const all = [...(lists.active ?? []), ...(lists.paused ?? []), ...(lists.created ?? []), ...(lists.completed ?? [])];
  const seen = new Set<string>();
  const groups: MyCompletedJobsGroup[] = [];
  for (const wo of all) {
    if (seen.has(wo.id)) continue;
    seen.add(wo.id);
    const jobs = wo.jobs.filter((job) => job.status === 'completed' && job.completedBy?.id === currentUserId);
    if (jobs.length) groups.push({ wo, jobs });
  }
  return groups;
}

/** LTR-277 §3: "View completed work (N)" counts the Jobs the Completed screen lists, not the closed Work Orders. */
export function myCompletedJobsCount(lists: Lists | undefined, currentUserId: string): number {
  return myCompletedJobs(lists, currentUserId).reduce((total, group) => total + group.jobs.length, 0);
}
