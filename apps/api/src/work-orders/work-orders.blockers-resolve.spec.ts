import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';

const mechanic: AuthUser = {
  id: 'mg', email: 'mg@lightning.local', name: 'MG', role: 'mechanic', active: true,
 capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
};
const manager: AuthUser = {
  id: 'mgr', email: 'manager@lightning.local', name: 'Manager', role: 'manager', active: true,
 capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
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

function setup(blocker: { resolvedAt: Date | null; jobId?: string; reportedById?: string } | null, mechanicId = 'mg') {
  const wo = workOrder(mechanicId);
  const tx = {
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(wo),
      update: vi.fn().mockResolvedValue({ ...wo, version: 4 }),
    },
    pauseEvent: {
      findFirst: vi.fn().mockResolvedValue(blocker ? { id: 'b-1', reason: 'waiting_for_parts', notes: null, jobId: 'job-1', reportedById: 'mg', ...blocker } : null),
      update: vi.fn(),
    },
    workSession: { create: vi.fn() },
  };
  const activity = { log: vi.fn() };
  const service = new WorkOrdersService({
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as never, activity as never);
  return { service, tx, activity };
}

describe('resolveBlocker (LTR-155 / D17 replaces D3)', () => {
  it('lets the Manager resolve with an optional note and does not restart labor', async () => {
    const { service, tx, activity } = setup({ resolvedAt: null }, 'someone-else');

    await service.resolveBlocker(manager, 'wo-1', 'b-1', { notes: 'Part picked up at the counter' });

    expect(tx.pauseEvent.update).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: { resolvedAt: expect.any(Date), resolvedById: 'mgr' },
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.BLOCKER_RESOLVED,
      entityType: 'pause_event',
      entityId: 'b-1',
      newValue: { resolved: true, actor: 'manager', notes: 'Part picked up at the counter' },
    }));
    // D18: time restarts only when the mechanic taps Continue.
    expect(tx.workSession.create).not.toHaveBeenCalled();
  });

  it('rejects resolving twice', async () => {
    const { service, tx } = setup({ resolvedAt: new Date() });
    await expect(service.resolveBlocker(manager, 'wo-1', 'b-1')).rejects.toMatchObject({
      response: { code: 'BLOCKER_ALREADY_RESOLVED' },
    });
    expect(tx.pauseEvent.update).not.toHaveBeenCalled();
  });

  it('returns 404 for an official pause or a blocker of another Work Order', async () => {
    const { service } = setup(null);
    await expect(service.resolveBlocker(manager, 'wo-1', 'b-x')).rejects.toThrow('Blocker not found');
  });

  it('has no mechanic resolve route (only Admin resolves)', () => {
    expect(Object.getOwnPropertyNames(WorkOrdersController.prototype)).not.toContain('resolveBlocker');
    expect(Object.getOwnPropertyNames(WorkOrdersController.prototype)).toContain('addBlockerNote');
  });
});

describe('addBlockerNote (LTR-155 / D17)', () => {
  it('appends a note by the mechanic who owns the blocked Job', async () => {
    const { service, activity, tx } = setup({ resolvedAt: null });

    await service.addBlockerNote(mechanic, 'wo-1', 'b-1', { body: 'The part arrived' });

    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.NOTE_ADDED,
      entityType: 'pause_event',
      entityId: 'b-1',
      userId: 'mg',
      newValue: { body: 'The part arrived' },
    }));
    expect(tx.pauseEvent.update).not.toHaveBeenCalled();
  });

  it('rejects empty notes, resolved blockers and other mechanics', async () => {
    const empty = setup({ resolvedAt: null });
    await expect(empty.service.addBlockerNote(mechanic, 'wo-1', 'b-1', { body: '  ' })).rejects.toMatchObject({ status: 400 });

    const resolved = setup({ resolvedAt: new Date() });
    await expect(resolved.service.addBlockerNote(mechanic, 'wo-1', 'b-1', { body: 'x' })).rejects.toMatchObject({
      response: { code: 'BLOCKER_ALREADY_RESOLVED' },
    });

    const other = setup({ resolvedAt: null, jobId: 'job-other', reportedById: 'someone' });
    await expect(other.service.addBlockerNote(mechanic, 'wo-1', 'b-1', { body: 'x' })).rejects.toMatchObject({ status: 403 });
    expect(other.activity.log).not.toHaveBeenCalled();
  });
});
