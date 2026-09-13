export type TruckSearchFields = {
  truckNumber: string;
  make?: string | null;
  model?: string | null;
  company?: string | null;
};

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

export function rankTruckResults<T extends TruckSearchFields>(trucks: T[], query: string) {
  const term = normalizeTruckSearch(query);
  if (!term) return { results: [] as T[], isFallback: false };

  const unitTerm = normalizeUnit(term);
  const naturalCompare = (left: T, right: T) =>
    left.truckNumber.localeCompare(right.truckNumber, undefined, { numeric: true, sensitivity: 'base' });

  const exact: T[] = [];
  const prefix: T[] = [];
  const rest: T[] = [];

  for (const truck of trucks) {
    const unitNumber = normalizeUnit(truck.truckNumber);
    if (unitNumber === unitTerm) exact.push(truck);
    else if (unitNumber.startsWith(unitTerm)) prefix.push(truck);
    else if (unitNumber.includes(unitTerm) || searchableHaystack(truck).includes(term)) rest.push(truck);
  }

  exact.sort(naturalCompare);
  prefix.sort(naturalCompare);
  rest.sort(naturalCompare);

  const primary = [...exact, ...prefix];
  if (primary.length) {
    return { results: [...primary, ...rest].slice(0, 20), isFallback: false };
  }
  return { results: rest.slice(0, 20), isFallback: rest.length > 0 };
}
