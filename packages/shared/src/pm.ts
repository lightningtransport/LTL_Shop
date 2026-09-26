/**
 * LTR-141: the PM Category name is the one marker of PM work (catalog keeps it
 * exactly "PM"). Centralized so the PM-as-a-Job slices share one definition.
 */
export const PM_CATEGORY_NAME = 'PM';

export function isPmCategory(name: string | null | undefined) {
  return (name ?? '').trim().toLowerCase() === PM_CATEGORY_NAME.toLowerCase();
}

export function isPmJob(job: { category?: { name: string } | null }) {
  return isPmCategory(job.category?.name);
}
