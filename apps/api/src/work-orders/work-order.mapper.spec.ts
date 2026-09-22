import { describe, expect, it } from 'vitest';
import { ActivityEventType } from '@prisma/client';
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

function job(
  id: string,
  categoryId: string,
  categoryName: string,
  displayName: string,
  assignedMechanic: { id: string; name: string } | null = null,
) {
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
    assignedMechanic,
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

  it('maps per-Job assignees and inherited-team unassigned Jobs on summary and detail', () => {
    const wo: WorkOrderWithRelations = {
      ...base,
      mechanics: [{
        mechanicId: 'mechanic-1',
        addedAt: new Date('2026-09-09T12:00:00.000Z'),
        removedAt: null,
        mechanic: { name: 'Alex Mechanic' },
      }],
      jobs: [
        job('job-assigned', 'category-brakes', 'Brakes', 'Replace pads', {
          id: 'mechanic-2', name: 'Jamie Technician',
        }),
        job('job-team', 'category-brakes', 'Brakes', 'Bleed brakes'),
      ],
    };

    expect(toWorkOrderSummary(wo)).toMatchObject({
      mechanics: [{ mechanicId: 'mechanic-1', mechanicName: 'Alex Mechanic' }],
      jobs: [
        expect.objectContaining({
          id: 'job-assigned',
          assignedMechanic: { id: 'mechanic-2', name: 'Jamie Technician' },
        }),
        expect.objectContaining({ id: 'job-team', assignedMechanic: null }),
      ],
    });
    expect(toWorkOrderDetail(wo).jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'job-assigned',
        assignedMechanic: { id: 'mechanic-2', name: 'Jamie Technician' },
      }),
      expect.objectContaining({ id: 'job-team', assignedMechanic: null }),
    ]));
  });

  it('does not treat a reported blocker as the current official pause', () => {
    const reportedAt = new Date('2026-09-11T15:00:00.000Z');
    const wo: WorkOrderWithRelations = {
      ...base,
      jobs: [job('job-brakes', 'category-brakes', 'Brakes', 'Inspect brakes')],
      pauseEvents: [{
        id: 'report-1',
        workOrderId: 'wo-1',
        reason: 'waiting_for_parts',
        notes: 'Air line ordered',
        startedAt: reportedAt,
        endedAt: reportedAt,
        durationMs: 0n,
        isOfficialPause: false,
        reportedBy: { id: 'mechanic-1', name: 'Alex Mechanic' },
      }],
    };

    expect(toWorkOrderSummary(wo).currentPauseReason).toBeNull();
    expect(toWorkOrderDetail(wo).currentPause).toBeNull();
  });

  it('reads mechanic finish notes from the latest job_completed activity row', () => {
    const wo: WorkOrderWithRelations = {
      ...base,
      jobs: [
        {
          ...job('job-brakes', 'category-brakes', 'Brakes', 'Inspect brakes'),
          status: 'completed',
          completedAt: new Date('2026-09-19T22:41:00.000Z'),
          completedById: 'mechanic-1',
        },
        job('job-open', 'category-brakes', 'Brakes', 'Bleed brakes'),
      ],
      activityLogs: [
        {
          eventType: ActivityEventType.job_completed,
          entityId: 'job-brakes',
          newValue: { notes: '  ' },
          createdAt: new Date('2026-09-19T22:40:00.000Z'),
        },
        {
          eventType: ActivityEventType.job_completed,
          entityId: 'job-brakes',
          newValue: { displayName: 'Inspect brakes', notes: 'Replaced the air hose' },
          createdAt: new Date('2026-09-19T22:41:00.000Z'),
        },
        {
          eventType: ActivityEventType.notes_updated,
          entityId: 'wo-1',
          newValue: { notes: 'Work Order note must not become the job note' },
          createdAt: new Date('2026-09-19T22:50:00.000Z'),
        },
      ],
    };

    expect(toWorkOrderDetail(wo).jobs).toEqual([
      expect.objectContaining({ id: 'job-brakes', completionNotes: 'Replaced the air hose' }),
      expect.objectContaining({ id: 'job-open', completionNotes: null }),
    ]);
  });
});
