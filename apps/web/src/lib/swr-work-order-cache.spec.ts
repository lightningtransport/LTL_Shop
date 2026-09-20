import { describe, expect, it } from 'vitest';
import type { AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { Priority, WorkOrderStatus } from '@ltl-shop/shared';
import { prependAdminWorkOrderPage, writeCreatedWorkOrderToListCache } from './swr-work-order-cache';

function createdWorkOrder(id = 'wo-new'): AdminWorkOrderDetailDto {
  return {
    id,
    displayId: 'WO-0100',
    truck: {
      id: 'truck-1',
      truckNumber: '905',
      make: 'Volvo',
      model: 'VNL',
      year: 2024,
      mileage: 1000,
      company: null,
      owner: null,
      vin: null,
      location: null,
      locationUpdatedOn: null,
    },
    category: { id: 'cat-1', name: 'Brakes' },
    status: WorkOrderStatus.CREATED,
    priority: Priority.NORMAL,
    jobsCompleted: 0,
    jobsTotal: 1,
    mechanics: [],
    currentPause: null,
    latestReportedBlocker: null,
    createdAt: '2026-09-20T02:00:00.000Z',
    startedAt: null,
    completedAt: null,
    updatedAt: '2026-09-20T02:00:00.000Z',
    version: 1,
    notes: null,
    createdBy: { id: 'mgr-1', name: 'Cristian' },
    completedBy: null,
    totalActiveLaborMs: 0,
    totalWaitingMs: 0,
    jobs: [],
    laborSessions: [],
    pauseHistory: [],
    reportedBlockers: [],
    activityLog: [],
    returnedToServiceAt: null,
  };
}

describe('Admin Work Order list cache after create', () => {
  it('prepends a newly created Work Order onto the first list page', () => {
    const created = createdWorkOrder();
    const next = prependAdminWorkOrderPage(
      [{ items: [{ ...created, id: 'wo-old', displayId: 'WO-0001' }], nextCursor: null }],
      created,
    );
    expect(next?.[0].items.map((item) => item.id)).toEqual(['wo-new', 'wo-old']);
  });

  it('does not duplicate a Work Order that is already on the page', () => {
    const created = createdWorkOrder();
    const pages = [{ items: [created], nextCursor: null }];
    expect(prependAdminWorkOrderPage(pages, created)).toBe(pages);
  });

  it('only writes into Admin Work Order list keys', () => {
    const created = createdWorkOrder();
    expect(writeCreatedWorkOrderToListCache('/api/admin/dashboard', [{ items: [] }], created))
      .toEqual([{ items: [] }]);
    const written = writeCreatedWorkOrderToListCache(
      '$inf$/api/admin/work-orders?limit=25',
      [{ items: [], nextCursor: null }],
      created,
    );
    expect(written).toEqual([{ items: [expect.objectContaining({ id: 'wo-new', displayId: 'WO-0100' })], nextCursor: null }]);
  });
});
