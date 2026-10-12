/**
 * Admin text helpers and types. The catalog itself lives in `./admin-messages-catalog` (server only, PF12);
 * everything here takes the `messages` object the server already passed down.
 */
export type { AdminLocale, AdminMessages } from './admin-messages-catalog';
import type { AdminLocale, AdminMessages } from './admin-messages-catalog';

export const ADMIN_PAUSE_REASON_KEY = {
  waiting_for_parts: 'waitingForParts',
  waiting_for_approval: 'waitingForApproval',
  waiting_for_vendor: 'waitingForVendor',
  waiting_for_equipment: 'waitingForEquipment',
  waiting_for_bay: 'waitingForBay',
  waiting_for_driver: 'waitingForDriver',
  truck_unavailable: 'truckUnavailable',
  working_on_another_wo: 'workingOnAnotherWorkOrder',
  break: 'breakPause',
  end_of_shift: 'endOfShift',
  other: 'otherPause',
  quality_check_failed: 'returnedBySafety',
} as const;

export function adminPauseReasonLabel(reason: string, catalog: AdminMessages): string {
  return reason in ADMIN_PAUSE_REASON_KEY
    ? catalog[ADMIN_PAUSE_REASON_KEY[reason as keyof typeof ADMIN_PAUSE_REASON_KEY]]
    : reason;
}

const ADMIN_CAPABILITY_KEY = {
  'mechanic.standard': 'mechanicStandard',
  'mechanic.pm': 'mechanicPm',
  'admin.access': 'capabilityAdmin',
  'yard.operations.manage': 'capabilityYard',
  'work_orders.manage': 'capabilityWorkOrders',
  'quality_check.perform': 'capabilitySafety',
} as const;

/** LTR-169: "Standard", "PM", "Shop Admin"… instead of keys like mechanic.standard. Unknown keys pass through. */
export function adminCapabilityLabel(capability: string, catalog: AdminMessages): string {
  return capability in ADMIN_CAPABILITY_KEY
    ? catalog[ADMIN_CAPABILITY_KEY[capability as keyof typeof ADMIN_CAPABILITY_KEY]]
    : capability;
}

export function isAdminLocale(value?: string): value is AdminLocale {
  return value === 'en' || value === 'es';
}
