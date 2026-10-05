import { SHOP_TIME_ZONE } from '../common/shop-time';

export { SHOP_TIME_ZONE };

type LocalDate = { year: number; month: number; day: number };

const localPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TIME_ZONE,
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

const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TIME_ZONE,
  calendar: 'iso8601',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function partsToRecord(parts: Intl.DateTimeFormatPart[]) {
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

export function getShopLocalDate(now: Date): LocalDate {
  const parts = partsToRecord(datePartsFormatter.formatToParts(now));
  return { year: parts.year, month: parts.month, day: parts.day };
}

function getLocalDateTimeParts(date: Date) {
  return partsToRecord(localPartsFormatter.formatToParts(date));
}

/** Convert a local calendar midnight to its UTC instant, including DST changes. */
export function shopLocalMidnightUtc(localDate: LocalDate): Date {
  const utcGuess = Date.UTC(localDate.year, localDate.month - 1, localDate.day);
  let instant = utcGuess;

  // Recalculate the offset after each adjustment. This converges for normal
  // IANA timezone transitions, including both spring-forward and fall-back.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = getLocalDateTimeParts(new Date(instant));
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const offsetMs = localAsUtc - instant;
    const candidate = utcGuess - offsetMs;
    if (candidate === instant) break;
    instant = candidate;
  }

  return new Date(instant);
}

function addLocalDays(localDate: LocalDate, days: number): LocalDate {
  const date = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function getShopDashboardWindows(now = new Date()) {
  const today = getShopLocalDate(now);
  const tomorrow = addLocalDays(today, 1);
  const sevenDaysAgo = addLocalDays(today, -6);
  return {
    timeZone: SHOP_TIME_ZONE,
    today: {
      from: shopLocalMidnightUtc(today).toISOString(),
      to: shopLocalMidnightUtc(tomorrow).toISOString(),
    },
    last7Days: {
      from: shopLocalMidnightUtc(sevenDaysAgo).toISOString(),
      to: shopLocalMidnightUtc(tomorrow).toISOString(),
    },
  } as const;
}

export function formatShopIsoDate(localDate: LocalDate): string {
  return `${String(localDate.year).padStart(4, '0')}-${String(localDate.month).padStart(2, '0')}-${String(localDate.day).padStart(2, '0')}`;
}

/**
 * Monday–Sunday calendar weeks in the Shop timezone. `from`/`to` are inclusive
 * ISO dates (`YYYY-MM-DD`) for agent-reporting `out_from` / `out_to` filters.
 */
export function getShopWeekWindows(now = new Date()) {
  const today = getShopLocalDate(now);
  const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const thisMonday = addLocalDays(today, -daysFromMonday);
  const thisSunday = addLocalDays(thisMonday, 6);
  const nextMonday = addLocalDays(thisMonday, 7);
  const nextSunday = addLocalDays(thisMonday, 13);
  return {
    timeZone: SHOP_TIME_ZONE,
    /** Shop-local today (ISO date); LTR-93 hides departures before it. */
    today: formatShopIsoDate(today),
    thisWeek: {
      from: formatShopIsoDate(thisMonday),
      to: formatShopIsoDate(thisSunday),
    },
    nextWeek: {
      from: formatShopIsoDate(nextMonday),
      to: formatShopIsoDate(nextSunday),
    },
  } as const;
}
