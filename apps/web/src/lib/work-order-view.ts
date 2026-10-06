import type { AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import type { AdminLocale } from './admin-messages';
import { intlLocale } from './shop-locale';

/**
 * Stage 8 (mockups): what the Work Order screen shows that is computed from the detail it already has —
 * short dates, the progress bar's parts, the mechanics on it, and the cancel reason and corrected segments
 * read from the Activity Log. Nothing here decides a step: the Next step always comes from the API.
 */

const SHOP_TZ = 'America/New_York';

/** "Oct 1, 9:26 AM" (no year): the mockups' meta line and callouts. */
export function formatShortDateTime(value: string | null | undefined, locale: AdminLocale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: SHOP_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

/** "3:53 PM": a time on the same row as its day. */
export function formatTime(value: string | null | undefined, locale: AdminLocale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: SHOP_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

/** "Oct 5, 2026": the Activity day heading. */
export function formatDay(value: string | null | undefined, locale: AdminLocale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: SHOP_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

/** Age of a Work Order: "5h", "4d 2h". */
export function formatAge(fromIso: string, now = Date.now()) {
  const hours = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 3_600_000));
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

type Detail = Pick<AdminWorkOrderDetailDto, 'jobs' | 'reportedBlockers'>;

/** The progress bar: done, blocked (an open mechanic blocker) and at an external shop, out of the non-cancelled Jobs. */
export function workOrderProgress(data: Detail) {
  const live = data.jobs.filter((job) => job.status !== 'cancelled');
  const open = live.filter((job) => job.status === 'to_do');
  const blockedIds = new Set((data.reportedBlockers ?? []).filter((blocker) => !blocker.resolvedAt && blocker.job).map((blocker) => blocker.job!.id));
  return {
    done: live.filter((job) => job.status === 'completed').length,
    total: live.length,
    blocked: open.filter((job) => blockedIds.has(job.id)).length,
    external: open.filter((job) => job.external).length,
  };
}

/** Everyone who owns or finished a Job on this Work Order, once each (the avatars). */
export function workOrderMechanics(data: Pick<AdminWorkOrderDetailDto, 'jobs'>) {
  const seen = new Map<string, { id: string; name: string }>();
  for (const job of data.jobs) {
    for (const person of [job.assignedMechanic, job.completedBy]) {
      if (person && !seen.has(person.id)) seen.set(person.id, { id: person.id, name: person.name });
    }
  }
  return [...seen.values()];
}

type Activity = Pick<AdminWorkOrderDetailDto, 'activityLog'>;

function relevant(entry: { relevantValue: unknown }) {
  return (entry.relevantValue && typeof entry.relevantValue === 'object' ? entry.relevantValue : {}) as { action?: unknown; reason?: unknown };
}

/** Why the Work Order was cancelled (the latest cancel in the Activity Log). */
export function workOrderCancelReason(data: Activity) {
  const entry = [...data.activityLog]
    .filter((item) => relevant(item).action === 'work_order_cancelled')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const reason = entry ? relevant(entry).reason : null;
  return typeof reason === 'string' && reason.trim() ? reason : null;
}

/** Segments a manager corrected (they get a "Corrected" chip). */
export function correctedSegmentIds(data: Activity) {
  return new Set(data.activityLog.filter((item) => relevant(item).action === 'time_corrected' && item.entityId).map((item) => item.entityId!));
}
