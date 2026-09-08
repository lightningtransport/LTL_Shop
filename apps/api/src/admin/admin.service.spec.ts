import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service';

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
  jobs: [{ status: 'to_do' }],
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
  };
}

describe('AdminService', () => {
  afterEach(() => vi.useRealTimers());

  it('returns current dashboard counts with provenance', async () => {
    const prisma = createPrisma();
    [6, 2, 3, 4, 5, 6].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = new AdminService(prisma as never);

    await expect(service.dashboard()).resolves.toMatchObject({
      source: 'supabase_postgres',
      counts: {
        open: 6, waitingPaused: 2, highCriticalOpen: 3,
        openOlderThan24h: 4, completedToday: 5, completedLast7Days: 6,
      },
      attention: [],
    });
    expect(prisma.workOrder.count).toHaveBeenCalledTimes(6);
    expect(prisma.workOrder.findMany).toHaveBeenCalledTimes(4);
  });

  it('returns the exact UTC cutoff used by the older-than-24-hours count', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T14:45:00.000Z'));
    const prisma = createPrisma();
    [0, 0, 0, 1, 0, 0].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = new AdminService(prisma as never);

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
    const service = new AdminService(prisma as never);

    await service.list({});

    expect(prisma.workOrder.findMany.mock.calls[0][0].where).toEqual({});
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
    const service = new AdminService(prisma as never);

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
    const service = new AdminService(createPrisma() as never);
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
    const service = new AdminService(prisma as never);
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
    const service = new AdminService(prisma as never);

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
    const service = new AdminService(prisma as never);
    await expect(service.detail(baseRow.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
