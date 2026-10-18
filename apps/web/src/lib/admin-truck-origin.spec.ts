import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages-catalog';
import { adminListFromPath, adminTruckHref, adminTruckOrigin, adminWorkOrderHref, adminWorkOrderOrigin } from './admin-truck-origin';

const en = getAdminMessages('en');

describe('adminTruckOrigin (LTR-110)', () => {
  it('goes back to Trucks when there is no origin or it is unknown (LTR-245)', () => {
    expect(adminTruckOrigin(null, en)).toEqual({ href: '/admin/trucks', backLabel: 'Back to Trucks' });
    expect(adminTruckOrigin('/admin/somewhere-else', en)).toEqual({ href: '/admin/trucks', backLabel: 'Back to Trucks' });
  });

  it('goes back to the Yard and to Samsara with their own query (LTR-245)', () => {
    expect(adminTruckOrigin('/admin/yard-operations?tab=dispatch', en)).toEqual({ href: '/admin/yard-operations?tab=dispatch', backLabel: 'Back to Yard Operations' });
    expect(adminTruckOrigin('/admin/setup/samsara', en)).toEqual({ href: '/admin/setup/samsara', backLabel: 'Back to Samsara' });
  });

  it('keeps the list filters on the way back (LTR-245, UX-5-008)', () => {
    expect(adminTruckOrigin('/admin/trucks?search=9&status=all', en)).toEqual({ href: '/admin/trucks?search=9&status=all', backLabel: 'Back to Trucks' });
    expect(adminTruckOrigin('/admin/work-orders?status=blocked', en)).toEqual({ href: '/admin/work-orders?status=blocked', backLabel: 'Back to Work Orders' });
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

  it('builds a list origin with its filters, and a Work Order link that carries it (LTR-245)', () => {
    expect(adminListFromPath('/admin/trucks', '')).toBe('/admin/trucks');
    expect(adminListFromPath('/admin/trucks', 'search=9')).toBe('/admin/trucks?search=9');
    expect(adminWorkOrderHref('wo-1', '/admin/work-orders?status=blocked')).toBe('/admin/work-orders/wo-1?from=%2Fadmin%2Fwork-orders%3Fstatus%3Dblocked');
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
  it('goes back to the filtered Work Orders list (LTR-245)', () => {
    expect(adminWorkOrderOrigin('/admin/work-orders?status=blocked', '601', messages)).toEqual({ href: '/admin/work-orders?status=blocked', backLabel: 'Back to Work Orders' });
  });
});
