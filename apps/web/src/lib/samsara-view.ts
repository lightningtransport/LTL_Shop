import { OPEN_WORK_ORDER_STATUSES, truckPlace, type TruckFaultSeverity, type TruckSamsaraDto } from '@ltl-shop/shared';
import type { AdminLocale, AdminMessages } from './admin-messages';
import { fillPlaceholders } from './admin-next-step';
import { formatDay, formatShortDateTime, formatTime } from './work-order-view';

/** D35 / S-3: how a fault's severity reads and looks on Trucks, Truck → Faults and the banner. */
export const FAULT_SEVERITY_KEY: Record<TruckFaultSeverity, keyof AdminMessages> = {
  stop: 'faultSeverityStop',
  warning: 'faultSeverityWarning',
  check_engine: 'faultSeverityCheckEngine',
  pending: 'faultSeverityPending',
  info: 'faultSeverityInfo',
};

export function faultSeverityLabel(severity: TruckFaultSeverity, messages: AdminMessages) {
  return String(messages[FAULT_SEVERITY_KEY[severity]]);
}

/** STOP is red; warning and check engine are amber; pending and info are plain. */
export function faultSeverityVariant(severity: TruckFaultSeverity): 'destructive' | 'warning' | 'outline' {
  return severity === 'stop' ? 'destructive' : severity === 'warning' || severity === 'check_engine' ? 'warning' : 'outline';
}

/** A map link for a GPS point (opens the phone's map app or the browser). */
export function mapHref(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/**
 * TL-4: "Pennsylvania Turnpike, Napier Township, PA, 15550" → "Napier Township, PA". City and state are what the
 * Manager scans for; the full address stays in the title and on the Truck page.
 */
export function shortLocation(address: string | null | undefined): string | null {
  const parts = (address ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (/^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) parts.pop();
  return parts.length >= 2 ? parts.slice(-2).join(', ') : parts[0];
}

/** TL-7: a GPS point older than a day is shown as "no signal". */
export const STALE_LOCATION_MS = 24 * 60 * 60 * 1000;

export function isStaleLocation(at: string | null | undefined, now = Date.now()) {
  return Boolean(at) && now - new Date(at as string).getTime() > STALE_LOCATION_MS;
}

/**
 * D49 (LTR-257): "In yard · since 9:00 AM" in our yard, "In shop · in yard since 9:00 AM" when it also has an open Work
 * Order (the date too when it arrived another day); null outside the yard or with no Samsara point.
 */
export function yardPlaceText(
  samsara: TruckSamsaraDto | null | undefined,
  hasOpenWorkOrder: boolean,
  locale: AdminLocale,
  messages: AdminMessages,
  now = new Date(),
): string | null {
  const place = truckPlace(samsara, hasOpenWorkOrder);
  if (!place) return null;
  const since = samsara?.inYardSince ?? null;
  if (!since) return place === 'in_shop' ? messages.presenceInShop : messages.presenceInYard;
  const sameDay = formatDay(since, locale) === formatDay(now.toISOString(), locale);
  const when = sameDay ? formatTime(since, locale) : formatShortDateTime(since, locale);
  return fillPlaceholders(place === 'in_shop' ? messages.presenceInShopSince : messages.presenceInYardSince, { since: when });
}

/** D49: an open Work Order (created, in progress or paused); a completed one waiting for Return to Service is not. */
export function isOpenWorkOrderStatus(status: string | null | undefined) {
  return Boolean(status) && (OPEN_WORK_ORDER_STATUSES as string[]).includes(status as string);
}
