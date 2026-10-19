import { fillPlaceholders } from './admin-next-step';
import { OPEN_WORK_ORDER_STATUSES, type TruckNextStepDto } from '@ltl-shop/shared';
import type { AdminMessages } from './admin-messages';
import { truckNextStepText } from './truck-next-step';

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

/**
 * LTR-157: lists and cards say what is next instead of the Category
 * ("5 Jobs · Next: PM A Service"). Older API responses fall back to the Category.
 */
export function workOrderNextJobLine(
  item: { category: { name: string }; jobsTotal: number; jobsCompleted: number; nextJobName?: string | null },
  messages: { workOrderJobsNext: string; workOrderJobsAllDone: string },
): string {
  if (item.category.name === 'PM' || item.nextJobName === undefined) return item.category.name;
  if (item.nextJobName) {
    return fillPlaceholders(messages.workOrderJobsNext, { count: String(item.jobsTotal), job: item.nextJobName });
  }
  return item.jobsTotal > 0 ? fillPlaceholders(messages.workOrderJobsAllDone, { count: String(item.jobsTotal) }) : item.category.name;
}

/**
 * DM1 (LTR-204): the "Next" cell of the Work Orders table says the same next step as the Truck, the Trucks list
 * and the Yard (the API's `nextStep`, worded by `truckNextStepText`); a Ready to Go truck reads "Return to
 * Service", not "4 Jobs · all done". Without a step (older API responses) it keeps the Jobs line.
 */
export function workOrderListNextText(
  item: { category: { name: string }; jobsTotal: number; jobsCompleted: number; nextJobName?: string | null; nextStep?: TruckNextStepDto | null },
  messages: AdminMessages,
): string {
  return truckNextStepText(item.nextStep, messages) ?? workOrderNextJobLine(item, messages);
}

