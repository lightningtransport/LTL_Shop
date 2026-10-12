import type { AdminWorkOrderDetailDto } from '@ltl-shop/shared';

/**
 * PF2: every Admin Work Order action (`POST …/assign`, `/complete`, `/pause`, `/time-corrections`, …) answers
 * with the Work Order detail as the API now sees it, the same document `GET /api/admin/work-orders/:id`
 * returns. When the answer is that Work Order, the screen writes it to the cache instead of asking again.
 * Anything else (another Work Order, an older API, an empty body) returns null and the caller refetches.
 */
export function workOrderDetailFromResult(result: unknown, workOrderId: string): AdminWorkOrderDetailDto | null {
  if (!result || typeof result !== 'object') return null;
  const candidate = result as Partial<AdminWorkOrderDetailDto>;
  if (candidate.id !== workOrderId) return null;
  if (typeof candidate.version !== 'number' || !Array.isArray(candidate.jobs) || !candidate.truck || !candidate.status) return null;
  return result as AdminWorkOrderDetailDto;
}
