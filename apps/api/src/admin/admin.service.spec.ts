import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
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
  it('returns current dashboard counts with provenance', async () => {
    const prisma = createPrisma();
    [6, 2, 2, 2, 3, 1].forEach((value) => prisma.workOrder.count.mockResolvedValueOnce(value));
    prisma.workOrder.findMany.mockResolvedValue([]);
    const service = new AdminService(prisma as never);

    await expect(service.dashboard()).resolves.toMatchObject({
      source: 'supabase_postgres',
      counts: {
        open: 6, created: 2, inProgress: 2, waitingPaused: 2,
        highCriticalOpen: 3, unassignedOpen: 1,
      },
      attention: [],
    });
    expect(prisma.workOrder.count).toHaveBeenCalledTimes(6);
    expect(prisma.workOrder.findMany).toHaveBeenCalledTimes(4);
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

  it('returns 404 for a missing detail', async () => {
    const prisma = createPrisma();
    prisma.workOrder.findUnique.mockResolvedValue(null);
    const service = new AdminService(prisma as never);
    await expect(service.detail(baseRow.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
