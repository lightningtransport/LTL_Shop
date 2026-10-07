'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import type {
  MechanicClockDto,
  AppCapability,
  CatalogJobDto,
  JobAliasOptionDto,
  JobCategoryDto,
  PmServiceDto,
  RepairHistoryItemDto,
  TruckDto,
  WorkOrderDetailDto,
  WorkOrderSummaryDto,
} from '@ltl-shop/shared';
import { catalogJobsPath, fetchAliasOptions } from './job-catalog';

export type HomeLists = {
  /** Stage MG-1 (MG1): where my clock runs now; absent on older API responses. */
  myClock?: MechanicClockDto | null;
  created: WorkOrderSummaryDto[];
  active: WorkOrderSummaryDto[];
  paused: WorkOrderSummaryDto[];
  completed: WorkOrderSummaryDto[];
};

export type Mechanic = {
  id: string;
  name: string;
  email: string;
  role: string;
  capabilities: AppCapability[];
};

export type RepairHistory = {
  truck: TruckDto;
  items: RepairHistoryItemDto[];
};

export const shopKeys = {
  workOrders: (mode?: 'standard' | 'pm') =>
    `/api/work-orders${mode ? `?mode=${mode}` : ''}`,
  workOrder: (id: string) => `/api/work-orders/${id}`,
  categories: '/api/catalog/categories',
  mechanics: '/api/mechanics',
  trucks: '/api/trucks',
  repairHistory: (truckId: string, categoryId: string) => {
    const query =
      categoryId === 'all'
        ? ''
        : `?categoryId=${encodeURIComponent(categoryId)}`;
    return `/api/trucks/${truckId}/repair-history${query}`;
  },
  pmService: (workOrderId: string) => `/api/work-orders/${workOrderId}/pm`,
  aliases: (categoryId?: string) =>
    `shop:aliases:${categoryId || 'all'}`,
  catalogJobs: (categoryId: string) => catalogJobsPath(categoryId),
};

export function useWorkOrders(enabled: boolean, mode?: 'standard' | 'pm') {
  return useSWR<HomeLists>(enabled ? shopKeys.workOrders(mode) : null, {
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

export function usePmService(workOrderId: string, enabled: boolean) {
  return useSWR<PmServiceDto>(
    enabled && workOrderId ? shopKeys.pmService(workOrderId) : null,
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

export function useTrucks(enabled: boolean) {
  return useSWR<TruckDto[]>(enabled ? shopKeys.trucks : null, {
    dedupingInterval: 5 * 60_000,
    revalidateOnFocus: false,
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
  const response = useSWR<JobAliasOptionDto[]>(
    enabled ? shopKeys.aliases() : null,
    () => fetchAliasOptions(),
    { dedupingInterval: 5 * 60_000, revalidateOnFocus: false },
  );
  const data = useMemo(
    () =>
      categoryId
        ? response.data?.filter((alias) => alias.categoryId === categoryId)
        : response.data,
    [categoryId, response.data],
  );

  return { ...response, data };
}

/** Full in-category catalog list. Omits `q` so Search can filter locally. */
export function useCatalogJobs(categoryId: string, enabled: boolean) {
  return useSWR<CatalogJobDto[]>(
    enabled && categoryId ? shopKeys.catalogJobs(categoryId) : null,
    { dedupingInterval: 5 * 60_000, revalidateOnFocus: false },
  );
}
