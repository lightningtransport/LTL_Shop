import type { YardFeedDto, YardFeedItemDto } from '@ltl-shop/shared';

export const SHOP_TIME_ZONE = 'America/New_York';
export const YARD_FEED_ITEM_LIMIT = 40;

const SHOP_OR_YARD = /\b(301\s*yard|yard|shop|taller|vendor\s*lot)\b/i;
const ON_ROAD = /\b(us\s*\d+|i-\d+|hwy|highway|county|street|ave\.?|road|rd\.?)\b/i;
const DEFAULT_LOCATION_MIN = 12;
const DEFAULT_LOCATION_SHARE = 0.25;

export type ShopMovementTruck = {
  id: string;
  truckNumber: string;
  yardLocation?: string | null;
  samsaraTruckLocation?: string | null;
  workOrders: Array<{ displayId: string }>;
};

export type AgentReportingReports = {
  available: boolean;
  trucks: unknown;
  returns: unknown;
  driverPay: unknown;
};

export type RawMovementRow = {
  truckNumber: string;
  location: string | null;
  scheduledOn: string | null;
  people: string | null;
};

export function unavailableFeed(reason: YardFeedDto['reason'] = 'integration_not_connected'): YardFeedDto {
  return { status: 'unavailable', reason, items: [], total: 0 };
}

export function okFeed(items: YardFeedItemDto[]): YardFeedDto {
  return { status: 'ok', items: items.slice(0, YARD_FEED_ITEM_LIMIT), total: items.length };
}

export function shopDateKey(value: Date, timeZone = SHOP_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function parseScheduledOn(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return shopDateKey(value, 'UTC');
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return shopDateKey(parsed, 'UTC');
}

export function isReportedYardLocation(value: string | null | undefined): boolean {
  const text = value?.trim() ?? '';
  if (!text) return false;
  if (ON_ROAD.test(text) && !SHOP_OR_YARD.test(text)) return false;
  return SHOP_OR_YARD.test(text);
}

export function normalizeTruckNumber(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^#/, '').replace(/\s+/g, '');
  return normalized || null;
}

export function extractMovementRows(payload: unknown): RawMovementRow[] {
  const records = asRecordArray(payload);
  const rows: RawMovementRow[] = [];
  for (const record of records) {
    const truckNumber = normalizeTruckNumber(firstValue(record, [
      'truckNumber', 'truck_number', 'unit', 'unitNumber', 'unit_number', 'truck', 'Truck', 'Unit',
    ]));
    if (!truckNumber) continue;
    rows.push({
      truckNumber,
      location: stringValue(firstValue(record, [
        'yard_location', 'yardLocation', 'location', 'Location', 'samsaraTruckLocation',
      ])),
      scheduledOn: parseScheduledOn(firstValue(record, [
        'return_date', 'returnDate', 'expected_date', 'expectedDate', 'date', 'Date',
        'eta', 'ETA', 'scheduled_at', 'scheduledOn', 'out_date', 'outDate', 'Out Date',
        'out_schedule', 'outSchedule', 'Out Schedule',
      ])),
      people: stringValue(firstValue(record, [
        'drivers', 'driver', 'Driver', 'team', 'Team', 'names', 'crew',
      ])),
    });
  }
  return rows;
}

export function buildYardMovementFeeds(input: {
  shop: ShopMovementTruck[];
  reporting: AgentReportingReports;
  now?: Date;
}): { workLocation: YardFeedDto; incomingTrucks: YardFeedDto; upcomingDepartures: YardFeedDto } {
  const today = shopDateKey(input.now ?? new Date());
  const shopByNumber = new Map(input.shop.map((truck) => [normalizeTruckNumber(truck.truckNumber) ?? truck.truckNumber, truck]));
  const workLocation = buildWorkLocation(input.shop, extractMovementRows(input.reporting.trucks ?? []));
  const atShop = new Set(workLocation.items.map((item) => item.truckNumber));

  return {
    workLocation,
    incomingTrucks: movementReportFeed(
      input.reporting.available,
      input.reporting.returns,
      (rows) => filterIncoming(rows, today, atShop, shopByNumber),
    ),
    upcomingDepartures: movementReportFeed(
      input.reporting.available,
      input.reporting.driverPay,
      (rows) => filterUpcoming(rows, today, shopByNumber),
    ),
  };
}

function movementReportFeed(
  available: boolean,
  payload: unknown,
  filter: (rows: RawMovementRow[]) => YardFeedItemDto[],
): YardFeedDto {
  if (!available) return unavailableFeed();
  if (payload == null) return unavailableFeed('upstream_error');
  return okFeed(filter(extractMovementRows(payload)));
}

function buildWorkLocation(shop: ShopMovementTruck[], reported: RawMovementRow[]): YardFeedDto {
  const items = new Map<string, YardFeedItemDto>();
  const locationCounts = new Map<string, number>();
  for (const truck of shop) {
    const location = (truck.yardLocation ?? truck.samsaraTruckLocation ?? '').trim().toLowerCase();
    if (!location) continue;
    locationCounts.set(location, (locationCounts.get(location) ?? 0) + 1);
  }
  for (const row of reported) {
    const location = (row.location ?? '').trim().toLowerCase();
    if (!location) continue;
    locationCounts.set(location, (locationCounts.get(location) ?? 0) + 1);
  }
  const population = Math.max(shop.length + reported.length, 1);

  function isDefaultLabel(location: string | null | undefined) {
    const key = location?.trim().toLowerCase() ?? '';
    if (!key) return false;
    const count = locationCounts.get(key) ?? 0;
    return count >= DEFAULT_LOCATION_MIN && count / population >= DEFAULT_LOCATION_SHARE;
  }

  for (const truck of shop) {
    const number = normalizeTruckNumber(truck.truckNumber) ?? truck.truckNumber;
    const location = truck.yardLocation ?? truck.samsaraTruckLocation ?? null;
    const openWorkOrder = truck.workOrders[0]?.displayId ?? null;
    const reportedYard = isReportedYardLocation(location) && !isDefaultLabel(location);
    if (!openWorkOrder && !reportedYard) continue;
    items.set(number, {
      truckNumber: number,
      truckId: truck.id,
      detail: openWorkOrder,
      scheduledOn: null,
      source: openWorkOrder ? 'open_work_order' : 'reported_yard',
    });
  }

  for (const row of reported) {
    if (items.has(row.truckNumber)) continue;
    if (!isReportedYardLocation(row.location) || isDefaultLabel(row.location)) continue;
    const shopTruck = shop.find((candidate) => (normalizeTruckNumber(candidate.truckNumber) ?? candidate.truckNumber) === row.truckNumber);
    items.set(row.truckNumber, {
      truckNumber: row.truckNumber,
      truckId: shopTruck?.id ?? null,
      detail: null,
      scheduledOn: null,
      source: 'reported_yard',
    });
  }

  return okFeed([...items.values()].sort(compareFeedItems));
}

function filterIncoming(
  rows: RawMovementRow[],
  today: string,
  atShop: Set<string>,
  shopByNumber: Map<string, ShopMovementTruck>,
): YardFeedItemDto[] {
  const items = new Map<string, YardFeedItemDto>();
  for (const row of rows) {
    if (atShop.has(row.truckNumber)) continue;
    if (row.scheduledOn && row.scheduledOn < today) continue;
    const existing = items.get(row.truckNumber);
    if (existing?.scheduledOn && row.scheduledOn && existing.scheduledOn <= row.scheduledOn) continue;
    items.set(row.truckNumber, {
      truckNumber: row.truckNumber,
      truckId: shopByNumber.get(row.truckNumber)?.id ?? null,
      detail: row.people,
      scheduledOn: row.scheduledOn,
      source: 'expected_return',
    });
  }
  return [...items.values()].sort(compareFeedItems);
}

function filterUpcoming(
  rows: RawMovementRow[],
  today: string,
  shopByNumber: Map<string, ShopMovementTruck>,
): YardFeedItemDto[] {
  const items = new Map<string, YardFeedItemDto>();
  for (const row of rows) {
    if (row.scheduledOn !== today) continue;
    items.set(row.truckNumber, {
      truckNumber: row.truckNumber,
      truckId: shopByNumber.get(row.truckNumber)?.id ?? null,
      detail: row.people,
      scheduledOn: row.scheduledOn,
      source: 'planned_out',
    });
  }
  return [...items.values()].sort(compareFeedItems);
}

function compareFeedItems(left: YardFeedItemDto, right: YardFeedItemDto) {
  const time = (left.scheduledOn ?? '').localeCompare(right.scheduledOn ?? '');
  if (time !== 0) return time;
  return left.truckNumber.localeCompare(right.truckNumber, undefined, { numeric: true, sensitivity: 'base' });
}

function asRecordArray(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ['rows', 'data', 'items', 'trucks', 'returns', 'result']) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstValue(record: Record<string, unknown>, keys: string[]) {
  const lookup = new Map(Object.entries(record).map(([key, value]) => [key.toLowerCase().replace(/[\s_]/g, ''), value]));
  for (const key of keys) {
    const value = lookup.get(key.toLowerCase().replace(/[\s_]/g, ''));
    if (value != null && value !== '') return value;
  }
  return null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}
