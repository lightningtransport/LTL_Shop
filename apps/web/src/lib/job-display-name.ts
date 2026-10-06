/**
 * LTR-188 / D23: a helper Job stores its parent's name; the screens add " · helper" / " · ayudante"
 * from the catalogs, so the language follows the viewer and the stored name stays the catalog Job's.
 */
export function jobDisplayName(job: { displayName: string; helperOfJobId?: string | null }, helperSuffix: string): string {
  return job.helperOfJobId ? `${job.displayName}${helperSuffix}` : job.displayName;
}
