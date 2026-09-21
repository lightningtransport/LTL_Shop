import { describe, expect, it } from 'vitest';
import { hrefString, shouldClientNavigate } from './admin-nav';

describe('admin work-order first-click navigation', () => {
  it('takes unmodified left clicks and leaves modified clicks to the browser', () => {
    expect(shouldClientNavigate({ defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0 })).toBe(true);
    expect(shouldClientNavigate({ defaultPrevented: true, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0 })).toBe(false);
    expect(shouldClientNavigate({ defaultPrevented: false, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, button: 0 })).toBe(false);
    expect(shouldClientNavigate({ defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 1 })).toBe(false);
  });

  it('resolves Admin Work Orders hrefs without a hash sink', () => {
    expect(hrefString('/admin/work-orders')).toBe('/admin/work-orders');
    expect(hrefString({ pathname: '/admin/work-orders', search: '?status=open' })).toBe('/admin/work-orders?status=open');
    expect(hrefString('/admin/work-orders')).not.toBe('#');
  });
});
