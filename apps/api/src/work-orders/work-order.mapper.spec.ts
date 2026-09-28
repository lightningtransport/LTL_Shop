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

  it('marks the blocked Job and carries its blocker notes and job (LTR-155 / D17)', () => {
    const reportedAt = new Date('2026-09-11T15:00:00.000Z');
    const alex = { id: 'mechanic-1', name: 'Alex Mechanic' };
    const wo: WorkOrderWithRelations = {
      ...base,
      jobs: [
        { ...job('job-brakes', 'category-brakes', 'Brakes', 'Inspect brakes', alex), assignedMechanicId: alex.id },
        { ...job('job-pads', 'category-brakes', 'Brakes', 'Replace pads', alex), assignedMechanicId: alex.id },
      ],
      sessions: [{ id: 's-1', startedAt: reportedAt, endedAt: null, userId: alex.id }],
      pauseEvents: [{
        id: 'report-1', workOrderId: 'wo-1', reason: 'waiting_for_parts', notes: 'Air line ordered',
        startedAt: reportedAt, endedAt: reportedAt, durationMs: 0n, isOfficialPause: false,
        reportedBy: alex, jobId: 'job-brakes', job: { id: 'job-brakes', displayName: 'Inspect brakes' },
        blockerReason: 'waiting_for_parts',
      }],
      activityLogs: [{
        id: 'log-1', eventType: ActivityEventType.note_added, entityType: 'pause_event', entityId: 'report-1',
        newValue: { body: 'The part arrived' }, createdAt: new Date('2026-09-11T16:00:00.000Z'), user: alex,
      }],
    };

    const detail = toWorkOrderDetail(wo, alex.id);
    expect(detail.jobs.map((item) => [item.id, item.workStatus])).toEqual([
      ['job-brakes', 'blocked'],
      ['job-pads', 'in_progress'],
    ]);
    expect(detail.jobs[0].activeBlocker).toMatchObject({ id: 'report-1', reason: 'waiting_for_parts', reportedBy: alex });
    expect(detail.activeBlockers?.[0]).toMatchObject({
      job: { id: 'job-brakes', displayName: 'Inspect brakes' },
      blockerReason: 'waiting_for_parts',
      blockerNotes: [{ id: 'log-1', body: 'The part arrived', author: alex, createdAt: '2026-09-11T16:00:00.000Z' }],
      resolutionNote: null,
    });
    expect(toWorkOrderSummary(wo).jobs[0]).toMatchObject({ workStatus: 'blocked', activeBlocker: { id: 'report-1' } });
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

describe('live labor totals (LTR-94)', () => {
  it('counts the open session up to now instead of the persisted 0m', () => {
    const now = Date.now();
    const wo = {
      ...base,
      jobs: [],
      pauseEvents: [],
      mechanics: [],
      totalActiveLaborMs: 0n,
      sessions: [
        { id: 's1', startedAt: new Date(now - 60 * 60_000), endedAt: new Date(now - 30 * 60_000) },
        { id: 's2', startedAt: new Date(now - 10 * 60_000), endedAt: null },
      ],
    } as unknown as WorkOrderWithRelations;
    const detail = toWorkOrderDetail(wo);
    expect(detail.laborRunning).toBe(true);
    expect(detail.totalActiveLaborMs).toBeGreaterThanOrEqual(40 * 60_000);
    expect(detail.totalActiveLaborMs).toBeLessThan(41 * 60_000);
  });

  it('keeps persisted totals when sessions were not loaded', () => {
    const wo = { ...base, jobs: [], pauseEvents: [], mechanics: [], totalActiveLaborMs: 5000n } as unknown as WorkOrderWithRelations;
    expect(toWorkOrderDetail(wo).totalActiveLaborMs).toBe(5000);
  });
});

describe('resolvedBlockerAwaitingContinue (LTR-158 / D18)', () => {
  const alex = { id: 'mechanic-1', name: 'Alex' };
  const stoppedAt = new Date('2026-09-28T10:00:00.000Z');
  const wo = (resolvedAt: Date | null, sessionOpen = false): WorkOrderWithRelations => ({
    ...base,
    jobs: [{ ...job('job-1', 'category-brakes', 'Brakes', 'Inspect brakes', alex), assignedMechanicId: alex.id }],
    sessions: [{ id: 's-1', startedAt: new Date('2026-09-28T09:00:00.000Z'), endedAt: sessionOpen ? null : stoppedAt, userId: alex.id }],
    pauseEvents: [{
      id: 'b-1', workOrderId: 'wo-1', reason: 'waiting_for_parts', notes: null, startedAt: stoppedAt, endedAt: stoppedAt,
      durationMs: 0n, isOfficialPause: false, reportedBy: alex, jobId: 'job-1', resolvedAt,
    }],
  });

  it('asks me to Continue once the Manager resolved my blocker after my time stopped', () => {
    expect(toWorkOrderSummary(wo(new Date('2026-09-28T11:00:00.000Z')), alex.id).resolvedBlockerAwaitingContinue).toBe(true);
  });

  it('stays quiet while the blocker is active, after I continued, or for someone else', () => {
    expect(toWorkOrderSummary(wo(null), alex.id).resolvedBlockerAwaitingContinue).toBe(false);
    expect(toWorkOrderSummary(wo(new Date('2026-09-28T11:00:00.000Z'), true), alex.id).resolvedBlockerAwaitingContinue).toBe(false);
    expect(toWorkOrderSummary(wo(new Date('2026-09-28T11:00:00.000Z')), 'other').resolvedBlockerAwaitingContinue).toBe(false);
    expect(toWorkOrderSummary(wo(new Date('2026-09-28T11:00:00.000Z'))).resolvedBlockerAwaitingContinue).toBeUndefined();
  });
});
