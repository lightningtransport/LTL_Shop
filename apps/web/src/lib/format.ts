import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PAUSE_REASON_LABELS, type PauseReason } from '@ltl-shop/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Year + make + model, skipping a make that is already the start of model (e.g. PETERBILT + PETERBILT 579). */
export function formatVehicleYmm(truck: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
}): string {
  const year = truck.year == null || truck.year === '' ? '' : String(truck.year);
  const make = truck.make?.trim() ?? '';
  const model = truck.model?.trim() ?? '';
  let name = '';
  if (make && model) {
    const duplicatedMake = new RegExp(`^${escapeRegExp(make)}(?:\\s+|$)`, 'i').test(model);
    name = duplicatedMake ? model : `${make} ${model}`;
  } else {
    name = make || model;
  }
  return [year, name].filter(Boolean).join(' ');
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
