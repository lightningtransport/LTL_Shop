import { describe, expect, it } from 'vitest';
import {
  OPEN_WORK_ORDER_STATUSES,
  PauseReason,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  WorkOrderStatus,
} from './enums';
import {
  adminListQuerySchema,
  adminHistoryQuerySchema,
  adminMechanicsQuerySchema,
  adminTrucksQuerySchema,
  adminAddWorkOrderMechanicSchema,
  adminCancelWorkOrderSchema,
  adminMutationMetaSchema,
  adminRepairHistoryQuerySchema,
  adminYardOperationsQuerySchema,
  adminWorkOrderCursorSchema,
  adminWorkOrdersQuerySchema,
  updateReadinessRequirementSchema,
  addJobSchema,
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

  it('applies read-only Work Order defaults and accepts supported filters', () => {
    expect(adminWorkOrdersQuerySchema.parse({})).toMatchObject({
      limit: 25,
      sort: 'updatedAt',
      direction: 'desc',
    });
    expect(adminWorkOrdersQuerySchema.parse({
      status: 'created,waiting_paused',
      priority: 'high,critical',
      createdBefore: '2026-09-08T12:00:00.000Z',
      completedFrom: '2026-09-01T00:00:00-04:00',
      completedBefore: '2026-09-09T00:00:00-04:00',
    })).toMatchObject({
      status: ['created', 'waiting_paused'],
      priority: ['high', 'critical'],
    });
  });

  it('rejects unsupported Work Order filters, limits, and malformed cursors', () => {
    expect(adminWorkOrdersQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
    expect(adminWorkOrdersQuerySchema.safeParse({ priority: 'urgent' }).success).toBe(false);
    expect(adminWorkOrdersQuerySchema.safeParse({ sort: 'priority' }).success).toBe(false);
    expect(adminWorkOrdersQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(adminWorkOrdersQuerySchema.safeParse({ cursor: 'not+a+cursor' }).success).toBe(false);
    expect(adminWorkOrderCursorSchema.safeParse({
      sort: 'updatedAt', direction: 'desc', value: '', id: 'bad-id',
    }).success).toBe(false);
    expect(adminRepairHistoryQuerySchema.parse({
      excludeWorkOrderId: '00000000-0000-4000-8000-000000000001',
    })).toMatchObject({
      excludeWorkOrderId: '00000000-0000-4000-8000-000000000001',
      limit: 5,
    });
    expect(adminRepairHistoryQuerySchema.safeParse({ limit: 26 }).success).toBe(false);
    expect(adminWorkOrdersQuerySchema.safeParse({ createdBefore: 'not-a-date' }).success).toBe(false);
  });

  it('scopes History to closed Work Orders and paginates Mechanics', async () => {
    expect(adminHistoryQuerySchema.parse({})).toMatchObject({
      limit: 25,
      sort: 'updatedAt',
      direction: 'desc',
    });
    expect(adminHistoryQuerySchema.parse({ status: 'completed' }).status).toEqual(['completed']);
    expect(adminHistoryQuerySchema.safeParse({ status: 'in_progress' }).success).toBe(false);
    expect(adminMechanicsQuerySchema.parse({}).direction).toBe('asc');
    expect(adminMechanicsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(adminTrucksQuerySchema.parse({}).direction).toBe('asc');
    expect(adminTrucksQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('requires version and UUID idempotency for Admin mutations', () => {
    expect(adminMutationMetaSchema.safeParse({
      expectedVersion: 2,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    }).success).toBe(true);
    expect(adminMutationMetaSchema.safeParse({ expectedVersion: 2 }).success).toBe(false);
    expect(adminAddWorkOrderMechanicSchema.safeParse({
      mechanicId: '00000000-0000-4000-8000-000000000002',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000003',
    }).success).toBe(true);
    expect(adminAddWorkOrderMechanicSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000003',
    }).success).toBe(false);
    expect(adminCancelWorkOrderSchema.safeParse({
      reason: 'Duplicate Work Order',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    }).success).toBe(true);
    expect(adminCancelWorkOrderSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    }).success).toBe(false);
  });

  it('requires version and UUID idempotency for Add Job mutations', () => {
    const base = {
      categoryId: '00000000-0000-4000-8000-000000000001',
      displayName: 'Brake inspection',
      expectedVersion: 3,
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
    };
    expect(addJobSchema.safeParse(base).success).toBe(true);
    expect(addJobSchema.safeParse({ ...base, idempotencyKey: undefined }).success).toBe(false);
    expect(addJobSchema.safeParse({ ...base, expectedVersion: -1 }).success).toBe(false);
  });

  it('requires a reason when waiving a readiness requirement', () => {
    const base = {
      type: ReadinessRequirementType.INSPECTION,
      outcome: ReadinessRequirementOutcome.WAIVED,
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    };
    expect(updateReadinessRequirementSchema.safeParse(base).success).toBe(false);
    expect(updateReadinessRequirementSchema.safeParse({ ...base, waiverReason: 'Not required for this visit' }).success).toBe(true);
  });

  it('parses Yard Operations filters with safe pagination defaults', () => {
    expect(adminYardOperationsQuerySchema.parse({
      readiness: 'under_review,ready',
      phase: 'inspection,required_work',
      workOrderStatus: 'created,waiting_paused',
      priority: 'high,critical',
      blocked: 'true',
    })).toMatchObject({
      limit: 25,
      readiness: ['under_review', 'ready'],
      phase: ['inspection', 'required_work'],
      workOrderStatus: ['created', 'waiting_paused'],
      priority: ['high', 'critical'],
      blocked: true,
    });
    expect(adminYardOperationsQuerySchema.parse({ blocked: 'false' }).blocked).toBe(false);
    expect(adminYardOperationsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
