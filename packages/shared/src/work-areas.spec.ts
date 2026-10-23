import { describe, expect, it } from 'vitest';
import { ShopWorkflowStepKey, WorkPlanJobLane } from './enums';
import { WORK_AREA_ORDER, jobArea, workAreaOf } from './work-areas';

const shop = (displayName: string, categoryName: string, workflowStepKey?: string | null) => ({
  lane: WorkPlanJobLane.SHOP_WORK, displayName, categoryName, workflowStepKey,
});

describe('work areas (D57)', () => {
  it('WORK_AREA_ORDER is inspection, pm, alignment, shop_work, detailing, quality_check', () => {
    expect([...WORK_AREA_ORDER]).toEqual(['inspection', 'pm', 'alignment', 'shop_work', 'detailing', 'quality_check']);
  });

  it('Tires and Flat Repair in Tires & Wheels are Alignment', () => {
    expect(workAreaOf(shop('Tires', 'Tires & Wheels'))).toBe(WorkPlanJobLane.ALIGNMENT);
    expect(workAreaOf(shop('Flat Repair', 'Tires & Wheels'))).toBe(WorkPlanJobLane.ALIGNMENT);
  });

  it('other Tires & Wheels Jobs stay in Shop Work', () => {
    expect(workAreaOf(shop('Wheel Seals', 'Tires & Wheels'))).toBe(WorkPlanJobLane.SHOP_WORK);
    expect(workAreaOf(shop('Tire Rotation', 'Tires & Wheels'))).toBe(WorkPlanJobLane.SHOP_WORK);
  });

  it('Tires outside the Tires & Wheels category stays in Shop Work', () => {
    expect(workAreaOf(shop('Tires', 'Brakes'))).toBe(WorkPlanJobLane.SHOP_WORK);
  });

  it('a Shop Work Job with a workflow step key goes to that area', () => {
    expect(workAreaOf(shop('Anything', 'Misc', ShopWorkflowStepKey.ALIGNMENT))).toBe(WorkPlanJobLane.ALIGNMENT);
    expect(workAreaOf(shop('Anything', 'Misc', ShopWorkflowStepKey.PM))).toBe(WorkPlanJobLane.PM);
    expect(workAreaOf(shop('Anything', 'Misc', ShopWorkflowStepKey.DETAILING))).toBe(WorkPlanJobLane.DETAILING);
  });

  it('other lanes are returned unchanged even with a workflow step key', () => {
    for (const lane of [WorkPlanJobLane.PM, WorkPlanJobLane.DETAILING, WorkPlanJobLane.QUALITY_CHECK, WorkPlanJobLane.INSPECTION]) {
      expect(workAreaOf({ lane, displayName: 'Tires', categoryName: 'Tires & Wheels', workflowStepKey: ShopWorkflowStepKey.ALIGNMENT })).toBe(lane);
    }
  });

  it('jobArea falls back to the lane', () => {
    expect(jobArea({ lane: WorkPlanJobLane.SHOP_WORK })).toBe(WorkPlanJobLane.SHOP_WORK);
    expect(jobArea({ lane: WorkPlanJobLane.SHOP_WORK, area: null })).toBe(WorkPlanJobLane.SHOP_WORK);
    expect(jobArea({ lane: WorkPlanJobLane.SHOP_WORK, area: WorkPlanJobLane.ALIGNMENT })).toBe(WorkPlanJobLane.ALIGNMENT);
  });
});
