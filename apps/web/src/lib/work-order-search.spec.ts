import { describe, expect, it } from 'vitest';
import {
  buildAdminWorkOrdersQuery,
  countActiveAdminWorkOrderFilters,
  DEFAULT_ADMIN_WORK_ORDER_FILTERS,
  hrefWithQuery,
  rankWorkOrderResults,
  readAdminWorkOrdersFilters,
} from './work-order-search';

const item = (
  displayId: string,
  truckNumber: string,
  extra: { category?: string; mechanic?: string } = {},
) => ({
  displayId,
  truck: { truckNumber },
  category: { name: extra.category ?? 'Brakes' },
  mechanics: extra.mechanic ? [{ mechanicName: extra.mechanic }] : [],
});

describe('Admin Work Order search query', () => {
  it('trims search, strips #, and omits default sort/status', () => {
    const query = buildAdminWorkOrdersQuery({
      search: ' # 9 ',
      status: 'all',
      priority: 'all',
      sort: 'updatedAt',
      direction: 'desc',
    });
    expect(query.toString()).toBe('search=9');
    expect(hrefWithQuery('/admin/work-orders', query)).toBe('/admin/work-orders?search=9');
    expect(hrefWithQuery('/admin/work-orders', new URLSearchParams())).toBe('/admin/work-orders');
  });

  it('preserves active filters and dashboard range on Apply', () => {
    const query = buildAdminWorkOrdersQuery({
      search: '9',
      status: 'open',
      priority: 'high,critical',
      sort: 'displayId',
      direction: 'asc',
    }, new URLSearchParams('createdBefore=2026-09-05T18:30:00.000Z'));
    expect(query.get('search')).toBe('9');
    expect(query.get('status')).toBe('created,in_progress,waiting_paused');
    expect(query.get('priority')).toBe('high,critical');
    expect(query.get('sort')).toBe('displayId');
    expect(query.get('direction')).toBe('asc');
    expect(query.get('createdBefore')).toBe('2026-09-05T18:30:00.000Z');
  });

  it('reads open-status dashboard links back into the form', () => {
    expect(readAdminWorkOrdersFilters(new URLSearchParams('status=created,in_progress,waiting_paused&search=9'))).toEqual({
      search: '9',
      status: 'open',
      priority: 'all',
      sort: 'updatedAt',
      direction: 'desc',
    });
  });

  it('treats empty search as clear', () => {
    expect(buildAdminWorkOrdersQuery({
      search: '   ',
      status: 'all',
      priority: 'all',
      sort: 'updatedAt',
      direction: 'desc',
    }).toString()).toBe('');
  });

  it('counts non-default filters and ignores search', () => {
    expect(countActiveAdminWorkOrderFilters(DEFAULT_ADMIN_WORK_ORDER_FILTERS)).toBe(0);
    expect(countActiveAdminWorkOrderFilters({
      ...DEFAULT_ADMIN_WORK_ORDER_FILTERS,
      status: 'open',
      priority: 'high',
    })).toBe(2);
    expect(countActiveAdminWorkOrderFilters({
      ...DEFAULT_ADMIN_WORK_ORDER_FILTERS,
      sort: 'displayId',
      direction: 'asc',
    }, new URLSearchParams('createdBefore=2026-09-05T18:30:00.000Z'))).toBe(3);
    expect(countActiveAdminWorkOrderFilters({
      ...DEFAULT_ADMIN_WORK_ORDER_FILTERS,
      search: '9',
    })).toBe(0);
  });
});

describe('rankWorkOrderResults', () => {
  it('ranks query 9 as WO/truck exact → prefix → contains', () => {
    const { results, isFallback } = rankWorkOrderResults([
      item('WO-0422', '9644'),
      item('WO-0609', '609'),
      item('WO-0101', 'T-101'),
      item('WO-0009', '9'),
      item('WO-0905', '905'),
      item('WO-0019', '19'),
    ], '9');
    const ids = results.map((row) => row.displayId);

    expect(isFallback).toBe(false);
    expect(ids[0]).toBe('WO-0009');
    expect(ids.slice(0, 3)).toEqual(['WO-0009', 'WO-0905', 'WO-0422']);
    expect(ids.indexOf('WO-0905')).toBeLessThan(ids.indexOf('WO-0609'));
    expect(ids.indexOf('WO-0422')).toBeLessThan(ids.indexOf('WO-0019'));
    expect(ids.indexOf('WO-0422')).toBeLessThan(ids.indexOf('WO-0609'));
    expect(ids).not.toContain('WO-0101');
  });

  it('matches WO number without the WO- prefix or padding', () => {
    const { results } = rankWorkOrderResults([
      item('WO-0422', '9644'),
      item('WO-0101', 'T-101'),
    ], '0422');
    expect(results.map((row) => row.displayId)).toEqual(['WO-0422']);
    expect(rankWorkOrderResults([
      item('WO-0422', '9644'),
      item('WO-0101', 'T-101'),
    ], '422').results.map((row) => row.displayId)).toEqual(['WO-0422']);
  });

  it('keeps category and mechanic contains matches', () => {
    expect(rankWorkOrderResults([
      item('WO-0101', 'T-101', { category: 'Suspension' }),
      item('WO-0102', 'T-102', { mechanic: 'Cristian Perez' }),
      item('WO-0103', 'T-103'),
    ], 'suspension').results.map((row) => row.displayId)).toEqual(['WO-0101']);
    expect(rankWorkOrderResults([
      item('WO-0101', 'T-101', { category: 'Suspension' }),
      item('WO-0102', 'T-102', { mechanic: 'Cristian Perez' }),
    ], 'cristian').results.map((row) => row.displayId)).toEqual(['WO-0102']);
  });

  it('returns the original order when search is empty', () => {
    const items = [item('WO-0422', '9644'), item('WO-0101', 'T-101')];
    expect(rankWorkOrderResults(items, '   ').results).toEqual(items);
  });
});
