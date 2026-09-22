import { WorkOrderStatus } from '@ltl-shop/shared';

/** Official pause matches the API rule: only in-progress Work Orders can be paused. */
export function canOfficiallyPauseWorkOrder(status: string): boolean {
  return status === WorkOrderStatus.IN_PROGRESS;
}
