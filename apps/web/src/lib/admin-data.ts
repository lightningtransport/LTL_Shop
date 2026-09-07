'use client';

import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import type { AdminDashboardDto, AdminPage, AdminWorkOrderDetailDto, AdminWorkOrderSummaryDto } from '@ltl-shop/shared';

export function useAdminDashboard() {
  return useSWR<AdminDashboardDto>('/api/admin/dashboard', { dedupingInterval: 10_000, refreshInterval: 30_000 });
}

export function useAdminWorkOrders(query: string) {
  return useSWRInfinite<AdminPage<AdminWorkOrderSummaryDto>>(
    (pageIndex, previous) => {
      if (previous && !previous.nextCursor) return null;
      const params = new URLSearchParams(query);
      params.set('limit', '25');
      if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
      return `/api/admin/work-orders?${params.toString()}`;
    },
    { revalidateFirstPage: false, persistSize: false },
  );
}

export function useAdminWorkOrder(id: string) {
  return useSWR<AdminWorkOrderDetailDto>(id ? `/api/admin/work-orders/${id}` : null, { dedupingInterval: 10_000 });
}
