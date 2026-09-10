import { describe, expect, it } from 'vitest';
import { publicRequestRoute } from './public-request-route';

describe('publicRequestRoute', () => {
  it('prefers the Nest route path and prefixes /api', () => {
    expect(
      publicRequestRoute({
        originalUrl: '/api/admin/work-orders/d2262a20-0862-4f18-a6c8-184a88a42f78',
        route: { path: '/admin/work-orders/:id' },
      }),
    ).toBe('/api/admin/work-orders/:id');
  });

  it('strips UUIDs when Nest did not bind a route', () => {
    expect(
      publicRequestRoute({
        originalUrl: '/api/work-orders/d2262a20-0862-4f18-a6c8-184a88a42f78?x=1',
      }),
    ).toBe('/api/work-orders/:id');
  });
});
