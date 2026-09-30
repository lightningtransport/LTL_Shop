import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { TrucksService } from '../trucks/trucks.service';
import { WorkOrdersService } from './work-orders.service';

const pmMechanic: AuthUser = {
  id: 'mpm', email: 'mpm@l.local', name: 'MPM', role: 'mechanic', active: true,
  capabilities: [AppCapability.MECHANIC_PM], supabaseAuthId: null,
};
const input = {
  truckId: '11111111-1111-4111-8111-111111111111', primaryCategoryId: 'cat-pm', priority: 'normal',
  mechanicIds: [], jobs: [], idempotencyKey: 'pm-create-key-1',
} as never;
const pmA = { id: 'cj-pm-a', categoryId: 'cat-pm', displayName: 'PM A Service' };

function openWo(jobs: unknown[], overrides: Record<string, unknown> = {}) {
  return { id: 'wo-1', displayId: 'WO-010', version: 4, primaryCategory: { name: 'Air & Brake System' }, jobs, ...overrides };
}
function pmJob(overrides: Record<string, unknown> = {}) {
  return { id: 'job-pm', status: 'to_do', assignedMechanicId: null, startedAt: null, category: { name: 'PM' }, ...overrides };
}

function setup(open: unknown) {
  const prisma = {
    workOrder: { findFirst: vi.fn().mockResolvedValue(open) },
    catalogJob: { findFirst: vi.fn().mockResolvedValue(pmA) },
    jobCategory: { findFirst: vi.fn().mockResolvedValue({ id: 'cat-inspection' }) },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
      workOrder: { findFirst: vi.fn().mockResolvedValue(null) },
      workOrderJob: { findFirst: vi.fn().mockResolvedValue(null) },
    })),
  };
  const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never);
  const started = { id: 'wo-1', pmJob: { id: 'job-pm' } };
  const spies = {
    start: vi.spyOn(service, 'startPmJob').mockResolvedValue(started as never),
    addJob: vi.spyOn(service, 'addJobByManager').mockResolvedValue({ jobs: [pmJob()] } as never),
    create: vi.spyOn(service, 'create').mockResolvedValue({ id: 'wo-new', jobs: [{ ...pmJob(), id: 'job-new' }] } as never),
  };
  const createOrJoin = (service as unknown as { createOrJoinPm: (u: AuthUser, i: unknown) => Promise<unknown> }).createOrJoinPm.bind(service);
  return { prisma, service, spies, createOrJoin };
}

describe('Create PM service joins the truck Work Order (LTR-147)', () => {

  it('creates the truck Work Order (Inspection + PM A) and starts its PM job when the truck has none', async () => {
    const { spies, createOrJoin } = setup(null);
    await createOrJoin(pmMechanic, input);
    expect(spies.create).toHaveBeenCalledWith(pmMechanic, expect.objectContaining({
      primaryCategoryId: 'cat-inspection',
      mechanicIds: [],
      jobs: [{ categoryId: 'cat-pm', catalogJobId: 'cj-pm-a', displayName: 'PM A Service' }],
    }), { actorKind: 'manager' });
    expect(spies.start).toHaveBeenCalledWith(pmMechanic, 'wo-new', 'job-new');
  });

  it('adds PM A to an open Work Order without a PM job, then starts it', async () => {
    const { spies, createOrJoin } = setup(openWo([]));
    await createOrJoin(pmMechanic, input);
    expect(spies.addJob).toHaveBeenCalledWith(pmMechanic, 'wo-1', expect.objectContaining({ catalogJobId: 'cj-pm-a', expectedVersion: 4 }));
    expect(spies.start).toHaveBeenCalledWith(pmMechanic, 'wo-1', 'job-pm');
    expect(spies.create).not.toHaveBeenCalled();
  });

  it('joins an unassigned PM job, and returns a PM already started by the same mechanic', async () => {
    const join = setup(openWo([pmJob()]));
    await join.createOrJoin(pmMechanic, input);
    expect(join.spies.start).toHaveBeenCalledWith(pmMechanic, 'wo-1', 'job-pm');
    expect(join.spies.addJob).not.toHaveBeenCalled();

    const mine = setup(openWo([pmJob({ assignedMechanicId: 'mpm', startedAt: new Date() })], {
      truck: { id: 't', truckNumber: '1', make: null, model: null, year: null, mileage: null, company: null, owner: null },
      primaryCategoryId: 'c', status: 'in_progress', priority: 'normal', createdAt: new Date(), startedAt: null,
      completedAt: null, completedById: null, totalActiveLaborMs: 0n, totalWaitingMs: 0n, createdById: 'mgr', notes: null, truckId: 't',
    }));
    await expect(mine.createOrJoin(pmMechanic, input)).resolves.toMatchObject({ id: 'wo-1' });
    expect(mine.spies.start).not.toHaveBeenCalled();
  });

  it('refuses a finished PM and keeps the legacy PM Work Order conflict', async () => {
    await expect(setup(openWo([pmJob({ status: 'completed' })])).createOrJoin(pmMechanic, input))
      .rejects.toMatchObject({ response: { code: 'PM_JOB_DONE' } });
    await expect(setup(openWo([], { primaryCategory: { name: 'PM' } })).createOrJoin(pmMechanic, input))
      .rejects.toMatchObject({ response: { code: 'OPEN_WORK_ORDER_EXISTS' } });
  });

  it('previews what Create PM will do on a truck with an open Work Order', async () => {
    const wo = (jobs: unknown[]) => ({
      id: 'wo-1', displayId: 'WO-010', createdById: 'mgr', mechanics: [], primaryCategory: { name: 'Air & Brake System' }, jobs,
      truck: { id: 't', truckNumber: '1', make: null, model: null, year: null, mileage: null, company: null, owner: null },
      primaryCategoryId: 'c', status: 'created', priority: 'normal', createdAt: new Date(), startedAt: null, pauseEvents: [],
    });
    const preview = async (jobs: unknown[]) => {
      const prisma = {
        truck: { findUnique: vi.fn().mockResolvedValue({ id: 't', truckNumber: '1' }) },
        workOrder: { findFirst: vi.fn().mockResolvedValue(wo(jobs)) },
      };
      const result = await new TrucksService(prisma as never).getOpenWorkOrder(pmMechanic, 't') as { pmJoin?: unknown };
      return result.pmJoin;
    };
    const catJob = (overrides: Record<string, unknown>) => ({ ...pmJob(overrides), displayName: 'PM A Service', category: { id: 'cat-pm', name: 'PM' } });
    expect(await preview([])).toEqual({ displayId: 'WO-010', status: 'add', assignedMechanicName: null });
    expect(await preview([catJob({})])).toMatchObject({ status: 'join' });
    expect(await preview([catJob({ assignedMechanicId: 'mpm2', assignedMechanic: { name: 'MPM 2' } })])).toEqual({ displayId: 'WO-010', status: 'taken', assignedMechanicName: 'MPM 2' });
    expect(await preview([catJob({ status: 'completed' })])).toMatchObject({ status: 'done' });
  });
});
