import { describe, expect, it } from 'vitest';
import {
  cacheKeyPath,
  isAdminWorkOrdersListKey,
  isMechanicWorkOrdersListKey,
  isWorkOrderRelatedListKey,
  isYardRelatedListKey,
} from './swr-cache-keys';

describe('swr cache key matchers', () => {
  it('unwraps SWR Infinite $inf$ prefixes', () => {
    expect(cacheKeyPath('$inf$/api/admin/work-orders?limit=25')).toBe('/api/admin/work-orders?limit=25');
    expect(cacheKeyPath('/api/admin/work-orders?limit=25')).toBe('/api/admin/work-orders?limit=25');
  });

  it('matches Admin WO list pages without touching WO detail', () => {
    expect(isAdminWorkOrdersListKey('/api/admin/work-orders?limit=25')).toBe(true);
    expect(isAdminWorkOrdersListKey('$inf$/api/admin/work-orders?status=open&limit=25')).toBe(true);
    expect(isAdminWorkOrdersListKey('/api/admin/work-orders/wo-1')).toBe(false);
    expect(isAdminWorkOrdersListKey('$inf$/api/admin/work-orders/wo-1')).toBe(false);
  });

  it('matches mechanic home lists without touching WO detail', () => {
    expect(isMechanicWorkOrdersListKey('/api/work-orders')).toBe(true);
    expect(isMechanicWorkOrdersListKey('/api/work-orders?mode=standard')).toBe(true);
    expect(isMechanicWorkOrdersListKey('/api/work-orders/wo-1')).toBe(false);
    expect(isMechanicWorkOrdersListKey('/api/work-orders/wo-1/pm')).toBe(false);
  });

  it('scopes WO-related invalidation to operational lists', () => {
    expect(isWorkOrderRelatedListKey('/api/admin/work-orders?limit=25')).toBe(true);
    expect(isWorkOrderRelatedListKey('/api/admin/dashboard')).toBe(true);
    expect(isWorkOrderRelatedListKey('/api/admin/history?limit=25')).toBe(true);
    expect(isWorkOrderRelatedListKey('$inf$/api/admin/yard-operations?limit=25')).toBe(true);
    expect(isWorkOrderRelatedListKey('/api/admin/trucks/truck-1/repair-history?limit=5')).toBe(true);
    expect(isWorkOrderRelatedListKey('/api/admin/work-orders/wo-1')).toBe(false);
    expect(isWorkOrderRelatedListKey('/api/admin/catalog/categories')).toBe(false);
  });

  it('scopes Yard invalidation to yard, dashboard, trucks list, and WO list', () => {
    expect(isYardRelatedListKey('$inf$/api/admin/yard-operations?limit=25')).toBe(true);
    expect(isYardRelatedListKey('/api/admin/trucks?limit=25')).toBe(true);
    expect(isYardRelatedListKey('/api/admin/work-orders?limit=25')).toBe(true);
    expect(isYardRelatedListKey('/api/admin/trucks/truck-1')).toBe(false);
    expect(isYardRelatedListKey('/api/admin/mechanics?limit=25')).toBe(false);
  });
});
