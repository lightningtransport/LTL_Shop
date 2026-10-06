import { describe, expect, it } from 'vitest';
import { WorkPlanPhase } from '@ltl-shop/shared';
import {
  buildYardOperationsQuery,
  countActiveYardOperationsFilters,
  countOverflowYardOperationsFilters,
  DEFAULT_YARD_OPERATIONS_FILTERS,
  readYardOperationsFilters,
  WORK_PLAN_YARD_PHASES,
  yardOperationsFromPath,
} from './yard-operations-routing';

describe('Yard Operations URL filters', () => {
  it('round-trips supported filters without adding unsupported mechanic options', () => {
    const query = buildYardOperationsQuery({ search: 'Y-103', readiness: 'under_review', phase: 'required_work', workOrderStatus: 'in_progress', priority: 'critical', blocked: 'true' });
    expect(query.toString()).toBe('search=Y-103&readiness=under_review&phase=required_work&workOrderStatus=in_progress&priority=critical&blocked=true');
    expect(readYardOperationsFilters(query)).toEqual({ search: 'Y-103', readiness: 'under_review', phase: 'required_work', workOrderStatus: 'in_progress', priority: 'critical', blocked: 'true' });
  });

  it('does not preserve a cursor when applying new filters', () => {
    const query = buildYardOperationsQuery({ search: '', readiness: '', phase: '', workOrderStatus: '', priority: '', blocked: '' });
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
});
