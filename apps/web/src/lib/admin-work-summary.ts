import { OPEN_WORK_ORDER_STATUSES } from '@ltl-shop/shared';

/**
 * LTR-151 (§8.3): Truck "Current Work" lists only an open Work Order. The Truck detail also carries the
 * completed Work Order that keeps a Truck Ready to Go; that one is not current work.
 */
export function openCurrentWork<T extends { status: string }>(workOrder: T | null | undefined): T | null {
  if (!workOrder) return null;
  return (OPEN_WORK_ORDER_STATUSES as string[]).includes(workOrder.status) ? workOrder : null;
}

/** LTR-151 (§8.10): one wording for an empty mechanics list on every Admin summary. */
export function mechanicNamesLabel(
  mechanics: { mechanicName: string }[],
  copy: { noMechanicsAssigned: string },
): string {
  return mechanics.map((mechanic) => mechanic.mechanicName).join(', ') || copy.noMechanicsAssigned;
}
