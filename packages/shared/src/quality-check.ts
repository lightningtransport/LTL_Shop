/**
 * LTR-164 (#2) / D15: whether a Job is the Quality Check step, which has no
 * owner (the Manager completes it). One rule for the API Work Plan lanes and
 * the Admin screens. Catalog ids differ per environment, so it matches names.
 */
export function isQualityCheckJob(categoryName: string | null | undefined, displayName: string | null | undefined) {
  const category = (categoryName ?? '').trim().toLowerCase();
  const name = (displayName ?? '').trim().toLowerCase();
  return category.includes('quality check')
    || category.includes('quality_check')
    || name === 'qc'
    || name.includes('quality check');
}
