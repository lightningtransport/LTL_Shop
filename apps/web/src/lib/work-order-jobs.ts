import { WORK_AREA_ORDER, WorkPlanJobLane, isPmCategory, isQualityCheckJob, type AdminWorkOrderDetailDto } from '@ltl-shop/shared';

type Job = AdminWorkOrderDetailDto['jobs'][number];
type OrderJob = Pick<Job, 'id' | 'status' | 'category' | 'displayName' | 'helperOfJobId' | 'external'> & Partial<Pick<Job, 'area'>>;

/**
 * D57 (LTR-301): the area a Job is painted in. The API sends it (`workAreaOf`: Tires and Flat Repair are Alignment's);
 * while an older API answers (deploy skew) it is read from the category, which is right for everything but those two.
 */
export function workOrderJobArea(job: OrderJob): WorkPlanJobLane {
  if (job.area) return job.area;
  if (isQualityCheckJob(job.category.name, job.displayName)) return WorkPlanJobLane.QUALITY_CHECK;
  if (isPmCategory(job.category.name)) return WorkPlanJobLane.PM;
  return WorkPlanJobLane.SHOP_WORK;
}

/**
 * D57 (LTR-301): open Jobs grouped by area in `WORK_AREA_ORDER` (PM · Alignment · Shop Work · Detailing · Quality
 * Check) — inside an area the blocked ones first, then the shop's work in the order it was added, then at an external
 * shop; each helper right under its Job. An area with no open Jobs has no group. Done and cancelled apart (in their
 * order). `open` is the same Jobs, flat.
 */
export function orderJobs<T extends OrderJob>(jobs: T[], blockedJobIds: string[] = []) {
  const rank = (job: T) => {
    if (blockedJobIds.includes(job.id)) return 0;
    if (job.external) return 2;
    return 1;
  };
  const withHelpers = (list: T[]) => {
    const parents = list.filter((job) => !job.helperOfJobId || !list.some((other) => other.id === job.helperOfJobId));
    return parents.flatMap((job) => [job, ...list.filter((other) => other.helperOfJobId === job.id)]);
  };
  const areaOf = (job: T) => {
    const area = workOrderJobArea(job);
    return WORK_AREA_ORDER.includes(area) ? area : WorkPlanJobLane.SHOP_WORK;
  };
  const openJobs = jobs.filter((job) => job.status === 'to_do');
  const groups = WORK_AREA_ORDER.flatMap((area) => {
    const inArea = openJobs
      .filter((job) => areaOf(job) === area)
      .map((job, index) => ({ job, index }))
      .sort((left, right) => rank(left.job) - rank(right.job) || left.index - right.index)
      .map((entry) => entry.job);
    return inArea.length ? [{ area, jobs: withHelpers(inArea) }] : [];
  });
  return { open: groups.flatMap((group) => group.jobs), groups, closed: withHelpers(jobs.filter((job) => job.status !== 'to_do')) };
}
