import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';

const manager: AuthUser = {
  id: 'mgr', email: 'm@l.local', name: 'Manager', role: 'manager', active: true,
  capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
};

function job(id: string, categoryName: string, displayName: string) {
  return {
    id, workOrderId: 'wo-1', catalogJobId: null, categoryId: `cat-${categoryName}`, category: { id: `cat-${categoryName}`, name: categoryName },
    displayName, customDescription: null, status: 'to_do' as const, completedAt: null, completedById: null,
    assignedMechanicId: null, assignedMechanic: null,
  };
}

function setup(jobs = [job('j-brakes', 'Brakes', 'Brake adjustment'), job('j-detail', 'Detailing', 'Detailing')], status = 'in_progress') {
  const wo = {
    id: 'wo-1', displayId: 'WO-0042', truckId: 'truck-1', primaryCategoryId: 'cat-Brakes', status, priority: 'normal' as const,
    notes: null, createdAt: new Date(), createdById: 'mgr', startedAt: null, completedAt: null, completedById: null,
    totalActiveLaborMs: 0n, totalWaitingMs: 0n, version: 3,
    truck: { id: 'truck-1', truckNumber: '922', make: null, model: null, year: null, mileage: null, company: null, owner: null },
    primaryCategory: { id: 'cat-Brakes', name: 'Brakes' }, jobs, pauseEvents: [], sessions: [], mechanics: [],
  };
  const steps = [
    { stepKey: 'pm', catalogJob: { id: 'cj-pm', categoryId: 'cat-PM', displayName: 'PM A Service', category: { name: 'PM' } }, members: [{ user: { id: 'daniel', active: true, capabilities: [{ capability: 'MECHANIC_PM' }] } }] },
    { stepKey: 'alignment', catalogJob: { id: 'cj-al', categoryId: 'cat-Susp', displayName: 'Alignment', category: { name: 'Suspension & Steering' } }, members: [{ user: { id: 'anthony', active: true, capabilities: [{ capability: 'MECHANIC_STANDARD' }] } }] },
    { stepKey: 'detailing', catalogJob: { id: 'cj-de', categoryId: 'cat-Detailing', displayName: 'Detailing', category: { name: 'Detailing' } }, members: [] },
    { stepKey: 'quality_check', catalogJob: { id: 'cj-qc', categoryId: 'cat-QC', displayName: 'Quality Check', category: { name: 'Quality Check' } }, members: [] },
  ];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    workOrder: { findUnique: vi.fn().mockResolvedValue(wo), update: vi.fn().mockResolvedValue({ ...wo, version: 4 }) },
    shopWorkflowStep: { findMany: vi.fn().mockResolvedValue(steps) },
    catalogJob: { findFirst: vi.fn() },
    workOrderJob: { create: vi.fn(async ({ data }: { data: { displayName: string; assignedMechanicId: string | null } }) => ({ id: `new-${data.displayName}` })) },
    jobCategory: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ name: where.id === 'cat-PM' ? 'PM' : 'Other' })) },
    mechanicAssignment: { upsert: vi.fn() },
  };
  const activity = { log: vi.fn() };
  const service = new WorkOrdersService({
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as never, activity as never);
  return { service, tx, activity };
}

describe('backfillMandatoryJobs (LTR-158)', () => {
  it('adds only the missing steps with their default owners and logs each one', async () => {
    const { service, tx, activity } = setup();

    await service.backfillMandatoryJobs(manager, 'wo-1', 3);

    expect(tx.workOrderJob.create.mock.calls.map(([args]) => [args.data.displayName, args.data.assignedMechanicId])).toEqual([
      ['PM A Service', 'daniel'],
      ['Alignment', 'anthony'],
      ['Quality Check', null],
    ]);
    // Anthony (Standard) joins the derived team; Daniel reaches it through the PM job.
    expect(tx.mechanicAssignment.upsert).toHaveBeenCalledTimes(1);
    expect(tx.mechanicAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { workOrderId: 'wo-1', mechanicId: 'anthony', addedById: 'mgr' },
    }));
    expect(activity.log).toHaveBeenCalledTimes(3);
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.JOB_ADDED,
      newValue: expect.objectContaining({ action: 'mandatory_backfill', displayName: 'PM A Service' }),
    }));
    expect(tx.workOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { version: { increment: 1 } } }));
  });

  it('does nothing when every step is already there, and refuses a stale version or a closed Work Order', async () => {
    const full = setup([
      job('a', 'PM', 'PM A Service'), job('b', 'Suspension & Steering', 'Alignment'),
      job('c', 'Detailing', 'Detailing'), job('d', 'Quality Check', 'Quality Check'),
    ]);
    await full.service.backfillMandatoryJobs(manager, 'wo-1', 3);
    expect(full.tx.workOrderJob.create).not.toHaveBeenCalled();

    await expect(setup().service.backfillMandatoryJobs(manager, 'wo-1', 2)).rejects.toMatchObject({ status: 409 });
    await expect(setup(undefined, 'completed').service.backfillMandatoryJobs(manager, 'wo-1', 3)).rejects.toMatchObject({ status: 400 });
  });
});
