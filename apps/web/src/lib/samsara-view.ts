import type { TruckFaultSeverity } from '@ltl-shop/shared';
import type { AdminMessages } from './admin-messages';

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
