'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Block A (MG9, Q9, PM6): what someone typed but did not send stays on this phone, per field and
 * per Job or truck, until it is sent. Closing the sheet, leaving the screen or a session that
 * expires no longer loses it. Storage can be unavailable (private mode): then it lives in memory.
 */
export function readDraft(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(key: string, value: string) {
  try {
    if (value.trim()) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Not available; the value stays in the component.
  }
}

/** `key` null means there is nothing to draft for yet (no Job chosen). */
export function useLocalDraft(key: string | null): [string, (value: string) => void, () => void] {
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue(key ? readDraft(key) : '');
  }, [key]);

  const update = useCallback((next: string) => {
    setValue(next);
    if (key) writeDraft(key, next);
  }, [key]);

  const clear = useCallback(() => {
    setValue('');
    if (key) writeDraft(key, '');
  }, [key]);

  return [value, update, clear];
}

/**
 * LTR-293 §2: the same for a form with several fields (the truck form, Safety's findings). The draft is read once
 * per key, written on every change and cleared on send or discard. Only plain JSON (no files).
 */
export function readDraftJson<T>(key: string): T | null {
  const raw = readDraft(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeDraftJson(key: string, value: unknown | null) {
  writeDraft(key, value == null ? '' : JSON.stringify(value));
}

export const draftKeys = {
  jobFinish: (jobId: string) => `ltl-draft:job-finish:${jobId}`,
  blockerNote: (jobId: string) => `ltl-draft:blocker-note:${jobId}`,
  workOrderNote: (workOrderId: string) => `ltl-draft:work-order-note:${workOrderId}`,
  workRequest: (workOrderId: string) => `ltl-draft:work-request:${workOrderId}`,
  qcReturn: (workOrderId: string) => `ltl-draft:qc-return:${workOrderId}`,
  // LTR-293 §2
  newWorkOrderNote: (truckId: string) => `ltl-draft:new-work-order-note:${truckId}`,
  truckForm: (truckId: string | null) => `ltl-draft:truck-form:${truckId ?? 'new'}`,
  managerNote: (workOrderId: string) => `ltl-draft:manager-note:${workOrderId}`,
  qcFindings: (workOrderId: string) => `ltl-draft:qc-findings:${workOrderId}`,
};
