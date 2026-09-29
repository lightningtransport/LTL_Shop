import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability, Priority } from '@ltl-shop/shared';
import { WorkOrdersService } from './work-orders.service';
import { idempotencyFingerprint } from '../common/idempotency';

const workOrderId = '00000000-0000-4000-8000-000000000011';
const categoryId = '00000000-0000-4000-8000-000000000004';
const mechanicId = '00000000-0000-4000-8000-000000000050';
const newJobId = '00000000-0000-4000-8000-000000000031';
const idempotencyKey = '00000000-0000-4000-8000-000000000023';

const manager = {
  id: 'manager-id', email: 'manager@lightning.local', name: 'Shop Manager', role: 'manager' as const, active: true,
  pmAuthorized: false, capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
};

const body = { categoryId, displayName: 'Air Leak', expectedVersion: 2, idempotencyKey };

function setup(options: {
  categoryName?: string;
  mechanic?: { id: string; name: string } | null;
  teamAssignment?: { id: string; removedAt: Date | null } | null;
} = {}) {
  const createdAt = new Date('2026-09-28T13:00:00.000Z');
  const wo = {
    id: workOrderId, displayId: 'WO-0011',
    truckId: '00000000-0000-4000-8000-000000000001',
    primaryCategoryId: categoryId,
    status: 'in_progress', priority: Priority.NORMAL, notes: null, createdAt,
    createdById: 'manager-id', startedAt: createdAt, completedAt: null, completedById: null,
    totalActiveLaborMs: BigInt(0), totalWaitingMs: BigInt(0), version: 2,
    truck: { id: 'truck-1', truckNumber: '905', make: null, model: null, year: null, mileage: null, company: null, owner: null },
    primaryCategory: { id: categoryId, name: 'Air & Brake System' },
    jobs: [], pauseEvents: [], mechanics: [],
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    workOrder: { findUnique: vi.fn().mockResolvedValue(wo), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    jobCategory: { findFirst: vi.fn().mockResolvedValue({ id: categoryId, name: options.categoryName ?? 'Air & Brake System' }) },
    catalogJob: { findMany: vi.fn().mockResolvedValue([]) },
    user: {
      findFirst: vi.fn().mockResolvedValue(
        options.mechanic === undefined ? { id: mechanicId, name: 'Mario' } : options.mechanic,
      ),
    },
    mechanicAssignment: {
      findUnique: vi.fn().mockResolvedValue(options.teamAssignment ?? null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    workOrderJob: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: newJobId, catalogJobId: null, displayName: 'Air Leak', isCustom: true,
      }),
    },
  };
  const prisma = {
    workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  const activity = { log: vi.fn().mockResolvedValue(undefined) };
  const service = new WorkOrdersService(prisma as never, activity as never);
  return { tx, prisma, activity, service };
}

describe('addJobByManager with the Job owner (D14)', () => {
  it('adds the Job with its owner, joins the team and logs the assignment in one version bump', async () => {
    const { tx, activity, service } = setup();
    await service.addJobByManager(manager, workOrderId, body, { assignedMechanicId: mechanicId });

    expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: mechanicId, active: true, capabilities: { some: { capability: 'MECHANIC_STANDARD' } } },
    }));
    expect(tx.workOrderJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assignedMechanicId: mechanicId }),
    }));
    expect(tx.mechanicAssignment.create).toHaveBeenCalledWith({
      data: { workOrderId, mechanicId, addedById: manager.id },
    });
    expect(tx.workOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.MECHANIC_ADDED,
      entityId: newJobId,
      newValue: expect.objectContaining({ action: 'job_assigned', assignedMechanicId: mechanicId, mechanicName: 'Mario' }),
    }));
    expect(tx.workOrderMutation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        operation: 'add_job',
        payloadHash: idempotencyFingerprint({ workOrderId, ...body, assignedMechanicId: mechanicId }),
      }),
    });
  });

  it('restores a removed team assignment instead of creating another', async () => {
    const { tx, service } = setup({ teamAssignment: { id: 'assignment-1', removedAt: new Date() } });
    await service.addJobByManager(manager, workOrderId, body, { assignedMechanicId: mechanicId });
    expect(tx.mechanicAssignment.create).not.toHaveBeenCalled();
    expect(tx.mechanicAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'assignment-1' },
      data: expect.objectContaining({ removedAt: null, addedById: manager.id }),
    }));
  });

  it('refuses an inactive or non-Standard mechanic before writing', async () => {
    const { tx, service } = setup({ mechanic: null });
    await expect(service.addJobByManager(manager, workOrderId, body, { assignedMechanicId: mechanicId }))
      .rejects.toMatchObject({ response: { message: 'This mechanic cannot perform standard work' } });
    expect(tx.workOrderJob.create).not.toHaveBeenCalled();
    expect(tx.workOrder.updateMany).not.toHaveBeenCalled();
  });

  it('refuses an owner on the PM job, which is assigned on the Work Order', async () => {
    const { tx, service } = setup({ categoryName: 'PM' });
    await expect(service.addJobByManager(manager, workOrderId, body, { assignedMechanicId: mechanicId }))
      .rejects.toMatchObject({ response: { message: 'Assign the PM job from the Work Order' } });
    expect(tx.workOrderJob.create).not.toHaveBeenCalled();
  });

  it('adds an unassigned Job without touching the team and keeps the old fingerprint', async () => {
    const { tx, activity, service } = setup();
    await service.addJobByManager(manager, workOrderId, body);
    expect(tx.user.findFirst).not.toHaveBeenCalled();
    expect(tx.mechanicAssignment.create).not.toHaveBeenCalled();
    expect(activity.log).toHaveBeenCalledTimes(1);
    expect(tx.workOrderMutation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ payloadHash: idempotencyFingerprint({ workOrderId, ...body }) }),
    });
  });

  it('rejects the same key replayed with another owner', async () => {
    const { prisma, service } = setup();
    prisma.workOrderMutation.findUnique.mockResolvedValue({
      workOrderId, operation: 'add_job', actorId: manager.id, result: {},
      payloadHash: idempotencyFingerprint({ workOrderId, ...body }),
    });
    await expect(service.addJobByManager(manager, workOrderId, body, { assignedMechanicId: mechanicId }))
      .rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSE' } });
  });

});
