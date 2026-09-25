import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';

const mechanic: AuthUser = {
  id: 'mech-1',
  email: 'alex@lightning.local',
  name: 'Alejandro',
  role: 'mechanic',
  active: true,
  pmAuthorized: false,
  capabilities: [AppCapability.MECHANIC_STANDARD],
  supabaseAuthId: null,
};

function workOrder() {
  return {
    id: 'wo-1',
    displayId: 'WO-0001',
    truckId: 'truck-1',
    primaryCategoryId: 'category-brakes',
    status: 'in_progress' as const,
    priority: 'normal' as const,
    notes: null,
    createdAt: new Date('2026-09-09T12:00:00.000Z'),
    createdById: 'manager-1',
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
    sessions: [{ id: 'session-1', startedAt: new Date('2026-09-22T14:56:00.000Z'), endedAt: null }],
    mechanics: [{ mechanicId: 'mech-1', addedAt: new Date(), removedAt: null, mechanic: { name: 'Alejandro' } }],
    jobs: [{
      id: 'job-1',
      workOrderId: 'wo-1',
      catalogJobId: 'catalog-1',
      categoryId: 'category-brakes',
      category: { id: 'category-brakes', name: 'Brakes' },
      displayName: 'Inspect brakes',
      customDescription: null,
      status: 'to_do' as const,
      completedAt: null,
      completedById: null,
      assignedMechanic: { id: 'mech-1', name: 'Alejandro' },
    }],
  };
}

describe('mechanic completeJob notes', () => {
  it('stores finish notes on the Activity Log and Job DTO', async () => {
    const initial = workOrder();
    const completed = {
      ...initial,
      version: 2,
      jobs: [{
        ...initial.jobs[0],
        status: 'completed' as const,
        completedAt: new Date('2026-09-19T22:41:00.000Z'),
        completedById: mechanic.id,
      }],
    };
    const activity = { log: vi.fn() };
    const tx = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(initial),
        update: vi.fn().mockResolvedValue(completed),
      },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ name: 'Brakes' }) },
      workOrderJob: {
        findFirst: vi.fn().mockResolvedValue(initial.jobs[0]),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = new WorkOrdersService({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never, activity as never);

    await expect(service.completeJob(mechanic, 'wo-1', 'job-1', {
      notes: 'Replaced the air hose',
    })).resolves.toMatchObject({
      jobs: [expect.objectContaining({
        id: 'job-1',
        status: 'completed',
        completionNotes: 'Replaced the air hose',
      })],
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.JOB_COMPLETED,
      entityId: 'job-1',
      newValue: { displayName: 'Inspect brakes', status: 'completed', notes: 'Replaced the air hose' },
    }));
  });

  it('keeps finish notes optional', async () => {
    const initial = workOrder();
    const activity = { log: vi.fn() };
    const tx = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(initial),
        update: vi.fn().mockResolvedValue({
          ...initial,
          version: 2,
          jobs: [{ ...initial.jobs[0], status: 'completed' as const, completedById: mechanic.id }],
        }),
      },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ name: 'Brakes' }) },
      workOrderJob: {
        findFirst: vi.fn().mockResolvedValue(initial.jobs[0]),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = new WorkOrdersService({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never, activity as never);

    await expect(service.completeJob(mechanic, 'wo-1', 'job-1')).resolves.toMatchObject({
      jobs: [expect.objectContaining({ completionNotes: null })],
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      newValue: { displayName: 'Inspect brakes', status: 'completed', notes: null },
    }));
  });

  it('returns the persisted finish note on reload and after adding a Work Order note', async () => {
    const completed = {
      ...workOrder(),
      version: 3,
      notes: 'Check the leak again',
      jobs: [{
        ...workOrder().jobs[0],
        status: 'completed' as const,
        completedAt: new Date('2026-09-19T22:41:00.000Z'),
        completedById: mechanic.id,
      }],
      activityLogs: [{
        eventType: ActivityEventType.JOB_COMPLETED,
        entityId: 'job-1',
        newValue: { displayName: 'Inspect brakes', status: 'completed', notes: 'Replaced the air hose' },
        createdAt: new Date('2026-09-19T22:41:00.000Z'),
      }],
    };
    const findUnique = vi.fn().mockResolvedValue(completed);
    const tx = {
      workOrder: {
        findUnique,
        findUniqueOrThrow: findUnique,
        update: vi.fn().mockResolvedValue(completed),
      },
      workOrderNote: { create: vi.fn().mockResolvedValue({ id: 'note-1', kind: 'note', body: 'Check the leak again' }) },
    };
    const service = new WorkOrdersService({
      workOrder: { findUnique },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never, { log: vi.fn() } as never);

    await expect(service.getById(mechanic, 'wo-1')).resolves.toMatchObject({
      jobs: [expect.objectContaining({
        id: 'job-1',
        status: 'completed',
        completionNotes: 'Replaced the air hose',
      })],
    });
    await expect(service.addNote(mechanic, 'wo-1', { body: 'Check the leak again' })).resolves.toMatchObject({
      jobs: [expect.objectContaining({
        id: 'job-1',
        completionNotes: 'Replaced the air hose',
      })],
    });
  });
});
