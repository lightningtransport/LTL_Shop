import { describe, expect, it } from 'vitest';
import { WorkPlanPhase } from '@ltl-shop/shared';
import {
  buildYardOperationsQuery,
  countActiveYardOperationsFilters,
  countOverflowYardOperationsFilters,
  DEFAULT_YARD_OPERATIONS_FILTERS,
  readYardOperationsFilters,
  WORK_PLAN_YARD_PHASES,
  YARD_PHASES,
  yardPhasesForBoard,
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

describe('yardPhasesForBoard', () => {
  it('keeps Phase 1 nine columns when cutover is off', () => {
    expect(yardPhasesForBoard({ workPlanBoardCutover: false })).toEqual([...YARD_PHASES]);
  });

  it('uses Work Plan opción A columns when cutover is on', () => {
    expect(yardPhasesForBoard({ workPlanBoardCutover: true })).toEqual([...WORK_PLAN_YARD_PHASES]);
  });

  it('inserts Quality Check only when a truck is in that phase', () => {
    expect(yardPhasesForBoard({
      workPlanBoardCutover: true,
      itemPhases: [WorkPlanPhase.QUALITY_CHECK, WorkPlanPhase.SHOP_WORK],
    })).toEqual([
      WorkPlanPhase.INSPECTION,
      WorkPlanPhase.SHOP_WORK,
      WorkPlanPhase.ALIGNMENT,
      WorkPlanPhase.DETAILING,
      WorkPlanPhase.QUALITY_CHECK,
      WorkPlanPhase.READY_TO_GO,
    ]);
  });
});
