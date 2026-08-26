import { describe, expect, it } from 'vitest';
import { OPEN_WORK_ORDER_STATUSES, PauseReason, WorkOrderStatus } from './enums';
import { createWorkOrderSchema } from './schemas';

describe('shared contracts', () => {
  it('treats created/in_progress/paused as open', () => {
    expect(OPEN_WORK_ORDER_STATUSES).toContain(WorkOrderStatus.CREATED);
    expect(OPEN_WORK_ORDER_STATUSES).toContain(WorkOrderStatus.IN_PROGRESS);
    expect(OPEN_WORK_ORDER_STATUSES).toContain(WorkOrderStatus.WAITING_PAUSED);
  });

  it('requires at least one job on create', () => {
    const result = createWorkOrderSchema.safeParse({
      truckId: '00000000-0000-0000-0000-000000000001',
      primaryCategoryId: '00000000-0000-0000-0000-000000000002',
      jobs: [],
    });
    expect(result.success).toBe(false);
  });

  it('includes end of shift pause reason', () => {
    expect(PauseReason.END_OF_SHIFT).toBe('end_of_shift');
  });
});
