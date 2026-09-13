export type TruckSearchFields = {
  truckNumber: string;
  make?: string | null;
  model?: string | null;
  company?: string | null;
};

export type TruckSearchTier = 'exact' | 'prefix' | 'rest';

export function normalizeTruckSearch(query: string) {
  return query.trim().replace(/^#\s*/, '').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function normalizeUnit(value: string) {
  return value.replace(/\s+/g, '').toLocaleLowerCase('en-US');
}

function searchableHaystack(truck: TruckSearchFields) {
  return [truck.truckNumber, truck.make, truck.model, truck.company]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLocaleLowerCase('en-US');
}

export function truckSearchTier(truck: TruckSearchFields, query: string): TruckSearchTier | null {
  const term = normalizeTruckSearch(query);
  if (!term) return null;
  const unitTerm = normalizeUnit(term);
  const unitNumber = normalizeUnit(truck.truckNumber);
  if (unitNumber === unitTerm) return 'exact';
  if (unitNumber.startsWith(unitTerm)) return 'prefix';
  if (unitNumber.includes(unitTerm) || searchableHaystack(truck).includes(term)) return 'rest';
  return null;
}

export function rankTruckSearchResults<T>(
  trucks: T[],
  query: string,
  fields: (item: T) => TruckSearchFields = (item) => item as TruckSearchFields,
): T[] {
  const term = normalizeTruckSearch(query);
  if (!term) return [];

  const exact: T[] = [];
  const prefix: T[] = [];
  const rest: T[] = [];

  for (const truck of trucks) {
    const tier = truckSearchTier(fields(truck), term);
    if (tier === 'exact') exact.push(truck);
    else if (tier === 'prefix') prefix.push(truck);
    else if (tier === 'rest') rest.push(truck);
  }

  const naturalCompare = (left: T, right: T) =>
    fields(left).truckNumber.localeCompare(fields(right).truckNumber, undefined, {
      numeric: true,
      sensitivity: 'base',
    });

  return [...exact.sort(naturalCompare), ...prefix.sort(naturalCompare), ...rest.sort(naturalCompare)];
}
