import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';

const pmMechanic: AuthUser = {
  id: 'mpm', email: 'mpm@l.local', name: 'MPM', role: 'mechanic', active: true, pmAuthorized: true,
  capabilities: [AppCapability.MECHANIC_PM], supabaseAuthId: null,
};
const otherPm: AuthUser = { ...pmMechanic, id: 'mpm2', name: 'MPM 2' };
const standard: AuthUser = { ...pmMechanic, id: 'mg', name: 'MG', capabilities: [AppCapability.MECHANIC_STANDARD] };

function pmJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-pm', workOrderId: 'wo-1', catalogJobId: 'cj-pm-a', categoryId: 'cat-pm', displayName: 'PM A Service',
    customDescription: null, status: 'to_do', completedAt: null, completedById: null, startedAt: null,
    assignedMechanicId: null, assignedMechanic: null, completedBy: null, category: { id: 'cat-pm', name: 'PM' },
    ...overrides,
  };
}

function workOrder(jobOverrides: Record<string, unknown> = {}, woOverrides: Record<string, unknown> = {}) {
  return {
    id: 'wo-1', displayId: 'WO-006', truckId: 'truck-968', primaryCategoryId: 'cat-brake', status: 'created',
    priority: 'normal', notes: null, createdAt: new Date(), createdById: 'mgr', startedAt: null, completedAt: null,
    completedById: null, totalActiveLaborMs: 0n, totalWaitingMs: 0n, version: 3,
    truck: { id: 'truck-968', truckNumber: '968', make: 'Freightliner', model: 'Cascadia', year: 2023, mileage: 100_000, company: null, owner: null },
    primaryCategory: { id: 'cat-brake', name: 'Air & Brake System' },
    jobs: [
      { ...pmJob(), id: 'job-brake', displayName: 'Brake Inspection', categoryId: 'cat-brake', category: { id: 'cat-brake', name: 'Air & Brake System' } },
      pmJob(jobOverrides),
    ],
    pauseEvents: [], sessions: [], mechanics: [{ mechanicId: 'mg', addedAt: new Date(), removedAt: null, mechanic: { name: 'MG' } }],
    activityLogs: [], noteEntries: [],
    ...woOverrides,
  };
}

function setup(wo = workOrder(), options: { runningJob?: unknown; pmService?: unknown } = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(wo),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(wo),
    },
    workOrderJob: {
      findFirst: vi.fn().mockResolvedValue(options.runningJob ?? null),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
    workSession: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    pmService: {
      upsert: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(options.pmService ?? null),
    },
    truck: { update: vi.fn() },
    truckMileageAdjustment: { create: vi.fn() },
    jobCategory: { findUnique: vi.fn().mockResolvedValue({ name: 'Air & Brake System' }) },
    catalogJob: { findFirst: vi.fn().mockResolvedValue({ id: 'cj-pm-b', displayName: 'PM B Service' }) },
  };
  const activity = { log: vi.fn() };
  const service = new WorkOrdersService({
    workOrder: { findUnique: vi.fn().mockResolvedValue(wo) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as never, activity as never);
  return { service, tx, activity };
}

describe('PM job inside the truck Work Order (LTR-146)', () => {

  it('lets a PM mechanic claim and start the unassigned PM job', async () => {
    const { service, tx, activity } = setup();
    await service.startPmJob(pmMechanic, 'wo-1', 'job-pm');
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: 'job-pm' },
      data: { startedAt: expect.any(Date), assignedMechanicId: 'mpm' },
    });
    expect(tx.pmService.upsert).toHaveBeenCalledWith({
      where: { workOrderId: 'wo-1' },
      update: { workOrderJobId: 'job-pm' },
      create: { workOrderId: 'wo-1', workOrderJobId: 'job-pm' },
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.WORK_STARTED }));
  });

  it('lets the PM mechanic who starts take a PM job defaulted to someone else (LTR-157 / D15)', async () => {
    const assigned = setup(workOrder({ assignedMechanicId: 'mpm2', assignedMechanic: { id: 'mpm2', name: 'MPM 2' } }));
    await assigned.service.startPmJob(pmMechanic, 'wo-1', 'job-pm');
    expect(assigned.tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: 'job-pm' },
      data: { startedAt: expect.any(Date), assignedMechanicId: 'mpm' },
    });
    expect(assigned.activity.log).toHaveBeenCalledWith(assigned.tx, expect.objectContaining({
      previousValue: { assignedMechanicId: 'mpm2' },
      newValue: expect.objectContaining({ assignedMechanicId: 'mpm' }),
    }));
  });

  it('refuses a Standard mechanic and a second running PM (D2)', async () => {
    await expect(setup().service.startPmJob(standard, 'wo-1', 'job-pm')).rejects.toThrow();
    const busy = setup(workOrder(), { runningJob: { workOrder: { id: 'wo-9', displayId: 'WO-009' } } });
    await expect(busy.service.startPmJob(pmMechanic, 'wo-1', 'job-pm')).rejects.toMatchObject({
      response: { code: 'PM_ALREADY_IN_PROGRESS', runningDisplayId: 'WO-009' },
    });
    expect(busy.tx.workOrderJob.update).not.toHaveBeenCalled();
  });

  it('opens the Work Order to its PM mechanic only', async () => {
    const wo = workOrder({ assignedMechanicId: 'mpm', startedAt: new Date() });
    const { service } = setup(wo);
    await expect(service.getById(pmMechanic, 'wo-1')).resolves.toMatchObject({ id: 'wo-1' });
    await expect(service.getById(otherPm, 'wo-1')).rejects.toThrow();
  });

  it('finishes the PM job with mileage and parts, updates the truck, and keeps the Work Order open', async () => {
    const wo = workOrder({ assignedMechanicId: 'mpm', startedAt: new Date() }, { status: 'in_progress' });
    const { service, tx, activity } = setup(wo, { pmService: { observedMileage: 101_500, parts: [{ id: 'p1' }] } });
    await service.completeJob(pmMechanic, 'wo-1', 'job-pm');
    expect(tx.truck.update).toHaveBeenCalledWith({ where: { id: 'truck-968' }, data: { mileage: 101_500 } });
    expect(tx.truckMileageAdjustment.create).toHaveBeenCalled();
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: 'job-pm' },
      data: { status: 'completed', completedAt: expect.any(Date), completedById: 'mpm' },
    });
    expect(tx.workOrder.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.JOB_COMPLETED,
      newValue: expect.objectContaining({ pmService: { observedMileage: 101_500, parts: 1 } }),
    }));
  });

  it('refuses to finish without mileage/parts, before start, or by someone else', async () => {
    const started = workOrder({ assignedMechanicId: 'mpm', startedAt: new Date() }, { status: 'in_progress' });
    await expect(setup(started, { pmService: { observedMileage: null, parts: [] } }).service.completeJob(pmMechanic, 'wo-1', 'job-pm'))
      .rejects.toThrow('Observed mileage is required');
    await expect(setup(started, { pmService: { observedMileage: 99_000, parts: [{ id: 'p1' }] } }).service.completeJob(pmMechanic, 'wo-1', 'job-pm'))
      .rejects.toMatchObject({ response: { code: 'MILEAGE_BELOW_CURRENT' } });
    const notStarted = workOrder({ assignedMechanicId: 'mpm' }, { status: 'in_progress' });
    await expect(setup(notStarted).service.completeJob(pmMechanic, 'wo-1', 'job-pm'))
      .rejects.toMatchObject({ response: { code: 'PM_JOB_NOT_STARTED' } });
    await expect(setup(started).service.completeJob(standard, 'wo-1', 'job-pm')).rejects.toThrow('not assigned to you');
  });

  it('lists the truck Work Order in the PM workspace, bucketed by the PM job', async () => {
    const notStarted = workOrder({ assignedMechanicId: 'mpm' }, { status: 'in_progress' });
    const started = { ...workOrder({ assignedMechanicId: 'mpm', startedAt: new Date() }), id: 'wo-2', displayId: 'WO-007' };
    const findMany = vi.fn().mockResolvedValue([notStarted, started]);
    const service = new WorkOrdersService({ workOrder: { findMany } } as never, { log: vi.fn() } as never);

    const result = await service.listForMechanic(pmMechanic, 'pm');
    expect(findMany.mock.calls[0][0].where.AND[0].OR).toContainEqual({
      jobs: { some: { assignedMechanicId: 'mpm', status: { not: 'cancelled' }, category: { name: 'PM' } } },
    });
    expect(result.created.map((item) => item.displayId)).toEqual(['WO-006']);
    expect(result.active.map((item) => item.displayId)).toEqual(['WO-007']);
    expect(result.active[0].pmJob).toMatchObject({ id: 'job-pm', displayName: 'PM A Service' });
  });

  it('lets the assigned PM mechanic switch PM A to PM B, and nobody else (LTR-148)', async () => {
    const wo = workOrder({ assignedMechanicId: 'mpm', startedAt: new Date() }, { status: 'in_progress' });
    const { service, tx } = setup(wo);
    await service.changePmService(pmMechanic, 'wo-1', 'job-pm', { catalogJobId: '00000000-0000-4000-8000-00000000cb02' });
    expect(tx.catalogJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ categoryId: 'cat-pm', status: 'active' }),
    }));
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: 'job-pm' },
      data: { catalogJobId: 'cj-pm-b', displayName: 'PM B Service' },
    });
    await expect(setup(wo).service.changePmService(otherPm, 'wo-1', 'job-pm', { catalogJobId: '00000000-0000-4000-8000-00000000cb02' }))
      .rejects.toThrow('not assigned to you');
  });
});

describe('PM job blockers (LTR-158 / D17)', () => {
  const PM_JOB = '33333333-3333-4333-8333-333333333333';
  const mine = { assignedMechanicId: 'mpm', assignedMechanic: { id: 'mpm', name: 'MPM' }, startedAt: new Date() };

  it('lets the PM mechanic block their PM job without Standard capability', async () => {
    const wo = workOrder({ ...mine, id: PM_JOB }, { status: 'in_progress' });
    const { service, tx } = setup(wo);
    Object.assign(tx, { pauseEvent: { create: vi.fn().mockResolvedValue({ id: 'b-pm' }) }, workSession: { ...tx.workSession, updateMany: vi.fn() } });

    await service.reportBlocker(pmMechanic, 'wo-1', { jobId: PM_JOB, reason: 'waiting_for_parts' });

    expect((tx as unknown as { pauseEvent: { create: ReturnType<typeof vi.fn> } }).pauseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ jobId: PM_JOB, blockerReason: 'waiting_for_parts', reportedById: 'mpm' }),
    });
    // Another PM mechanic (not the owner) still has no Standard access here.
    await expect(setup(wo).service.reportBlocker(otherPm, 'wo-1', { jobId: PM_JOB, reason: 'waiting_for_parts' }))
      .rejects.toMatchObject({ status: 403 });
  });

  it('refuses to finish a blocked PM', async () => {
    const blocker = {
      id: 'b-pm', workOrderId: 'wo-1', jobId: 'job-pm', reason: 'waiting_for_parts', notes: null, startedAt: new Date(),
      endedAt: new Date(), durationMs: 0n, isOfficialPause: false, resolvedAt: null, reportedBy: null,
    };
    const { service, tx } = setup(workOrder(mine, { status: 'in_progress', pauseEvents: [blocker] }));
    await expect(service.completeJob(pmMechanic, 'wo-1', 'job-pm')).rejects.toMatchObject({ response: { code: 'JOB_BLOCKED' } });
    expect(tx.workOrderJob.update).not.toHaveBeenCalled();
  });
});

