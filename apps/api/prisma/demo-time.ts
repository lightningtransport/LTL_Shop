/**
 * Demo only (`reset-demo-work-orders --demo`): move what one step of the demo wrote to a day in the past.
 *
 * The services stamp every row with "now", so a Work Order built by the script happens in a few seconds. `retime`
 * takes every timestamp written between `since` and the moment it is called (in every table) and lays them out again,
 * in the same order, on a shop day: short gaps between the Manager's clicks, longer ones while a mechanic works (the
 * gap before a work session ends). Rows written in the same transaction keep the same instant.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { persistTotals } from '../src/work-orders/labor-session';
import { addLocalDays, isoWeekday, localDateTimeIn, SHOP_TIME_ZONE, zonedTimeToUtc, type LocalDate } from '../src/common/shop-time';

const WORKDAYS = [1, 2, 3, 4, 5];
const DAY_START = 7 * 60 + 30;
const DAY_END = 16 * 60 + 45;

type Column = { table: string; column: string };
let columns: Column[] | null = null;

async function timestampColumns(prisma: PrismaClient): Promise<Column[]> {
  if (!columns) {
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and table_name <> '_prisma_migrations'
          and data_type in ('timestamp without time zone', 'timestamp with time zone')`,
    );
    columns = rows.map((row) => ({ table: row.table_name, column: row.column_name }));
  }
  return columns;
}

/** Today in the shop. */
export function shopToday(): LocalDate {
  const now = localDateTimeIn(new Date(), SHOP_TIME_ZONE);
  return { year: now.year, month: now.month, day: now.day };
}

/** The shop workday `count` workdays before today (1 = the last workday before today). */
export function workdaysAgo(count: number): LocalDate {
  let day = shopToday();
  let left = count;
  while (left > 0) {
    day = addLocalDays(day, -1);
    if (WORKDAYS.includes(isoWeekday(day))) left -= 1;
  }
  return day;
}

/** A workday about `days` calendar days ago (moved back to a workday). */
export function daysAgo(days: number): LocalDate {
  let day = addLocalDays(shopToday(), -days);
  while (!WORKDAYS.includes(isoWeekday(day))) day = addLocalDays(day, -1);
  return day;
}

export function isoDay(day: LocalDate) {
  return `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
}

export function shopInstant(day: LocalDate, minutesOfDay: number) {
  return zonedTimeToUtc(SHOP_TIME_ZONE, day, minutesOfDay);
}

/** A small deterministic random, so every run of the demo looks the same. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Lay out every timestamp written since `since` on `day`, from `startMinutes` (shop time). Returns the last instant
 * used.
 */
export async function retime(
  prisma: PrismaClient,
  since: Date,
  day: LocalDate,
  options: { startMinutes?: number; endMinutes?: number; random?: () => number } = {},
): Promise<Date> {
  const random = options.random ?? Math.random;
  const until = new Date();
  const lower = since.toISOString();
  const upper = until.toISOString();
  const cols = await timestampColumns(prisma);

  const found = new Set<string>();
  for (const { table, column } of cols) {
    const rows = await prisma.$queryRawUnsafe<Array<{ v: string }>>(
      `select distinct to_char("${column}", 'YYYY-MM-DD HH24:MI:SS.MS') as v from "${table}"
        where "${column}" >= $1::timestamp and "${column}" <= $2::timestamp`,
      lower.replace('Z', ''),
      upper.replace('Z', ''),
    );
    for (const row of rows) found.add(row.v);
  }
  const originals = [...found].sort();
  if (!originals.length) return shopInstant(day, options.startMinutes ?? DAY_START);

  // Work happens before a session ends; everything else is a click or two.
  const sessionEnds = new Set(
    (await prisma.$queryRawUnsafe<Array<{ v: string }>>(
      `select distinct to_char(ended_at, 'YYYY-MM-DD HH24:MI:SS.MS') as v from work_sessions
        where ended_at >= $1::timestamp and ended_at <= $2::timestamp`,
      lower.replace('Z', ''),
      upper.replace('Z', ''),
    )).map((row) => row.v),
  );
  const start = options.startMinutes ?? DAY_START;
  const gaps = originals.map((value, index) => {
    if (index === 0) return 0;
    return sessionEnds.has(value) ? 45 + random() * 105 : 2 + random() * 8;
  });
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  const room = Math.max((options.endMinutes ?? DAY_END) - start, 1);
  const scale = total > room ? room / total : 1;

  let minutes = start;
  const targets = originals.map((_, index) => {
    minutes += gaps[index] * scale;
    const whole = Math.floor(minutes);
    const instant = shopInstant(day, whole);
    return new Date(instant.getTime() + Math.round((minutes - whole) * 60_000) + index);
  });

  const from = originals.map((value) => value);
  const to = targets.map((value) => value.toISOString().replace('T', ' ').replace('Z', ''));
  for (const { table, column } of cols) {
    await prisma.$executeRawUnsafe(
      `update "${table}" t set "${column}" = m.target
         from (select unnest($1::text[])::timestamp as orig, unnest($2::text[])::timestamp as target) m
        where t."${column}" = m.orig`,
      from,
      to,
    );
  }
  // Blockers and pauses keep their length in sync with the new times, and each Work Order its totals.
  await prisma.$executeRawUnsafe(
    `update pause_events set duration_ms = (extract(epoch from (ended_at - started_at)) * 1000)::bigint
      where ended_at is not null and started_at >= $1::timestamp`,
    to[0],
  );
  const touched = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `select work_order_id::text as id from work_sessions where started_at >= $1::timestamp and started_at <= $2::timestamp
      union select work_order_id::text from pause_events where started_at >= $1::timestamp and started_at <= $2::timestamp`,
    to[0],
    to[to.length - 1],
  );
  for (const { id } of touched) await persistTotals(prisma as unknown as Prisma.TransactionClient, id, new Date());
  return targets[targets.length - 1];
}

/** Minutes since local midnight in the shop, now. */
export function shopMinutesNow() {
  const now = localDateTimeIn(new Date(), SHOP_TIME_ZONE);
  return now.hour * 60 + now.minute;
}
