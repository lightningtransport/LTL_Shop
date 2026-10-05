import type { AdminMessages } from './admin-messages';

/** LTR-188 / D24: "At external shop · part|truck" for a Job's Mechanic cell (Work Order and Truck Work Plan). */
export function externalShopLabel(kind: string, messages: Pick<AdminMessages, 'externalStatus' | 'externalKindPart' | 'externalKindTruck'>): string {
  const what = kind === 'truck' ? messages.externalKindTruck : messages.externalKindPart;
  return `${messages.externalStatus} · ${what}`;
}
