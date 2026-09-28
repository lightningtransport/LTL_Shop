import { describe, expect, it, vi } from 'vitest';
import { toTruckDto, TrucksService } from './trucks.service';

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

  it('maps live identity columns onto the current TruckDto without exposing samsaraId', () => {
    const dto = toTruckDto({
      id: 'truck-1',
      truckNumber: '905',
      make: 'Peterbilt',
      model: '579',
      year: 2025,
      mileage: 155000,
      company: 'CTC',
      owner: 'Cristian',
      vin: ' 1XKYD49X0LJ123456 ',
      samsaraTruckLocation: 'West Main Street, Woodville, OH, 43469',
      samsaraLastConnectedDate: new Date('2026-09-11T00:00:00.000Z'),
      ...({ samsaraId: 281474976710656 } as { samsaraId?: number }),
    });

    expect(dto).toEqual({
      id: 'truck-1',
      truckNumber: '905',
      make: 'Peterbilt',
      model: '579',
      year: 2025,
      mileage: 155000,
      company: 'CTC',
      owner: 'Cristian',
      vin: '1XKYD49X0LJ123456',
      location: 'West Main Street, Woodville, OH, 43469',
      locationUpdatedOn: '2026-09-11',
    });
    expect(dto).not.toHaveProperty('samsaraId');
    expect(dto).not.toHaveProperty('samsaraTruckLocation');
    expect(dto).not.toHaveProperty('ninoxExternalId');
  });

  it('keeps miles and owners when live identity columns are absent', () => {
    expect(toTruckDto(truck('905'))).toEqual({
      id: 'truck-905',
      truckNumber: '905',
      make: null,
      model: null,
      year: null,
      mileage: null,
      company: null,
      owner: null,
      vin: null,
      location: null,
      locationUpdatedOn: null,
    });
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
        mechanics: [{ mechanic: { id: 'mechanic-alex', name: 'Alex' }, addedAt: new Date('2026-09-01T10:00:00.000Z'), removedAt: null }],
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
          include: {
            category: { select: { id: true, name: true } },
            assignedMechanic: { select: { id: true, name: true } },
          },
        }),
      }),
    }));
  });
});

describe('TrucksService list (LTR-140)', () => {
  it('marks the Truck open Work Order for search results', async () => {
    const findMany = vi.fn().mockResolvedValueOnce([
      { ...truck('905'), workOrders: [{ id: 'wo-9', displayId: 'WO-009', status: 'in_progress' }] },
      { ...truck('906'), workOrders: [] },
    ]);
    const service = new TrucksService({ truck: { findMany } } as never);

    await expect(service.list()).resolves.toMatchObject([
      { truckNumber: '905', openWorkOrder: { id: 'wo-9', displayId: 'WO-009', status: 'in_progress' } },
      { truckNumber: '906', openWorkOrder: null },
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { workOrders: expect.objectContaining({ take: 1, where: { status: { in: expect.any(Array) } } }) },
    }));
  });
});
