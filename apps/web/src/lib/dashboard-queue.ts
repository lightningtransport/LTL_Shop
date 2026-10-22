import type { AdminWorkOrderSummaryDto, YardSamsaraPlacesDto, YardSamsaraTruckDto } from '@ltl-shop/shared';

/**
 * Stage 3 (D1, UX-5-002, D26): the Dashboard answers "what do I do now?". Every open Work Order and
 * every Truck still Ready to Go comes with its Next step; the queue groups them by the action the
 * Manager takes, in this order. Plain work in progress (`work`) waits on mechanics, not on the
 * Manager, so it is not in the queue.
 */
export const DASHBOARD_GROUPS = ['blocked', 'close', 'cancel', 'return_to_service', 'assign', 'inspect', 'missing_steps', 'qc', 'external'] as const;
export type DashboardGroup = (typeof DASHBOARD_GROUPS)[number];

/** The four counters on top: they filter the queue to their group. */
export const DASHBOARD_COUNTERS = ['blocked', 'close', 'return_to_service', 'assign'] as const;
export type DashboardCounter = (typeof DASHBOARD_COUNTERS)[number];

export function dashboardGroupOf(item: Pick<AdminWorkOrderSummaryDto, 'nextStep'>): DashboardGroup | null {
  switch (item.nextStep?.kind) {
    case 'resolve_blocker':
    case 'resume':
      return 'blocked';
    case 'close': return 'close';
    // D55 R15: nothing was done; the Manager cancels the visit (no counter counts it).
    case 'cancel_work_order': return 'cancel';
    case 'return_to_service': return 'return_to_service';
    case 'assign': return 'assign';
    case 'inspect': return 'inspect';
    case 'add_missing_steps': return 'missing_steps';
    case 'qc': return 'qc';
    case 'external': return 'external';
    default: return null;
  }
}

/**
 * LTR-277 §1: a counter puts its group first and hides only the other three counters. What no counter counts
 * (inspection, missing steps, QC, outside) still waits on the Manager and stays.
 */
export function groupDashboardQueue<T extends Pick<AdminWorkOrderSummaryDto, 'nextStep'>>(items: T[], only: DashboardCounter | null = null) {
  const counters: readonly DashboardGroup[] = DASHBOARD_COUNTERS;
  const order = only ? [only, ...DASHBOARD_GROUPS.filter((group) => !counters.includes(group))] : DASHBOARD_GROUPS;
  return order
    .map((group) => ({ group, items: firstWhatLeftTheYard(items.filter((item) => dashboardGroupOf(item) === group)) }))
    .filter((entry) => entry.items.length > 0);
}

/** D52 (LTR-260): a Ready to Go truck Samsara saw leave the yard (or come back) goes first in Return to Service. */
function firstWhatLeftTheYard<T extends Pick<AdminWorkOrderSummaryDto, 'nextStep'>>(items: T[]): T[] {
  const moved = items.filter((item) => item.nextStep?.yardMove);
  return moved.length ? [...moved, ...items.filter((item) => !item.nextStep?.yardMove)] : items;
}

/**
 * "Blocked" means the same as on the Yard (D5): an official pause or an active mechanic blocker on an
 * open Work Order, even when another step comes first.
 */
export function dashboardCounts(items: AdminWorkOrderSummaryDto[]): Record<DashboardCounter, number> {
  const open = items.filter((item) => item.status !== 'completed' && item.status !== 'cancelled');
  return {
    blocked: open.filter((item) => item.currentPause || item.latestReportedBlocker).length,
    close: items.filter((item) => dashboardGroupOf(item) === 'close').length,
    return_to_service: items.filter((item) => dashboardGroupOf(item) === 'return_to_service').length,
    assign: items.filter((item) => dashboardGroupOf(item) === 'assign').length,
  };
}

/** LTR-261: how many arrivals the Dashboard lists; the rest open in Trucks › In yard without a Work Order. */
export const DASHBOARD_ARRIVED_LIMIT = 5;

/**
 * LTR-261: the trucks Samsara sees in our yard with no open Work Order (D49, the same list as the Yard counter "In yard
 * without a Work Order"). Last to arrive first: a truck that just came in is the one nobody has looked at yet.
 */
export function arrivedNeedsWorkOrder(places: YardSamsaraPlacesDto | null | undefined): YardSamsaraTruckDto[] {
  return [...(places?.inYard ?? [])]
    .filter((truck) => !truck.openWorkOrder)
    .sort((left, right) => (right.inYardSince ?? '').localeCompare(left.inYardSince ?? '') || left.truckNumber.localeCompare(right.truckNumber, 'en', { numeric: true }));
}

/** YYYY-MM-DD of `date` in the shop's time zone (Eastern, D20). */
export function shopDay(date: Date, timeZone = 'America/New_York') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** The next working day of the shop (Monday–Friday, D20) after a YYYY-MM-DD day. */
export function nextShopDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  do date.setUTCDate(date.getUTCDate() + 1); while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

export type LeavingSoon = { item: AdminWorkOrderSummaryDto; outDate: string };

/**
 * UX-5-004: the Dispatch departures crossed with the shop — open Work Orders whose Truck Dispatch
 * expects to leave today or on the next working day. Ready to Go Trucks are not "not ready".
 */
export function leavingSoonNotReady(
  items: AdminWorkOrderSummaryDto[],
  departures: Array<{ truckNumber: string; outDate: string | null }>,
  today: string,
): LeavingSoon[] {
  const until = nextShopDay(today);
  const departing = new Map<string, string>();
  for (const departure of departures) {
    const day = departure.outDate?.slice(0, 10);
    if (!day || day < today || day > until) continue;
    const known = departing.get(departure.truckNumber);
    if (!known || day < known) departing.set(departure.truckNumber, day);
  }
  return items
    .filter((item) => item.status !== 'completed' && item.status !== 'cancelled' && departing.has(item.truck.truckNumber))
    .map((item) => ({ item, outDate: departing.get(item.truck.truckNumber)! }))
    .sort((left, right) => left.outDate.localeCompare(right.outDate));
}
