import { describe, expect, it } from 'vitest';
import { OPEN_WORK_ORDER_STATUSES, PauseReason, WorkOrderStatus } from './enums';
import {
  adminListQuerySchema,
  adminMutationMetaSchema,
  createWorkOrderSchema,
} from './schemas';

describe('shared contracts', () => {
  it('treats created/in_progress/paused as open', () => {
    expect(OPEN_WORK_ORDER_STATUSES).toContain(WorkOrderStatus.CREATED);
    expect(OPEN_WORK_ORDER_STATUSES).toContain(WorkOrderStatus.IN_PROGRESS);
    expect(OPEN_WORK_ORDER_STATUSES).toContain(WorkOrderStatus.WAITING_PAUSED);
  });

  it('allows category-specific job validation in the service', () => {
    const result = createWorkOrderSchema.safeParse({
      truckId: '00000000-0000-0000-0000-000000000001',
      primaryCategoryId: '00000000-0000-0000-0000-000000000002',
      jobs: [],
    });
    expect(result.success).toBe(true);
  });

  it('includes end of shift pause reason', () => {
    expect(PauseReason.END_OF_SHIFT).toBe('end_of_shift');
  });

  it('bounds Admin pagination and applies safe defaults', () => {
    expect(adminListQuerySchema.parse({})).toMatchObject({ limit: 25, direction: 'asc' });
    expect(adminListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('requires version and UUID idempotency for Admin mutations', () => {
    expect(adminMutationMetaSchema.safeParse({
      expectedVersion: 2,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    }).success).toBe(true);
    expect(adminMutationMetaSchema.safeParse({ expectedVersion: 2 }).success).toBe(false);
  });
});
