import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityEventType, AppCapability } from '@ltl-shop/shared';
import { idempotencyFingerprint } from '../common/idempotency';
import { AdminService, countUnassignedJobs } from './admin.service';

const baseRow = {
  id: '00000000-0000-4000-8000-000000000011',
  displayId: 'WO-0011',
  truckId: '00000000-0000-4000-8000-000000000021',
  primaryCategoryId: '00000000-0000-4000-8000-000000000031',
  status: 'created',
  priority: 'normal',
  notes: null,
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  createdById: '00000000-0000-4000-8000-000000000041',
  startedAt: null,
  completedAt: null,
  completedById: null,
  totalActiveLaborMs: 0n,
  totalWaitingMs: 0n,
  version: 1,
  updatedAt: new Date('2026-09-02T10:00:00.000Z'),
  truck: {
    id: '00000000-0000-4000-8000-000000000021',
    truckNumber: 'T-21',
    make: 'Volvo', model: 'VNL', year: 2024, mileage: null, company: null, owner: null,
  },
  primaryCategory: { id: '00000000-0000-4000-8000-000000000031', name: 'Engine' },
  jobs: [{ status: 'to_do', assignedMechanicId: 'mechanic-1' }],
  mechanics: [],
  pauseEvents: [],
};

function createPrisma() {
  return {
    workOrder: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    workOrderJob: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    workSession: {
      findUnique: vi.fn(),
    },
    pauseEvent: {
      findUnique: vi.fn(),
    },
    truck: {
      findMany: vi.fn(),
    },
    jobCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workOrderMutation: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    workOrderNote: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(),
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new AdminService(prisma as never, { log: vi.fn() } as never, {} as never);
}

describe('AdminService', () => {
  afterEach(() => vi.useRealTimers());

  it('returns current dashboard counts with provenance', async () => {
    const prisma = createPrisma();
    [6, 2, 3, 4, 5, 6].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await expect(service.dashboard()).resolves.toMatchObject({
      source: 'supabase_postgres',
      counts: {
        open: 6, waitingPaused: 2, highCriticalOpen: 3,
        openOlderThan24h: 4, completedToday: 5, completedLast7Days: 6,
      },
      attention: [],
    });
    expect(prisma.workOrder.count).toHaveBeenCalledTimes(6);
    // LTR-121: critical, high, paused, open, ready to close, active blocker; then (stage 3) the queue of
    // open Work Orders. Without YARD_READY_TO_GO_SINCE there is no Ready to Go window to read.
    expect(prisma.workOrder.findMany).toHaveBeenCalledTimes(7);
    expect(prisma.workOrder.findMany.mock.calls[6][0]).toMatchObject({
      where: { status: { in: ['created', 'in_progress', 'waiting_paused'] } },
      take: 200,
    });
    expect(prisma.workOrder.findMany.mock.calls[5][0].where).toMatchObject({
      pauseEvents: { some: { isOfficialPause: false, resolvedAt: null } },
    });
    expect(prisma.workOrder.findMany.mock.calls[4][0].where).toMatchObject({
      status: 'in_progress',
      // LTR-97: PM Work Orders (no Jobs) are never "ready to close".
      primaryCategory: { name: { not: 'PM' } },
      jobs: { some: { status: 'completed' }, none: { status: 'to_do' } },
    });
    expect(prisma.workOrder.findMany.mock.calls[4][0].orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }]);
  });

  it('flags open work with an unassigned pending Job (LTR-154 / D11)', async () => {
    const prisma = createPrisma();
    [0, 0, 0, 0, 0, 0].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    const unassigned = {
      ...baseRow, id: 'unassigned-id', displayId: 'WO-UNASSIGNED', status: 'in_progress', createdAt: new Date(),
      jobs: [{ status: 'to_do', assignedMechanicId: null }],
    };
    prisma.workOrder.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unassigned])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await createService(prisma).dashboard();
    expect(result.attention.map((item) => [item.displayId, item.attentionReason])).toEqual([
      ['WO-UNASSIGNED', 'unassigned'],
    ]);
  });

  it('ranks an active reported blocker after paused and before plain open work (LTR-121)', async () => {
    const prisma = createPrisma();
    [0, 0, 0, 0, 0, 0].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    const stale = { ...baseRow, id: 'stale-id', displayId: 'WO-OPEN', status: 'in_progress', createdAt: new Date() };
    const blocked = {
      ...baseRow, id: 'blocked-id', displayId: 'WO-BLOCKED', status: 'in_progress',
      pauseEvents: [{ id: 'b-1', workOrderId: 'blocked-id', reason: 'waiting_for_parts', notes: null, startedAt: new Date(), endedAt: new Date(), durationMs: 0n, isOfficialPause: false, resolvedAt: null, createdBy: { id: 'u', name: 'MG' }, reportedBy: { id: 'u', name: 'MG' } }],
    };
    prisma.workOrder.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([stale, blocked])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([blocked]);

    const result = await createService(prisma).dashboard();
    expect(result.attention.map((item) => [item.displayId, item.attentionReason])).toEqual([
      ['WO-BLOCKED', 'blocker'],
      ['WO-OPEN', 'open'],
    ]);
  });

  it('LTR-116: leaves a fresh PM service out of needs attention', async () => {
    const prisma = createPrisma();
    [0, 0, 0, 0, 0, 0].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    const pm = { ...baseRow, id: 'pm-id', displayId: 'WO-PM', status: 'in_progress', createdAt: new Date(), jobs: [], primaryCategory: { id: 'pm-cat', name: 'PM' } };
    const open = { ...baseRow, id: 'open-id', displayId: 'WO-OPEN', status: 'in_progress', createdAt: new Date() };
    prisma.workOrder.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pm, open])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await createService(prisma).dashboard();
    expect(result.attention.map((item) => item.displayId)).toEqual(['WO-OPEN']);
  });

  it('lists open mechanic work requests on the dashboard (LTR-126)', async () => {
    const prisma = createPrisma();
    [0, 0, 0, 0, 0, 0].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.workOrderNote.findMany.mockResolvedValue([{
      id: 'n-1', body: 'Brake lights out', createdAt: new Date('2026-09-25T12:00:00Z'),
      author: { id: 'mg', name: 'MG' },
      workOrder: { id: 'wo-1', displayId: 'WO-001', truck: { id: 't-277', truckNumber: '277' } },
    }]);

    const result = await createService(prisma).dashboard();

    expect(prisma.workOrderNote.findMany.mock.calls[0][0].where).toMatchObject({ kind: 'work_request', handledAt: null });
    expect(result.openWorkRequests).toEqual([{
      id: 'n-1', body: 'Brake lights out', author: { id: 'mg', name: 'MG' }, createdAt: '2026-09-25T12:00:00.000Z',
      workOrderId: 'wo-1', workOrderDisplayId: 'WO-001', truckNumber: '277', truckId: 't-277',
    }]);
  });

  it('ranks ready-to-close Work Orders ahead of critical ones in needs attention', async () => {
    const prisma = createPrisma();
    [0, 0, 0, 0, 0, 0].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    const ready = { ...baseRow, id: 'ready-id', displayId: 'WO-READY', status: 'in_progress', jobs: [{ status: 'completed' }] };
    const critical = { ...baseRow, id: 'crit-id', displayId: 'WO-CRIT', priority: 'critical' };
    prisma.workOrder.findMany
      .mockResolvedValueOnce([critical])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ready, critical])
      .mockResolvedValueOnce([]);
    const service = createService(prisma);

    const result = await service.dashboard();
    expect(result.attention.map((item) => item.displayId)).toEqual(['WO-READY', 'WO-CRIT']);
    expect(result.attention.map((item) => item.attentionReason)).toEqual(['ready_to_close', 'critical']);
  });

  it('returns the exact UTC cutoff used by the older-than-24-hours count', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T14:45:00.000Z'));
    const prisma = createPrisma();
    [0, 0, 0, 1, 0, 0].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    const result = await service.dashboard();

    expect(result.windows.openOlderThan24h.before).toBe('2026-09-07T14:45:00.000Z');
    expect(prisma.workOrder.count.mock.calls[3][0]).toEqual({
      where: {
        status: { in: ['created', 'in_progress', 'waiting_paused'] },
        createdAt: { lt: new Date('2026-09-07T14:45:00.000Z') },
      },
    });
  });

  it('does not add a status filter when the list query has no status', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await service.list({});

    expect(prisma.workOrder.findMany.mock.calls[0][0].where).toEqual({});
  });

  it('returns the Admin detail DTO after Manager create so the list can refresh without a full reload', async () => {
    const created = detailRow();
    const prisma = createPrisma();
    prisma.workOrder.findUnique.mockResolvedValue(created);
    const workOrders = { createByManager: vi.fn().mockResolvedValue({ id: created.id }) };
    const service = new AdminService(prisma as never, { log: vi.fn() } as never, workOrders as never);

    await expect(service.createWorkOrder({
      id: created.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager',
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE],
      supabaseAuthId: null,
    }, { truckId: created.truckId })).resolves.toMatchObject({
      id: created.id,
      displayId: created.displayId,
      notes: null,
      activityLog: [],
    });
    expect(workOrders.createByManager).toHaveBeenCalled();
    expect(prisma.workOrder.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: created.id } }));
  });

  it('exposes mechanic finish notes on Admin Job rows and Activity Log', async () => {
    const jobId = '00000000-0000-4000-8000-000000000501';
    const created = detailRow({
      jobs: [{
        ...detailRow().jobs[0],
        status: 'completed',
        completedAt: new Date('2026-09-19T22:41:00.000Z'),
        completedBy: { id: 'mech-1', name: 'Alejandro' },
      }],
      activityLogs: [{
        id: 'log-1',
        eventType: ActivityEventType.JOB_COMPLETED,
        entityType: 'work_order_job',
        entityId: jobId,
        user: { id: 'mech-1', name: 'Alejandro' },
        previousValue: null,
        newValue: { displayName: 'Inspect', status: 'completed', notes: 'Replaced the air hose' },
        relevantValue: null,
        createdAt: new Date('2026-09-19T22:41:00.000Z'),
      }],
    });
    const prisma = createPrisma();
    prisma.workOrder.findUnique.mockResolvedValue(created);
    const service = createService(prisma);

    await expect(service.detail(created.id)).resolves.toMatchObject({
      jobs: [expect.objectContaining({
        status: 'completed',
        completedBy: { id: 'mech-1', name: 'Alejandro' },
        completionNotes: 'Replaced the air hose',
      })],
      activityLog: [expect.objectContaining({
        eventType: ActivityEventType.JOB_COMPLETED,
        newValue: expect.objectContaining({ notes: 'Replaced the air hose' }),
      })],
    });
  });

  it('Stage 8: a cancelled Job carries its reason; other Jobs do not', async () => {
    const created = detailRow({
      jobs: [
        { ...detailRow().jobs[0], status: 'cancelled', cancelledReason: 'Not needed' },
        { ...detailRow().jobs[0], id: '00000000-0000-4000-8000-0000000000aa', status: 'to_do', cancelledReason: 'stale' },
      ],
    });
    const prisma = createPrisma();
    prisma.workOrder.findUnique.mockResolvedValue(created);
    const detail = await createService(prisma).detail(created.id);
    expect(detail.jobs.map((job) => job.cancelledReason)).toEqual(['Not needed', null]);
  });

  it('uses a stable sort-value plus UUID cursor without repeating the boundary row', async () => {
    const prisma = createPrisma();
    const nextRow = {
      ...baseRow,
      id: '00000000-0000-4000-8000-000000000012',
      displayId: 'WO-0012',
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };
    prisma.workOrder.findMany.mockResolvedValueOnce([baseRow, nextRow]).mockResolvedValueOnce([nextRow]);
    const service = createService(prisma);

    const first = await service.list({ limit: 1 });
    expect(first.items.map((item) => item.id)).toEqual([baseRow.id]);
    expect(first.nextCursor).toBeTypeOf('string');

    const second = await service.list({ limit: 1, cursor: first.nextCursor });
    expect(second.items.map((item) => item.id)).toEqual([nextRow.id]);
    const secondWhere = prisma.workOrder.findMany.mock.calls[1][0].where;
    expect(JSON.stringify(secondWhere)).toContain(baseRow.id);
    expect(JSON.stringify(secondWhere)).toContain('lt');
  });

  it('rejects malformed or incompatible cursors', async () => {
    const service = createService(createPrisma());
    await expect(service.list({ cursor: 'not-valid' })).rejects.toBeInstanceOf(BadRequestException);
    const mismatched = Buffer.from(JSON.stringify({
      sort: 'createdAt', direction: 'desc', value: '2026-09-01T00:00:00.000Z',
      id: baseRow.id,
    })).toString('base64url');
    await expect(service.list({ cursor: mismatched })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies status, priority, and cross-field search filters', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);
    await service.list({ status: 'completed', priority: 'critical', search: 'T-21' });
    const where = JSON.stringify(prisma.workOrder.findMany.mock.calls[0][0].where);
    expect(where).toContain('completed');
    expect(where).toContain('critical');
    expect(where).toContain('displayId');
    expect(where).toContain('truckNumber');
    expect(where).toContain('primaryCategory');
    expect(where).toContain('mechanics');
  });

  it('applies absolute created and completed date boundaries', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await service.list({
      createdBefore: '2026-09-08T12:00:00.000Z',
      completedFrom: '2026-09-01T00:00:00-04:00',
      completedBefore: '2026-09-09T00:00:00-04:00',
    });

    const where = prisma.workOrder.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      { createdAt: { lt: new Date('2026-09-08T12:00:00.000Z') } },
      { completedAt: { gte: new Date('2026-09-01T04:00:00.000Z') } },
      { completedAt: { lt: new Date('2026-09-09T04:00:00.000Z') } },
    ]));
  });

  it('returns 404 for a missing detail', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findUnique.mockResolvedValue(null);
    const service = createService(prisma);
    await expect(service.detail(baseRow.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists mechanics with open assignments and rejects a missing mechanic', async () => {
    const prisma = createPrisma();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);
    const service = createService(prisma);
    await expect(service.listMechanics({})).resolves.toEqual({ items: [], nextCursor: null });
    await expect(service.mechanicDetail(baseRow.createdById)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('opens the detail of a Safety person listed on the roster (G9)', async () => {
    const prisma = createPrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = createService(prisma);
    await expect(service.mechanicDetail(baseRow.createdById)).rejects.toBeInstanceOf(NotFoundException);
    const where = prisma.user.findFirst.mock.calls[0][0].where;
    const allowed: string[] = where.capabilities.some.capability.in.map(String);
    expect(allowed).toHaveLength(3);
    expect(allowed.some((capability) => /quality/i.test(capability))).toBe(true);
  });

  it('excludes System Admin accounts only when listing assignable mechanics (LTR-151)', async () => {
    const prisma = createPrisma();
    prisma.user.findMany.mockResolvedValue([]);
    const service = createService(prisma);
    await service.listMechanics({ assignable: 'true' });
    await service.listMechanics({});
    const assignableWhere = JSON.stringify(prisma.user.findMany.mock.calls[0][0].where);
    const rosterWhere = JSON.stringify(prisma.user.findMany.mock.calls[1][0].where);
    expect(assignableWhere).toContain('{"role":{"not":"admin"}}');
    expect(rosterWhere).not.toContain('"role"');
  });

  it('hides deactivated mechanics unless includeInactive is requested (LTR-160)', async () => {
    const prisma = createPrisma();
    prisma.user.findMany.mockResolvedValue([]);
    const service = createService(prisma);
    await service.listMechanics({});
    await service.listMechanics({ includeInactive: 'true' });
    expect(JSON.stringify(prisma.user.findMany.mock.calls[0][0].where)).toContain('{"active":true}');
    expect(JSON.stringify(prisma.user.findMany.mock.calls[1][0].where)).not.toContain('"active"');
  });

  it('maps Prisma capability keys onto shared capability values', async () => {
    const prisma = createPrisma();
    prisma.user.findMany.mockResolvedValue([{
      id: '00000000-0000-4000-8000-000000000201',
      name: 'Cristian',
      email: 'cristian@ltransl.com',
      role: 'mechanic',
      active: true,
      capabilities: [{ capability: 'MECHANIC_PM' }, { capability: 'MECHANIC_STANDARD' }],
      assignedJobs: [],
    }]);
    const service = createService(prisma);
    await expect(service.listMechanics({})).resolves.toEqual({
      items: [expect.objectContaining({
        capabilities: [AppCapability.MECHANIC_PM, AppCapability.MECHANIC_STANDARD],
      })],
      nextCursor: null,
    });
  });

  it('defaults History to completed and cancelled Work Orders', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = createService(prisma);
    await service.listHistory({});
    const where = JSON.stringify(prisma.workOrder.findMany.mock.calls[0][0].where);
    expect(where).toContain('completed');
    expect(where).toContain('cancelled');
  });

  it('rejects History filters for open Work Orders', async () => {
    const service = createService(createPrisma());
    await expect(service.listHistory({ status: 'in_progress' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists trucks without inventing Off Duty state', async () => {
    const prisma = createPrisma();
    prisma.truck.findMany.mockResolvedValue([]);
    const service = createService(prisma);
    await expect(service.listTrucks({})).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('lists catalog categories with job and alias counts, including inactive jobs', async () => {
    const prisma = createPrisma();
    prisma.jobCategory.findMany.mockResolvedValue([{
      id: '00000000-0000-4000-8000-000000000301',
      name: 'Brakes',
      status: 'active',
      sortOrder: 1,
      catalogJobs: [
        { status: 'active', _count: { aliases: 2 } },
        { status: 'inactive', _count: { aliases: 1 } },
      ],
    }]);
    const service = createService(prisma);
    await expect(service.listCatalogCategories()).resolves.toEqual([{
      id: '00000000-0000-4000-8000-000000000301',
      name: 'Brakes',
      status: 'active',
      sortOrder: 1,
      activeJobCount: 1,
      inactiveJobCount: 1,
      aliasCount: 3,
      systemKey: null,
      inactiveReason: null,
      holdsSystemJob: false,
    }]);
  });

  it('returns catalog category jobs and aliases without inventing write actions', async () => {
    const prisma = createPrisma();
    prisma.jobCategory.findUnique.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000301',
      name: 'Brakes',
      status: 'active',
      sortOrder: 1,
      catalogJobs: [{
        id: '00000000-0000-4000-8000-000000000801',
        displayName: 'Inspect brake chamber',
        status: 'active',
        systemKey: null,
        aliases: [{ id: '00000000-0000-4000-8000-000000000901', aliasText: 'Brake chamber' }],
        workflowSteps: [],
        _count: { workOrderJobs: 3 },
      }],
    });
    const service = createService(prisma);
    await expect(service.catalogCategoryDetail('00000000-0000-4000-8000-000000000301')).resolves.toMatchObject({
      name: 'Brakes',
      activeJobCount: 1,
      jobs: [{ displayName: 'Inspect brake chamber', aliases: ['Brake chamber'] }],
    });
    await expect(service.catalogCategoryDetail('not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);
    prisma.jobCategory.findUnique.mockResolvedValue(null);
    await expect(service.catalogCategoryDetail('00000000-0000-4000-8000-000000000399')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancels open Standard and PM Work Orders, closes labor, and refuses closed ones', async () => {
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const body = {
      reason: 'Duplicate Work Order',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000801',
    };
    const wo = detailRow({ status: 'in_progress' });
    const session = { id: 'sess-1', startedAt: new Date('2026-09-06T16:00:00.000Z'), endedAt: null };
    const pause = { id: 'pause-1', startedAt: new Date('2026-09-06T17:00:00.000Z'), endedAt: null };
    const activity = { log: vi.fn() };
    const tx = cancelTx(wo, {
      workSession: {
        findFirst: vi.fn().mockResolvedValue(session),
        findMany: vi.fn().mockResolvedValue([{ ...session, endedAt: new Date() }]),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      pauseEvent: {
        findFirst: vi.fn().mockResolvedValue(pause),
        findMany: vi.fn().mockResolvedValue([{ ...pause, endedAt: new Date() }]),
        update: vi.fn(),
      },
    });
    tx.workOrder.findUnique
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(detailRow({ status: 'cancelled', version: 2 }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await expect(service.cancelWorkOrder(manager, wo.id, body)).resolves.toMatchObject({ status: 'cancelled', version: 2 });
    expect(tx.workSession.updateMany).toHaveBeenCalledWith({
      where: { workOrderId: wo.id, endedAt: null },
      data: { endedAt: expect.any(Date) },
    });
    expect(tx.pauseEvent.update).toHaveBeenCalled();
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled' }),
    }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.MANAGER_CORRECTION }));

    const pmRow = detailRow({ primaryCategory: { ...baseRow.primaryCategory, name: 'PM' } });
    const pm = cancelTx(pmRow);
    pm.workOrder.findUnique
      .mockResolvedValueOnce(pmRow)
      .mockResolvedValueOnce(pmRow)
      .mockResolvedValueOnce(detailRow({ status: 'cancelled', version: 2, primaryCategory: pmRow.primaryCategory }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof pm) => unknown) => callback(pm));
    await expect(service.cancelWorkOrder(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000802' }))
      .resolves.toMatchObject({ status: 'cancelled' });

    const closed = cancelTx(detailRow({ status: 'completed' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof closed) => unknown) => callback(closed));
    await expect(service.cancelWorkOrder(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000803' }))
      .rejects.toBeInstanceOf(BadRequestException);

    await expect(service.cancelWorkOrder(manager, wo.id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000804',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replays an idempotent cancel and rejects a stale Work Order version', async () => {
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const stored = { id: baseRow.id, status: 'cancelled', version: 3 };
    const prisma = createPrisma();
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: baseRow.id,
      operation: 'admin_cancel_work_order',
      payloadHash: idempotencyFingerprint({
        workOrderId: baseRow.id,
        reason: 'Duplicate Work Order',
        expectedVersion: 1,
      }),
      actorId: manager.id,
      result: stored,
    });
    const service = createService(prisma);
    await expect(service.cancelWorkOrder(manager, baseRow.id, {
      reason: 'Duplicate Work Order',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000805',
    })).resolves.toEqual(stored);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    prisma.workOrderMutation.findUnique.mockResolvedValue(null);
    const stale = cancelTx(detailRow({ version: 4 }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof stale) => unknown) => callback(stale));
    await expect(service.cancelWorkOrder(manager, baseRow.id, {
      reason: 'Duplicate Work Order',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000806',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('completes an in-progress Standard Work Order and refuses incomplete or paused ones', async () => {
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const body = {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000901',
    };
    const jobs = [{
      id: '00000000-0000-4000-8000-000000000501',
      displayName: 'Inspect',
      customDescription: null,
      status: 'completed',
      categoryId: baseRow.primaryCategoryId,
      category: { name: 'Engine' },
    }];
    const wo = detailRow({ status: 'in_progress', jobs });
    const activity = { log: vi.fn() };
    const tx = assignmentTx(wo);
    tx.workOrder.findUnique
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(detailRow({ status: 'completed', version: 2, jobs }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await expect(service.completeWorkOrder(manager, wo.id, body)).resolves.toMatchObject({ status: 'completed', version: 2 });
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed' }),
    }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.WORK_ORDER_COMPLETED }));

    const incomplete = assignmentTx(detailRow({ status: 'in_progress' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof incomplete) => unknown) => callback(incomplete));
    await expect(service.completeWorkOrder(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000902' }))
      .rejects.toBeInstanceOf(BadRequestException);

    const paused = assignmentTx(detailRow({ status: 'waiting_paused', jobs }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof paused) => unknown) => callback(paused));
    await expect(service.completeWorkOrder(manager, wo.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000000903' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes a PM Work Order with mileage and parts, and replays an idempotent complete', async () => {
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const pmRow = detailRow({
      status: 'in_progress',
      primaryCategory: { ...baseRow.primaryCategory, name: 'PM' },
      jobs: [],
    });
    const activity = { log: vi.fn() };
    const ready = assignmentTx(pmRow, {
      pmService: {
        findUnique: vi.fn().mockResolvedValue({ observedMileage: 125000, parts: [{ id: 'part-1' }] }),
      },
    });
    ready.workOrder.findUnique
      .mockResolvedValueOnce(pmRow)
      .mockResolvedValueOnce(pmRow)
      .mockResolvedValueOnce(detailRow({
        status: 'completed',
        version: 2,
        primaryCategory: pmRow.primaryCategory,
        jobs: [],
      }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof ready) => unknown) => callback(ready));
    const service = new AdminService(prisma as never, activity as never, {} as never);
    await expect(service.completeWorkOrder(manager, pmRow.id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000904',
    })).resolves.toMatchObject({ status: 'completed' });
    expect(ready.truck.update).toHaveBeenCalled();
    expect(ready.truckMileageAdjustment.create).toHaveBeenCalled();

    const missing = assignmentTx(pmRow);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof missing) => unknown) => callback(missing));
    await expect(service.completeWorkOrder(manager, pmRow.id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000905',
    })).rejects.toBeInstanceOf(BadRequestException);

    const stored = { id: baseRow.id, status: 'completed', version: 3 };
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: baseRow.id,
      operation: 'admin_complete_work_order',
      payloadHash: idempotencyFingerprint({
        workOrderId: baseRow.id,
        expectedVersion: 1,
      }),
      actorId: manager.id,
      result: stored,
    });
    const replaying = createService(prisma);
    await expect(replaying.completeWorkOrder(manager, baseRow.id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000906',
    })).resolves.toEqual(stored);
  });

  it('reopens completed and cancelled Work Orders and refuses an open Truck conflict', async () => {
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const body = {
      reason: 'More work found',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001001',
    };
    const completed = detailRow({
      status: 'completed',
      startedAt: new Date('2026-09-06T16:00:00.000Z'),
      completedAt: new Date('2026-09-06T18:00:00.000Z'),
    });
    const activity = { log: vi.fn() };
    const tx = assignmentTx(completed);
    tx.workOrder.findUnique
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(detailRow({ status: 'in_progress', version: 2, startedAt: completed.startedAt, completedAt: null }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await expect(service.reopenWorkOrder(manager, completed.id, body)).resolves.toMatchObject({ status: 'in_progress', version: 2 });
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'in_progress', completedAt: null, completedById: null }),
    }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.MANAGER_CORRECTION }));
    expect(tx.truckReadinessAssessment.findFirst).toHaveBeenCalled();
    expect(tx.truckReadinessAssessment.update).not.toHaveBeenCalled();

    const readyTx = assignmentTx(completed);
    readyTx.workOrder.findUnique
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(detailRow({ status: 'in_progress', version: 2, startedAt: completed.startedAt, completedAt: null }));
    readyTx.truckReadinessAssessment.findFirst.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000501',
      status: 'ready',
      version: 3,
      approvedById: manager.id,
    });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof readyTx) => unknown) => callback(readyTx));
    await expect(service.reopenWorkOrder(manager, completed.id, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001006',
    })).resolves.toMatchObject({ status: 'in_progress' });
    expect(readyTx.truckReadinessAssessment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'under_review', readyAt: null, approvedById: null }),
    }));
    expect(activity.log).toHaveBeenCalledWith(readyTx, expect.objectContaining({
      eventType: ActivityEventType.READINESS_APPROVAL_INVALIDATED,
    }));

    const cancelled = detailRow({ status: 'cancelled', startedAt: null, completedAt: new Date() });
    const createdTx = assignmentTx(cancelled);
    createdTx.workOrder.findUnique
      .mockResolvedValueOnce(cancelled)
      .mockResolvedValueOnce(cancelled)
      .mockResolvedValueOnce(detailRow({ status: 'created', version: 2, startedAt: null, completedAt: null }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof createdTx) => unknown) => callback(createdTx));
    await expect(service.reopenWorkOrder(manager, cancelled.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000001002' }))
      .resolves.toMatchObject({ status: 'created' });

    const open = assignmentTx(detailRow({ status: 'in_progress' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof open) => unknown) => callback(open));
    await expect(service.reopenWorkOrder(manager, completed.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000001003' }))
      .rejects.toBeInstanceOf(BadRequestException);

    const conflict = assignmentTx(completed);
    conflict.workOrder.findFirst.mockResolvedValue({ id: 'other-open' });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof conflict) => unknown) => callback(conflict));
    await expect(service.reopenWorkOrder(manager, completed.id, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000001004' }))
      .rejects.toBeInstanceOf(BadRequestException);

    const stored = { id: baseRow.id, status: 'in_progress', version: 3 };
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: baseRow.id,
      operation: 'admin_reopen_work_order',
      payloadHash: idempotencyFingerprint({
        workOrderId: baseRow.id,
        reason: 'More work found',
        expectedVersion: 1,
      }),
      actorId: manager.id,
      result: stored,
    });
    const replaying = createService(prisma);
    await expect(replaying.reopenWorkOrder(manager, baseRow.id, {
      reason: 'More work found',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001005',
    })).resolves.toEqual(stored);
  });

  it('LTR-145: switches the PM job between PM A and PM B, and refuses completing it as a plain Job', async () => {
    const manager = {
      id: '00000000-0000-4000-8000-000000000002', email: 'manager@lightning.local', name: 'Shop Manager',
      role: 'manager' as const, active: true,
      capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
    };
    const pmJobId = '00000000-0000-4000-8000-000000000777';
    const pmJob = {
      ...detailRow().jobs[0], id: pmJobId, catalogJobId: '00000000-0000-4000-8000-000000000a01',
      displayName: 'PM A Service', categoryId: 'pm-cat', category: { name: 'PM' },
    };
    const open = detailRow({ status: 'in_progress', version: 1, jobs: [pmJob] });
    const activity = { log: vi.fn() };
    const tx = assignmentTx(open, {
      catalogJob: { findFirst: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000a02', displayName: 'PM B Service' }) },
    });
    tx.workOrder.findUnique.mockResolvedValue(open);
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await service.changePmService(manager, open.id, pmJobId, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001201',
      catalogJobId: '00000000-0000-4000-8000-000000000a02',
    });
    expect((tx as unknown as { catalogJob: { findFirst: ReturnType<typeof vi.fn> } }).catalogJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ categoryId: 'pm-cat', status: 'active' }),
    }));
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: pmJobId },
      data: { catalogJobId: '00000000-0000-4000-8000-000000000a02', displayName: 'PM B Service' },
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.MANAGER_CORRECTION,
      newValue: expect.objectContaining({ action: 'pm_service_changed', displayName: 'PM B Service' }),
    }));

    prisma.workOrderJob.findUnique.mockResolvedValue({ id: pmJobId, workOrderId: open.id });
    await expect(service.completeJob(manager, pmJobId, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001202',
    })).rejects.toMatchObject({ response: { code: 'PM_JOB_USES_PM_SERVICE' } });
  });

  it('LTR-146: assigns the PM job to a PM mechanic without adding them to the Standard team', async () => {
    const manager = {
      id: '00000000-0000-4000-8000-000000000002', email: 'manager@lightning.local', name: 'Shop Manager',
      role: 'manager' as const, active: true,
      capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
    };
    const pmJobId = '00000000-0000-4000-8000-000000000778';
    const open = detailRow({
      status: 'in_progress', version: 1,
      jobs: [{ ...detailRow().jobs[0], id: pmJobId, displayName: 'PM A Service', category: { name: 'PM' }, startedAt: null }],
    });
    const tx = assignmentTx(open);
    tx.workOrder.findUnique.mockResolvedValue(open);
    tx.user.findFirst.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000009', name: 'MPM' });
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, { log: vi.fn() } as never, {} as never);

    await service.assignJob(manager, open.id, pmJobId, {
      mechanicId: '00000000-0000-4000-8000-000000000009',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001301',
    });
    expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ capabilities: { some: { capability: 'MECHANIC_PM' } } }),
    }));
    expect(tx.mechanicAssignment.create).not.toHaveBeenCalled();
    expect(tx.workOrderJob.update).toHaveBeenCalledWith({
      where: { id: pmJobId },
      data: { assignedMechanicId: '00000000-0000-4000-8000-000000000009' },
    });
  });

  it('patches allowed Admin fields on open Work Orders', async () => {
    const manager = {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const body = {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001101',
      priority: 'high' as const,
      notes: 'Check the leak again',
    };
    const open = detailRow({ status: 'in_progress', priority: 'normal', notes: null });
    const activity = { log: vi.fn() };
    const tx = assignmentTx(open);
    tx.workOrder.findUnique
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(detailRow({ status: 'in_progress', version: 2, priority: 'high', notes: 'Check the leak again' }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await expect(service.patchWorkOrder(manager, open.id, body)).resolves.toMatchObject({
      priority: 'high',
      notes: 'Check the leak again',
      version: 2,
    });
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ priority: 'high' }),
    }));
    // LTR-126: notes are append-only, so the shared notes column is not overwritten.
    expect(tx.workOrder.updateMany.mock.calls[0][0].data).not.toHaveProperty('notes');
    expect(tx.workOrderNote.create).toHaveBeenCalledWith({
      data: { workOrderId: open.id, kind: 'note', body: 'Check the leak again', authorId: manager.id },
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.PRIORITY_CHANGED }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.NOTE_ADDED }));

    const pm = detailRow({
      status: 'created',
      priority: 'normal',
      notes: null,
      primaryCategory: { ...baseRow.primaryCategory, name: 'PM' },
    });
    const pmTx = assignmentTx(pm);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof pmTx) => unknown) => callback(pmTx));
    await expect(service.patchWorkOrder(manager, pm.id, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001102',
    })).rejects.toBeInstanceOf(BadRequestException);

    pmTx.workOrder.findUnique
      .mockResolvedValueOnce(pm)
      .mockResolvedValueOnce(pm)
      .mockResolvedValueOnce(detailRow({
        status: 'created',
        version: 2,
        priority: 'normal',
        notes: 'PM note',
        primaryCategory: { ...baseRow.primaryCategory, name: 'PM' },
      }));
    await expect(service.patchWorkOrder(manager, pm.id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001103',
      notes: 'PM note',
    })).resolves.toMatchObject({ notes: 'PM note' });

    const closed = assignmentTx(detailRow({ status: 'completed' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof closed) => unknown) => callback(closed));
    await expect(service.patchWorkOrder(manager, open.id, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001104',
    })).rejects.toBeInstanceOf(BadRequestException);

    const unchanged = assignmentTx(detailRow({ status: 'created', priority: 'normal', notes: 'Same' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof unchanged) => unknown) => callback(unchanged));
    await expect(service.patchWorkOrder(manager, open.id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001105',
      priority: 'normal',
      notes: 'Same',
    })).rejects.toBeInstanceOf(BadRequestException);

    const conflict = assignmentTx(detailRow({ status: 'created', version: 3 }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof conflict) => unknown) => callback(conflict));
    await expect(service.patchWorkOrder(manager, open.id, body)).rejects.toBeInstanceOf(ConflictException);

    const stored = { id: baseRow.id, priority: 'high', notes: 'Check the leak again', version: 2 };
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: baseRow.id,
      operation: 'admin_patch_work_order',
      payloadHash: idempotencyFingerprint({
        workOrderId: baseRow.id,
        expectedVersion: 1,
        priority: 'high',
        notes: 'Check the leak again',
        notesProvided: true,
      }),
      actorId: manager.id,
      result: stored,
    });
    const replaying = createService(prisma);
    await expect(replaying.patchWorkOrder(manager, baseRow.id, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001106',
    })).resolves.toEqual(stored);
  });

  it('corrects closed labor sessions and recalculates totals', async () => {
    const manager = {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const session = {
      id: '00000000-0000-4000-8000-000000000701',
      workOrderId: baseRow.id,
      startedAt: new Date('2026-09-06T16:00:00.000Z'),
      endedAt: new Date('2026-09-06T18:00:00.000Z'),
    };
    const body = {
      workOrderId: baseRow.id,
      targetType: 'work_session' as const,
      targetId: session.id,
      endedAt: '2026-09-06T17:30:00.000Z',
      reason: 'Clock was wrong',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001301',
    };
    const open = detailRow({ status: 'in_progress' });
    const activity = { log: vi.fn() };
    const tx = assignmentTx(open);
    tx.workSession.findUnique.mockResolvedValue(session);
    tx.workSession.findMany.mockResolvedValue([{ ...session, endedAt: new Date('2026-09-06T17:30:00.000Z') }]);
    tx.workOrder.findUnique
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(detailRow({ status: 'in_progress', version: 2, totalActiveLaborMs: 5_400_000n }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await expect(service.correctTime(manager, body)).resolves.toMatchObject({ version: 2 });
    expect(tx.workSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ endedAt: new Date('2026-09-06T17:30:00.000Z') }),
    }));
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalActiveLaborMs: expect.any(BigInt) }),
    }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.MANAGER_CORRECTION,
      relevantValue: expect.objectContaining({ action: 'time_corrected' }),
    }));

    tx.workSession.findUnique.mockResolvedValue({ ...session, endedAt: null });
    await expect(service.correctTime(manager, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000001302' }))
      .rejects.toBeInstanceOf(BadRequestException);

    tx.workSession.findUnique.mockResolvedValue(session);
    await expect(service.correctTime(manager, {
      ...body,
      endedAt: '2026-09-06T15:00:00.000Z',
      idempotencyKey: '00000000-0000-4000-8000-000000001303',
    })).rejects.toBeInstanceOf(BadRequestException);

    tx.pauseEvent.findUnique.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000901',
      workOrderId: baseRow.id,
      startedAt: new Date('2026-09-11T15:00:00.000Z'),
      endedAt: new Date('2026-09-11T15:00:00.000Z'),
      isOfficialPause: false,
    });
    await expect(service.correctTime(manager, {
      ...body,
      targetType: 'pause_event',
      targetId: '00000000-0000-4000-8000-000000000901',
      idempotencyKey: '00000000-0000-4000-8000-000000001305',
    })).rejects.toThrow('Cannot correct a reported blocker');

    const stored = { id: baseRow.id, version: 3 };
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: baseRow.id,
      operation: 'admin_time_correction',
      payloadHash: idempotencyFingerprint({
        workOrderId: baseRow.id,
        targetType: 'work_session',
        targetId: session.id,
        startedAt: null,
        endedAt: '2026-09-06T17:30:00.000Z',
        reason: 'Clock was wrong',
        expectedVersion: 1,
      }),
      actorId: manager.id,
      result: stored,
    });
    const replaying = createService(prisma);
    await expect(replaying.correctTime(manager, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001304',
    })).resolves.toEqual(stored);
  });

  it('cancels and reopens Jobs on open Standard Work Orders', async () => {
    const manager = {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const jobId = '00000000-0000-4000-8000-000000000501';
    const body = {
      reason: 'Not needed',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001201',
    };
    const open = detailRow({ status: 'in_progress' });
    const activity = { log: vi.fn() };
    const tx = assignmentTx(open);
    tx.workOrder.findUnique
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(detailRow({
        status: 'in_progress',
        version: 2,
        jobs: [{ ...open.jobs[0], status: 'cancelled' }],
      }));
    const prisma = createPrisma();
    prisma.workOrderJob.findUnique.mockResolvedValue({ ...open.jobs[0], workOrderId: open.id });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await expect(service.cancelJob(manager, jobId, body)).resolves.toMatchObject({ version: 2 });
    expect(tx.workOrderJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'cancelled', cancelledReason: 'Not needed' }),
    }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: ActivityEventType.JOB_CANCELLED }));

    const completedJob = detailRow({
      status: 'in_progress',
      jobs: [{ ...open.jobs[0], status: 'completed' }],
    });
    const completedTx = assignmentTx(completedJob);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof completedTx) => unknown) => callback(completedTx));
    await expect(service.cancelJob(manager, jobId, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000001202' }))
      .rejects.toBeInstanceOf(BadRequestException);

    const pm = detailRow({ primaryCategory: { ...baseRow.primaryCategory, name: 'PM' } });
    const pmTx = assignmentTx(pm);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof pmTx) => unknown) => callback(pmTx));
    await expect(service.cancelJob(manager, jobId, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000001203' }))
      .rejects.toBeInstanceOf(BadRequestException);

    const closed = assignmentTx(detailRow({ status: 'completed' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof closed) => unknown) => callback(closed));
    await expect(service.cancelJob(manager, jobId, { ...body, idempotencyKey: '00000000-0000-4000-8000-000000001204' }))
      .rejects.toBeInstanceOf(BadRequestException);

    const completeOpen = detailRow({ status: 'created' });
    const completeTx = assignmentTx(completeOpen);
    completeTx.workOrder.findUnique
      .mockResolvedValueOnce(completeOpen)
      .mockResolvedValueOnce(completeOpen)
      .mockResolvedValueOnce(detailRow({
        status: 'created',
        version: 2,
        jobs: [{ ...completeOpen.jobs[0], status: 'completed' }],
      }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof completeTx) => unknown) => callback(completeTx));
    await expect(service.completeJob(manager, jobId, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001210',
    })).resolves.toMatchObject({ version: 2 });
    expect(completeTx.workOrderJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed', completedById: manager.id }),
    }));
    expect(activity.log).toHaveBeenCalledWith(completeTx, expect.objectContaining({ eventType: ActivityEventType.JOB_COMPLETED }));

    const alreadyCompleted = detailRow({
      status: 'in_progress',
      jobs: [{ ...open.jobs[0], status: 'completed' }],
    });
    const alreadyCompletedTx = assignmentTx(alreadyCompleted);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof alreadyCompletedTx) => unknown) => callback(alreadyCompletedTx));
    await expect(service.completeJob(manager, jobId, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001211',
    })).rejects.toBeInstanceOf(BadRequestException);

    const cancelled = detailRow({
      status: 'in_progress',
      jobs: [{ ...open.jobs[0], status: 'cancelled' }],
    });
    const reopenTx = assignmentTx(cancelled);
    reopenTx.workOrder.findUnique
      .mockResolvedValueOnce(cancelled)
      .mockResolvedValueOnce(cancelled)
      .mockResolvedValueOnce(detailRow({ status: 'in_progress', version: 2, jobs: [{ ...open.jobs[0], status: 'to_do' }] }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof reopenTx) => unknown) => callback(reopenTx));
    await expect(service.reopenJob(manager, jobId, {
      reason: 'Job is still required',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001205',
    })).resolves.toMatchObject({ version: 2 });
    expect(reopenTx.workOrderJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'to_do', cancelledAt: null, cancelledReason: null }),
    }));
    expect(activity.log).toHaveBeenCalledWith(reopenTx, expect.objectContaining({ eventType: ActivityEventType.MANAGER_CORRECTION }));

    const openTx = assignmentTx(open);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof openTx) => unknown) => callback(openTx));
    await expect(service.reopenJob(manager, jobId, {
      reason: 'Job is still required',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001206',
    })).rejects.toBeInstanceOf(BadRequestException);

    const stored = { id: baseRow.id, version: 3 };
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: baseRow.id,
      operation: 'admin_cancel_job',
      payloadHash: idempotencyFingerprint({
        jobId,
        workOrderId: baseRow.id,
        reason: 'Not needed',
        expectedVersion: 1,
      }),
      actorId: manager.id,
      result: stored,
    });
    const replaying = createService(prisma);
    await expect(replaying.cancelJob(manager, jobId, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001207',
    })).resolves.toEqual(stored);
  });

  it('returns a completed Work Order Truck to service without changing Work Order status', async () => {
    const manager = {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS],
      supabaseAuthId: null,
    };
    const body = {
      reason: 'Repairs verified',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001401',
    };
    const completed = detailRow({ status: 'completed', startedAt: new Date('2026-09-06T16:00:00.000Z') });
    const activity = { log: vi.fn() };
    const tx = assignmentTx(completed);
    tx.workOrder.findUnique
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(detailRow({
        status: 'completed',
        version: 2,
        startedAt: completed.startedAt,
        serviceStatusEvents: [{ occurredAt: new Date('2026-09-10T18:00:00.000Z') }],
      }));
    // LTR-164 (#13): the truck's readiness assessment ends with Return to Service.
    tx.truckReadinessAssessment.findMany.mockResolvedValue([{ id: 'assessment-1', status: 'under_review', version: 4 }]);
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await expect(service.returnToService(manager, completed.id, body)).resolves.toMatchObject({
      status: 'completed',
      version: 2,
      returnedToServiceAt: '2026-09-10T18:00:00.000Z',
    });
    expect(tx.truckServiceStatusEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'in_service', reason: 'Repairs verified', workOrderId: completed.id }),
    }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.TRUCK_RETURNED_TO_SERVICE,
    }));
    expect(tx.truckReadinessAssessment.update).toHaveBeenCalledWith({
      where: { id: 'assessment-1' },
      data: expect.objectContaining({ status: 'closed', closedById: manager.id, closedReason: 'Returned to Service' }),
    });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.READINESS_ASSESSMENT_CLOSED,
      entityId: 'assessment-1',
    }));

    // LTR-158: the reason is optional.
    const noReasonTx = assignmentTx(completed);
    noReasonTx.workOrder.findUnique
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(detailRow({ status: 'completed', version: 2, startedAt: completed.startedAt }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof noReasonTx) => unknown) => callback(noReasonTx));
    await expect(service.returnToService(manager, completed.id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000001409',
    })).resolves.toMatchObject({ status: 'completed' });
    expect(noReasonTx.truckServiceStatusEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'in_service', reason: '' }),
    }));

    const open = assignmentTx(detailRow({ status: 'in_progress' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof open) => unknown) => callback(open));
    await expect(service.returnToService(manager, completed.id, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001402',
    })).rejects.toBeInstanceOf(BadRequestException);

    const cancelled = assignmentTx(detailRow({ status: 'cancelled' }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof cancelled) => unknown) => callback(cancelled));
    await expect(service.returnToService(manager, completed.id, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001403',
    })).rejects.toBeInstanceOf(BadRequestException);

    const duplicateTx = assignmentTx(completed);
    duplicateTx.truckServiceStatusEvent.findFirst.mockResolvedValue({ id: 'evt' });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof duplicateTx) => unknown) => callback(duplicateTx));
    await expect(service.returnToService(manager, completed.id, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001404',
    })).rejects.toBeInstanceOf(BadRequestException);

    const stored = { id: completed.id, version: 3 };
    prisma.workOrderMutation.findUnique.mockResolvedValueOnce({
      workOrderId: completed.id,
      operation: 'admin_return_to_service',
      payloadHash: idempotencyFingerprint({
        workOrderId: completed.id,
        reason: 'Repairs verified',
        expectedVersion: 1,
      }),
      actorId: manager.id,
      result: stored,
    });
    const replaying = createService(prisma);
    await expect(replaying.returnToService(manager, completed.id, {
      ...body,
      idempotencyKey: '00000000-0000-4000-8000-000000001405',
    })).resolves.toEqual(stored);
  });

  it('assigns and unassigns a Job with version and idempotency guards', async () => {
    const jobId = '00000000-0000-4000-8000-000000000501';
    const mechanicId = '00000000-0000-4000-8000-000000000001';
    const manager = {
      id: baseRow.createdById,
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager' as const,
      active: true,
      capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE],
      supabaseAuthId: null,
    };
    const wo = detailRow();
    const activity = { log: vi.fn() };
    const tx = assignmentTx(wo, {
      user: { findFirst: vi.fn().mockResolvedValue({ id: mechanicId, name: 'Alejandro 1' }) },
    });
    tx.workOrder.findUnique
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(wo)
      .mockResolvedValueOnce(detailRow({
        version: 2,
        jobs: [{ ...wo.jobs[0], assignedMechanicId: mechanicId, assignedMechanic: { id: mechanicId, name: 'Alejandro 1' } }],
      }));
    const prisma = createPrisma();
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService(prisma as never, activity as never, {} as never);

    await expect(service.assignJob(manager, wo.id, jobId, {
      mechanicId,
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000801',
    })).resolves.toMatchObject({ version: 2, jobs: [expect.objectContaining({ assignedMechanic: { id: mechanicId, name: 'Alejandro 1' } })] });
    expect(tx.workOrderJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: jobId },
      data: { assignedMechanicId: mechanicId },
    }));
    expect(tx.mechanicAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { workOrderId: wo.id, mechanicId, addedById: manager.id },
    }));
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: ActivityEventType.MECHANIC_ADDED,
      entityType: 'work_order_job',
    }));

    const stale = assignmentTx(detailRow({ version: 5 }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof stale) => unknown) => callback(stale));
    await expect(service.assignJob(manager, wo.id, jobId, {
      mechanicId,
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000802',
    })).rejects.toBeInstanceOf(ConflictException);

    const assignedRow = detailRow({
      jobs: [{ ...wo.jobs[0], assignedMechanicId: mechanicId, assignedMechanic: { id: mechanicId, name: 'Alejandro 1' } }],
    });
    const unassignTx = assignmentTx(assignedRow);
    unassignTx.workOrder.findUnique
      .mockResolvedValueOnce(assignedRow)
      .mockResolvedValueOnce(assignedRow)
      .mockResolvedValueOnce(detailRow({ version: 2 }));
    prisma.$transaction.mockImplementation(async (callback: (client: typeof unassignTx) => unknown) => callback(unassignTx));
    await expect(service.unassignJob(manager, wo.id, jobId, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000803',
    })).resolves.toMatchObject({ version: 2 });
    expect(unassignTx.workOrderJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { assignedMechanicId: null },
    }));
    // Still owns another Job here: stays on the derived team.
    expect(unassignTx.mechanicAssignment.updateMany).not.toHaveBeenCalled();
  });

  it('drops a mechanic from the derived team and stops their labor when their last Job is unassigned (LTR-154)', async () => {
    const prisma = createPrisma();
    const service = createService(prisma);
    const mechanicId = '00000000-0000-4000-8000-000000000004';
    const manager = {
      id: baseRow.createdById, email: 'manager@lightning.local', name: 'Shop Manager', role: 'manager' as const,
      active: true, capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE],
      supabaseAuthId: null,
    };
    const base = detailRow({});
    const assignedRow = detailRow({
      jobs: [{ ...base.jobs[0], assignedMechanicId: mechanicId, assignedMechanic: { id: mechanicId, name: 'Alejandro 1' } }],
    });
    const tx = assignmentTx(assignedRow);
    tx.workOrder.findUnique
      .mockResolvedValueOnce(assignedRow)
      .mockResolvedValueOnce(assignedRow)
      .mockResolvedValueOnce(detailRow({ version: 2 }));
    // No Job left for this mechanic; the Work Order still has the now-unassigned pending Job.
    tx.workOrderJob.count.mockImplementation(async ({ where }: { where: { assignedMechanicId?: string } }) => (
      where.assignedMechanicId ? 0 : 1
    ));
    tx.workSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(service.unassignJob(manager, base.id, base.jobs[0].id, {
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000804',
    })).resolves.toMatchObject({ version: 2 });

    expect(tx.mechanicAssignment.updateMany).toHaveBeenCalledWith({
      where: { workOrderId: base.id, mechanicId, removedAt: null },
      data: { removedAt: expect.any(Date) },
    });
    expect(tx.workSession.updateMany).toHaveBeenCalledWith({
      where: { workOrderId: base.id, endedAt: null, userId: mechanicId },
      data: { endedAt: expect.any(Date) },
    });
  });

  it('shows a reported blocker without treating it as the current pause', async () => {
    const reportedAt = new Date('2026-09-11T15:00:00.000Z');
    const report = {
      id: '00000000-0000-4000-8000-000000000901',
      workOrderId: baseRow.id,
      reason: 'waiting_for_parts',
      notes: 'Air line ordered',
      startedAt: reportedAt,
      endedAt: reportedAt,
      durationMs: 0n,
      isOfficialPause: false,
      createdBy: { id: '00000000-0000-4000-8000-000000000001', name: 'Alejandro 1' },
      reportedBy: { id: '00000000-0000-4000-8000-000000000001', name: 'Alejandro 1' },
    };
    const prisma = createPrisma();
    prisma.workOrder.findUnique.mockResolvedValue(detailRow({
      status: 'in_progress',
      totalWaitingMs: 0n,
      pauseEvents: [report],
    }));
    const service = createService(prisma);

    const detail = await service.detail(baseRow.id);
    expect(detail.status).toBe('in_progress');
    expect(detail.currentPause).toBeNull();
    expect(detail.latestReportedBlocker).toMatchObject({
      reason: 'waiting_for_parts',
      isOfficialPause: false,
      reportedBy: { id: '00000000-0000-4000-8000-000000000001', name: 'Alejandro 1' },
    });
    expect(detail.pauseHistory).toEqual([]);
    expect(detail.reportedBlockers).toHaveLength(1);
    expect(detail.reportedBlockers[0]).toMatchObject({
      reason: 'waiting_for_parts',
      createdBy: { id: '00000000-0000-4000-8000-000000000001', name: 'Alejandro 1' },
    });
    expect(detail.totalWaitingMs).toBe(0);
  });

  it('sends the mechanic notes with the active blocker for the Dashboard and the Truck (LTR-164 #8)', async () => {
    const reportedAt = new Date('2026-09-28T17:41:00.000Z');
    const md = { id: '00000000-0000-4000-8000-000000000005', name: 'MD' };
    const prisma = createPrisma();
    prisma.workOrder.findUnique.mockResolvedValue(detailRow({
      status: 'in_progress',
      pauseEvents: [{
        id: '00000000-0000-4000-8000-000000000902', workOrderId: baseRow.id, reason: 'waiting_for_parts', notes: null,
        startedAt: reportedAt, endedAt: reportedAt, durationMs: 0n, isOfficialPause: false, createdBy: md, reportedBy: md,
      }],
      activityLogs: [{
        id: 'log-1', eventType: 'note_added', entityType: 'pause_event', entityId: '00000000-0000-4000-8000-000000000902',
        newValue: { body: 'ya llegó la pieza' }, createdAt: reportedAt, user: md, previousValue: null, userId: md.id, workOrderId: baseRow.id,
      }],
    }));

    const detail = await createService(prisma).detail(baseRow.id);
    expect(detail.latestReportedBlocker?.blockerNotes).toEqual([
      expect.objectContaining({ body: 'ya llegó la pieza', author: md }),
    ]);
  });
});

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    ...baseRow,
    createdBy: { id: baseRow.createdById, name: 'Shop Manager' },
    completedBy: null,
    jobs: [{
      id: '00000000-0000-4000-8000-000000000501',
      catalogJobId: null,
      displayName: 'Inspect',
      customDescription: null,
      status: 'to_do',
      categoryId: baseRow.primaryCategoryId,
      category: { name: 'Engine' },
      assignedMechanicId: null,
      assignedMechanic: null,
      completedAt: null,
      completedBy: null,
    }],
    pauseEvents: [],
    sessions: [],
    activityLogs: [],
    mechanics: [],
    serviceStatusEvents: [],
    ...overrides,
  };
}

function assignmentTx(wo: ReturnType<typeof detailRow>, extra: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    workOrder: {
      findUnique: vi.fn().mockResolvedValue(wo),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    mechanicAssignment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    workOrderJob: {
      findUnique: vi.fn().mockResolvedValue(wo.jobs[0] ? { ...wo.jobs[0], workOrderId: wo.id } : null),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
    workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    workOrderNote: { create: vi.fn().mockResolvedValue({ id: 'note-1', kind: 'note', body: 'note' }) },
    workSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    pauseEvent: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    truckServiceStatusEvent: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    pmService: { findUnique: vi.fn().mockResolvedValue(null) },
    truckReadinessAssessment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    truck: { update: vi.fn() },
    truckMileageAdjustment: { create: vi.fn() },
    ...extra,
  };
}

function cancelTx(wo: ReturnType<typeof detailRow>, extra: Record<string, unknown> = {}) {
  return assignmentTx(wo, extra);
}

describe('countUnassignedJobs (LTR-164 / D15)', () => {
  const qc = { status: 'to_do', assignedMechanicId: null, displayName: 'Quality Check', category: { name: 'Quality Check' } };

  it('does not count Quality Check, which never has an owner', () => {
    expect(countUnassignedJobs([qc])).toBe(0);
  });

  it('counts pending Jobs without an owner and skips owned or finished ones', () => {
    expect(countUnassignedJobs([
      qc,
      { status: 'to_do', assignedMechanicId: null, displayName: 'Alignment', category: { name: 'Suspension & Steering' } },
      { status: 'to_do', assignedMechanicId: 'm1', displayName: 'Detailing', category: { name: 'Detailing' } },
      { status: 'completed', assignedMechanicId: null, displayName: 'Brake Inspection', category: { name: 'Air & Brake System' } },
    ])).toBe(1);
  });
});

describe('Dashboard Ready to Go (LTR-164 #12)', () => {
  it('uses the Yard Work Plan count so both surfaces agree', async () => {
    const yard = { countReadyToGoTrucks: vi.fn().mockResolvedValue(1) };
    const prisma = {
      workOrder: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      workOrderNote: { findMany: vi.fn().mockResolvedValue([]) },
      truck: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new AdminService(prisma as never, { log: vi.fn() } as never, {} as never, yard as never);
    const dashboard = await service.dashboard();
    expect(dashboard.counts.readyToGo).toBe(1);
    expect(yard.countReadyToGoTrucks).toHaveBeenCalledTimes(1);
    // The Dashboard no longer counts completed Work Orders on its own.
    expect(prisma.truck.findMany).not.toHaveBeenCalled();
  });
});

describe('Dashboard queue (stage 3 / D1, UX-5-002)', () => {
  afterEach(() => { delete process.env.YARD_READY_TO_GO_SINCE; });

  function queueService(open: unknown[], completed: unknown[]) {
    const prisma = createPrisma();
    prisma.workOrder.count.mockResolvedValue(0);
    // Six attention queries first, then the open queue, then the completed (Ready to Go) window.
    [[], [], [], [], [], []].forEach((value) => prisma.workOrder.findMany.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValueOnce(open).mockResolvedValueOnce(completed);
    return createService(prisma);
  }

  it('lists every open Work Order, not only eight, each with its Next step', async () => {
    const open = Array.from({ length: 10 }, (_, index) => ({
      ...baseRow, id: `open-${index}`, displayId: `WO-${index}`, truckId: `truck-${index}`,
      truck: { ...baseRow.truck, id: `truck-${index}`, truckNumber: `T-${index}` },
      status: 'in_progress', jobs: [{ status: 'to_do', assignedMechanicId: null }],
    }));
    const result = await queueService(open, []).dashboard();
    expect(result.queue).toHaveLength(10);
    expect(result.queue?.every((item) => item.nextStep)).toBe(true);
  });

  it('adds a Truck still Ready to Go (latest completed, not returned, no newer open Work Order)', async () => {
    process.env.YARD_READY_TO_GO_SINCE = '2026-01-01T00:00:00.000Z';
    const completed = (id: string, truckId: string, completedAt: string, extra: Record<string, unknown> = {}) => ({
      ...baseRow, id, displayId: id, truckId, status: 'completed', completedAt: new Date(completedAt),
      truck: { ...baseRow.truck, id: truckId, truckNumber: truckId },
      jobs: [{ status: 'completed', assignedMechanicId: 'mechanic-1' }], serviceStatusEvents: [], ...extra,
    });
    const openOnBusyTruck = { ...baseRow, id: 'open-busy', displayId: 'WO-BUSY', truckId: 'busy', status: 'in_progress', truck: { ...baseRow.truck, id: 'busy', truckNumber: 'busy' } };
    const result = await queueService([openOnBusyTruck], [
      completed('WO-READY', 'ready', '2026-10-04T15:00:00.000Z'),
      completed('WO-OLDER', 'ready', '2026-09-20T15:00:00.000Z'),
      completed('WO-RETURNED', 'returned', '2026-10-03T15:00:00.000Z', {
        serviceStatusEvents: [{ status: 'in_service', occurredAt: new Date('2026-10-04T09:00:00.000Z') }],
      }),
      completed('WO-BUSY-OLD', 'busy', '2026-10-02T15:00:00.000Z'),
    ]).dashboard();
    const ready = result.queue?.filter((item) => item.nextStep?.kind === 'return_to_service').map((item) => item.displayId);
    expect(ready).toEqual(['WO-READY']);
  });
});
