import { describe, expect, it } from 'vitest';
import { WorkOrderStatus } from '@ltl-shop/shared';
import { canOfficiallyPauseWorkOrder } from './work-order-pause';

describe('canOfficiallyPauseWorkOrder', () => {
  it('allows pause only while the Work Order is In Progress', () => {
    expect(canOfficiallyPauseWorkOrder(WorkOrderStatus.IN_PROGRESS)).toBe(true);
    expect(canOfficiallyPauseWorkOrder(WorkOrderStatus.CREATED)).toBe(false);
    expect(canOfficiallyPauseWorkOrder(WorkOrderStatus.WAITING_PAUSED)).toBe(false);
    expect(canOfficiallyPauseWorkOrder(WorkOrderStatus.COMPLETED)).toBe(false);
    expect(canOfficiallyPauseWorkOrder(WorkOrderStatus.CANCELLED)).toBe(false);
  });
});
