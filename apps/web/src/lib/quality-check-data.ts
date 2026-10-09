'use client';

import useSWR from 'swr';
import { getShopCopy } from './locale-context';

type Person = { id: string; name: string };

/** LTR-185 / D19: what the Safety workspace reads from GET /api/qc/queue. */
export type QualityCheckItem = {
  workOrderId: string;
  displayId: string;
  version: number;
  truck: { id: string; truckNumber: string; make: string | null; model: string | null; year: number | null };
  doneJobs: string[];
  mechanics: string[];
  /** Stage QC-1: who did each Job, the priority, and what Dispatch knows (null when it does not answer). */
  doneBy?: Array<{ jobId: string; job: string; mechanic: Person | null }>;
  priority?: string;
  leavesOn?: string | null;
  location?: string | null;
  readySince: string;
  takenBy: Person | null;
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
  /** LTR-197 / D-SET7: false when this Safety person is not on Quality Check's team (the list is then empty). */
  onTeam?: boolean;
};

/** Stage QC-1 (Q2): GET /api/qc/:workOrderId — everything Safety needs to decide on one truck. */
export type QualityCheckReview = (QualityCheckItem | QualityCheckReturnedItem) & {
  truck: QualityCheckItem['truck'] & { vin: string | null; mileage: number | null; company: string | null };
  jobs: Array<{ id: string; name: string; category: string; mechanic: Person | null; completedAt: string | null; note: string | null; isPm: boolean }>;
  pm: { service: string; observedMileage: number | null; parts: Array<{ category: string; partNumber: string | null; name: string }> } | null;
  inspection: { outcome: 'issues_found' | 'no_issues_found' | 'not_recorded'; recordedAt: string | null };
  blockers: Array<{ job: string | null; reason: string; note: string | null; reportedBy: string | null; startedAt: string; resolvedAt: string; resolvedBy: string | null; resolution: string | null }>;
  previousReturns: Array<{ note: string | null; returnedBy: string | null; returnedAt: string; resolvedAt: string; resolvedBy: string | null; resolution: string | null }>;
};

/** Stage QC-1 (D-QC6): GET /api/qc/history — what I approved or returned. */
export type QualityCheckHistory = {
  days: number;
  items: Array<{ workOrderId: string; displayId: string; truck: QualityCheckItem['truck']; outcome: 'approved' | 'returned'; at: string; note: string | null }>;
};

export const qualityCheckQueueKey = '/api/qc/queue';
export const qualityCheckHistoryKey = '/api/qc/history?days=7';
export const qualityCheckReviewKey = (workOrderId: string) => `/api/qc/${workOrderId}`;

export function useQualityCheckQueue(enabled: boolean) {
  return useSWR<QualityCheckQueue>(enabled ? qualityCheckQueueKey : null, {
    dedupingInterval: 5_000,
    refreshInterval: 20_000,
  });
}

export function useQualityCheckReview(workOrderId: string | null) {
  return useSWR<QualityCheckReview>(workOrderId ? qualityCheckReviewKey(workOrderId) : null, { dedupingInterval: 5_000 });
}

export function useQualityCheckHistory(enabled: boolean) {
  return useSWR<QualityCheckHistory>(enabled ? qualityCheckHistoryKey : null, { dedupingInterval: 10_000 });
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

/** Mechanics of the done Jobs, once each, in Job order (avatars on the card). */
export function cardMechanics(item: QualityCheckItem): Person[] {
  const seen = new Map<string, Person>();
  for (const entry of item.doneBy ?? []) if (entry.mechanic && !seen.has(entry.mechanic.id)) seen.set(entry.mechanic.id, entry.mechanic);
  return [...seen.values()];
}
