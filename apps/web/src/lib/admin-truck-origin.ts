import type { AdminMessages } from './admin-messages';

/**
 * LTR-110: Truck Detail is reached from Trucks, Yard Operations and Work Orders.
 * Links pass `?from=<admin path>` so the back link matches the origin.
 * LTR-245 (UX-5-006): unknown or missing origins go to Trucks, the item the menu marks.
 */
export type AdminTruckOrigin = {
  href: string;
  backLabel: string;
};

/**
 * LTR-245 (UX-5-008): a list passes itself with its query as `from`, so going back keeps its filters
 * (the Yard's pattern). `search` may come with or without the leading "?".
 */
export function adminListFromPath(pathname: string, search: string | URLSearchParams | null | undefined) {
  const query = (search ?? '').toString().replace(/^\?/, '');
  return query ? `${pathname}?${query}` : pathname;
}

/** LTR-245: a Work Order link that knows where it was opened from. */
export function adminWorkOrderHref(workOrderId: string, fromPath: string) {
  return `/admin/work-orders/${workOrderId}?from=${encodeURIComponent(fromPath)}`;
}

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
  const trucks = { href: '/admin/trucks', backLabel: messages.backToTrucks };
  // Only same-app Admin paths; never follow an external or protocol-relative URL.
  if (!from || !from.startsWith('/admin') || from.startsWith('//')) return trucks;
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
  if (path === '/admin/yard-operations') return { href: from, backLabel: messages.backToYardOperations };
  if (path === '/admin/setup/samsara') return { href: from, backLabel: messages.backToSamsara };
  // PCA2: Parts & costs → Truck (Costs tab) → back to the purchase, the outside repair, the invoice or the list.
  if (path.startsWith('/admin/parts/purchases/')) return { href: from, backLabel: messages.backToPurchase };
  if (path === '/admin/parts/purchases') return { href: from, backLabel: messages.pcBackToPurchases };
  if (path.startsWith('/admin/parts/outside-repairs/')) return { href: from, backLabel: messages.backToOutsideRepair };
  if (path === '/admin/parts/outside-repairs') return { href: from, backLabel: messages.pcBackToOutside };
  if (path.startsWith('/admin/parts/internal-invoices/')) return { href: from, backLabel: messages.backToInternalInvoice };
  if (path === '/admin/parts/internal-invoices') return { href: from, backLabel: messages.pcInvoiceBackToList };
  return trucks;
}

/** The Truck breadcrumb's parent ("Trucks › 601"): the screen the Truck was opened from. */
export function adminTruckOriginCrumb(href: string, messages: AdminMessages) {
  const path = href.split(/[?#]/)[0];
  if (path === '/admin/yard-operations') return messages.yardOperations;
  if (path === '/admin/work-orders') return messages.workOrders;
  if (path.startsWith('/admin/work-orders/')) return messages.workOrder;
  if (path === '/admin') return messages.dashboard;
  if (path === '/admin/setup/samsara') return messages.samsaraNav;
  // PCA2: opened from Parts & costs.
  if (path.startsWith('/admin/parts/purchases')) return messages.pcPurchases;
  if (path.startsWith('/admin/parts/outside-repairs')) return messages.pcOutsideRepairs;
  if (path.startsWith('/admin/parts/internal-invoices')) return messages.pcInvoices;
  return messages.trucks;
}

/**
 * LTR-245 (UX-5-008): the Work Order breadcrumb's parent when it was not opened from its Truck. The Work Orders list
 * keeps its filters; the Dashboard, Trucks, History or Parts & costs name themselves; anything else is the plain list.
 */
export function adminWorkOrderParentCrumb(from: string | null | undefined, messages: AdminMessages): { label: string; href: string } {
  const list = { label: messages.workOrders, href: '/admin/work-orders' };
  const safe = safeAdminPath(from);
  if (!safe) return list;
  const path = safe.split(/[?#]/)[0];
  if (path === '/admin/work-orders') return { label: messages.workOrders, href: safe };
  if (path === '/admin') return { label: messages.dashboard, href: safe };
  if (path === '/admin/trucks') return { label: messages.trucks, href: safe };
  if (path === '/admin/history') return { label: messages.history, href: safe };
  if (path.startsWith('/admin/parts/purchases')) return { label: messages.pcPurchases, href: safe };
  if (path.startsWith('/admin/parts/outside-repairs')) return { label: messages.pcOutsideRepairs, href: safe };
  if (path.startsWith('/admin/parts/internal-invoices')) return { label: messages.pcInvoices, href: safe };
  return list;
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
