import { describe, expect, it } from 'vitest';
import { isYardWorkPlanSlice1Enabled } from './yard-work-plan-flag';

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
