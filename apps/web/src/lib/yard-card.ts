/** Work Order age for a compact card: "5h" or "3d". */
export function compactAge(fromIso: string, now = Date.now()) {
  const hours = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 3_600_000));
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/** LTR-103: group reported work locations so 50+ rows read as a few lines. */
export function groupWorkLocations(items: { truckNumber: string; location: string | null }[], unknownLabel: string) {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = item.location?.trim() || unknownLabel;
    groups.set(key, [...(groups.get(key) ?? []), item.truckNumber]);
  }
  return [...groups.entries()]
    .map(([location, trucks]) => ({ location, trucks }))
    .sort((left, right) => right.trucks.length - left.trucks.length || left.location.localeCompare(right.location));
}

export function matchesTruckSearch(truckNumber: string, search: string) {
  const term = search.trim().toLowerCase();
  return !term || truckNumber.toLowerCase().includes(term);
}

export function fillYardText(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export interface YardDispatchSignal {
  /** Next expected arrival reported by Dispatch (YYYY-MM-DD). */
  expectedIn?: string;
  /** Next departure reported by Dispatch (YYYY-MM-DD). */
  departs?: string;
}

/**
 * LTR-120: Dispatch movement is an external source. The Shop board only shows
 * it as a signal on the Truck card ("expected in 28 Sep"), never as a phase.
 */
export function dispatchSignalsByTruck(boundary?: {
  incomingTrucks: { status: string; items: { truckNumber: string; returnDate: string | null }[] };
  upcomingDepartures: { status: string; items: { truckNumber: string; outDate: string | null }[] };
}) {
  const signals = new Map<string, YardDispatchSignal>();
  if (!boundary) return signals;
  const earliest = (current: string | undefined, next: string) => (!current || next < current ? next : current);
  if (boundary.incomingTrucks.status === 'ok') {
    for (const item of boundary.incomingTrucks.items) {
      if (!item.returnDate) continue;
      const signal = signals.get(item.truckNumber) ?? {};
      signals.set(item.truckNumber, { ...signal, expectedIn: earliest(signal.expectedIn, item.returnDate) });
    }
  }
  if (boundary.upcomingDepartures.status === 'ok') {
    for (const item of boundary.upcomingDepartures.items) {
      if (!item.outDate) continue;
      const signal = signals.get(item.truckNumber) ?? {};
      signals.set(item.truckNumber, { ...signal, departs: earliest(signal.departs, item.outDate) });
    }
  }
  return signals;
}
