import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages-catalog';
import {
  adminListFromPath,
  adminTruckHref,
  adminTruckOrigin,
  adminTruckOriginCrumb,
  adminWorkOrderHref,
  adminWorkOrderOrigin,
  adminWorkOrderParentCrumb,
} from './admin-truck-origin';

const en = getAdminMessages('en');

describe('adminTruckOrigin (LTR-110)', () => {
  it('goes to Trucks when there is no origin (LTR-245: the item the menu marks)', () => {
    expect(adminTruckOrigin(null, en)).toEqual({ href: '/admin/trucks', backLabel: 'Back to Trucks' });
  });

  it('goes to Trucks when the origin is unknown (LTR-245 / UX-5-006)', () => {
    expect(adminTruckOrigin('/admin/setup/workflow', en)).toEqual({ href: '/admin/trucks', backLabel: 'Back to Trucks' });
  });

  it('keeps the list filters of the origin (LTR-245 / UX-5-008)', () => {
    expect(adminTruckOrigin('/admin/trucks?search=9&status=all', en)).toEqual({ href: '/admin/trucks?search=9&status=all', backLabel: 'Back to Trucks' });
    expect(adminTruckOrigin('/admin/work-orders?status=WAITING_PARTS', en).href).toBe('/admin/work-orders?status=WAITING_PARTS');
    expect(adminTruckOrigin('/admin/yard-operations?tab=dispatch', en)).toEqual({ href: '/admin/yard-operations?tab=dispatch', backLabel: 'Back to Yard Operations' });
  });

  it('goes back to Samsara pairing (LTR-245 / UX-5-006)', () => {
    expect(adminTruckOrigin('/admin/setup/samsara', en)).toEqual({ href: '/admin/setup/samsara', backLabel: 'Back to Samsara' });
  });

  it('returns to Trucks, Work Orders, a Work Order or the Dashboard', () => {
    expect(adminTruckOrigin('/admin/trucks', en)).toMatchObject({ href: '/admin/trucks', backLabel: 'Back to Trucks' });
    expect(adminTruckOrigin('/admin/work-orders', en)).toMatchObject({ backLabel: 'Back to Work Orders' });
    expect(adminTruckOrigin('/admin/work-orders/abc', en)).toMatchObject({ href: '/admin/work-orders/abc', backLabel: 'Back to Work Order' });
    expect(adminTruckOrigin('/admin', en)).toMatchObject({ backLabel: 'Back to Dashboard' });
  });

  it('ignores external or protocol-relative origins', () => {
    expect(adminTruckOrigin('https://evil.example', en).href).toBe('/admin/trucks');
    expect(adminTruckOrigin('//evil.example/admin', en).href).toBe('/admin/trucks');
  });

  it('builds the link with an encoded origin', () => {
    expect(adminTruckHref('t-1', '/admin/work-orders/wo-1')).toBe('/admin/trucks/t-1?from=%2Fadmin%2Fwork-orders%2Fwo-1');
  });
});

describe('Work Order back link (stage 4 / T4)', () => {
  const messages = getAdminMessages('en');
  it('goes back to the Truck it came from', () => {
    expect(adminWorkOrderOrigin('/admin/trucks/t1?from=%2Fadmin', '601', messages)).toEqual({ href: '/admin/trucks/t1?from=%2Fadmin', backLabel: 'Back to Truck 601' });
  });
  it('falls back to the Work Orders list for missing or foreign origins', () => {
    expect(adminWorkOrderOrigin(null, '601', messages).href).toBe('/admin/work-orders');
    expect(adminWorkOrderOrigin('//evil.com/admin', '601', messages).href).toBe('/admin/work-orders');
    expect(adminWorkOrderOrigin('https://evil.com', '601', messages).href).toBe('/admin/work-orders');
  });
});

describe('Truck breadcrumb parent (LTR-245 / UX-5-006)', () => {
  it('names the screen the Truck was opened from', () => {
    expect(adminTruckOriginCrumb('/admin/trucks?search=9', en)).toBe('Trucks');
    expect(adminTruckOriginCrumb('/admin/yard-operations?tab=dispatch', en)).toBe('Yard Operations');
    expect(adminTruckOriginCrumb('/admin/work-orders/wo-1', en)).toBe('Work Order');
    expect(adminTruckOriginCrumb('/admin/setup/samsara', en)).toBe('Samsara');
    expect(adminTruckOriginCrumb('/admin/parts/purchases/p-1', en)).toBe(en.pcPurchases);
  });
  it('says Trucks for anything else', () => {
    expect(adminTruckOriginCrumb(adminTruckOrigin('/admin/setup/workflow', en).href, en)).toBe('Trucks');
  });
});

describe('from builders (LTR-245 / UX-5-008)', () => {
  it('keeps the list query, with or without "?"', () => {
    expect(adminListFromPath('/admin/trucks', 'search=9&status=all')).toBe('/admin/trucks?search=9&status=all');
    expect(adminListFromPath('/admin/trucks', '?search=9')).toBe('/admin/trucks?search=9');
    expect(adminListFromPath('/admin/work-orders', new URLSearchParams({ status: 'WAITING_PARTS' }))).toBe('/admin/work-orders?status=WAITING_PARTS');
  });
  it('is the bare path without a query', () => {
    expect(adminListFromPath('/admin/trucks', '')).toBe('/admin/trucks');
    expect(adminListFromPath('/admin/trucks', null)).toBe('/admin/trucks');
  });
  it('encodes the whole origin, query included, into the link', () => {
    expect(adminTruckHref('t-1', '/admin/trucks?search=9&status=all')).toBe('/admin/trucks/t-1?from=%2Fadmin%2Ftrucks%3Fsearch%3D9%26status%3Dall');
    expect(adminWorkOrderHref('wo-1', '/admin/work-orders?status=OPEN')).toBe('/admin/work-orders/wo-1?from=%2Fadmin%2Fwork-orders%3Fstatus%3DOPEN');
  });
});

describe('Work Order breadcrumb parent (LTR-245 / UX-5-008)', () => {
  it('goes back to the filtered list it came from', () => {
    expect(adminWorkOrderParentCrumb('/admin/work-orders?status=OPEN', en)).toEqual({ label: 'Work Orders', href: '/admin/work-orders?status=OPEN' });
    expect(adminWorkOrderParentCrumb('/admin/trucks?search=9', en)).toEqual({ label: 'Trucks', href: '/admin/trucks?search=9' });
    expect(adminWorkOrderParentCrumb('/admin/history?status=CLOSED', en)).toEqual({ label: 'History', href: '/admin/history?status=CLOSED' });
  });
  it('names the Dashboard and Parts & costs', () => {
    expect(adminWorkOrderParentCrumb('/admin', en)).toEqual({ label: 'Dashboard', href: '/admin' });
    expect(adminWorkOrderParentCrumb('/admin/parts/outside-repairs/r-1', en)).toEqual({ label: en.pcOutsideRepairs, href: '/admin/parts/outside-repairs/r-1' });
  });
  it('falls back to the plain Work Orders list', () => {
    expect(adminWorkOrderParentCrumb(null, en)).toEqual({ label: 'Work Orders', href: '/admin/work-orders' });
    expect(adminWorkOrderParentCrumb('/admin/setup/workflow', en)).toEqual({ label: 'Work Orders', href: '/admin/work-orders' });
    expect(adminWorkOrderParentCrumb('//evil.example/admin', en)).toEqual({ label: 'Work Orders', href: '/admin/work-orders' });
  });
});
