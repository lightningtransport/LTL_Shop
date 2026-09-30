import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
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

function workOrder(status: 'in_progress' | 'completed' = 'in_progress', mechanicId = 'mg') {
  return {
    id: 'wo-1', displayId: 'WO-001', truckId: 'truck-277', primaryCategoryId: 'cat', status,
    priority: 'normal' as const, notes: 'Manager note', createdAt: new Date(), createdById: 'mgr', startedAt: new Date(),
    completedAt: null, completedById: null, totalActiveLaborMs: 0n, totalWaitingMs: 0n, version: 3,
    truck: { id: 'truck-277', truckNumber: '277', make: null, model: null, year: null, mileage: null, company: null, owner: null },
    primaryCategory: { id: 'cat', name: 'Inspection' }, jobs: [ownedJob(mechanicId)], pauseEvents: [], sessions: [],
    mechanics: [{ mechanicId, addedAt: new Date(), removedAt: null, mechanic: { name: 'MG' } }],
    noteEntries: [{
      id: 'n-0', kind: 'note' as const, body: 'Manager note', createdAt: new Date('2026-09-25T10:00:00Z'),
      handledAt: null, author: { id: 'mgr', name: 'Manager' }, handledBy: null,
    }],
  };
}

function setup(options: { status?: 'in_progress' | 'completed'; mechanicId?: string; request?: { handledAt: Date | null } | null } = {}) {
  const wo = workOrder(options.status, options.mechanicId);
  const tx = {
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(wo),
      findUniqueOrThrow: vi.fn().mockResolvedValue(wo),
      update: vi.fn(),
    },
    workOrderNote: {
      create: vi.fn(async ({ data }: { data: { kind: string; body: string } }) => ({ id: 'n-1', ...data })),
      findFirst: vi.fn().mockResolvedValue(options.request === undefined || options.request === null
        ? null
        : { id: 'n-2', body: 'Brake lights out', ...options.request }),
      update: vi.fn(),
    },
  };
  const activity = { log: vi.fn() };
  const service = new WorkOrdersService({
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as never, activity as never);
  return { service, tx, activity };
}

describe('append-only Work Order notes (LTR-126 / D8)', () => {
  it('appends a mechanic note without touching the Manager note or the Work Order row', async () => {
    const { service, tx, activity } = setup();

    const result = await service.addNote(mechanic, 'wo-1', { body: '  Oil leak near the pan  ' });

    expect(tx.workOrderNote.create).toHaveBeenCalledWith({
      data: { workOrderId: 'wo-1', kind: 'note', body: 'Oil leak near the pan', authorId: 'mg' },
    });
    expect(tx.workOrder.update).not.toHaveBeenCalled();
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.NOTE_ADDED }));
    expect(result.noteEntries).toEqual([expect.objectContaining({ body: 'Manager note', author: { id: 'mgr', name: 'Manager' } })]);
  });

  it('records a work request as its own kind', async () => {
    const { service, tx } = setup();
    await service.addNote(mechanic, 'wo-1', { kind: 'work_request', body: 'Brake lights out' });
    expect(tx.workOrderNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'work_request', body: 'Brake lights out' }),
    });
  });

  it('rejects empty notes and notes on a closed Work Order', async () => {
    const { service, tx } = setup();
    await expect(service.addNote(mechanic, 'wo-1', { body: '   ' })).rejects.toThrow();
    const closed = setup({ status: 'completed' });
    await expect(closed.service.addNote(mechanic, 'wo-1', { body: 'Late note' })).rejects.toMatchObject({
      response: { code: 'WORK_ORDER_CLOSED' },
    });
    expect(tx.workOrderNote.create).not.toHaveBeenCalled();
  });

  it('refuses a mechanic who is not on the Work Order team but lets the Manager add a note', async () => {
    const { service, tx } = setup({ mechanicId: 'someone-else' });
    await expect(service.addNote(mechanic, 'wo-1', { body: 'Hi' })).rejects.toThrow();
    await service.addNote(manager, 'wo-1', { body: 'Use the OEM part' }, { managerActor: true });
    expect(tx.workOrderNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authorId: 'mgr', body: 'Use the OEM part' }),
    });
  });

  it('lets the Manager mark a work request handled once', async () => {
    const { service, tx, activity } = setup({ request: { handledAt: null } });
    await service.handleWorkRequest(manager, 'wo-1', 'n-2');
    expect(tx.workOrderNote.findFirst).toHaveBeenCalledWith({ where: { id: 'n-2', workOrderId: 'wo-1', kind: 'work_request' } });
    expect(tx.workOrderNote.update).toHaveBeenCalledWith({
      where: { id: 'n-2' },
      data: { handledAt: expect.any(Date), handledById: 'mgr' },
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.WORK_REQUEST_HANDLED }));

    const again = setup({ request: { handledAt: new Date() } });
    await expect(again.service.handleWorkRequest(manager, 'wo-1', 'n-2')).rejects.toMatchObject({
      response: { code: 'WORK_REQUEST_ALREADY_HANDLED' },
    });
    const missing = setup({ request: null });
    await expect(missing.service.handleWorkRequest(manager, 'wo-1', 'n-x')).rejects.toThrow('Work request not found');
  });
});
