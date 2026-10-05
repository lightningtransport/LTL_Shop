import type { Prisma } from '@prisma/client';
import { addLocalDays, isoWeekday, localDateTimeIn, zonedTimeToUtc } from '../common/shop-time';
import { persistTotals } from './labor-session';

/** LTR-186 / D20: the shop hours the day close reads (from `shop_settings`). */
export type DayCloseSettings = {
  /** Minutes after local midnight (17:00 = 1020). */
  cutoffMinutes: number;
  /** ISO weekdays (Monday = 1 … Sunday = 7). */
  workdays: readonly number[];
  timeZone: string;
};

/**
 * LTR-186 / D20: when an open labor session closes by itself. A session that starts on a workday
 * before the cutoff closes at that day's cutoff; one that starts after the cutoff, or on a day the
 * shop does not work, closes at 23:59:59.999 local of the day it started. Pure, no DB.
 */
export function sessionCloseAt(startedAt: Date, settings: DayCloseSettings): Date {
  const local = localDateTimeIn(startedAt, settings.timeZone);
  const day = { year: local.year, month: local.month, day: local.day };
  if (settings.workdays.includes(isoWeekday(day))) {
    const cutoff = zonedTimeToUtc(settings.timeZone, day, settings.cutoffMinutes);
    if (startedAt.getTime() < cutoff.getTime()) return cutoff;
  }
  return new Date(zonedTimeToUtc(settings.timeZone, addLocalDays(day, 1), 0).getTime() - 1);
}

export type DayCloseResult = { closed: number; workOrderIds: string[] };

/**
 * LTR-186 / D20: close every open session whose close time has passed, with `endedAt` = its close
 * time (not now) and `end_reason = day_close`, then refresh those Work Orders' totals. Idempotent:
 * the update only touches sessions that are still open, so two callers racing close each once.
 * There is no scheduler on Vercel Functions, so the API calls this lazily before reading or writing
 * labor, and a Vercel Cron call is the backstop (`GET /api/internal/day-close`).
 */
export async function closeSessionsPastCutoff(
  tx: Prisma.TransactionClient,
  now: Date,
  settings: DayCloseSettings,
): Promise<DayCloseResult> {
  const open = await tx.workSession.findMany({
    where: { endedAt: null, startedAt: { lt: now } },
    select: { id: true, startedAt: true, workOrderId: true },
  });
  return closeDueSessions(tx, open, now, settings);
}

/** The second half of {@link closeSessionsPastCutoff}, for a caller that already read the open sessions. */
export async function closeDueSessions(
  tx: Prisma.TransactionClient,
  open: Array<{ id: string; startedAt: Date; workOrderId: string }>,
  now: Date,
  settings: DayCloseSettings,
): Promise<DayCloseResult> {
  const byCloseAt = new Map<number, { ids: string[]; workOrderIds: Set<string> }>();
  for (const session of open) {
    const closeAt = sessionCloseAt(session.startedAt, settings).getTime();
    if (closeAt > now.getTime()) continue;
    const group = byCloseAt.get(closeAt) ?? { ids: [], workOrderIds: new Set<string>() };
    group.ids.push(session.id);
    group.workOrderIds.add(session.workOrderId);
    byCloseAt.set(closeAt, group);
  }
  let closed = 0;
  const touched = new Set<string>();
  for (const [closeAt, group] of byCloseAt) {
    const result = await tx.workSession.updateMany({
      where: { id: { in: group.ids }, endedAt: null },
      data: { endedAt: new Date(closeAt), endReason: 'day_close' },
    });
    closed += result.count;
    if (result.count > 0) group.workOrderIds.forEach((id) => touched.add(id));
  }
  for (const workOrderId of touched) await persistTotals(tx, workOrderId, now);
  return { closed, workOrderIds: [...touched] };
}
