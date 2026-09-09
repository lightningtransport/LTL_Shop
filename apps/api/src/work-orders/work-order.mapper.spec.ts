import { describe, expect, it } from 'vitest';
import { toWorkOrderDetail, toWorkOrderSummary, type WorkOrderWithRelations } from './work-order.mapper';

const base = {
  id: 'wo-1',
  displayId: 'WO-0001',
  truckId: 'truck-1',
  primaryCategoryId: 'category-brakes',
  status: 'in_progress' as const,
  priority: 'normal' as const,
  notes: null,
  createdAt: new Date('2026-09-09T12:00:00.000Z'),
  createdById: 'mechanic-1',
  startedAt: new Date('2026-09-09T12:05:00.000Z'),
  completedAt: null,
  completedById: null,
  totalActiveLaborMs: 0n,
  totalWaitingMs: 0n,
  version: 1,
  truck: {
    id: 'truck-1', truckNumber: '905', make: null, model: null, year: null,
    mileage: null, company: null, owner: null,
  },
  primaryCategory: { id: 'category-brakes', name: 'Brakes' },
  pauseEvents: [],
  mechanics: [],
};

function job(id: string, categoryId: string, categoryName: string, displayName: string) {
  return {
    id,
    workOrderId: 'wo-1',
    catalogJobId: `${id}-catalog`,
    categoryId,
    category: { id: categoryId, name: categoryName },
    displayName,
    customDescription: null,
    status: 'to_do' as const,
    completedAt: null,
    completedById: null,
  };
}

describe('Work Order Job Category readers', () => {
  it('keeps a legacy one-Category Work Order readable with additive Category fields', () => {
    const wo: WorkOrderWithRelations = {
      ...base,
      jobs: [job('job-brakes', 'category-brakes', 'Brakes', 'Inspect brakes')],
    };

    expect(toWorkOrderSummary(wo)).toMatchObject({
      primaryCategoryId: 'category-brakes',
      primaryCategoryName: 'Brakes',
      jobs: [{
        id: 'job-brakes', categoryId: 'category-brakes',
        category: { id: 'category-brakes', name: 'Brakes' },
        displayName: 'Inspect brakes', status: 'to_do',
      }],
    });
  });

  it('returns every Job Category for a target mixed-Category row without changing primary Category', () => {
    const wo: WorkOrderWithRelations = {
      ...base,
      jobs: [
        job('job-brakes', 'category-brakes', 'Brakes', 'Inspect brakes'),
        job('job-electrical', 'category-electrical', 'Electrical', 'Inspect ABS sensor'),
      ],
    };

    const detail = toWorkOrderDetail(wo);

    expect(detail.primaryCategoryName).toBe('Brakes');
    expect(detail.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ categoryId: 'category-brakes', category: { id: 'category-brakes', name: 'Brakes' } }),
      expect.objectContaining({ categoryId: 'category-electrical', category: { id: 'category-electrical', name: 'Electrical' } }),
    ]));
  });
});
