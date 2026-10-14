import type { AdminLocale } from './admin-messages';
import { intlLocale } from './shop-locale';

export function formatAdminDate(value: string | null, locale: AdminLocale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

export function formatAdminDateOnly(value: string | null, locale: AdminLocale) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: 'UTC',
    dateStyle: 'medium',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

export function formatDuration(milliseconds: number) {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

/** D35 / S-2: "5 min ago", "2 hr ago", "3 days ago" (Samsara readings). Future or bad values read as "now". */
export function formatAdminAgo(value: string | null, locale: AdminLocale, now = Date.now()) {
  if (!value) return '—';
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return '—';
  const format = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto', style: 'short' });
  if (seconds < 60) return format.format(0, 'second');
  if (seconds < 3600) return format.format(-Math.round(seconds / 60), 'minute');
  if (seconds < 86_400) return format.format(-Math.round(seconds / 3600), 'hour');
  return format.format(-Math.round(seconds / 86_400), 'day');
}
