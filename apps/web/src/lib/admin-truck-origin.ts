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

/** PCA2 (UX-5-002): a Truck opened from Parts & costs lands on its Costs tab, and knows where to go back. */
export function adminTruckCostsHref(truckId: string, fromPath: string) {
  return `/admin/trucks/${truckId}?from=${encodeURIComponent(fromPath)}&tab=costs`;
}

/** Only same-app Admin paths are followed back; never an external or protocol-relative URL. */
export function safeAdminPath(from: string | null | undefined): string | null {
  if (!from || !from.startsWith('/admin') || from.startsWith('//')) return null;
  return from;
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
  // PCA2: Parts & costs → Truck (Costs tab) → back to the purchase, the outside repair, the invoice or the list.
  if (path.startsWith('/admin/parts/purchases/')) return { href: from, backLabel: messages.backToPurchase };
  if (path === '/admin/parts/purchases') return { href: from, backLabel: messages.pcBackToPurchases };
  if (path.startsWith('/admin/parts/outside-repairs/')) return { href: from, backLabel: messages.backToOutsideRepair };
  if (path === '/admin/parts/outside-repairs') return { href: from, backLabel: messages.pcBackToOutside };
  if (path.startsWith('/admin/parts/internal-invoices/')) return { href: from, backLabel: messages.backToInternalInvoice };
  if (path === '/admin/parts/internal-invoices') return { href: from, backLabel: messages.pcInvoiceBackToList };
  return yard;
}

/**
 * PCA2 (UX-5-002): a purchase, an outside repair or an internal invoice reached from a Truck's Costs, a Work Order,
 * an internal invoice or its own filtered list goes back there; otherwise to its plain list.
 */
export function adminPartsOrigin(from: string | null | undefined, fallback: AdminTruckOrigin, messages: AdminMessages): AdminTruckOrigin {
  const safe = safeAdminPath(from);
  if (!safe) return fallback;
  const path = safe.split(/[?#]/)[0];
  if (path.startsWith('/admin/trucks/')) return { href: safe, backLabel: messages.backToTruckCosts };
  if (path.startsWith('/admin/work-orders/')) return { href: safe, backLabel: messages.backToWorkOrder };
  if (path.startsWith('/admin/parts/internal-invoices/')) return { href: safe, backLabel: messages.backToInternalInvoice };
  if (path === fallback.href.split(/[?#]/)[0]) return { ...fallback, href: safe };
  return fallback;
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
  // PCA2: a Work Order opened from an outside repair or an internal invoice goes back there.
  if (path.startsWith('/admin/parts/outside-repairs/')) return { href: from, backLabel: messages.backToOutsideRepair };
  if (path.startsWith('/admin/parts/internal-invoices/')) return { href: from, backLabel: messages.backToInternalInvoice };
  if (path === '/admin') return { href: from, backLabel: messages.backToDashboard };
  return list;
}
