const SHOP_TIME_ZONE = 'America/New_York' as const;

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
