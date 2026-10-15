import { describe, expect, it, vi } from 'vitest';
import { resolveSeedIdentity, runNinoxTruckSeed } from './ninox-truck-seed';
import type { NinoxReadOnlyClient } from './ninox.read-only-client';

function prismaMock(options?: {
  completed?: boolean;
  byNumber?: Record<string, { id: string; truckNumber: string; vin: string | null; model?: string | null }>;
  byVin?: Record<string, Array<{ id: string; truckNumber: string; vin: string | null }>>;
}) {
  const byNumber = options?.byNumber ?? {};
  const byVin = options?.byVin ?? {};
  return {
    ninoxTruckSeedRun: {
      findFirst: vi.fn().mockResolvedValue(options?.completed ? { id: 'run-1' } : null),
      create: vi.fn().mockResolvedValue({ id: 'run-2' }),
    },
    truck: {
      findMany: vi.fn(async ({ where }: { where: { vin: string } }) => byVin[where.vin] ?? []),
      findUnique: vi.fn(async ({ where }: { where: { truckNumber?: string; id?: string } }) => {
        if (where.truckNumber) return byNumber[where.truckNumber] ?? null;
        return null;
      }),
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('runNinoxTruckSeed', () => {
  it('does not query Ninox after a completed seed', async () => {
    const listTrucksDbRecords = vi.fn();
    const prisma = prismaMock({ completed: true });
    const result = await runNinoxTruckSeed({
      prisma: prisma as never,
      client: { listTrucksDbRecords } as unknown as NinoxReadOnlyClient,
    });
    expect(result).toMatchObject({ queriedNinox: false, status: 'already-completed' });
    expect(listTrucksDbRecords).not.toHaveBeenCalled();
    expect(prisma.truck.upsert).not.toHaveBeenCalled();
    expect(prisma.truck.update).not.toHaveBeenCalled();
  });

  it('upserts by VIN when unique, else by truckNumber, and inserts new rows', async () => {
    const listTrucksDbRecords = vi.fn().mockResolvedValue([
      { id: 1, fields: { A: '905', CG: 'VIN905', OF: 111, X1: '301 Yard' } },
      { id: 2, fields: { A: '777', OF: 50, X1: 'Vendor' } },
      { id: 3, fields: { OF: 1 } },
    ]);
    const prisma = prismaMock({
      byVin: { VIN905: [{ id: 'id-old-905', truckNumber: '905', vin: 'VIN905' }] },
    });
    const result = await runNinoxTruckSeed({
      prisma: prisma as never,
      client: { listTrucksDbRecords } as unknown as NinoxReadOnlyClient,
    });
    expect(result).toMatchObject({
      queriedNinox: true,
      status: 'completed',
      recordsRead: 3,
      updatedCount: 1,
      insertedCount: 1,
      skippedMissingNumberCount: 1,
      identity: { uniqueWriteKey: 'truckNumber', preferredMatch: ['vin', 'truckNumber'] },
    });
    expect(prisma.truck.update).toHaveBeenCalledWith({
      where: { id: 'id-old-905' },
      data: expect.objectContaining({
        vin: 'VIN905',
        mileage: 111,
        samsaraTruckLocation: '301 Yard',
      }),
    });
    expect(prisma.truck.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { truckNumber: '777' },
      create: expect.objectContaining({ truckNumber: '777', mileage: 50 }),
    }));
    expect(prisma.truck.update.mock.calls[0][0].data).not.toHaveProperty('presence');
    expect(prisma.truck.upsert.mock.calls[0][0].create).not.toHaveProperty('yardLocation');
  });

  it("reads TrucksDB's Make against the Model the truck already has (LTR-113)", async () => {
    const listTrucksDbRecords = vi.fn().mockResolvedValue([{ id: 1, fields: { A: '277', DG: 'CASCADIA' } }]);
    const prisma = prismaMock({ byNumber: { '277': { id: 'id-277', truckNumber: '277', vin: null, model: 'Freightliner' } } });
    await runNinoxTruckSeed({ prisma: prisma as never, client: { listTrucksDbRecords } as unknown as NinoxReadOnlyClient });
    expect(prisma.truck.update.mock.calls[0][0].data).toMatchObject({ make: 'Freightliner', model: 'CASCADIA' });
  });

  it('prefers VIN+truckNumber and reports an ambiguous VIN as skipped', async () => {
    const prisma = prismaMock({
      byVin: {
        DUP: [
          { id: 'a', truckNumber: '1', vin: 'DUP' },
          { id: 'b', truckNumber: '2', vin: 'DUP' },
        ],
      },
    });
    await expect(resolveSeedIdentity(prisma as never, {
      truckNumber: '9',
      vin: 'DUP',
      make: null,
      model: null,
      year: null,
      licensePlate: null,
      mileage: null,
      samsaraTruckLocation: null,
      samsaraLastConnectedDate: null,
      company: null,
      owner: null,
      ninoxExternalId: null,
      ninoxMechanicStatus: null,
      samsaraId: null,
    })).resolves.toEqual({ existing: null, ambiguousVin: true });
  });
});
