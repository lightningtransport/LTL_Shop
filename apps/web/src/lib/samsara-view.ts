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
