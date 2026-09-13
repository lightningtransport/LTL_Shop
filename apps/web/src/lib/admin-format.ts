import type { AdminLocale } from './admin-messages';

export function formatAdminDate(value: string | null, locale: AdminLocale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

export function formatAdminDateOnly(value: string | null, locale: AdminLocale) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '—';
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
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
