import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages';
import { adminTruckHref, adminTruckOrigin, adminWorkOrderOrigin } from './admin-truck-origin';

const en = getAdminMessages('en');

describe('adminTruckOrigin (LTR-110)', () => {
  it('keeps Yard Operations when there is no origin', () => {
    expect(adminTruckOrigin(null, en)).toEqual({
      href: '/admin/yard-operations', backLabel: 'Back to Yard Operations',
    });
  });

  it('returns to Trucks, Work Orders, a Work Order or the Dashboard', () => {
    expect(adminTruckOrigin('/admin/trucks', en)).toMatchObject({ href: '/admin/trucks', backLabel: 'Back to Trucks' });
    expect(adminTruckOrigin('/admin/work-orders', en)).toMatchObject({ backLabel: 'Back to Work Orders' });
    expect(adminTruckOrigin('/admin/work-orders/abc', en)).toMatchObject({ href: '/admin/work-orders/abc', backLabel: 'Back to Work Order' });
    expect(adminTruckOrigin('/admin', en)).toMatchObject({ backLabel: 'Back to Dashboard' });
  });

  it('ignores external or protocol-relative origins', () => {
    expect(adminTruckOrigin('https://evil.example', en).href).toBe('/admin/yard-operations');
    expect(adminTruckOrigin('//evil.example/admin', en).href).toBe('/admin/yard-operations');
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
