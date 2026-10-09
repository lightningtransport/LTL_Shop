import type { AdminLocale } from './admin-messages';

/** LTR-200: an invoice date ("2026-10-06") as "Oct 6, 2026" / "6 oct 2026". It is a date, not a moment: UTC. */
export function formatInvoiceDate(value: string, locale: AdminLocale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
