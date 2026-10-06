import type { AdminMessages } from './admin-messages';

/**
 * LTR-110: Truck Detail is reached from Trucks, Yard Operations and Work Orders.
 * Links pass `?from=<admin path>` so the back link matches the origin.
 * Unknown or missing origins keep the historical Yard Operations behavior.
 */
export type AdminTruckOrigin = {
  href: string;
  backLabel: string;
};

export function adminTruckHref(truckId: string, fromPath: string) {
  return `/admin/trucks/${truckId}?from=${encodeURIComponent(fromPath)}`;
}

export function adminTruckOrigin(from: string | null | undefined, messages: AdminMessages): AdminTruckOrigin {
  const yard = {
    href: '/admin/yard-operations',
    backLabel: messages.backToYardOperations,
  };
  // Only same-app Admin paths; never follow an external or protocol-relative URL.
  if (!from || !from.startsWith('/admin') || from.startsWith('//')) return yard;
  const path = from.split(/[?#]/)[0];
  if (path === '/admin/trucks') {
    return { href: from, backLabel: messages.backToTrucks };
  }
  if (path === '/admin/work-orders') {
    return { href: from, backLabel: messages.backToWorkOrders };
  }
  if (path.startsWith('/admin/work-orders/')) {
    return { href: from, backLabel: messages.backToWorkOrder };
  }
  if (path === '/admin') {
    return { href: from, backLabel: messages.backToDashboard };
  }
  if (path === '/admin/yard-operations') return { ...yard, href: from };
  return yard;
}

/**
 * Stage 4 (T4, truck-detail-redesign §2.3): a Work Order reached from its Truck goes back to the
 * Truck ("Back to Truck 601"); otherwise it goes back to the Work Orders list.
 */
export function adminWorkOrderOrigin(from: string | null | undefined, truckNumber: string, messages: AdminMessages): AdminTruckOrigin {
  const list = { href: '/admin/work-orders', backLabel: messages.backToWorkOrders };
  if (!from || !from.startsWith('/admin') || from.startsWith('//')) return list;
  const path = from.split(/[?#]/)[0];
  if (path.startsWith('/admin/trucks/')) return { href: from, backLabel: messages.backToTruck.replace('{truck}', truckNumber) };
  if (path === '/admin/work-orders') return { href: from, backLabel: messages.backToWorkOrders };
  if (path === '/admin') return { href: from, backLabel: messages.backToDashboard };
  return list;
}
