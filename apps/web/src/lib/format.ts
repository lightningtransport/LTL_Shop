import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PAUSE_REASON_LABELS, type PauseReason, type Priority } from '@ltl-shop/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function priorityLabel(p: Priority | string) {
  return String(p).toUpperCase();
}

export function statusLabel(status: string, labels?: Record<string, string>) {
  if (labels?.[status]) return labels[status];
  switch (status) {
    case 'created':
      return 'Created';
    case 'in_progress':
      return 'In Progress';
    case 'waiting_paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function pauseLabel(
  reason: PauseReason | string | null | undefined,
  labels?: Record<string, string>,
) {
  if (!reason) return null;
  return labels?.[reason] ?? PAUSE_REASON_LABELS[reason as PauseReason] ?? String(reason);
}

export function formatMileage(n: number | null | undefined) {
  if (n == null) return '—';
  return `${n.toLocaleString()} mi`;
}

export function formatIsoDate(value: string | null | undefined, locale: 'en' | 'es' = 'en') {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '—';
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}
