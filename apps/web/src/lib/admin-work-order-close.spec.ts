import { describe, expect, it } from 'vitest';
import { isAdminWorkOrderReadyToClose } from './admin-work-order-close';

describe('admin work-order ready-to-close gate', () => {
  it('requires work_orders.manage, an open WO, and no open Standard jobs', () => {
    expect(isAdminWorkOrderReadyToClose({
      canManageWorkOrders: true,
      status: 'in_progress',
      categoryName: 'Brakes',
      jobs: [{ status: 'completed' }],
    })).toBe(true);
    expect(isAdminWorkOrderReadyToClose({
      canManageWorkOrders: false,
      status: 'in_progress',
      categoryName: 'Brakes',
      jobs: [{ status: 'completed' }],
    })).toBe(false);
    expect(isAdminWorkOrderReadyToClose({
      canManageWorkOrders: true,
      status: 'in_progress',
      categoryName: 'Brakes',
      jobs: [{ status: 'to_do' }],
    })).toBe(false);
    // LTR-175: the PM mechanic and the Manager can finish every Job without a Standard Start.
    expect(isAdminWorkOrderReadyToClose({
      canManageWorkOrders: true,
      status: 'created',
      categoryName: 'Brakes',
      jobs: [{ status: 'completed' }],
    })).toBe(true);
    expect(isAdminWorkOrderReadyToClose({
      canManageWorkOrders: true,
      status: 'waiting_paused',
      categoryName: 'Brakes',
      jobs: [{ status: 'completed' }],
    })).toBe(false);
  });

  it('does not treat Ready to Go or Returned to Service as Complete', () => {
    expect(isAdminWorkOrderReadyToClose({
      canManageWorkOrders: true,
      status: 'completed',
      categoryName: 'Brakes',
      jobs: [{ status: 'completed' }],
    })).toBe(false);
  });
});
