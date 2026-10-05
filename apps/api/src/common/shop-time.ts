/**
 * LTR-186: the shop's time zone and wall-clock ↔ instant conversions for any IANA zone,
 * DST included. The Admin dashboard windows (admin-time.ts) and the day close (D20) share it.
 */
export const SHOP_TIME_ZONE = 'America/New_York' as const;

export type LocalDate = { year: number; month: number; day: number };
type LocalDateTime = LocalDate & { hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'iso8601',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock parts of an instant in a zone. */
export function localDateTimeIn(instant: Date, timeZone: string): LocalDateTime {
  const parts = Object.fromEntries(
    formatterFor(timeZone).formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}

/** ISO weekday of a calendar date (Monday = 1 … Sunday = 7). */
export function isoWeekday(date: LocalDate): number {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/**
 * The instant a wall-clock time happens in a zone. Recomputes the offset after each guess, which
 * converges across spring-forward and fall-back (for a time inside the spring gap it lands one hour later).
 */
export function zonedTimeToUtc(timeZone: string, date: LocalDate, minutesOfDay = 0): Date {
  const wallAsUtc = Date.UTC(date.year, date.month - 1, date.day, Math.floor(minutesOfDay / 60), minutesOfDay % 60);
  let instant = wallAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = localDateTimeIn(new Date(instant), timeZone);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const candidate = wallAsUtc - (localAsUtc - instant);
    if (candidate === instant) break;
    instant = candidate;
  }
  return new Date(instant);
}
