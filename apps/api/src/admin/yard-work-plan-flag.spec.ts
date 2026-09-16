import { describe, expect, it } from 'vitest';
import { isYardWorkPlanSlice1Enabled, isYardWorkPlanSlice2Enabled } from './yard-work-plan-flag';

describe('isYardWorkPlanSlice1Enabled', () => {
  it('defaults off so Phase 1 gates stay canonical', () => {
    expect(isYardWorkPlanSlice1Enabled({})).toBe(false);
    expect(isYardWorkPlanSlice1Enabled({ YARD_WORK_PLAN_SLICE1: '' })).toBe(false);
    expect(isYardWorkPlanSlice1Enabled({ YARD_WORK_PLAN_SLICE1: 'false' })).toBe(false);
  });

  it('enables the Slice 1 Truck Detail attachment when explicitly on', () => {
    expect(isYardWorkPlanSlice1Enabled({ YARD_WORK_PLAN_SLICE1: 'true' })).toBe(true);
    expect(isYardWorkPlanSlice1Enabled({ YARD_WORK_PLAN_SLICE1: '1' })).toBe(true);
    expect(isYardWorkPlanSlice1Enabled({ YARD_WORK_PLAN_SLICE1: 'YES' })).toBe(true);
  });
});

describe('isYardWorkPlanSlice2Enabled', () => {
  it('defaults off so Yard board stays on six-gate phase', () => {
    expect(isYardWorkPlanSlice2Enabled({})).toBe(false);
    expect(isYardWorkPlanSlice2Enabled({ YARD_WORK_PLAN_SLICE2: '' })).toBe(false);
    expect(isYardWorkPlanSlice2Enabled({ YARD_WORK_PLAN_SLICE2: 'false' })).toBe(false);
  });

  it('enables board/list Work Plan phase cutover when explicitly on', () => {
    expect(isYardWorkPlanSlice2Enabled({ YARD_WORK_PLAN_SLICE2: 'true' })).toBe(true);
    expect(isYardWorkPlanSlice2Enabled({ YARD_WORK_PLAN_SLICE2: '1' })).toBe(true);
    expect(isYardWorkPlanSlice2Enabled({ YARD_WORK_PLAN_SLICE2: 'YES' })).toBe(true);
  });

  it('does not inherit Slice 1 — Detail-only flag leaves board on Phase 1', () => {
    expect(isYardWorkPlanSlice2Enabled({ YARD_WORK_PLAN_SLICE1: 'true' })).toBe(false);
  });
});
