import { describe, expect, it, vi } from 'vitest';
import { runNinoxTruckSeed } from './ninox-truck-seed';
import type { NinoxReadOnlyClient } from './ninox.read-only-client';

function prismaMock(options?: { completed?: boolean; existingNumbers?: string[] }) {
  const existing = new Set(options?.existingNumbers ?? []);
  return {
    ninoxTruckSeedRun: {
      findFirst: vi.fn().mockResolvedValue(options?.completed ? { id: 'run-1' } : null),
      create: vi.fn().mockResolvedValue({ id: 'run-2' }),
    },
    truck: {
      findUnique: vi.fn(async ({ where }: { where: { truckNumber: string } }) => (
        existing.has(where.truckNumber) ? { id: `id-${where.truckNumber}` } : null
      )),
      upsert: vi.fn(async ({ where }: { where: { truckNumber: string } }) => {
        existing.add(where.truckNumber);
        return { truckNumber: where.truckNumber };
      }),
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
  });

  it('inserts new truckNumbers and skips existing ones', async () => {
    const listTrucksDbRecords = vi.fn().mockResolvedValue([
      { id: 1, fields: { A: '905', OF: 100, Y4: 'CTC' } },
      { id: 2, fields: { A: '777', OF: 50, Y4: 'LTL', X1: '301 Yard' } },
      { id: 3, fields: { OF: 1 } },
    ]);
    const prisma = prismaMock({ existingNumbers: ['905'] });
    const result = await runNinoxTruckSeed({
      prisma: prisma as never,
      client: { listTrucksDbRecords } as unknown as NinoxReadOnlyClient,
    });
    expect(result).toMatchObject({
      queriedNinox: true,
      status: 'completed',
      recordsRead: 3,
      insertedCount: 1,
      skippedExistingCount: 1,
      skippedMissingNumberCount: 1,
      sourceTableId: 'E',
    });
    expect(prisma.truck.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.truck.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { truckNumber: '777' },
      update: {},
      create: expect.objectContaining({
        truckNumber: '777',
        mileage: 50,
        company: 'LTL',
        yardLocation: '301 Yard',
        ninoxExternalId: '2',
      }),
    }));
    expect(prisma.ninoxTruckSeedRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed', sourceTableId: 'E' }),
    }));
  });
});
