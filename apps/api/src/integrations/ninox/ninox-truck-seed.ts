import type { PrismaClient } from '@prisma/client';
import { NINOX_TRUCKS_DB } from './ninox.mapping';
import type { NinoxReadOnlyClient } from './ninox.read-only-client';
import { transformTrucksDbRecord, type ShopTruckSeedRow } from './ninox-truck-transform';

export const NINOX_TRUCK_SEED_COMPLETED_STATUS = 'completed';

export type NinoxTruckSeedResult = {
  queriedNinox: boolean;
  status: 'completed' | 'already-completed' | 'dry-run';
  recordsRead: number;
  insertedCount: number;
  skippedExistingCount: number;
  skippedMissingNumberCount: number;
  sourceTableId: string;
};

type SeedPrisma = Pick<PrismaClient, 'ninoxTruckSeedRun' | 'truck'>;

export async function hasCompletedNinoxTruckSeed(prisma: SeedPrisma): Promise<boolean> {
  const existing = await prisma.ninoxTruckSeedRun.findFirst({
    where: { status: NINOX_TRUCK_SEED_COMPLETED_STATUS, sourceTableId: NINOX_TRUCKS_DB.tableId },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * One-shot TrucksDB E → Shop trucks seed.
 * Reads Ninox only when no completed run exists.
 * Persists NEW rows keyed by truckNumber. Existing numbers are left untouched.
 * Never writes to Ninox.
 */
export async function runNinoxTruckSeed(options: {
  prisma: SeedPrisma;
  client: NinoxReadOnlyClient;
  dryRun?: boolean;
  allowRerun?: boolean;
  now?: Date;
}): Promise<NinoxTruckSeedResult> {
  const now = options.now ?? new Date();
  const alreadyDone = await hasCompletedNinoxTruckSeed(options.prisma);
  if (alreadyDone && !options.allowRerun) {
    return {
      queriedNinox: false,
      status: 'already-completed',
      recordsRead: 0,
      insertedCount: 0,
      skippedExistingCount: 0,
      skippedMissingNumberCount: 0,
      sourceTableId: NINOX_TRUCKS_DB.tableId,
    };
  }

  const records = await options.client.listTrucksDbRecords();
  const rows: ShopTruckSeedRow[] = [];
  let skippedMissingNumberCount = 0;
  for (const record of records) {
    const row = transformTrucksDbRecord(record);
    if (!row) {
      skippedMissingNumberCount += 1;
      continue;
    }
    rows.push(row);
  }

  if (options.dryRun) {
    return {
      queriedNinox: true,
      status: 'dry-run',
      recordsRead: records.length,
      insertedCount: 0,
      skippedExistingCount: 0,
      skippedMissingNumberCount,
      sourceTableId: NINOX_TRUCKS_DB.tableId,
    };
  }

  let insertedCount = 0;
  let skippedExistingCount = 0;
  for (const row of rows) {
    const existing = await options.prisma.truck.findUnique({
      where: { truckNumber: row.truckNumber },
      select: { id: true },
    });
    if (existing) {
      skippedExistingCount += 1;
      continue;
    }
    await options.prisma.truck.upsert({
      where: { truckNumber: row.truckNumber },
      create: toCreateData(row),
      update: {},
    });
    insertedCount += 1;
  }

  await options.prisma.ninoxTruckSeedRun.create({
    data: {
      sourceTableId: NINOX_TRUCKS_DB.tableId,
      status: NINOX_TRUCK_SEED_COMPLETED_STATUS,
      recordsRead: records.length,
      insertedCount,
      skippedCount: skippedExistingCount + skippedMissingNumberCount,
      skippedNinoxQuery: false,
      notes: 'Initial TrucksDB E seed. Insert-only by truckNumber. No Ninox writes.',
      startedAt: now,
      finishedAt: new Date(),
    },
  });

  return {
    queriedNinox: true,
    status: 'completed',
    recordsRead: records.length,
    insertedCount,
    skippedExistingCount,
    skippedMissingNumberCount,
    sourceTableId: NINOX_TRUCKS_DB.tableId,
  };
}

function toCreateData(row: ShopTruckSeedRow) {
  return {
    truckNumber: row.truckNumber,
    make: row.make,
    model: row.model,
    year: row.year,
    mileage: row.mileage,
    company: row.company,
    owner: row.owner,
    vin: row.vin,
    samsaraTruckLocation: row.samsaraTruckLocation,
    samsaraLastConnectedDate: row.samsaraLastConnectedDate,
    samsaraId: row.samsaraId,
    ninoxExternalId: row.ninoxExternalId,
    yardLocation: row.yardLocation,
    ninoxMechanicStatus: row.ninoxMechanicStatus,
    dispatcher: row.dispatcher,
    insurance: row.insurance,
    licensePlate: row.licensePlate,
  };
}
