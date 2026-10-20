import { truckPlace, type YardDispatchShopTruckDto } from '@ltl-shop/shared';
import { fillPlaceholders } from './admin-next-step';
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

/** Same rules as `fillPlaceholders`, including `{count:one|many}` plurals. */
export function fillYardText(template: string, values: Record<string, string>) {
  return fillPlaceholders(template, values);
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

/**
 * Stage 6 (UX-4-005): the one alert line of a Yard card, the most urgent first — blocked (a mechanic
 * blocker), paused (official pause), out of the shop (D24), leaving soon with work left (Dispatch,
 * today or the next shop day), nobody on a Job. Null when nothing needs the Manager's eye.
 */
export type YardCardAlert =
  | { kind: 'blocked'; reason: string }
  | { kind: 'paused'; reason: string | null }
  | { kind: 'out_of_shop' }
  | { kind: 'leaves'; date: string; jobsLeft: number }
  | { kind: 'nobody'; job: string };

export function yardCardAlert(
  item: {
    outOfShop?: boolean;
    nextStep?: { kind: string; jobName?: string } | null;
    activeWorkOrder: {
      status: string;
      jobsCompleted: number;
      jobsTotal: number;
      currentPause?: { reason: string } | null;
      latestReportedBlocker?: { reason: string; blockerReason?: string | null } | null;
    } | null;
  },
  dispatch: YardDispatchSignal | undefined,
  soonUntil: string | null,
): YardCardAlert | null {
  const workOrder = item.activeWorkOrder;
  if (workOrder?.latestReportedBlocker) {
    return { kind: 'blocked', reason: workOrder.latestReportedBlocker.blockerReason ?? workOrder.latestReportedBlocker.reason };
  }
  if (workOrder?.status === 'waiting_paused') return { kind: 'paused', reason: workOrder.currentPause?.reason ?? null };
  if (item.outOfShop) return { kind: 'out_of_shop' };
  const open = workOrder && workOrder.status !== 'completed' && workOrder.status !== 'cancelled';
  if (open && dispatch?.departs && soonUntil && dispatch.departs.slice(0, 10) <= soonUntil) {
    return { kind: 'leaves', date: dispatch.departs, jobsLeft: Math.max(0, workOrder.jobsTotal - workOrder.jobsCompleted) };
  }
  if (item.nextStep?.kind === 'assign' && item.nextStep.jobName) return { kind: 'nobody', job: item.nextStep.jobName };
  return null;
}

/** D50: what a Dispatch row says about the truck (D49 place), and whether it already arrived (Incoming) or left (Departures). */
export type DispatchRowPlace = 'missing' | 'ready_to_go' | 'in_shop' | 'in_yard' | 'outside' | 'no_gps';

export function dispatchRowPlace(
  truck: Pick<YardDispatchShopTruckDto, 'readyToGo' | 'openWorkOrder' | 'samsara'> | undefined,
  list: 'incoming' | 'departures',
  day: string | null,
  today: string | null,
): { place: DispatchRowPlace; done: boolean } {
  if (!truck) return { place: 'missing', done: false };
  const yard = truckPlace(truck.samsara, Boolean(truck.openWorkOrder));
  const place: DispatchRowPlace = truck.readyToGo ? 'ready_to_go' : yard ?? (truck.samsara?.locationAt ? 'outside' : 'no_gps');
  // Arrived: Samsara already sees it in our yard. Left: its day came and Samsara sees it outside.
  const done = list === 'incoming'
    ? yard !== null
    : yard === null && Boolean(truck.samsara?.locationAt) && Boolean(day && today && day <= today);
  return { place, done };
}

/** D50: the rows still to happen first; arrived or left at the end, each group in the API order. */
export function orderDispatchRows<T extends { done: boolean }>(rows: T[]): T[] {
  return [...rows.filter((row) => !row.done), ...rows.filter((row) => row.done)];
}
