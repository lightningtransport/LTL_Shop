'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import type {
  ShopWorkflowStepDto,
  ShopHoursDto,
  AdminCatalogJobWriteDto,
  AdminDashboardDto,
  AdminMechanicCreatedDto,
  AdminMechanicDetailDto,
  AdminMechanicPasswordResetDto,
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
  AdminCatalogSearchHitDto,
  YardDataBoundaryDto,
  YardOperationsPageDto,
  TruckWorkPlanDto,
  AdminCreatePartInput,
  AdminCreateVendorInput,
  AdminPartsCatalogDto,
  AdminUpdatePartInput,
  AdminUpdateVendorInput,
  AdminVendorDto,
  AdminAttachmentUploadDto,
  AdminInvoiceMatchDto,
  AdminPurchaseDetailDto,
  AdminPurchaseFormDataDto,
  AdminPurchaseListDto,
  AdminRequestAttachmentInput,
  AdminSavePurchaseInput,
  AdminExternalJobDto,
  AdminOutsideRepairDetailDto,
  AdminOutsideRepairListDto,
  AdminSaveOutsideRepairInput,
  AdminTruckCostsDto,
  AdminLaborRatesDto,
  AdminLaborRatePreviewDto,
  AdminSetLaborRateInput,
  AdminCreateInternalInvoiceInput,
  AdminInternalInvoiceDetailDto,
  AdminInternalInvoiceSummaryDto,
  AdminCustomJobGroupDto,
  AdminReviewCustomJobsInput,
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

/**
 * LTR-84: a transient first failure (timeout, network) is retried once. Until that
 * retry settles the read is still loading, so the UI does not flash UNAVAILABLE.
 */
export function adminReadRetryPending(error: unknown, data: unknown, failures: number) {
  return (
    error !== undefined &&
    data === undefined &&
    isTransientApiError(error) &&
    failures <= adminReadRetry.errorRetryCount
  );
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

/** LTR-197 / D28: every active person on the roster (Standard, PM and Safety), to build a step's team. */
export function useAdminRoster() {
  const { token } = useAuth();
  const swr = withAdminReadPending(
    token,
    useSWRInfinite<AdminPage<AdminMechanicSummaryDto>>(
      (pageIndex, previous) => adminMechanicsPageKey(token, '', 100, pageIndex, previous),
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

/** LTR-199 / D31: Remove from Shop (history stays). */
export function removeAdminMechanic(id: string) {
  return apiFetch<{ removed: true }>(`/api/admin/mechanics/${id}/remove`, { method: 'POST', body: '{}' });
}

/** LTR-199 / D31: a real delete, only for someone who never did anything. */
export function deleteAdminMechanic(id: string) {
  return apiFetch<{ deleted: true }>(`/api/admin/mechanics/${id}`, { method: 'DELETE' });
}

/** LTR-199 / D28: the person's Jobs that came from a team queue go back to it. */
export function sendAdminMechanicJobsToQueue(id: string, jobIds?: string[]) {
  return apiFetch<{ sent: number; skipped: number }>(`/api/admin/mechanics/${id}/send-to-queue`, { method: 'POST', body: JSON.stringify(jobIds ? { jobIds } : {}) });
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
      // D5 / UX-6-001: the board refreshes on its own (30s, like the Dashboard) so nobody decides on stale data.
      { ...adminInfiniteOptions, refreshInterval: 30_000 },
    ),
  );
}

export function useAdminYardDataBoundary() {
  const { token } = useAuth();
  const [failures, setFailures] = useState(0);
  const swr = useSWR<YardDataBoundaryDto>(token ? ADMIN_YARD_DATA_BOUNDARY_PATH : null, adminReadFetcher, {
    dedupingInterval: 10_000,
    refreshInterval: 30_000,
    ...adminReadRetry,
    onSuccess: () => setFailures(0),
    onError: () => setFailures((count) => count + 1),
  });
  const pending = withAdminReadPending(token, swr);
  return {
    ...pending,
    isLoading: pending.isLoading || adminReadRetryPending(swr.error, swr.data, failures),
  };
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

/** LTR-188 / D23: another Standard mechanic helps on a Job (a helper Job of their own). */
export function addAdminHelperJob(
  workOrderId: string,
  jobId: string,
  input: { mechanicId: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/jobs/${jobId}/helper`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

/** LTR-188 / D24: the part or the truck goes to an external shop. */
export function sendAdminJobExternal(
  workOrderId: string,
  jobId: string,
  input: { kind: 'part' | 'truck'; note: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/jobs/${jobId}/external`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
}

/** LTR-188 / D24: back from the external shop — complete it or assign it. */
export function returnAdminJobExternal(
  workOrderId: string,
  jobId: string,
  input: { outcome: 'complete' | 'assign'; mechanicId?: string; expectedVersion: number },
  idempotencyKey = adminMutationIdempotencyKey(),
) {
  return apiFetch<AdminWorkOrderDetailDto>(`/api/admin/work-orders/${workOrderId}/jobs/${jobId}/external/return`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
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
 * Roster (D22) and Job catalog (D25) writes. API gate `ManagerWritesGuard`: the Shop Manager
 * (admin.access + work_orders.manage) or the System Admin by role. No idempotency key on these bodies.
 * A catalog Job name already in the category → 409 CATALOG_JOB_EXISTS with the existing `jobId`.
 *
 * POST /api/admin/mechanics { email, name, mode: 'standard' | 'pm' | 'safety' } → UserDto
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

/** LTR-198 / D30: Categories, deleting Jobs, aliases and the search across Jobs and aliases. */
export function createAdminCatalogCategory(name: string) {
  return apiFetch<AdminCatalogCategorySummaryDto>('/api/admin/catalog/categories', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
}

export function updateAdminCatalogCategory(id: string, input: { name?: string; status?: CatalogStatus; inactiveReason?: string | null }) {
  return apiFetch<AdminCatalogCategorySummaryDto>(`/api/admin/catalog/categories/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteAdminCatalogCategory(id: string) {
  return apiFetch<{ deleted: true }>(`/api/admin/catalog/categories/${id}`, { method: 'DELETE' });
}

export function deleteAdminCatalogJob(id: string) {
  return apiFetch<{ deleted: true }>(`${ADMIN_CATALOG_JOBS_PATH}/${id}`, { method: 'DELETE' });
}

export function addAdminCatalogAlias(jobId: string, text: string) {
  return apiFetch<{ id: string; text: string }>(`${ADMIN_CATALOG_JOBS_PATH}/${jobId}/aliases`, { method: 'POST', body: JSON.stringify({ text: text.trim() }) });
}

export function removeAdminCatalogAlias(jobId: string, aliasId: string) {
  return apiFetch<{ deleted: true }>(`${ADMIN_CATALOG_JOBS_PATH}/${jobId}/aliases/${aliasId}`, { method: 'DELETE' });
}

export function useAdminCatalogSearch(query: string) {
  const { token } = useAuth();
  const q = query.trim();
  return withAdminReadPending(
    token,
    useSWR<AdminCatalogSearchHitDto[]>(token && q.length >= 2 ? `/api/admin/catalog/search?q=${encodeURIComponent(q)}` : null, adminReadFetcher, {
      dedupingInterval: 5_000,
      keepPreviousData: true,
    }),
  );
}

export function updateAdminCatalogJob(
  jobId: string,
  input: { displayName?: string; status?: CatalogStatus; keepOldNameAsAlias?: boolean },
) {
  return apiFetch<AdminCatalogJobWriteDto>(`${ADMIN_CATALOG_JOBS_PATH}/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.displayName === undefined ? {} : { displayName: input.displayName.trim() }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.keepOldNameAsAlias === undefined ? {} : { keepOldNameAsAlias: input.keepOldNameAsAlias }),
    }),
  });
}

/** D22: also creates the access account; `temporaryPassword` comes back once (null without Supabase). */
export function createAdminMechanic(input: { name: string; email: string; mode: MechanicMode }) {
  return apiFetch<AdminMechanicCreatedDto>(ADMIN_MECHANICS_COLLECTION_PATH, {
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

/** D22: a new temporary password, returned once; the app forces a change at the next sign-in. */
export function resetAdminMechanicPassword(mechanicId: string) {
  return apiFetch<AdminMechanicPasswordResetDto>(`${ADMIN_MECHANICS_COLLECTION_PATH}/${mechanicId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function addAdminWorkPlanJobs(
  truckId: string,
  input: {
    jobs: Array<Pick<WorkPlanJobDraft, 'catalogJobId' | 'categoryId' | 'displayName' | 'customDescription' | 'assignedMechanicId'>>;
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

/** LTR-186 / D20: Setup → Shop workflow → Shop hours (day close). */
export function useAdminShopHours() {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<ShopHoursDto>(token ? '/api/admin/setup/shop-hours' : null, adminReadFetcher, adminReadRetry),
  );
}

export function updateAdminShopHours(input: { cutoff: string; workdays: number[] }) {
  return apiFetch<ShopHoursDto>('/api/admin/setup/shop-hours', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

/** LTR-197 / D28: each step's team. */
export function updateAdminWorkflowSteps(steps: Array<{ stepKey: string; memberIds: string[] }>) {
  return apiFetch<ShopWorkflowStepDto[]>('/api/admin/setup/workflow-steps', {
    method: 'PUT',
    body: JSON.stringify({ steps }),
  });
}

// ── LTR-200 / D32: Parts & costs (PC-1: the part catalog and the vendors) ──────────────────────────────────

export function useAdminPartsCatalog(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminPartsCatalogDto>(token ? `/api/admin/parts-costs/parts${query ? `?${query}` : ''}` : null, adminReadFetcher, {
      dedupingInterval: 10_000,
      keepPreviousData: true,
      ...adminReadRetry,
    }),
  );
}

export function useAdminVendors() {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminVendorDto[]>(token ? '/api/admin/parts-costs/vendors' : null, adminReadFetcher, {
      dedupingInterval: 10_000,
      ...adminReadRetry,
    }),
  );
}

export function createAdminPart(input: AdminCreatePartInput) {
  return apiFetch<{ id: string }>('/api/admin/parts-costs/parts', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminPart(id: string, input: AdminUpdatePartInput) {
  return apiFetch<{ id: string }>(`/api/admin/parts-costs/parts/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function createAdminVendor(input: AdminCreateVendorInput) {
  return apiFetch<{ id: string }>('/api/admin/parts-costs/vendors', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminVendor(id: string, input: AdminUpdateVendorInput) {
  return apiFetch<{ id: string }>(`/api/admin/parts-costs/vendors/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

// ── LTR-200 / D32 (PC-2): purchases and invoice files ──────────────────────────────────────────────────────

export function useAdminPurchases(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminPurchaseListDto>(token ? `/api/admin/parts-costs/purchases${query ? `?${query}` : ''}` : null, adminReadFetcher, {
      dedupingInterval: 5_000,
      keepPreviousData: true,
      ...adminReadRetry,
    }),
  );
}

export function useAdminPurchase(id: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminPurchaseDetailDto>(token && id ? `/api/admin/parts-costs/purchases/${id}` : null, adminReadFetcher, {
      dedupingInterval: 5_000,
      ...adminReadRetry,
    }),
  );
}

export function useAdminPurchaseFormData(enabled: boolean) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminPurchaseFormDataDto>(token && enabled ? '/api/admin/parts-costs/purchases/form-data' : null, adminReadFetcher, {
      dedupingInterval: 10_000,
      ...adminReadRetry,
    }),
  );
}

/** A59: the key is made once per open form, so a repeated tap or send saves one purchase. */
export function createAdminPurchase(input: AdminSavePurchaseInput, idempotencyKey: string) {
  return apiFetch<{ id: string; replayed: boolean }>('/api/admin/parts-costs/purchases', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export function updateAdminPurchase(id: string, input: AdminSavePurchaseInput) {
  return apiFetch<{ id: string }>(`/api/admin/parts-costs/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function voidAdminPurchase(id: string, reason: string) {
  return apiFetch<{ id: string }>(`/api/admin/parts-costs/purchases/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
}

/** PCA6 (UX-10-004): the invoice file on its own; the trucks' costs are not touched. */
export function setAdminPurchaseAttachment(id: string, attachmentId: string | null) {
  return apiFetch<{ id: string }>(`/api/admin/parts-costs/purchases/${id}/attachment`, { method: 'PATCH', body: JSON.stringify({ attachmentId }) });
}

export function setAdminOutsideRepairAttachment(id: string, attachmentId: string | null) {
  return apiFetch<{ id: string }>(`/api/admin/parts-costs/outside-repairs/${id}/attachment`, { method: 'PATCH', body: JSON.stringify({ attachmentId }) });
}

export function checkAdminInvoice(vendorId: string, number: string, excludeId?: string) {
  const params = new URLSearchParams({ vendorId, number });
  if (excludeId) params.set('excludeId', excludeId);
  return apiFetch<AdminInvoiceMatchDto>(`/api/admin/parts-costs/invoices/check?${params.toString()}`, { timeoutMs: ADMIN_READ_TIMEOUT_MS });
}

export function requestAdminAttachment(input: AdminRequestAttachmentInput) {
  return apiFetch<AdminAttachmentUploadDto>('/api/admin/parts-costs/attachments', { method: 'POST', body: JSON.stringify(input) });
}

export function openAdminAttachment(id: string) {
  return apiFetch<{ url: string }>(`/api/admin/parts-costs/attachments/${id}`, { timeoutMs: ADMIN_READ_TIMEOUT_MS });
}

/** PUTs the file straight to the signed Storage URL, reporting progress (0–100). */
export function uploadInvoiceFile(uploadUrl: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload failed (${request.status})`)));
    request.onerror = () => reject(new Error('Upload failed'));
    request.send(file);
  });
}

// ── LTR-200 / D32 (PC-3): outside repairs ──────────────────────────────────────────────────────────────────

export function useAdminOutsideRepairs(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminOutsideRepairListDto>(token ? `/api/admin/parts-costs/outside-repairs${query ? `?${query}` : ''}` : null, adminReadFetcher, {
      dedupingInterval: 5_000,
      keepPreviousData: true,
      ...adminReadRetry,
    }),
  );
}

export function useAdminOutsideRepair(id: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminOutsideRepairDetailDto>(token && id ? `/api/admin/parts-costs/outside-repairs/${id}` : null, adminReadFetcher, {
      dedupingInterval: 5_000,
      ...adminReadRetry,
    }),
  );
}

/** The truck's Jobs that went to an external shop (out now, or within 90 days). */
export function useAdminExternalJobs(truckId: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminExternalJobDto[]>(token && truckId ? `/api/admin/parts-costs/external-jobs?truckId=${truckId}` : null, adminReadFetcher, {
      dedupingInterval: 5_000,
      ...adminReadRetry,
    }),
  );
}

export function createAdminOutsideRepair(input: AdminSaveOutsideRepairInput, idempotencyKey: string) {
  return apiFetch<{ id: string; replayed: boolean }>('/api/admin/parts-costs/outside-repairs', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export function updateAdminOutsideRepair(id: string, input: AdminSaveOutsideRepairInput) {
  return apiFetch<{ id: string }>(`/api/admin/parts-costs/outside-repairs/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function voidAdminOutsideRepair(id: string, reason: string) {
  return apiFetch<{ id: string }>(`/api/admin/parts-costs/outside-repairs/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
}

// ── LTR-200 / D32 (PC-4): Truck → Costs ────────────────────────────────────────────────────────────────────

export function useAdminTruckCosts(truckId: string, query: string, enabled: boolean) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminTruckCostsDto>(token && truckId && enabled ? `/api/admin/parts-costs/trucks/${truckId}/costs${query ? `?${query}` : ''}` : null, adminReadFetcher, {
      dedupingInterval: 5_000,
      keepPreviousData: true,
      ...adminReadRetry,
    }),
  );
}

// ── LB-1 (LTR-201 / D34): the shop's labor rate ──────────────────────────────────────────────────────────────

export function useAdminLaborRates() {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminLaborRatesDto>(token ? '/api/admin/parts-costs/labor-rates' : null, adminReadFetcher, { dedupingInterval: 10_000, ...adminReadRetry }),
  );
}

export function setAdminLaborRate(input: AdminSetLaborRateInput) {
  return apiFetch<{ id: string; recalculatedWorkOrders: number }>('/api/admin/parts-costs/labor-rates', { method: 'POST', body: JSON.stringify(input) });
}

/** PCA7 (UX-10-005): what a rate from that date would recalculate, before saving it. */
export function useAdminLaborRatePreview(effectiveFrom: string | null) {
  const { token } = useAuth();
  return useSWR<AdminLaborRatePreviewDto>(
    token && effectiveFrom ? `/api/admin/parts-costs/labor-rates/preview?effectiveFrom=${effectiveFrom}` : null,
    adminReadFetcher,
    { dedupingInterval: 5_000, keepPreviousData: true, ...adminReadRetry },
  );
}

export function removeAdminLaborRate(id: string) {
  return apiFetch<{ id: string; recalculatedWorkOrders: number }>(`/api/admin/parts-costs/labor-rates/${id}`, { method: 'DELETE' });
}

// ── LB-2 (LTR-201 / D34): internal invoices to Finance ───────────────────────────────────────────────────────

export function useAdminInternalInvoices(query: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminInternalInvoiceSummaryDto[]>(token ? `/api/admin/parts-costs/internal-invoices${query ? `?${query}` : ''}` : null, adminReadFetcher, { dedupingInterval: 5_000, keepPreviousData: true, ...adminReadRetry }),
  );
}

export function useAdminInternalInvoice(id: string) {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminInternalInvoiceDetailDto>(token && id ? `/api/admin/parts-costs/internal-invoices/${id}` : null, adminReadFetcher, { dedupingInterval: 3_000, ...adminReadRetry }),
  );
}

const invoicePath = (id: string, action = '') => `/api/admin/parts-costs/internal-invoices/${id}${action}`;

export function createAdminInternalInvoice(input: AdminCreateInternalInvoiceInput) {
  return apiFetch<{ id: string }>('/api/admin/parts-costs/internal-invoices', { method: 'POST', body: JSON.stringify(input) });
}
export function refreshAdminInternalInvoice(id: string) {
  return apiFetch<{ id: string; added: number }>(invoicePath(id, '/refresh'), { method: 'POST', body: '{}' });
}
export function setAdminInternalInvoiceLine(id: string, lineId: string, active: boolean) {
  return apiFetch<{ id: string }>(invoicePath(id, `/lines/${lineId}/${active ? 'restore' : 'remove'}`), { method: 'POST', body: '{}' });
}
export function sendAdminInternalInvoice(id: string) {
  return apiFetch<{ id: string; number: string }>(invoicePath(id, '/send'), { method: 'POST', body: '{}' });
}
export function acceptAdminInternalInvoice(id: string) {
  return apiFetch<{ id: string }>(invoicePath(id, '/accept'), { method: 'POST', body: '{}' });
}
export function voidAdminInternalInvoice(id: string, reason: string) {
  return apiFetch<{ id: string }>(invoicePath(id, '/void'), { method: 'POST', body: JSON.stringify({ reason }) });
}
export function deleteAdminInternalInvoice(id: string) {
  return apiFetch<{ deleted: true }>(invoicePath(id), { method: 'DELETE' });
}

// ── LTR-57: the Custom Jobs review inbox ────────────────────────────────────────────────────────────────────

export function useAdminCustomJobs(status: 'pending' | 'reviewed') {
  const { token } = useAuth();
  return withAdminReadPending(
    token,
    useSWR<AdminCustomJobGroupDto[]>(token ? `/api/admin/catalog/custom-jobs?status=${status}` : null, adminReadFetcher, { dedupingInterval: 5_000, keepPreviousData: true, ...adminReadRetry }),
  );
}

export function reviewAdminCustomJobs(input: AdminReviewCustomJobsInput) {
  return apiFetch<{ updated: number; status: string; catalogJob: { id: string; displayName: string } | null; aliasAdded: boolean }>('/api/admin/catalog/custom-jobs/review', { method: 'POST', body: JSON.stringify(input) });
}

export function undoAdminCustomJobs(categoryId: string, nameNorm: string) {
  return apiFetch<{ updated: number }>('/api/admin/catalog/custom-jobs/undo', { method: 'POST', body: JSON.stringify({ categoryId, nameNorm }) });
}
