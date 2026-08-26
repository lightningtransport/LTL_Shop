import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PAUSE_REASON_LABELS, type PauseReason, type Priority } from '@ltl-shop/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function priorityLabel(p: Priority | string) {
  return String(p).toUpperCase();
}

export function statusLabel(status: string) {
  switch (status) {
    case 'created':
      return 'Created';
    case 'in_progress':
      return 'In Progress';
    case 'waiting_paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

export function pauseLabel(reason: PauseReason | string | null | undefined) {
  if (!reason) return null;
  return PAUSE_REASON_LABELS[reason as PauseReason] ?? String(reason);
}

export function formatMileage(n: number | null | undefined) {
  if (n == null) return '—';
  return `${n.toLocaleString()} mi`;
}
