import type { AdminPage, AdminWorkOrderDetailDto, AdminWorkOrderSummaryDto } from '@ltl-shop/shared';
import { isAdminWorkOrdersListKey } from './swr-cache-keys';

export const WORK_ORDER_LIST_REVALIDATE = {
  revalidate: true,
  populateCache: false,
} as const;

export function toAdminWorkOrderSummary(detail: AdminWorkOrderDetailDto): AdminWorkOrderSummaryDto {
  return {
    id: detail.id,
    displayId: detail.displayId,
    truck: {
      id: detail.truck.id,
      truckNumber: detail.truck.truckNumber,
      make: detail.truck.make,
      model: detail.truck.model,
      year: detail.truck.year,
    },
    category: detail.category,
    status: detail.status,
    priority: detail.priority,
    jobsCompleted: detail.jobsCompleted,
    jobsTotal: detail.jobsTotal,
    mechanics: detail.mechanics,
    currentPause: detail.currentPause,
    latestReportedBlocker: detail.latestReportedBlocker,
    createdAt: detail.createdAt,
    startedAt: detail.startedAt,
    completedAt: detail.completedAt,
    updatedAt: detail.updatedAt,
  };
}

export function prependAdminWorkOrderPage(
  pages: AdminPage<AdminWorkOrderSummaryDto>[] | undefined,
  created: AdminWorkOrderDetailDto,
): AdminPage<AdminWorkOrderSummaryDto>[] | undefined {
  if (!pages) return pages;
  const summary = toAdminWorkOrderSummary(created);
  const [first, ...rest] = pages;
  if (!first) return [{ items: [summary], nextCursor: null }];
  if (first.items.some((item) => item.id === created.id)) return pages;
  return [{ ...first, items: [summary, ...first.items] }, ...rest];
}

export function writeCreatedWorkOrderToListCache(
  key: unknown,
  current: unknown,
  created: AdminWorkOrderDetailDto,
) {
  if (!isAdminWorkOrdersListKey(key) || !Array.isArray(current)) return current;
  return prependAdminWorkOrderPage(current as AdminPage<AdminWorkOrderSummaryDto>[], created);
}
