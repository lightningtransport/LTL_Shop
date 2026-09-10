'use client';

import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import type {
  AdminDashboardDto,
  AdminMechanicDetailDto,
  AdminMechanicSummaryDto,
  AdminPage,
  AdminRepairHistoryDto,
  AdminTruckDetailDto,
  AdminTruckSummaryDto,
  AdminWorkOrderDetailDto,
  AdminWorkOrderSummaryDto,
  ReadinessAssessmentDto,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  YardOperationsPageDto,
} from '@ltl-shop/shared';
import { apiFetch } from './api';

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

export function useAdminMechanics(query: string) {
  return useSWRInfinite<AdminPage<AdminMechanicSummaryDto>>(
    (pageIndex, previous) => {
      if (previous && !previous.nextCursor) return null;
      const params = new URLSearchParams(query);
      params.set('limit', '25');
      if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
      return `/api/admin/mechanics?${params.toString()}`;
    },
    { revalidateFirstPage: false, persistSize: false },
  );
}

export function useAdminMechanic(id: string) {
  return useSWR<AdminMechanicDetailDto>(id ? `/api/admin/mechanics/${id}` : null, { dedupingInterval: 10_000 });
}

export function useAdminHistory(query: string) {
  return useSWRInfinite<AdminPage<AdminWorkOrderSummaryDto>>(
    (pageIndex, previous) => {
      if (previous && !previous.nextCursor) return null;
      const params = new URLSearchParams(query);
      params.set('limit', '25');
      if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
      return `/api/admin/history?${params.toString()}`;
    },
    { revalidateFirstPage: false, persistSize: false },
  );
}

export function useAdminYardOperations(query: string) {
  return useSWRInfinite<YardOperationsPageDto>(
    (pageIndex, previous) => {
      if (previous && !previous.nextCursor) return null;
      const params = new URLSearchParams(query);
      params.set('limit', '25');
      if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
      return `/api/admin/yard-operations?${params.toString()}`;
    },
    { revalidateFirstPage: false, persistSize: false },
  );
}

export function useAdminTruck(id: string) {
  return useSWR<AdminTruckDetailDto>(id ? `/api/admin/trucks/${id}` : null, { dedupingInterval: 10_000 });
}

export function useAdminTrucks(query: string) {
  return useSWRInfinite<AdminPage<AdminTruckSummaryDto>>(
    (pageIndex, previous) => {
      if (previous && !previous.nextCursor) return null;
      const params = new URLSearchParams(query);
      params.set('limit', '25');
      if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
      return `/api/admin/trucks?${params.toString()}`;
    },
    { revalidateFirstPage: false, persistSize: false },
  );
}

export function adminMutationIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

export function addAdminWorkOrderMechanic(
  workOrderId: string,
  input: { mechanicId: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/mechanics`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function removeAdminWorkOrderMechanic(
  workOrderId: string,
  mechanicId: string,
  expectedVersion: number,
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/mechanics/${mechanicId}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedVersion, idempotencyKey }),
  });
}

export function cancelAdminWorkOrder(
  workOrderId: string,
  input: { reason: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function startAdminTruckAssessment(truckId: string, idempotencyKey = adminMutationIdempotencyKey()) {
  return apiFetch<{ assessment: ReadinessAssessmentDto; linkedWorkOrderId: string | null }>(`/api/admin/trucks/${truckId}/readiness-assessments`, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey }),
  });
}

export function updateAdminTruckRequirement(
  assessmentId: string,
  type: ReadinessRequirementType,
  input: { outcome: ReadinessRequirementOutcome; expectedVersion: number; waiverReason?: string; evidenceWorkOrderId?: string },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<{ assessment: ReadinessAssessmentDto }>(`/api/admin/readiness-assessments/${assessmentId}/requirements/${type}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function markAdminTruckReady(assessmentId: string, expectedVersion: number, idempotencyKey = adminMutationIdempotencyKey()) {
  return apiFetch<{ assessment: ReadinessAssessmentDto }>(`/api/admin/readiness-assessments/${assessmentId}/mark-ready`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion, idempotencyKey }),
  });
}

export function closeAdminTruckAssessment(assessmentId: string, expectedVersion: number, reason: string, idempotencyKey = adminMutationIdempotencyKey()) {
  return apiFetch<{ assessment: ReadinessAssessmentDto }>(`/api/admin/readiness-assessments/${assessmentId}/close`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion, reason, idempotencyKey }),
  });
}

export function useAdminRepairHistory(truckId: string, excludeWorkOrderId: string, categoryId?: string) {
  return useSWRInfinite<AdminRepairHistoryDto>(
    (pageIndex, previous) => {
      if (!truckId || (previous && !previous.nextCursor)) return null;
      const params = new URLSearchParams({ limit: '5' });
      if (excludeWorkOrderId) params.set('excludeWorkOrderId', excludeWorkOrderId);
      if (categoryId) params.set('categoryId', categoryId);
      if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
      return `/api/admin/trucks/${truckId}/repair-history?${params.toString()}`;
    },
    { revalidateFirstPage: false, persistSize: false },
  );
}
