'use client';

import useSWR from 'swr';
import { getShopCopy } from './locale-context';

/** LTR-185 / D19: what the Safety workspace reads from GET /api/qc/queue. */
export type QualityCheckItem = {
  workOrderId: string;
  displayId: string;
  version: number;
  truck: { id: string; truckNumber: string; make: string | null; model: string | null; year: number | null };
  doneJobs: string[];
  mechanics: string[];
  readySince: string;
  takenBy: { id: string; name: string } | null;
  mine: boolean;
};

export type QualityCheckReturnedItem = QualityCheckItem & {
  note: string | null;
  returnedBy: string | null;
  returnedAt: string;
};

export type QualityCheckQueue = {
  pending: QualityCheckItem[];
  returned: QualityCheckReturnedItem[];
};

export const qualityCheckQueueKey = '/api/qc/queue';

export function useQualityCheckQueue(enabled: boolean) {
  return useSWR<QualityCheckQueue>(enabled ? qualityCheckQueueKey : null, {
    dedupingInterval: 5_000,
    refreshInterval: 20_000,
  });
}

/** "hace 40 min" / "40 min ago" without a library: minutes, hours or days. */
export function relativeTime(iso: string, locale: 'en' | 'es', now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  const copy = getShopCopy(locale);
  if (minutes < 60) return copy.relativeMinutesAgo(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return copy.relativeHoursAgo(hours);
  const days = Math.round(hours / 24);
  return copy.relativeDaysAgo(days);
}
