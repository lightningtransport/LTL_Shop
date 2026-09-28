import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { WorkOrdersService } from './work-orders.service';

const mechanic: AuthUser = {
  id: 'mg', email: 'mg@lightning.local', name: 'MG', role: 'mechanic', active: true,
  pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
};
const manager: AuthUser = {
  id: 'mgr', email: 'manager@lightning.local', name: 'Manager', role: 'manager', active: true,
  pmAuthorized: false, capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
};

// LTR-154 / D11: a mechanic reaches a Standard Work Order through a Job assigned to them.
function ownedJob(mechanicId: string) {
  return {
    id: 'job-1', workOrderId: 'wo-1', catalogJobId: null, categoryId: 'cat', category: { id: 'cat', name: 'Inspection' },
    displayName: 'Inspection', customDescription: null, status: 'to_do' as const, completedAt: null, completedById: null,
    assignedMechanicId: mechanicId, assignedMechanic: { id: mechanicId, name: 'MG' },
  };
}

function workOrder(mechanicId = 'mg') {
  return {
    id: 'wo-1', displayId: 'WO-001', truckId: 'truck-277', primaryCategoryId: 'cat', status: 'in_progress' as const,
    priority: 'normal' as const, notes: null, createdAt: new Date(), createdById: 'mgr', startedAt: new Date(),
    completedAt: null, completedById: null, totalActiveLaborMs: 0n, totalWaitingMs: 0n, version: 3,
    truck: { id: 'truck-277', truckNumber: '277', make: null, model: null, year: null, mileage: null, company: null, owner: null },
    primaryCategory: { id: 'cat', name: 'Inspection' }, jobs: [ownedJob(mechanicId)], pauseEvents: [], sessions: [],
    mechanics: [{ mechanicId, addedAt: new Date(), removedAt: null, mechanic: { name: 'MG' } }],
  };
}

function setup(blocker: { resolvedAt: Date | null } | null, mechanicId = 'mg') {
  const wo = workOrder(mechanicId);
  const tx = {
    workOrder: { findUnique: vi.fn().mockResolvedValue(wo), update: vi.fn().mockResolvedValue({ ...wo, version: 4 }) },
    pauseEvent: {
      findFirst: vi.fn().mockResolvedValue(blocker ? { id: 'b-1', reason: 'waiting_for_parts', notes: null, ...blocker } : null),
      update: vi.fn(),
    },
  };
  const activity = { log: vi.fn() };
  const service = new WorkOrdersService({
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as never, activity as never);
  return { service, tx, activity };
}

describe('resolveBlocker (LTR-98 / D3)', () => {
  it('lets the assigned mechanic resolve an active blocker and logs it', async () => {
    const { service, tx, activity } = setup({ resolvedAt: null });

    await service.resolveBlocker(mechanic, 'wo-1', 'b-1');

    expect(tx.pauseEvent.findFirst).toHaveBeenCalledWith({ where: { id: 'b-1', workOrderId: 'wo-1', isOfficialPause: false } });
    expect(tx.pauseEvent.update).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: { resolvedAt: expect.any(Date), resolvedById: 'mg' },
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.BLOCKER_RESOLVED }));
  });

  it('rejects resolving twice', async () => {
    const { service, tx } = setup({ resolvedAt: new Date() });
    await expect(service.resolveBlocker(mechanic, 'wo-1', 'b-1')).rejects.toMatchObject({
      response: { code: 'BLOCKER_ALREADY_RESOLVED' },
    });
    expect(tx.pauseEvent.update).not.toHaveBeenCalled();
  });

  it('returns 404 for an official pause or a blocker of another Work Order', async () => {
    const { service } = setup(null);
    await expect(service.resolveBlocker(mechanic, 'wo-1', 'b-x')).rejects.toThrow('Blocker not found');
  });

  it('lets the Manager resolve without being on the Work Order team', async () => {
    const { service, tx } = setup({ resolvedAt: null }, 'someone-else');
    await service.resolveBlocker(manager, 'wo-1', 'b-1', { managerActor: true });
    expect(tx.pauseEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resolvedById: 'mgr' }),
    }));
  });
});
