import { describe, expect, it, vi } from 'vitest';
import { TrucksService } from './trucks.service';

const truck = (truckNumber: string) => ({
  id: `truck-${truckNumber}`,
  truckNumber,
  make: null,
  model: null,
  year: null,
  mileage: null,
  company: null,
  owner: null,
});

describe('TrucksService search', () => {
  it('returns exact and prefix matches before internal matches in natural order', async () => {
    const findMany = vi.fn().mockResolvedValueOnce([
      truck('905'), truck('901'), truck('90'),
    ]);
    const service = new TrucksService({ truck: { findMany } } as never);

    await expect(service.search(' # 9 ')).resolves.toMatchObject([
      { truckNumber: '90' },
      { truckNumber: '901' },
      { truckNumber: '905' },
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) }),
    }));
  });

  it('uses contains matches only when no truck begins with the search', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([truck('905'), truck('609'), truck('899')]);
    const service = new TrucksService({ truck: { findMany } } as never);

    await expect(service.search('05')).resolves.toMatchObject([
      { truckNumber: '609' },
      { truckNumber: '899' },
      { truckNumber: '905' },
    ]);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0]).toEqual(expect.objectContaining({
      where: { truckNumber: { contains: '05', mode: 'insensitive' } },
    }));
  });

  it('returns completed repair history with bounded cursor pagination', async () => {
    const currentTruck = truck('905');
    const findUnique = vi.fn().mockResolvedValue(currentTruck);
    const rows = [
      {
        id: '00000000-0000-4000-8000-000000000002',
        displayId: 'WO-002',
        completedAt: new Date('2026-09-08T12:00:00.000Z'),
        createdAt: new Date('2026-09-08T10:00:00.000Z'),
        primaryCategory: { name: 'Suspension' },
        mechanics: [{ mechanic: { name: 'Alex' } }],
        pmService: null,
        jobs: [{
          id: '00000000-0000-4000-8000-000000000003',
          categoryId: '00000000-0000-4000-8000-000000000004',
          category: { id: '00000000-0000-4000-8000-000000000004', name: 'Suspension' },
          displayName: 'Inspect suspension',
        }],
      },
      {
        id: '00000000-0000-4000-8000-000000000001',
        displayId: 'WO-001',
        completedAt: new Date('2026-09-07T12:00:00.000Z'),
        createdAt: new Date('2026-09-07T10:00:00.000Z'),
        primaryCategory: { name: 'PM' },
        mechanics: [],
        pmService: { observedMileage: 123456 },
        jobs: [{
          id: '00000000-0000-4000-8000-000000000005',
          categoryId: '00000000-0000-4000-8000-000000000006',
          category: { id: '00000000-0000-4000-8000-000000000006', name: 'PM' },
          displayName: 'Hidden PM row',
        }],
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const service = new TrucksService({ truck: { findUnique }, workOrder: { findMany } } as never);

    const excludedId = '00000000-0000-4000-8000-000000000099';
    const result = await service.getRepairHistory(currentTruck.id, undefined, {
      excludeWorkOrderId: excludedId,
      limit: 1,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      displayId: 'WO-002',
      mechanicNames: ['Alex'],
      jobs: ['Inspect suspension'],
      jobDetails: [{
        id: '00000000-0000-4000-8000-000000000003',
        categoryId: '00000000-0000-4000-8000-000000000004',
        category: { id: '00000000-0000-4000-8000-000000000004', name: 'Suspension' },
        displayName: 'Inspect suspension',
        status: 'completed',
      }],
    });
    expect(result.nextCursor).toBeTypeOf('string');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 2,
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      where: expect.objectContaining({
        status: 'completed',
        completedAt: { not: null },
        id: { not: excludedId },
      }),
    }));
  });

  it('filters repair history by any Job Category while retaining primary Category fields', async () => {
    const currentTruck = truck('905');
    const findUnique = vi.fn().mockResolvedValue(currentTruck);
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new TrucksService({ truck: { findUnique }, workOrder: { findMany } } as never);

    await service.getRepairHistory(currentTruck.id, '00000000-0000-4000-8000-000000000004');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        jobs: { some: { categoryId: '00000000-0000-4000-8000-000000000004' } },
      }),
      include: expect.objectContaining({
        primaryCategory: true,
        jobs: expect.objectContaining({
          where: { status: 'completed' },
          include: { category: { select: { id: true, name: true } } },
        }),
      }),
    }));
  });
});
