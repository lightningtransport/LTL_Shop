const WORK_ORDER_NOTES_MAX = 2000;

export function mergeWorkOrderNotes(
  existing: string | null | undefined,
  addition: string | null | undefined,
): string {
  const current = existing?.trim() ?? '';
  const extra = addition?.trim() ?? '';
  if (!extra) return current;
  if (!current) return extra.slice(0, WORK_ORDER_NOTES_MAX);
  if (current.includes(extra)) return current.slice(0, WORK_ORDER_NOTES_MAX);
  return `${current}\n\n${extra}`.slice(0, WORK_ORDER_NOTES_MAX);
}
