import { normalizeTruckSearch } from './truck-search';

export type WorkOrderSearchFields = {
  displayId: string;
  truck: { truckNumber: string };
  category: { name: string };
  mechanics: Array<{ mechanicName: string }>;
};

export const OPEN_WORK_ORDER_STATUSES = 'created,in_progress,waiting_paused';
export const DASHBOARD_RANGE_KEYS = ['createdBefore', 'completedFrom', 'completedBefore'] as const;

export type AdminWorkOrdersFilters = {
  search: string;
  status: string;
  priority: string;
  sort: string;
  direction: string;
};

export const DEFAULT_ADMIN_WORK_ORDER_FILTERS: AdminWorkOrdersFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  sort: 'updatedAt',
  direction: 'desc',
};

export function statusFilterValue(params: { get(name: string): string | null }) {
  const value = params.get('status');
  return value === OPEN_WORK_ORDER_STATUSES ? 'open' : value ?? 'all';
}

export function readAdminWorkOrdersFilters(params: { get(name: string): string | null }): AdminWorkOrdersFilters {
  return {
    search: params.get('search') ?? '',
    status: statusFilterValue(params),
    priority: params.get('priority') ?? 'all',
    sort: params.get('sort') ?? 'updatedAt',
    direction: params.get('direction') ?? 'desc',
  };
}

export function buildAdminWorkOrdersQuery(
  filters: AdminWorkOrdersFilters,
  extras?: { get(name: string): string | null },
) {
  const next = new URLSearchParams();
  const search = normalizeTruckSearch(filters.search);
  if (search) next.set('search', search);
  if (filters.status === 'open') next.set('status', OPEN_WORK_ORDER_STATUSES);
  else if (filters.status !== 'all' && filters.status) next.set('status', filters.status);
  if (filters.priority !== 'all' && filters.priority) next.set('priority', filters.priority);
  if (filters.sort !== 'updatedAt') next.set('sort', filters.sort);
  if (filters.direction !== 'desc') next.set('direction', filters.direction);
  if (extras) {
    for (const key of DASHBOARD_RANGE_KEYS) {
      const value = extras.get(key);
      if (value) next.set(key, value);
    }
  }
  return next;
}

export function hrefWithQuery(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Count of Status/Priority/Sort/Direction/dashboard-range values that are not defaults. Search is excluded. */
export function countActiveAdminWorkOrderFilters(
  filters: AdminWorkOrdersFilters,
  extras?: { has(name: string): boolean },
) {
  let count = 0;
  if (filters.status !== DEFAULT_ADMIN_WORK_ORDER_FILTERS.status) count += 1;
  if (filters.priority !== DEFAULT_ADMIN_WORK_ORDER_FILTERS.priority) count += 1;
  if (filters.sort !== DEFAULT_ADMIN_WORK_ORDER_FILTERS.sort) count += 1;
  if (filters.direction !== DEFAULT_ADMIN_WORK_ORDER_FILTERS.direction) count += 1;
  if (extras && DASHBOARD_RANGE_KEYS.some((key) => extras.has(key))) count += 1;
  return count;
}

function normalizeUnit(value: string) {
  return value.replace(/\s+/g, '').toLocaleLowerCase('en-US');
}

function normalizeWoId(displayId: string) {
  return normalizeUnit(displayId).replace(/^wo-/, '');
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function stripLeadingZeros(value: string) {
  return value.replace(/^0+/, '') || '0';
}

function searchableHaystack(item: WorkOrderSearchFields) {
  return [item.displayId, item.truck.truckNumber, item.category.name, ...item.mechanics.map((mechanic) => mechanic.mechanicName)]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('en-US');
}

export function rankWorkOrderResults<T extends WorkOrderSearchFields>(items: T[], query: string) {
  const term = normalizeTruckSearch(query);
  if (!term) return { results: items, isFallback: false };

  const unitTerm = normalizeUnit(term);
  const woTerm = unitTerm.replace(/^wo-/, '');
  const queryDigits = digitsOnly(woTerm);
  const queryDigitsStripped = queryDigits ? stripLeadingZeros(queryDigits) : '';

  const exact: T[] = [];
  const prefix: T[] = [];
  const rest: T[] = [];

  for (const item of items) {
    const woId = normalizeWoId(item.displayId);
    const woDigits = digitsOnly(woId);
    const woStripped = woDigits ? stripLeadingZeros(woDigits) : '';
    const truck = normalizeUnit(item.truck.truckNumber);

    const woExact = woId === woTerm || (Boolean(queryDigitsStripped) && woStripped === queryDigitsStripped);
    const truckExact = truck === unitTerm;
    const woPrefix = !woExact && (
      woId.startsWith(woTerm)
      || (Boolean(queryDigits) && woDigits.startsWith(queryDigits))
      || (Boolean(queryDigitsStripped) && woStripped.startsWith(queryDigitsStripped))
    );
    const truckPrefix = !truckExact && truck.startsWith(unitTerm);
    const contains = woId.includes(woTerm)
      || truck.includes(unitTerm)
      || (Boolean(queryDigits) && woDigits.includes(queryDigits))
      || searchableHaystack(item).includes(term);

    if (woExact || truckExact) exact.push(item);
    else if (woPrefix || truckPrefix) prefix.push(item);
    else if (contains) rest.push(item);
  }

  const naturalCompare = (left: T, right: T) => {
    const trucks = left.truck.truckNumber.localeCompare(right.truck.truckNumber, undefined, { numeric: true, sensitivity: 'base' });
    return trucks !== 0
      ? trucks
      : left.displayId.localeCompare(right.displayId, undefined, { numeric: true, sensitivity: 'base' });
  };

  exact.sort(naturalCompare);
  prefix.sort(naturalCompare);
  rest.sort(naturalCompare);

  const primary = [...exact, ...prefix];
  if (primary.length) {
    return { results: [...primary, ...rest], isFallback: false };
  }
  return { results: rest, isFallback: rest.length > 0 };
}
