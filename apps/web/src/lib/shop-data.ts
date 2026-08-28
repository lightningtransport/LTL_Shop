'use client';

import useSWR from 'swr';
import type {
  JobAliasOptionDto,
  JobCategoryDto,
  RepairHistoryItemDto,
  TruckDto,
  WorkOrderDetailDto,
  WorkOrderSummaryDto,
} from '@ltl-shop/shared';
import { fetchAliasOptions } from './job-catalog';

export type HomeLists = {
  created: WorkOrderSummaryDto[];
  active: WorkOrderSummaryDto[];
  paused: WorkOrderSummaryDto[];
};

export type Mechanic = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type RepairHistory = {
  truck: TruckDto;
  items: RepairHistoryItemDto[];
};

export const shopKeys = {
  workOrders: '/api/work-orders',
  workOrder: (id: string) => `/api/work-orders/${id}`,
  categories: '/api/catalog/categories',
  mechanics: '/api/mechanics',
  repairHistory: (truckId: string, categoryId: string) => {
    const query =
      categoryId === 'all'
        ? ''
        : `?categoryId=${encodeURIComponent(categoryId)}`;
    return `/api/trucks/${truckId}/repair-history${query}`;
  },
  aliases: (categoryId?: string) =>
    `shop:aliases:${categoryId || 'all'}`,
};

export function useWorkOrders(enabled: boolean) {
  return useSWR<HomeLists>(enabled ? shopKeys.workOrders : null, {
    dedupingInterval: 10_000,
    refreshInterval: 30_000,
  });
}

export function useWorkOrder(id: string, enabled: boolean) {
  return useSWR<WorkOrderDetailDto>(
    enabled && id ? shopKeys.workOrder(id) : null,
    { dedupingInterval: 5_000, refreshInterval: 15_000 },
  );
}

export function useCategories(enabled: boolean) {
  return useSWR<JobCategoryDto[]>(enabled ? shopKeys.categories : null, {
    dedupingInterval: 5 * 60_000,
    revalidateOnFocus: false,
  });
}

export function useMechanics(enabled: boolean) {
  return useSWR<Mechanic[]>(enabled ? shopKeys.mechanics : null, {
    dedupingInterval: 60_000,
  });
}

export function useRepairHistory(
  truckId: string,
  categoryId: string,
  enabled: boolean,
) {
  return useSWR<RepairHistory>(
    enabled && truckId ? shopKeys.repairHistory(truckId, categoryId) : null,
    { dedupingInterval: 30_000 },
  );
}

export function useAliasOptions(categoryId: string, enabled: boolean) {
  return useSWR<JobAliasOptionDto[]>(
    enabled ? shopKeys.aliases(categoryId) : null,
    () => fetchAliasOptions(categoryId || undefined),
    { dedupingInterval: 5 * 60_000, revalidateOnFocus: false },
  );
}
