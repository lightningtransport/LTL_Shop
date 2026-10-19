import type {
  YardIncomingTruckItemDto,
  YardMovementWindow,
  YardUpcomingDepartureItemDto,
  YardWorkLocationItemDto,
} from '@ltl-shop/shared';
import type { getShopWeekWindows } from './admin-time';

export type ShopWeekWindows = ReturnType<typeof getShopWeekWindows>;

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/_+$/g, '')
    .replace(/[\s_-]+/g, '');
}

export function pickField(row: Record<string, unknown>, candidates: string[]): string {
  const wanted = new Set(candidates.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (!wanted.has(normalizeKey(key))) continue;
    if (value == null || value === '') return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
  }
  return '';
}

export function toIsoDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!us) return null;
  return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
}

export function classifyMovementWindow(
  isoDate: string | null,
  windows: ShopWeekWindows,
): YardMovementWindow {
  if (!isoDate) return 'undated';
  if (isoDate >= windows.thisWeek.from && isoDate <= windows.thisWeek.to) return 'this_week';
  if (isoDate >= windows.nextWeek.from && isoDate <= windows.nextWeek.to) return 'next_week';
  return 'undated';
}

export function inDefaultMovementWindow(
  isoDate: string | null,
  windows: ShopWeekWindows,
): boolean {
  if (!isoDate) return true;
  const window = classifyMovementWindow(isoDate, windows);
  return window === 'this_week' || window === 'next_week';
}

function driverDisplayName(row: Record<string, unknown>): string {
  const full = pickField(row, ['Driver Name', 'DriverName', 'FullName']);
  if (full) return full;
  const first = pickField(row, ['First Name', 'FirstName']);
  const last = pickField(row, ['Last Name', 'LastName']);
  return [first, last].filter(Boolean).join(' ').trim();
}

function compareTruckNumber(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function dominateWorkLocation(items: YardWorkLocationItemDto[]): string | undefined {
  if (items.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.location) continue;
    counts.set(item.location, (counts.get(item.location) ?? 0) + 1);
  }
  let top: string | undefined;
  let topCount = 0;
  for (const [location, count] of counts) {
    if (count > topCount) {
      top = location;
      topCount = count;
    }
  }
  if (!top || topCount * 2 <= items.length) return undefined;
  return top;
}

export function mapWorkLocationItems(rows: Record<string, unknown>[]): {
  items: YardWorkLocationItemDto[];
  summary?: string;
} {
  const items: YardWorkLocationItemDto[] = [];
  for (const row of rows) {
    const truckNumber = pickField(row, ['truck_number', 'Truck_Number', 'Truck', 'truck']);
    const location = pickField(row, ['yard_location', 'yardLocation']);
    if (!truckNumber || !location) continue;
    items.push({ truckNumber, location });
  }
  items.sort((a, b) => compareTruckNumber(a.truckNumber, b.truckNumber));
  return { items, summary: dominateWorkLocation(items) };
}

type TruckAccumulator = {
  truckNumber: string;
  date: string | null;
  drivers: Set<string>;
};

function mergeDriverRow(
  byTruck: Map<string, TruckAccumulator>,
  truckNumber: string,
  date: string | null,
  driverName: string,
) {
  const existing = byTruck.get(truckNumber) ?? {
    truckNumber,
    date: null,
    drivers: new Set<string>(),
  };
  if (date && (!existing.date || date < existing.date)) existing.date = date;
  if (driverName) existing.drivers.add(driverName);
  byTruck.set(truckNumber, existing);
}

function toDriverList(drivers: Set<string>): string[] | undefined {
  if (drivers.size === 0) return undefined;
  return [...drivers].sort((a, b) => a.localeCompare(b));
}

/**
 * LTR-254: Incoming Trucks reads `driver_pay`, not the `returns` copy (it holds the whole fleet,
 * undated rows and stale dates). Each Truck counts its latest assignment (newest Out Date) and that
 * assignment's Return Date. Assignments that ended early or moved to another Truck do not bring it
 * back, and rows without a Return Date are not arrivals.
 */
export function mapIncomingTrucks(
  rows: Record<string, unknown>[],
  windows: ShopWeekWindows,
): YardIncomingTruckItemDto[] {
  const latest = new Map<string, { outDate: string; rows: Array<{ returnDate: string; driver: string }> }>();
  for (const row of rows) {
    const truckNumber = pickField(row, ['Truck_Number', 'Truck', 'truck_number', 'truck']);
    const returnDate = toIsoDate(pickField(row, ['Return Date', 'ReturnDate', 'return_date']));
    if (!truckNumber || !returnDate) continue;
    if (pickField(row, ['Termination']) || pickField(row, ['Termination Date'])) continue;
    if (/to other truck/i.test(pickField(row, ['Transfer']))) continue;
    const outDate = toIsoDate(pickField(row, ['Out Date', 'OutDate', 'out_date'])) ?? '';
    const entry = { returnDate, driver: driverDisplayName(row) };
    const current = latest.get(truckNumber);
    if (!current || outDate > current.outDate) latest.set(truckNumber, { outDate, rows: [entry] });
    else if (outDate === current.outDate) current.rows.push(entry);
  }

  const byTruck = new Map<string, TruckAccumulator>();
  for (const [truckNumber, assignment] of latest) {
    for (const { returnDate, driver } of assignment.rows) {
      mergeDriverRow(byTruck, truckNumber, returnDate, driver);
    }
  }

  return [...byTruck.values()]
    .filter((item) => classifyMovementWindow(item.date, windows) !== 'undated')
    .map((item) => {
      const drivers = toDriverList(item.drivers);
      return {
        truckNumber: item.truckNumber,
        returnDate: item.date,
        window: classifyMovementWindow(item.date, windows),
        ...(drivers ? { drivers } : {}),
      };
    })
    .sort(
      (a, b) =>
        (a.returnDate ?? '9999-99-99').localeCompare(b.returnDate ?? '9999-99-99') ||
        compareTruckNumber(a.truckNumber, b.truckNumber),
    );
}

export function mapUpcomingDepartures(
  rows: Record<string, unknown>[],
  windows: ShopWeekWindows,
): YardUpcomingDepartureItemDto[] {
  const byTruck = new Map<string, TruckAccumulator>();
  for (const row of rows) {
    const truckNumber = pickField(row, ['Truck_Number', 'Truck', 'truck_number', 'truck']);
    if (!truckNumber) continue;
    const outDate = toIsoDate(pickField(row, ['Out Date', 'OutDate', 'out_date']));
    if (!inDefaultMovementWindow(outDate, windows)) continue;
    // LTR-93: "Upcoming" excludes departures dated before today (shop time).
    if (outDate && windows.today && outDate < windows.today) continue;
    mergeDriverRow(byTruck, truckNumber, outDate, driverDisplayName(row));
  }

  return [...byTruck.values()]
    .map((item) => {
      const drivers = toDriverList(item.drivers);
      return {
        truckNumber: item.truckNumber,
        outDate: item.date,
        window: classifyMovementWindow(item.date, windows),
        ...(drivers ? { drivers } : {}),
      };
    })
    .sort(
      (a, b) =>
        (a.outDate ?? '9999-99-99').localeCompare(b.outDate ?? '9999-99-99') ||
        compareTruckNumber(a.truckNumber, b.truckNumber),
    );
}

