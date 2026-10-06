import { describe, expect, it } from 'vitest';
import { WorkPlanPhase } from '@ltl-shop/shared';
import {
  buildYardOperationsQuery,
  countActiveYardOperationsFilters,
  countOverflowYardOperationsFilters,
  DEFAULT_YARD_OPERATIONS_FILTERS,
  readYardOperationsFilters,
  WORK_PLAN_YARD_PHASES,
  withYardQuickFilter,
  yardApiQuery,
  yardOperationsFromPath,
  yardQuickFilterOf,
} from './yard-operations-routing';

describe('Yard Operations URL filters', () => {
  it('round-trips supported filters without adding unsupported mechanic options', () => {
    const query = buildYardOperationsQuery({ search: 'Y-103', readiness: 'under_review', phase: 'required_work', workOrderStatus: 'in_progress', priority: 'critical', blocked: 'true', outOfShop: '', soon: '' });
    expect(query.toString()).toBe('search=Y-103&readiness=under_review&phase=required_work&workOrderStatus=in_progress&priority=critical&blocked=true');
    expect(readYardOperationsFilters(query)).toEqual({ search: 'Y-103', readiness: 'under_review', phase: 'required_work', workOrderStatus: 'in_progress', priority: 'critical', blocked: 'true', outOfShop: '', soon: '' });
  });

  it('does not preserve a cursor when applying new filters', () => {
    const query = buildYardOperationsQuery(DEFAULT_YARD_OPERATIONS_FILTERS);
    expect(query.has('cursor')).toBe(false);
  });

  it('counts non-default filters and ignores search', () => {
    expect(countActiveYardOperationsFilters(DEFAULT_YARD_OPERATIONS_FILTERS)).toBe(0);
    expect(countActiveYardOperationsFilters({
      ...DEFAULT_YARD_OPERATIONS_FILTERS,
      search: 'Y-103',
    })).toBe(0);
    expect(countActiveYardOperationsFilters({
      ...DEFAULT_YARD_OPERATIONS_FILTERS,
      phase: 'required_work',
      blocked: 'true',
    })).toBe(2);
    expect(countOverflowYardOperationsFilters({
      ...DEFAULT_YARD_OPERATIONS_FILTERS,
      phase: 'required_work',
      workOrderStatus: 'in_progress',
      priority: 'critical',
    })).toBe(2);
  });
});

describe('Yard quick filters (stage 6)', () => {
  it('one quick filter at a time, kept in the URL, the other filters untouched', () => {
    const base = { ...DEFAULT_YARD_OPERATIONS_FILTERS, search: '601', phase: 'pm' };
    const high = withYardQuickFilter(base, 'high');
    expect(yardQuickFilterOf(high)).toBe('high');
    expect(buildYardOperationsQuery(high).toString()).toBe('search=601&phase=pm&priority=high%2Ccritical');
    const out = withYardQuickFilter(high, 'out');
    expect(out).toMatchObject({ priority: '', outOfShop: 'true', search: '601', phase: 'pm' });
    expect(yardQuickFilterOf(withYardQuickFilter(out, 'all'))).toBe('all');
    expect(yardQuickFilterOf({ ...DEFAULT_YARD_OPERATIONS_FILTERS, blocked: 'true' })).toBe('blocked');
  });
});

describe('WORK_PLAN_YARD_PHASES', () => {
  it('LTR-144: shows PM after Shop Work and QC always (LTR-150: the only board)', () => {
    expect([...WORK_PLAN_YARD_PHASES]).toEqual([
      WorkPlanPhase.INSPECTION,
      WorkPlanPhase.SHOP_WORK,
      WorkPlanPhase.PM,
      WorkPlanPhase.ALIGNMENT,
      WorkPlanPhase.DETAILING,
      WorkPlanPhase.QUALITY_CHECK,
      WorkPlanPhase.READY_TO_CLOSE,
      WorkPlanPhase.READY_TO_GO,
    ]);
  });
});

describe('yardOperationsFromPath (D4 / UX-5-006)', () => {
  it('keeps search, filters, view and tab so the Truck back link returns to the same Yard', () => {
    expect(yardOperationsFromPath('search=918&blocked=true&view=list&tab=movement'))
      .toBe('/admin/yard-operations?search=918&blocked=true&view=list&tab=movement');
  });

  it('drops the pagination cursor and falls back to the plain Yard', () => {
    expect(yardOperationsFromPath('phase=pm&cursor=yard-page-2')).toBe('/admin/yard-operations?phase=pm');
    expect(yardOperationsFromPath('')).toBe('/admin/yard-operations');
  });

  it('Leaving soon is a quick filter, and the API query carries the soon Trucks (Stage 8)', () => {
    const soon = withYardQuickFilter(DEFAULT_YARD_OPERATIONS_FILTERS, 'soon');
    expect(soon.soon).toBe('true');
    expect(yardQuickFilterOf(soon)).toBe('soon');
    expect(withYardQuickFilter(soon, 'blocked').soon).toBe('');
    const departures = [
      { truckNumber: '601', outDate: '2026-10-06' },
      { truckNumber: '602', outDate: '2026-10-07T00:00:00Z' },
      { truckNumber: '603', outDate: '2026-10-09' },
      { truckNumber: '601', outDate: '2026-10-07' },
      { truckNumber: '604', outDate: null },
    ];
    expect(yardApiQuery('soon=true&tab=movement', departures, '2026-10-06', '2026-10-07')).toBe('soon=true&soonTrucks=601%2C602');
    expect(yardApiQuery('', [], '2026-10-06', '2026-10-07')).toBe('');
  });
});
