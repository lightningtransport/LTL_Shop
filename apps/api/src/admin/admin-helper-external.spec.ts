import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import { AdminService } from './admin.service';

/** LTR-188 / D23 (helper Job) and D24 (external shop): the Manager's Job menu. */

const WO_ID = '00000000-0000-4000-8000-000000000011';
const JOB_ID = '00000000-0000-4000-8000-000000000501';
const OWNER_ID = '00000000-0000-4000-8000-000000000061';
const HELPER_ID = '00000000-0000-4000-8000-000000000062';
const CATEGORY_ID = '00000000-0000-4000-8000-000000000031';
let keySeq = 900;
const key = () => `00000000-0000-4000-8000-000000000${String(keySeq++).padStart(3, '0')}`;

const manager = {
  id: '00000000-0000-4000-8000-000000000041', email: 'manager@lightning.local', name: 'Shop Manager',
  role: 'manager' as const, active: true,
  capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
};

type Job = Record<string, unknown>;

function job(overrides: Job = {}): Job {
  return {
    id: JOB_ID, workOrderId: WO_ID, catalogJobId: null, displayName: 'Air Leak', customDescription: null, isCustom: true,
    status: 'to_do', categoryId: CATEGORY_ID, category: { name: 'Air & Brake System' },
    assignedMechanicId: OWNER_ID, assignedMechanic: { id: OWNER_ID, name: 'Mario' },
    completedAt: null, completedBy: null, startedAt: null,
    helperOfJobId: null, externalSince: null, externalKind: null, externalNote: null, externalById: null,
    ...overrides,
  };
}

function row(jobs: Job[], overrides: Record<string, unknown> = {}) {
  return {
    id: WO_ID, displayId: 'WO-0011', truckId: '00000000-0000-4000-8000-000000000021',
    primaryCategoryId: CATEGORY_ID, status: 'in_progress', priority: 'normal', notes: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'), createdById: manager.id, startedAt: null, completedAt: null,
    completedById: null, totalActiveLaborMs: 0n, totalWaitingMs: 0n, version: 1,
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    truck: { id: '00000000-0000-4000-8000-000000000021', truckNumber: 'T-21', make: null, model: null, year: null, mileage: null, company: null, owner: null },
    primaryCategory: { id: CATEGORY_ID, name: 'Air & Brake System' },
    createdBy: { id: manager.id, name: 'Shop Manager' }, completedBy: null,
    jobs, pauseEvents: [], sessions: [], activityLogs: [], mechanics: [], serviceStatusEvents: [],
    ...overrides,
  };
}

function setup(wo: ReturnType<typeof row>, options: { user?: { id: string; name: string } | null; blockers?: unknown[] } = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    workOrder: { findUnique: vi.fn().mockResolvedValue(wo), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn() },
    user: { findFirst: vi.fn().mockResolvedValue(options.user === undefined ? { id: HELPER_ID, name: 'Luis' } : options.user) },
    mechanicAssignment: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    workOrderJob: {
      create: vi.fn().mockResolvedValue({ id: 'helper-job' }),
      update: vi.fn(),
      // The owner has nothing else here; the Work Order still has the pending Job.
      count: vi.fn(async ({ where }: { where: { assignedMechanicId?: string } }) => (where.assignedMechanicId ? 0 : 1)),
    },
    workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    workSession: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    pauseEvent: { findMany: vi.fn().mockResolvedValueOnce(options.blockers ?? []).mockResolvedValue([]), update: vi.fn() },
  };
  const prisma = {
    workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const activity = { log: vi.fn() };
  const service = new AdminService(prisma as never, activity as never, {} as never);
  return { tx, activity, service };
}

async function rejectsWithCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).getResponse()).toMatchObject({ code });
}

describe('addHelperJob (LTR-188 / D23)', () => {
  const body = () => ({ mechanicId: HELPER_ID, expectedVersion: 1, idempotencyKey: key() });

  it('creates a separate Job for the helper with the parent\'s Job, Category and name', async () => {
    const { tx, activity, service } = setup(row([job()]));
    await service.addHelperJob(manager, WO_ID, JOB_ID, body());
    expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: HELPER_ID, active: true, capabilities: { some: { capability: 'MECHANIC_STANDARD' } } },
    }));
    expect(tx.workOrderJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workOrderId: WO_ID, catalogJobId: null, categoryId: CATEGORY_ID, displayName: 'Air Leak', isCustom: true,
        assignedMechanicId: HELPER_ID, helperOfJobId: JOB_ID, status: 'to_do',
      }),
    });
    expect(tx.mechanicAssignment.create).toHaveBeenCalledWith({ data: { workOrderId: WO_ID, mechanicId: HELPER_ID, addedById: manager.id } });
    expect(tx.workOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.JOB_ADDED,
      newValue: expect.objectContaining({ action: 'helper_added', helperOfJobId: JOB_ID, mechanicName: 'Luis' }),
    }));
  });

  it('refuses the owner, a non-Standard mechanic, or the same helper twice', async () => {
    const sameOwner = setup(row([job()]), { user: { id: OWNER_ID, name: 'Mario' } });
    await rejectsWithCode(sameOwner.service.addHelperJob(manager, WO_ID, JOB_ID, { ...body(), mechanicId: OWNER_ID }), 'HELPER_INVALID_MECHANIC');
    const notStandard = setup(row([job()]), { user: null });
    await rejectsWithCode(notStandard.service.addHelperJob(manager, WO_ID, JOB_ID, body()), 'HELPER_INVALID_MECHANIC');
    const twice = setup(row([job(), job({ id: 'helper-1', helperOfJobId: JOB_ID, assignedMechanicId: HELPER_ID })]));
    await rejectsWithCode(twice.service.addHelperJob(manager, WO_ID, JOB_ID, body()), 'HELPER_ALREADY_ADDED');
    expect(twice.tx.workOrderJob.create).not.toHaveBeenCalled();
  });

  it('refuses the PM job, the Quality Check and a helper Job', async () => {
    const pm = setup(row([job({ displayName: 'PM A Service', category: { name: 'PM' } })]));
    await rejectsWithCode(pm.service.addHelperJob(manager, WO_ID, JOB_ID, body()), 'HELPER_NOT_ALLOWED_HERE');
    const qc = setup(row([job({ displayName: 'Quality Check', category: { name: 'Quality Check' }, assignedMechanicId: null })]));
    await rejectsWithCode(qc.service.addHelperJob(manager, WO_ID, JOB_ID, body()), 'HELPER_NOT_ALLOWED_HERE');
    const helper = setup(row([job({ helperOfJobId: 'parent-job' })]));
    await rejectsWithCode(helper.service.addHelperJob(manager, WO_ID, JOB_ID, body()), 'HELPER_NOT_ALLOWED_HERE');
  });

  it('refuses a finished Job or a closed Work Order', async () => {
    const done = setup(row([job({ status: 'completed' })]));
    await rejectsWithCode(done.service.addHelperJob(manager, WO_ID, JOB_ID, body()), 'HELPER_JOB_NOT_OPEN');
    const closed = setup(row([job()], { status: 'completed' }));
    await rejectsWithCode(closed.service.addHelperJob(manager, WO_ID, JOB_ID, body()), 'HELPER_JOB_NOT_OPEN');
  });
});

describe('sendJobExternal (LTR-188 / D24)', () => {
  const body = (kind: 'part' | 'truck' = 'part') => ({ kind, note: 'Hydraulic shop, back Friday', expectedVersion: 1, idempotencyKey: key() });

  it('takes the owner off, closes their clock when it was their last Job, and resolves the blocker', async () => {
    const blocker = { id: 'blocker-1', jobId: JOB_ID, reason: 'other', blockerReason: 'waiting_for_parts', notes: null };
    const { tx, activity, service } = setup(row([job()]), { blockers: [blocker] });
    await service.sendJobExternal(manager, WO_ID, JOB_ID, body('truck'));
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: JOB_ID },
      data: expect.objectContaining({
        assignedMechanicId: null, externalSince: expect.any(Date), externalKind: 'truck',
        externalNote: 'Hydraulic shop, back Friday', externalById: manager.id,
      }),
    });
    expect(tx.pauseEvent.update).toHaveBeenCalledWith({
      where: { id: 'blocker-1' }, data: { resolvedAt: expect.any(Date), resolvedById: manager.id },
    });
    expect(tx.workSession.updateMany).toHaveBeenCalledWith({
      where: { workOrderId: WO_ID, endedAt: null, userId: OWNER_ID }, data: { endedAt: expect.any(Date) },
    });
    expect(tx.mechanicAssignment.updateMany).toHaveBeenCalled();
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      relevantValue: expect.objectContaining({ action: 'job_sent_external', kind: 'truck' }),
    }));
  });

  it('keeps the owner\'s clock when they still have another available Job here', async () => {
    const { tx, service } = setup(row([job()]));
    tx.workOrderJob.count.mockResolvedValue(1);
    await service.sendJobExternal(manager, WO_ID, JOB_ID, body());
    expect(tx.workSession.updateMany).not.toHaveBeenCalled();
  });

  it('refuses the Quality Check, a Job already outside, a finished Job and an empty note', async () => {
    const qc = setup(row([job({ displayName: 'Quality Check', category: { name: 'Quality Check' } })]));
    await rejectsWithCode(qc.service.sendJobExternal(manager, WO_ID, JOB_ID, body()), 'EXTERNAL_NOT_ALLOWED_HERE');
    const outside = setup(row([job({ assignedMechanicId: null, externalSince: new Date(), externalKind: 'part', externalNote: 'x' })]));
    await rejectsWithCode(outside.service.sendJobExternal(manager, WO_ID, JOB_ID, body()), 'EXTERNAL_ALREADY');
    const done = setup(row([job({ status: 'completed' })]));
    await expect(done.service.sendJobExternal(manager, WO_ID, JOB_ID, body())).rejects.toBeInstanceOf(BadRequestException);
    const empty = setup(row([job()]));
    await expect(empty.service.sendJobExternal(manager, WO_ID, JOB_ID, { ...body(), note: '  ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('shows the Job as external on the Work Order detail and keeps it out of "unassigned"', async () => {
    const since = new Date('2026-10-05T14:00:00.000Z');
    const outside = job({ assignedMechanicId: null, assignedMechanic: null, externalSince: since, externalKind: 'part', externalNote: 'Machine shop' });
    const { service } = setup(row([outside]));
    // A plain Assign is refused: the Job comes back through "Returned".
    await rejectsWithCode(
      service.assignJob(manager, WO_ID, JOB_ID, { mechanicId: HELPER_ID, expectedVersion: 1, idempotencyKey: key() }),
      'JOB_AT_EXTERNAL_SHOP',
    );
    const { service: returnService } = setup(row([outside]), { user: { id: HELPER_ID, name: 'Luis' } });
    const detail = await returnService.returnJobExternal(manager, WO_ID, JOB_ID, {
      outcome: 'assign', mechanicId: HELPER_ID, expectedVersion: 1, idempotencyKey: key(),
    });
    // The mocked row is unchanged, so the DTO still shows it outside: the mapping is what this checks.
    expect(detail.jobs[0]).toMatchObject({ external: { kind: 'part', note: 'Machine shop', since: since.toISOString() }, helperOfJobId: null });
    expect(detail.attentionReason).not.toBe('unassigned');
  });
});

describe('returnJobExternal (LTR-188 / D24)', () => {
  const outside = () => job({ assignedMechanicId: null, assignedMechanic: null, externalSince: new Date(), externalKind: 'part', externalNote: 'Machine shop' });

  it('complete: clears the external state and completes the Job as the Manager', async () => {
    const { tx, activity, service } = setup(row([outside()]));
    await service.returnJobExternal(manager, WO_ID, JOB_ID, { outcome: 'complete', expectedVersion: 1, idempotencyKey: key() });
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: JOB_ID }, data: { externalSince: null, externalKind: null, externalNote: null, externalById: null },
    });
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: JOB_ID }, data: expect.objectContaining({ status: 'completed', completedById: manager.id }),
    });
    expect(tx.workOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.JOB_COMPLETED }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      relevantValue: expect.objectContaining({ action: 'job_returned_external', outcome: 'complete' }),
    }));
  });

  it('assign: gives the Job to a Standard mechanic who joins the team', async () => {
    const { tx, service } = setup(row([outside()]), { user: { id: HELPER_ID, name: 'Luis' } });
    await service.returnJobExternal(manager, WO_ID, JOB_ID, { outcome: 'assign', mechanicId: HELPER_ID, expectedVersion: 1, idempotencyKey: key() });
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({ where: { id: JOB_ID }, data: { assignedMechanicId: HELPER_ID, startedAt: null } });
    expect(tx.mechanicAssignment.create).toHaveBeenCalledWith({ data: { workOrderId: WO_ID, mechanicId: HELPER_ID, addedById: manager.id } });
    expect(tx.workOrder.updateMany).toHaveBeenCalledTimes(1);
  });

  it('assign needs a mechanic; a Job in the shop cannot "return"', async () => {
    const { service } = setup(row([outside()]));
    await expect(service.returnJobExternal(manager, WO_ID, JOB_ID, { outcome: 'assign', expectedVersion: 1, idempotencyKey: key() }))
      .rejects.toBeInstanceOf(BadRequestException);
    const inShop = setup(row([job()]));
    await rejectsWithCode(
      inShop.service.returnJobExternal(manager, WO_ID, JOB_ID, { outcome: 'complete', expectedVersion: 1, idempotencyKey: key() }),
      'JOB_NOT_EXTERNAL',
    );
  });
});
