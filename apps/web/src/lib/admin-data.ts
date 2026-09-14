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
  RecordWorkPlanInspectionInput,
  AdminCatalogCategoryDetailDto,
  AdminCatalogCategorySummaryDto,
  YardOperationsPageDto,
  WorkOrderDetailDto,
  TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { apiFetch } from './api';
import type { WorkPlanJobDraft } from './work-plan';

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

export function useAdminCatalogCategories() {
  return useSWR<AdminCatalogCategorySummaryDto[]>('/api/admin/catalog/categories', { dedupingInterval: 30_000 });
}

export function useAdminCatalogCategory(id: string) {
  return useSWR<AdminCatalogCategoryDetailDto>(id ? `/api/admin/catalog/categories/${id}` : null, { dedupingInterval: 30_000 });
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

export interface CreateAdminWorkOrderInput {
  truckId: string;
  primaryCategoryId: string;
  priority?: string;
  notes?: string;
  mechanicIds?: string[];
  jobs: Array<{
    catalogJobId?: string;
    categoryId: string;
    displayName: string;
    customDescription?: string;
    assignedMechanicId?: string;
  }>;
}

// Manager-first ownership: create a Work Order via the admin surface. The API
// enforces work_orders.manage, the truck advisory lock, idempotency, and the
// one-open-WO-per-Truck rule. Callers should revalidate the admin WO list after.
export function createAdminWorkOrder(
  input: CreateAdminWorkOrderInput,
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<WorkOrderDetailDto>('/api/admin/work-orders', {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
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

export function assignAdminWorkOrderJob(
  workOrderId: string,
  jobId: string,
  input: { mechanicId: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/jobs/${jobId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function unassignAdminWorkOrderJob(
  workOrderId: string,
  jobId: string,
  expectedVersion: number,
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/jobs/${jobId}/unassign`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion, idempotencyKey }),
  });
}

export function addAdminWorkOrderJob(
  workOrderId: string,
  input: {
    catalogJobId?: string;
    categoryId: string;
    displayName: string;
    customDescription?: string;
    expectedVersion: number;
  },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/jobs`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function pauseAdminWorkOrder(
  workOrderId: string,
  input: { reason: string; notes?: string },
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/pause`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function resumeAdminWorkOrder(workOrderId: string) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/resume`, {
    method: 'POST',
    body: JSON.stringify({}),
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

export function completeAdminWorkOrder(
  workOrderId: string,
  expectedVersion: number,
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion, idempotencyKey }),
  });
}

export function reopenAdminWorkOrder(
  workOrderId: string,
  input: { reason: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function returnAdminWorkOrderToService(
  workOrderId: string,
  input: { reason: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/return-to-service`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function patchAdminWorkOrder(
  workOrderId: string,
  input: { expectedVersion: number; priority?: AdminWorkOrderDetailDto['priority']; notes?: string | null },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function correctAdminTime(
  input: {
    workOrderId: string;
    targetType: 'work_session' | 'pause_event';
    targetId: string;
    expectedVersion: number;
    reason: string;
    startedAt?: string;
    endedAt?: string;
  },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>('/api/admin/time-corrections', {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function cancelAdminJob(
  jobId: string,
  input: { reason: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/jobs/${jobId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

export function reopenAdminJob(
  jobId: string,
  input: { reason: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/jobs/${jobId}/reopen`, {
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

export function recordAdminWorkPlanInspection(
  truckId: string,
  outcome: RecordWorkPlanInspectionInput['outcome'],
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<TruckWorkPlanDto>(`/api/admin/trucks/${truckId}/work-plan/inspection`, {
    method: 'POST',
    body: JSON.stringify({ outcome, idempotencyKey }),
  });
}

export function addAdminWorkPlanJobs(
  truckId: string,
  input: {
    jobs: Array<Pick<WorkPlanJobDraft, 'catalogJobId' | 'categoryId' | 'displayName' | 'customDescription'>>;
    expectedVersion?: number;
  },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<TruckWorkPlanDto>(`/api/admin/trucks/${truckId}/work-plan/jobs`, {
    method: 'POST',
    body: JSON.stringify({
      idempotencyKey,
      jobs: input.jobs,
      ...(input.expectedVersion === undefined ? {} : { expectedVersion: input.expectedVersion }),
    }),
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
