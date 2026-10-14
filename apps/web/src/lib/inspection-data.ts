'use client';

import useSWR from 'swr';
import type {
  AddInspectionDefectsInput,
  InspectionQueueItemDto,
  SaveInspectionInput,
  TruckInspectionStateDto,
} from '@ltl-shop/shared';
import { apiFetch } from './api';
import { useAuth } from './auth-context';

/**
 * D41: the inspection sheet's data. The Manager reads and writes under `/api/admin`; a mechanic with
 * "Can inspect trucks" under `/api/inspections` (HU-ME7). Same body and same answer on both.
 */
export type InspectionMode = 'admin' | 'mechanic';

export function inspectionStateKey(mode: InspectionMode, truckId: string) {
  return mode === 'admin' ? `/api/admin/trucks/${truckId}/inspection` : `/api/inspections/trucks/${truckId}`;
}

export const INSPECTION_QUEUE_KEY = '/api/inspections/queue';

export function useTruckInspection(mode: InspectionMode, truckId: string | null) {
  const { token } = useAuth();
  return useSWR<TruckInspectionStateDto>(token && truckId ? inspectionStateKey(mode, truckId) : null, (path: string) => apiFetch<TruckInspectionStateDto>(path), {
    dedupingInterval: 5_000,
    revalidateOnFocus: false,
  });
}

export function saveTruckInspection(mode: InspectionMode, truckId: string, input: SaveInspectionInput) {
  return apiFetch<TruckInspectionStateDto>(inspectionStateKey(mode, truckId), { method: 'POST', body: JSON.stringify(input) });
}

export function addTruckInspectionDefects(mode: InspectionMode, truckId: string, input: AddInspectionDefectsInput) {
  return apiFetch<TruckInspectionStateDto>(`${inspectionStateKey(mode, truckId)}/defects`, { method: 'POST', body: JSON.stringify(input) });
}

/** HU-ME7: "To inspect" in My work. Off (no request) without the permission. */
export function useInspectionQueue(enabled: boolean) {
  const { token } = useAuth();
  return useSWR<InspectionQueueItemDto[]>(token && enabled ? INSPECTION_QUEUE_KEY : null, (path: string) => apiFetch<InspectionQueueItemDto[]>(path), {
    refreshInterval: 30_000,
    dedupingInterval: 5_000,
  });
}
