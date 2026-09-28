'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import type {
  ShopWorkflowStepDto,
  AdminCatalogJobWriteDto,
  AdminDashboardDto,
  AdminMechanicDetailDto,
  AdminMechanicSummaryDto,
  AdminPage,
  AdminRepairHistoryDto,
  AdminTruckDetailDto,
  AdminTruckSummaryDto,
  AdminWorkOrderDetailDto,
  AdminWorkOrderSummaryDto,
  RecordWorkPlanInspectionInput,
  CatalogStatus,
  MechanicMode,
  UserDto,
  AdminCatalogCategoryDetailDto,
  AdminCatalogCategorySummaryDto,
  YardDataBoundaryDto,
  YardOperationsPageDto,
  TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { ADMIN_YARD_DATA_BOUNDARY_PATH } from './yard-data-boundary';
import { ADMIN_READ_TIMEOUT_MS, apiFetch, isTransientApiError } from './api';
import { useAuth } from './auth-context';
import type { WorkPlanJobDraft } from './work-plan';

export function adminReadFetcher<T>(path: string) {
  return apiFetch<T>(path, { timeoutMs: ADMIN_READ_TIMEOUT_MS });
}

const adminReadRetry = {
  errorRetryCount: 1,
  errorRetryInterval: 400,
  shouldRetryOnError: isTransientApiError,
} as const;

const adminInfiniteOptions = {
  revalidateFirstPage: true,
  persistSize: false,
  revalidateOnMount: true,
  dedupingInterval: 1_000,
  ...adminReadRetry,
} as const;

const adminWorkOrderListOptions = {
  ...adminInfiniteOptions,
  refreshInterval: 15_000,
} as const;

export function withAdminReadPending<T extends { isLoading: boolean; isValidating: boolean; data: unknown }>(
  token: string | null,
  swr: T,
): T {
  return {
    ...swr,
    isLoading: !token || swr.isLoading || (swr.isValidating && swr.data === undefined),
  };
}

export function useAdminDashboard() {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminDashboardDto>(token ? '/api/admin/dashboard' : null, adminReadFetcher, {
      dedupingInterval: 10_000,
      refreshInterval: 30_000,
      ...adminReadRetry,
    }),
  );
}

export function useAdminWorkOrders(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWRInfinite<AdminPage<AdminWorkOrderSummaryDto>>(
      (pageIndex, previous) => {
        if (!token || (previous && !previous.nextCursor)) return null;
        const params = new URLSearchParams(query);
        params.set('limit', '25');
        if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
        return `/api/admin/work-orders?${params.toString()}`;
      },
      adminReadFetcher,
      adminWorkOrderListOptions,
    ),
  );
}

export function useAdminWorkOrder(id: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminWorkOrderDetailDto>(token && id ? `/api/admin/work-orders/${id}` : null, adminReadFetcher, {
      dedupingInterval: 2_000,
      refreshInterval: 15_000,
      ...adminReadRetry,
    }),
  );
}

export function adminMechanicsPageKey(
  token: string | null,
  query: string,
  limit: number,
  pageIndex: number,
  previous: AdminPage<AdminMechanicSummaryDto> | null,
) {
  if (!token || (previous && !previous.nextCursor)) return null;
  const params = new URLSearchParams(query);
  params.set('limit', String(limit));
  if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
  return `/api/admin/mechanics?${params.toString()}`;
}

/** True when every requested page has loaded and the last one says more exist. */
export function hasUnloadedAdminPage<T>(pages: AdminPage<T>[] | undefined, size: number) {
  return Boolean(pages && pages.length === size && pages[pages.length - 1]?.nextCursor);
}

export function useAdminMechanics(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWRInfinite<AdminPage<AdminMechanicSummaryDto>>(
      (pageIndex, previous) => adminMechanicsPageKey(token, query, 25, pageIndex, previous),
      adminReadFetcher,
      adminInfiniteOptions,
    ),
  );
}

/**
 * LTR-151: the full roster for assignment pickers. Excludes System Admin accounts server-side and
 * follows the cursor until the last page, so a Shop with more than one page of mechanics is complete.
 */
export function useAdminAssignableMechanics() {
  const { token } = useAuth();
  const swr = withAdminReadPending(
    token,
    useSWRInfinite<AdminPage<AdminMechanicSummaryDto>>(
      (pageIndex, previous) => adminMechanicsPageKey(token, 'assignable=true', 100, pageIndex, previous),
      adminReadFetcher,
      adminInfiniteOptions,
    ),
  );
  const { data, size, setSize } = swr;
  useEffect(() => {
    if (hasUnloadedAdminPage(data, size)) void setSize(size + 1);
  }, [data, size, setSize]);
  return swr;
}

export function useAdminMechanic(id: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminMechanicDetailDto>(token && id ? `/api/admin/mechanics/${id}` : null, adminReadFetcher, {
      dedupingInterval: 10_000,
      ...adminReadRetry,
    }),
  );
}

export function useAdminHistory(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWRInfinite<AdminPage<AdminWorkOrderSummaryDto>>(
      (pageIndex, previous) => {
        if (!token || (previous && !previous.nextCursor)) return null;
        const params = new URLSearchParams(query);
        params.set('limit', '25');
        if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
        return `/api/admin/history?${params.toString()}`;
      },
      adminReadFetcher,
      adminInfiniteOptions,
    ),
  );
}

export function useAdminYardOperations(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWRInfinite<YardOperationsPageDto>(
      (pageIndex, previous) => {
        if (!token || (previous && !previous.nextCursor)) return null;
        const params = new URLSearchParams(query);
        params.set('limit', '25');
        if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
        return `/api/admin/yard-operations?${params.toString()}`;
      },
      adminReadFetcher,
      adminInfiniteOptions,
    ),
  );
}

export function useAdminYardDataBoundary() {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<YardDataBoundaryDto>(token ? ADMIN_YARD_DATA_BOUNDARY_PATH : null, adminReadFetcher, {
      dedupingInterval: 10_000,
      refreshInterval: 30_000,
      ...adminReadRetry,
    }),
  );
}

export function useAdminTruck(id: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminTruckDetailDto>(token && id ? `/api/admin/trucks/${id}` : null, adminReadFetcher, {
      dedupingInterval: 10_000,
      ...adminReadRetry,
    }),
  );
}

export function useAdminCatalogCategories() {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminCatalogCategorySummaryDto[]>(token ? '/api/admin/catalog/categories' : null, adminReadFetcher, {
      dedupingInterval: 30_000,
      ...adminReadRetry,
    }),
  );
}

export function useAdminCatalogCategory(id: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminCatalogCategoryDetailDto>(
      token && id ? `/api/admin/catalog/categories/${id}` : null,
      adminReadFetcher,
      { dedupingInterval: 30_000, ...adminReadRetry },
    ),
  );
}

export function useAdminTrucks(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWRInfinite<AdminPage<AdminTruckSummaryDto>>(
      (pageIndex, previous) => {
        if (!token || (previous && !previous.nextCursor)) return null;
        const params = new URLSearchParams(query);
        params.set('limit', '25');
        if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
        return `/api/admin/trucks?${params.toString()}`;
      },
      adminReadFetcher,
      adminInfiniteOptions,
    ),
  );
}

export function adminMutationIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

export interface CreateAdminWorkOrderInput {
  truckId: string;
  /** LTR-157 / D13: derived by the API when omitted. */
  primaryCategoryId?: string;
  priority?: string;
  notes?: string;
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
// one-open-WO-per-Truck rule. Callers revalidate WO-related list keys after create.
export function createAdminWorkOrder(
  input: CreateAdminWorkOrderInput,
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>('/api/admin/work-orders', {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

/** LTR-145: switch the PM job between PM Category catalog jobs (PM A ↔ PM B). */
export function changeAdminPmService(
  workOrderId: string,
  jobId: string,
  input: { catalogJobId: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/jobs/${jobId}/pm-service`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
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

/** LTR-98: Manager resolves a mechanic-reported blocker. */
/** LTR-155 / D17: only the Manager resolves, with an optional note for the mechanic. */
export function resolveAdminBlocker(workOrderId: string, blockerId: string, notes?: string) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/blockers/${blockerId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(notes ? { notes } : {}),
  });
}

// LTR-126: append-only notes; the Manager never overwrites a mechanic note.
export function addAdminWorkOrderNote(workOrderId: string, body: string) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ kind: 'note', body }),
  });
}

export function handleAdminWorkRequest(workOrderId: string, noteId: string) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/notes/${noteId}/handle`, {
    method: 'POST',
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
  input: { reason?: string; expectedVersion: number },
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

export function completeAdminJob(
  jobId: string,
  input: { expectedVersion: number; notes?: string },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/jobs/${jobId}/complete`, {
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

export function fetchAdminTruckWorkPlan(truckId: string) {
  return apiFetch<TruckWorkPlanDto>(`/api/admin/trucks/${truckId}/work-plan`);
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

/**
 * System Admin writes from main abbc0ff (`SystemAdminGuard`: role admin plus
 * admin.access). Shop Manager is 403. Live once API prod is READY.
 * No idempotency key on these bodies.
 *
 * POST /api/admin/mechanics { email, name, mode: 'standard' | 'pm' } → UserDto
 * PATCH /api/admin/mechanics/:id { name?, mode?, active? } → UserDto
 * POST /api/admin/catalog/jobs { categoryId, displayName, status? } → job + categoryId
 * PATCH /api/admin/catalog/jobs/:id { displayName?, status? } → same job id
 */
export const ADMIN_CATALOG_JOBS_PATH = '/api/admin/catalog/jobs';
export const ADMIN_MECHANICS_COLLECTION_PATH = '/api/admin/mechanics';

export function createAdminCatalogJob(input: { categoryId: string; displayName: string }) {
  return apiFetch<AdminCatalogJobWriteDto>(ADMIN_CATALOG_JOBS_PATH, {
    method: 'POST',
    body: JSON.stringify({
      categoryId: input.categoryId,
      displayName: input.displayName.trim(),
    }),
  });
}

export function updateAdminCatalogJob(
  jobId: string,
  input: { displayName?: string; status?: CatalogStatus },
) {
  return apiFetch<AdminCatalogJobWriteDto>(`${ADMIN_CATALOG_JOBS_PATH}/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.displayName === undefined ? {} : { displayName: input.displayName.trim() }),
      ...(input.status === undefined ? {} : { status: input.status }),
    }),
  });
}

export function createAdminMechanic(input: { name: string; email: string; mode: MechanicMode }) {
  return apiFetch<UserDto>(ADMIN_MECHANICS_COLLECTION_PATH, {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      mode: input.mode,
    }),
  });
}

export function updateAdminMechanic(
  mechanicId: string,
  input: { name?: string; mode?: MechanicMode; active?: boolean },
) {
  return apiFetch<UserDto>(`${ADMIN_MECHANICS_COLLECTION_PATH}/${mechanicId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
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
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWRInfinite<AdminRepairHistoryDto>(
      (pageIndex, previous) => {
        if (!token || !truckId || (previous && !previous.nextCursor)) return null;
        const params = new URLSearchParams({ limit: '5' });
        if (excludeWorkOrderId) params.set('excludeWorkOrderId', excludeWorkOrderId);
        if (categoryId) params.set('categoryId', categoryId);
        if (pageIndex > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor);
        return `/api/admin/trucks/${truckId}/repair-history?${params.toString()}`;
      },
      adminReadFetcher,
      adminInfiniteOptions,
    ),
  );
}

/** LTR-157 / D16: Setup → Shop workflow (mandatory steps and default owners). */
export function useAdminWorkflowSteps() {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<ShopWorkflowStepDto[]>(token ? '/api/admin/setup/workflow-steps' : null, adminReadFetcher, adminReadRetry),
  );
}

export function updateAdminWorkflowSteps(steps: Array<{ stepKey: string; defaultMechanicId: string | null }>) {
  return apiFetch<ShopWorkflowStepDto[]>('/api/admin/setup/workflow-steps', {
    method: 'PUT',
    body: JSON.stringify({ steps }),
  });
}
