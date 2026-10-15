import type { PrismaClient } from '@prisma/client';
import { normalizeMakeModel } from '@ltl-shop/shared';
import { NINOX_TRUCKS_DB, SHOP_TRUCK_SEED_IDENTITY } from './ninox.mapping';
import type { NinoxReadOnlyClient } from './ninox.read-only-client';
import {
  presentShopFields,
  transformTrucksDbRecord,
  type ShopTruckSeedRow,
} from './ninox-truck-transform';

export const NINOX_TRUCK_SEED_COMPLETED_STATUS = 'completed';

export type NinoxTruckSeedResult = {
  queriedNinox: boolean;
  status: 'completed' | 'already-completed' | 'dry-run';
  recordsRead: number;
  insertedCount: number;
  updatedCount: number;
  skippedMissingNumberCount: number;
  ambiguousVinCount: number;
  sourceTableId: string;
  identity: typeof SHOP_TRUCK_SEED_IDENTITY;
};

type SeedTruck = { id: string; truckNumber: string; vin: string | null; model?: string | null };
type SeedPrisma = Pick<PrismaClient, 'ninoxTruckSeedRun' | 'truck'>;

export async function hasCompletedNinoxTruckSeed(prisma: SeedPrisma): Promise<boolean> {
  const existing = await prisma.ninoxTruckSeedRun.findFirst({
    where: { status: NINOX_TRUCK_SEED_COMPLETED_STATUS, sourceTableId: NINOX_TRUCKS_DB.tableId },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function resolveSeedIdentity(
  prisma: SeedPrisma,
  row: ShopTruckSeedRow,
): Promise<{ existing: SeedTruck | null; ambiguousVin: boolean }> {
  if (row.vin) {
    const byVin = await prisma.truck.findMany({
      where: { vin: row.vin },
      select: { id: true, truckNumber: true, vin: true, model: true },
    });
    if (byVin.length === 1) return { existing: byVin[0], ambiguousVin: false };
    if (byVin.length > 1) {
      const sameNumber = byVin.find((truck) => truck.truckNumber === row.truckNumber) ?? null;
      return { existing: sameNumber, ambiguousVin: !sameNumber };
    }
  }
  const byNumber = await prisma.truck.findUnique({
    where: { truckNumber: row.truckNumber },
    select: { id: true, truckNumber: true, vin: true, model: true },
  });
  return { existing: byNumber, ambiguousVin: false };
}

/**
 * One-shot TrucksDB E → Shop trucks upsert.
 * Never writes Ninox. After a completed run, never queries Ninox again.
 * Does not import Work Orders / jobs and does not set Presence or Ready.
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
    return emptyResult('already-completed', false);
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
      ...emptyResult('dry-run', true),
      recordsRead: records.length,
      skippedMissingNumberCount,
    };
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let ambiguousVinCount = 0;
  for (const row of rows) {
    const { existing, ambiguousVin } = await resolveSeedIdentity(options.prisma, row);
    if (ambiguousVin) {
      ambiguousVinCount += 1;
      continue;
    }
    const fields = presentShopFields(row);
    if (existing) {
      if (row.make && !row.model && existing.model) {
        // LTR-113: TrucksDB has no Model; read its Make against the Model the truck already has.
        Object.assign(fields, normalizeMakeModel(row.make, existing.model));
      }
      await options.prisma.truck.update({
        where: { id: existing.id },
        data: fields,
      });
      updatedCount += 1;
      continue;
    }
    await options.prisma.truck.upsert({
      where: { truckNumber: row.truckNumber },
      create: { truckNumber: row.truckNumber, ...fields },
      update: fields,
    });
    insertedCount += 1;
  }

  await options.prisma.ninoxTruckSeedRun.create({
    data: {
      sourceTableId: NINOX_TRUCKS_DB.tableId,
      status: NINOX_TRUCK_SEED_COMPLETED_STATUS,
      recordsRead: records.length,
      insertedCount,
      skippedCount: skippedMissingNumberCount + ambiguousVinCount,
      skippedNinoxQuery: false,
      notes: 'One-shot TrucksDB E upsert by VIN+truckNumber. No Ninox writes. No WO/history. Presence stays UNKNOWN.',
      startedAt: now,
      finishedAt: new Date(),
    },
  });

  return {
    queriedNinox: true,
    status: 'completed',
    recordsRead: records.length,
    insertedCount,
    updatedCount,
    skippedMissingNumberCount,
    ambiguousVinCount,
    sourceTableId: NINOX_TRUCKS_DB.tableId,
    identity: SHOP_TRUCK_SEED_IDENTITY,
  };
}

function emptyResult(
  status: NinoxTruckSeedResult['status'],
  queriedNinox: boolean,
): NinoxTruckSeedResult {
  return {
    queriedNinox,
    status,
    recordsRead: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedMissingNumberCount: 0,
    ambiguousVinCount: 0,
    sourceTableId: NINOX_TRUCKS_DB.tableId,
    identity: SHOP_TRUCK_SEED_IDENTITY,
  };
}
