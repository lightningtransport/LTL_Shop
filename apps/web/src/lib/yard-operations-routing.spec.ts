import { describe, expect, it } from 'vitest';
import {
  buildYardOperationsQuery,
  countActiveYardOperationsFilters,
  countOverflowYardOperationsFilters,
  DEFAULT_YARD_OPERATIONS_FILTERS,
  readYardOperationsFilters,
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
