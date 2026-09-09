import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability, Priority } from '@ltl-shop/shared';
import { WorkOrdersService } from './work-orders.service';
import { idempotencyFingerprint } from '../common/idempotency';

describe('PM Work Order authorization', () => {
  it('creates Daniel PM work atomically as active with one session and both audit events', async () => {
    const createdAt = new Date('2026-09-02T15:00:00.000Z');
    const created = {
      id: 'wo-pm-1', displayId: 'WO-0001', truckId: 'truck-1', primaryCategoryId: 'pm-category',
      status: 'in_progress', priority: Priority.NORMAL, notes: null, createdAt, createdById: 'daniel-id',
      startedAt: createdAt, completedAt: null, completedById: null, totalActiveLaborMs: BigInt(0),
      totalWaitingMs: BigInt(0), version: 1,
      truck: { id: 'truck-1', truckNumber: '905', make: 'Peterbilt', model: '579', year: 2025, mileage: 155000, company: null, owner: null },
      primaryCategory: { id: 'pm-category', name: 'PM' }, jobs: [], pauseEvents: [],
      mechanics: [{ mechanicId: 'daniel-id', addedAt: createdAt, removedAt: null, mechanic: { name: 'Daniel' } }],
    } as never;
    const tx = { workOrder: { create: vi.fn().mockResolvedValue(created) } };
    const prisma = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0),
      },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'pm-category', name: 'PM' }) },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as never;
    const activity = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new WorkOrdersService(prisma, activity as never);

    const result = await service.create({
      id: 'daniel-id', email: 'daniel@lightning.local', name: 'Daniel',
      role: 'mechanic', active: true, pmAuthorized: true, capabilities: [AppCapability.MECHANIC_PM], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000002',
      priority: Priority.NORMAL, mechanicIds: [], jobs: [], notes: 'must not be saved at creation',
    });

    expect(result.status).toBe('in_progress');
    expect(tx.workOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'in_progress', startedAt: expect.any(Date), notes: undefined,
        sessions: { create: { startedAt: expect.any(Date) } },
        jobs: { create: [] },
        mechanics: { create: [{ mechanicId: 'daniel-id', addedById: 'daniel-id' }] },
      }),
    }));
    expect(activity.log).toHaveBeenCalledTimes(2);
    expect(activity.log).toHaveBeenLastCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.WORK_STARTED }));
  });

  it('rejects PM creation by a mechanic without PM authorization', async () => {
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'pm-category', name: 'PM' }) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'alejandro-id', email: 'mechanic@lightning.local', name: 'Alejandro 1',
      role: 'mechanic', active: true, pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000002',
      priority: Priority.NORMAL,
      mechanicIds: [],
      jobs: [{
        categoryId: '00000000-0000-4000-8000-000000000002',
        displayName: 'PM A Service',
      }],
    })).rejects.toThrow('You do not have access to the PM mechanic workspace');
  });

  it('rejects a Work Order idempotency key reused for another truck or payload', async () => {
    const prisma = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue({
          truckId: '00000000-0000-4000-8000-000000000099',
          idempotencyPayloadHash: 'different-payload',
          idempotencyActorId: 'daniel-id',
        }),
      },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'daniel-id', email: 'daniel@lightning.local', name: 'Daniel',
      role: 'mechanic', active: true, pmAuthorized: true, capabilities: [AppCapability.MECHANIC_PM], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000002',
      jobs: [],
      idempotencyKey: 'idempotency-key-duplicate',
    })).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSE' } });
  });

  it('replays a Work Order found after waiting for the truck lock before open-WO checks', async () => {
    const createdAt = new Date('2026-09-02T15:00:00.000Z');
    const idempotencyKey = 'idempotency-key-after-lock';
    const stored = {
      id: 'wo-pm-after-lock', displayId: 'WO-0002', truckId: '00000000-0000-0000-0000-000000000001', primaryCategoryId: '00000000-0000-0000-0000-000000000002',
      status: 'in_progress', priority: Priority.NORMAL, notes: null, createdAt, createdById: 'daniel-id',
      startedAt: createdAt, completedAt: null, completedById: null, totalActiveLaborMs: BigInt(0),
      totalWaitingMs: BigInt(0), version: 1,
      idempotencyPayloadHash: idempotencyFingerprint({
        truckId: '00000000-0000-0000-0000-000000000001',
        primaryCategoryId: '00000000-0000-0000-0000-000000000002',
        priority: Priority.NORMAL,
        notes: null,
        mechanicIds: [],
        jobs: [],
      }),
      idempotencyActorId: 'daniel-id',
      truck: { id: 'truck-1', truckNumber: '905', make: 'Peterbilt', model: '579', year: 2025, mileage: 155000, company: null, owner: null },
      primaryCategory: { id: 'pm-category', name: 'PM' }, jobs: [], pauseEvents: [],
      mechanics: [{ mechanicId: 'daniel-id', addedAt: createdAt, removedAt: null, mechanic: { name: 'Daniel' } }],
    } as never;
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      workOrder: { findUnique: vi.fn().mockResolvedValue(stored) },
    };
    const prisma = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'pm-category', name: 'PM' }) },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never);

    const result = await service.create({
      id: 'daniel-id', email: 'daniel@lightning.local', name: 'Daniel',
      role: 'mechanic', active: true, pmAuthorized: true, capabilities: [AppCapability.MECHANIC_PM], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-0000-0000-000000000001',
      primaryCategoryId: '00000000-0000-0000-0000-000000000002',
      jobs: [],
      idempotencyKey,
    });

    expect(result.id).toBe('wo-pm-after-lock');
    expect(tx.workOrder.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.workOrder.findFirst).toHaveBeenCalledTimes(1);
  });

  it('does not let a PM mechanic create a non-PM Work Order', async () => {
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'brakes-category', name: 'Brakes' }) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'daniel-id', email: 'daniel@lightning.local', name: 'Daniel',
      role: 'mechanic', active: true, pmAuthorized: true, capabilities: [AppCapability.MECHANIC_PM], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000003',
      priority: Priority.NORMAL,
      mechanicIds: [],
      jobs: [{
        categoryId: '00000000-0000-4000-8000-000000000003',
        displayName: 'Brake Inspection',
      }],
    })).rejects.toThrow('You do not have access to the standard mechanic workspace');
  });

  it('rejects a job checklist on a PM Work Order', async () => {
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'pm-category', name: 'PM' }) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'daniel-id', email: 'daniel@lightning.local', name: 'Daniel',
      role: 'mechanic', active: true, pmAuthorized: true, capabilities: [AppCapability.MECHANIC_PM], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000002',
      priority: Priority.NORMAL,
      mechanicIds: [],
      jobs: [{
        categoryId: '00000000-0000-4000-8000-000000000002',
        displayName: 'PM A Service',
      }],
    })).rejects.toThrow('PM Work Orders do not use jobs');
  });

  it('keeps at least one job mandatory for non-PM Work Orders', async () => {
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'brakes-category', name: 'Brakes' }) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'alex-id', email: 'mechanic@lightning.local', name: 'Alejandro 1',
      role: 'mechanic', active: true, pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000003',
      priority: Priority.NORMAL,
      mechanicIds: [],
      jobs: [],
    })).rejects.toThrow('At least one job is required for this Work Order');
  });

  it('rejects a duplicate job on an open standard Work Order', async () => {
    const tx = {
      workOrder: {
        findUnique: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000011',
          truckId: '00000000-0000-4000-8000-000000000001',
          primaryCategoryId: '00000000-0000-4000-8000-000000000003',
          status: 'in_progress', version: 1, createdById: 'alex-id', mechanics: [], primaryCategory: { name: 'Brakes' },
        }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
      jobCategory: { findFirst: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000003', name: 'Brakes' }) },
      catalogJob: { findMany: vi.fn().mockResolvedValue([{ id: '00000000-0000-4000-8000-000000000012' }]) },
      workOrderJob: { findMany: vi.fn().mockResolvedValue([{ catalogJobId: '00000000-0000-4000-8000-000000000012', displayName: 'Brake Inspection' }]) },
      workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.addJob({
      id: 'alex-id', email: 'mechanic@lightning.local', name: 'Alejandro 1',
      role: 'mechanic', active: true, pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
    }, '00000000-0000-4000-8000-000000000011', {
      catalogJobId: '00000000-0000-4000-8000-000000000012',
      categoryId: '00000000-0000-4000-8000-000000000003',
      displayName: 'Brake Inspection',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000013',
    })).rejects.toMatchObject({
      response: { message: 'This job is already on the Work Order' },
    });
  });

  it('replays an Add Job response for the same idempotency key without another write', async () => {
    const stored = { id: 'wo-result', version: 4 };
    const prisma = {
      workOrderMutation: { findUnique: vi.fn().mockResolvedValue({
        workOrderId: '00000000-0000-4000-8000-000000000011',
        operation: 'add_job',
        payloadHash: idempotencyFingerprint({
          workOrderId: '00000000-0000-4000-8000-000000000011',
          categoryId: '00000000-0000-4000-8000-000000000003',
          displayName: 'Brake Inspection',
          expectedVersion: 3,
          idempotencyKey: '00000000-0000-4000-8000-000000000014',
        }),
        actorId: 'alex-id',
        result: stored,
      }) },
      $transaction: vi.fn(),
    };
    const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never);

    await expect(service.addJob({
      id: 'alex-id', email: 'mechanic@lightning.local', name: 'Alejandro 1',
      role: 'mechanic', active: true, pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
    }, '00000000-0000-4000-8000-000000000011', {
      categoryId: '00000000-0000-4000-8000-000000000003',
      displayName: 'Brake Inspection', expectedVersion: 3,
      idempotencyKey: '00000000-0000-4000-8000-000000000014',
    })).resolves.toEqual(stored);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects reuse of an Add Job idempotency key for another payload', async () => {
    const prisma = {
      workOrderMutation: { findUnique: vi.fn().mockResolvedValue({
        workOrderId: '00000000-0000-4000-8000-000000000011', operation: 'add_job',
        payloadHash: 'other-payload', actorId: 'alex-id', result: {},
      }) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.addJob({
      id: 'alex-id', email: 'mechanic@lightning.local', name: 'Alejandro 1',
      role: 'mechanic', active: true, pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
    }, '00000000-0000-4000-8000-000000000011', {
      categoryId: '00000000-0000-4000-8000-000000000003',
      displayName: 'Brake Inspection', expectedVersion: 3,
      idempotencyKey: '00000000-0000-4000-8000-000000000015',
    })).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSE' } });
  });

  it('rejects duplicate jobs in a newly created Work Order before writing', async () => {
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'alex-id', email: 'mechanic@lightning.local', name: 'Alejandro 1',
      role: 'mechanic', active: true, pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000003',
      priority: Priority.NORMAL,
      mechanicIds: [],
      jobs: [
        { catalogJobId: '00000000-0000-4000-8000-000000000012', categoryId: '00000000-0000-4000-8000-000000000003', displayName: 'Brake Inspection' },
        { catalogJobId: '00000000-0000-4000-8000-000000000012', categoryId: '00000000-0000-4000-8000-000000000003', displayName: 'Brake Inspection' },
      ],
    })).rejects.toMatchObject({ response: { message: 'A Work Order cannot contain duplicate jobs' } });
  });

  it('rejects pausing a standard Work Order with no pending jobs', async () => {
    const tx = {
      workOrder: { findUnique: vi.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000011',
        primaryCategoryId: '00000000-0000-4000-8000-000000000003',
        primaryCategory: { name: 'Brakes' }, status: 'in_progress', jobs: [{ status: 'completed' }],
        createdById: 'alex-id', mechanics: [],
      }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ name: 'Brakes' }) },
    };
    const prisma = { $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.pause({
      id: 'alex-id', email: 'mechanic@lightning.local', name: 'Alejandro 1', role: 'mechanic', active: true, pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
    }, '00000000-0000-4000-8000-000000000011', { reason: 'waiting_for_parts' })).rejects.toMatchObject({
      response: { message: 'A Work Order without pending jobs cannot be paused' },
    });
  });

  it('does not let a standard Work Order assign a PM-only mechanic', async () => {
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'brakes-category', name: 'Brakes' }) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'alex-id', email: 'mechanic@lightning.local', name: 'Alejandro 1',
      role: 'mechanic', active: true, pmAuthorized: false, capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000003',
      priority: Priority.NORMAL,
      mechanicIds: ['00000000-0000-4000-8000-000000000004'],
      jobs: [{ categoryId: '00000000-0000-4000-8000-000000000003', displayName: 'Brake Inspection' }],
    })).rejects.toMatchObject({
      response: { message: 'One or more selected mechanics cannot perform standard work' },
    });
  });
});
