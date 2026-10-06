import { isQualityCheckJob, type AdminWorkOrderDetailDto } from '@ltl-shop/shared';

type Job = AdminWorkOrderDetailDto['jobs'][number];

/**
 * Stage 5 (R3): open Jobs first — blocked, then the shop's work, then at an external shop, Quality
 * Check last — each helper right under its Job; done and cancelled apart (in their order).
 */
export function orderJobs<T extends Pick<Job, 'id' | 'status' | 'category' | 'displayName' | 'helperOfJobId' | 'external'>>(jobs: T[], blockedJobIds: string[] = []) {
  const rank = (job: T) => {
    if (blockedJobIds.includes(job.id)) return 0;
    if (isQualityCheckJob(job.category.name, job.displayName)) return 3;
    if (job.external) return 2;
    return 1;
  };
  const withHelpers = (list: T[]) => {
    const parents = list.filter((job) => !job.helperOfJobId || !list.some((other) => other.id === job.helperOfJobId));
    return parents.flatMap((job) => [job, ...list.filter((other) => other.helperOfJobId === job.id)]);
  };
  const openJobs = jobs.filter((job) => job.status === 'to_do');
  const sorted = openJobs
    .map((job, index) => ({ job, index }))
    .sort((left, right) => rank(left.job) - rank(right.job) || left.index - right.index)
    .map((entry) => entry.job);
  return { open: withHelpers(sorted), closed: withHelpers(jobs.filter((job) => job.status !== 'to_do')) };
}
