import { describe, expect, it } from 'vitest';
import {
  OPEN_WORK_ORDER_STATUSES,
  PauseReason,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  WorkOrderStatus,
  WorkPlanInspectionOutcome,
} from './enums';
import type { YardDataBoundaryDto } from './types';
import {
  adminListQuerySchema,
  adminHistoryQuerySchema,
  adminMechanicsQuerySchema,
  adminTrucksQuerySchema,
  adminCancelWorkOrderSchema,
  adminCompleteWorkOrderSchema,
  adminReopenWorkOrderSchema,
  adminPatchWorkOrderSchema,
  adminTimeCorrectionSchema,
  adminCancelJobSchema,
  adminCompleteJobSchema,
  completeJobSchema,
  adminReopenJobSchema,
  adminReturnToServiceSchema,
  adminMutationMetaSchema,
  adminRepairHistoryQuerySchema,
  adminYardOperationsQuerySchema,
  adminWorkOrderCursorSchema,
  adminWorkOrdersQuerySchema,
  updateReadinessRequirementSchema,
  addJobSchema,
  createWorkOrderSchema,
  addWorkPlanJobsSchema,
  recordWorkPlanInspectionSchema,
  adminCreateMechanicSchema,
  adminUpdateMechanicSchema,
  adminCreateCatalogJobSchema,
  adminUpdateCatalogJobSchema,
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
    expect(adminCancelWorkOrderSchema.safeParse({
      reason: 'Duplicate Work Order',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    }).success).toBe(true);
    expect(adminCancelWorkOrderSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    }).success).toBe(false);
    expect(adminCompleteWorkOrderSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000005',
    }).success).toBe(true);
    expect(adminCompleteJobSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000015',
      notes: 'Replaced the hose',
    }).success).toBe(true);
    expect(completeJobSchema.safeParse({ notes: 'Replaced the hose' }).success).toBe(true);
    expect(completeJobSchema.safeParse({}).success).toBe(true);
    expect(completeJobSchema.safeParse({ notes: 'x'.repeat(2001) }).success).toBe(false);
    expect(adminCompleteWorkOrderSchema.safeParse({
      idempotencyKey: '00000000-0000-4000-8000-000000000005',
    }).success).toBe(false);
    expect(adminReopenWorkOrderSchema.safeParse({
      reason: 'More work found',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000006',
    }).success).toBe(true);
    expect(adminReopenWorkOrderSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000006',
    }).success).toBe(false);
    expect(adminPatchWorkOrderSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000007',
      notes: 'Check the leak again',
    }).success).toBe(true);
    expect(adminPatchWorkOrderSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000007',
      priority: 'high',
    }).success).toBe(true);
    expect(adminPatchWorkOrderSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000007',
      notes: null,
    }).success).toBe(true);
    expect(adminPatchWorkOrderSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000007',
    }).success).toBe(false);
    expect(adminPatchWorkOrderSchema.safeParse({
      notes: 'Check the leak again',
    }).success).toBe(false);
    expect(adminTimeCorrectionSchema.safeParse({
      workOrderId: '00000000-0000-4000-8000-000000000011',
      targetType: 'work_session',
      targetId: '00000000-0000-4000-8000-000000000701',
      endedAt: '2026-09-06T17:30:00.000Z',
      reason: 'Clock was wrong',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000008',
    }).success).toBe(true);
    expect(adminTimeCorrectionSchema.safeParse({
      workOrderId: '00000000-0000-4000-8000-000000000011',
      targetType: 'work_session',
      targetId: '00000000-0000-4000-8000-000000000701',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000008',
    }).success).toBe(false);
    expect(adminCancelJobSchema.safeParse({
      reason: 'Not needed',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000009',
    }).success).toBe(true);
    expect(adminCancelJobSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000009',
    }).success).toBe(false);
    expect(adminCompleteJobSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000019',
    }).success).toBe(true);
    expect(adminCompleteJobSchema.safeParse({
      expectedVersion: 1,
    }).success).toBe(false);
    expect(adminReopenJobSchema.safeParse({
      reason: 'Job is still required',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-00000000000a',
    }).success).toBe(true);
    expect(adminReopenJobSchema.safeParse({
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-00000000000a',
    }).success).toBe(false);
    expect(adminReturnToServiceSchema.safeParse({
      reason: 'Repairs verified',
      expectedVersion: 2,
      idempotencyKey: '00000000-0000-4000-8000-00000000000b',
    }).success).toBe(true);
    // LTR-158: the Return to Service reason is optional.
    expect(adminReturnToServiceSchema.safeParse({
      expectedVersion: 2,
      idempotencyKey: '00000000-0000-4000-8000-00000000000b',
    }).success).toBe(true);
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
    expect(adminYardOperationsQuerySchema.parse({ phase: 'shop_work' }).phase).toEqual(['shop_work']);
    expect(adminYardOperationsQuerySchema.parse({ blocked: 'false' }).blocked).toBe(false);
    expect(adminYardOperationsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('accepts Work Plan add-job batches and inspection discovery outcomes', () => {
    const idempotencyKey = '00000000-0000-4000-8000-000000000021';
    expect(addWorkPlanJobsSchema.safeParse({
      idempotencyKey,
      jobs: [{
        categoryId: '00000000-0000-4000-8000-000000000001',
        displayName: 'Alignment',
      }],
    }).success).toBe(true);
    expect(addWorkPlanJobsSchema.safeParse({ idempotencyKey, jobs: [] }).success).toBe(false);
    expect(recordWorkPlanInspectionSchema.safeParse({
      outcome: WorkPlanInspectionOutcome.ISSUES_FOUND,
      idempotencyKey,
    }).success).toBe(true);
    expect(recordWorkPlanInspectionSchema.safeParse({
      outcome: WorkPlanInspectionOutcome.NO_ISSUES_FOUND,
      idempotencyKey,
    }).success).toBe(true);
    expect(recordWorkPlanInspectionSchema.safeParse({
      outcome: WorkPlanInspectionOutcome.NOT_STARTED,
      idempotencyKey,
    }).success).toBe(false);
  });

  it('exports the Yard data-boundary DTO used by Admin Phase 1 cards', () => {
    const unavailable: YardDataBoundaryDto = {
      asOf: '2026-09-21T16:00:00.000Z',
      windows: {
        timeZone: 'America/New_York',
        thisWeek: { from: '2026-09-21', to: '2026-09-27' },
        nextWeek: { from: '2026-09-28', to: '2026-10-04' },
      },
      workLocation: { status: 'unavailable', items: [], message: 'Data unavailable.' },
      incomingTrucks: { status: 'error', items: [], message: 'Data unavailable.' },
      upcomingDepartures: {
        status: 'ok',
        items: [{ truckNumber: '905', outDate: '2026-09-23', window: 'this_week' }],
      },
    };
    expect(unavailable.workLocation.items).toEqual([]);
    expect(unavailable.upcomingDepartures.items[0]?.truckNumber).toBe('905');
  });

  it('accepts System Admin mechanic and catalog write bodies and rejects empty updates', () => {
    expect(adminCreateMechanicSchema.parse({
      email: 'New.Mechanic@Lightning.Local',
      name: 'New Mechanic',
      mode: 'pm',
    })).toEqual({
      email: 'new.mechanic@lightning.local',
      name: 'New Mechanic',
      mode: 'pm',
    });
    expect(adminUpdateMechanicSchema.safeParse({}).success).toBe(false);
    expect(adminUpdateMechanicSchema.parse({ active: true }).active).toBe(true);
    expect(adminCreateCatalogJobSchema.parse({
      categoryId: '00000000-0000-4000-8000-0000000000c1',
      displayName: ' Air hose ',
    })).toMatchObject({ displayName: 'Air hose' });
    expect(adminUpdateCatalogJobSchema.safeParse({}).success).toBe(false);
    expect(adminCreateCatalogJobSchema.safeParse({
      categoryId: 'not-a-uuid',
      displayName: 'Air hose',
    }).success).toBe(false);
  });
});
