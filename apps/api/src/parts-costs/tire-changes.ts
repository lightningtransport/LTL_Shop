import { tireAxle, type AdminJobTireDto, type InstalledTireDto, type TirePosition } from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';

/**
 * D45 / ST-4 (LTR-224): the tires to put on a Tires Job. A row is `proposed` until the Manager confirms it; then it
 * is `issued` while its stock movement still counts, or `to_buy` when there was none on the shelf (or it went back
 * to stock).
 */

export const tireChangeInclude = {
  part: { select: { id: true, displayName: true, tireSize: true, tireType: true } },
  tireReading: { select: { psi: true, tread: true } },
  stockMovement: { select: { valueCents: true, reversals: { select: { id: true } } } },
} satisfies Prisma.JobTireChangeInclude;

type TireChangeRow = Prisma.JobTireChangeGetPayload<{ include: typeof tireChangeInclude }>;

export function tireChangeStatus(row: { confirmedAt: Date | null; stockMovement: { reversals: unknown[] } | null }): AdminJobTireDto['status'] {
  if (!row.confirmedAt) return 'proposed';
  return row.stockMovement && !row.stockMovement.reversals.length ? 'issued' : 'to_buy';
}

export function toJobTireDto(row: TireChangeRow, suggested: { steer: string | null; drive: string | null }): AdminJobTireDto {
  const axle = tireAxle(row.position as TirePosition);
  const status = tireChangeStatus(row);
  return {
    id: row.id,
    position: row.position,
    axle,
    tireType: row.tireType,
    status,
    part: row.part,
    suggestedSize: suggested[axle],
    reading: row.tireReading,
    ...(status === 'issued' ? { valueCents: -row.stockMovement!.valueCents } : {}),
  };
}

/** The tires still mounted on a truck from confirmed Tires Jobs: the last one per position. */
export async function installedTires(db: Prisma.TransactionClient, truckId: string): Promise<InstalledTireDto[]> {
  const rows = await db.jobTireChange.findMany({
    where: { workOrderJob: { workOrder: { truckId } }, stockMovementId: { not: null }, stockMovement: { reversals: { none: {} } } },
    orderBy: { confirmedAt: 'desc' },
    select: {
      position: true, tireType: true, confirmedAt: true,
      part: { select: { tireSize: true } },
      workOrderJob: { select: { workOrder: { select: { displayId: true } } } },
    },
  });
  const seen = new Set<string>();
  const latest: InstalledTireDto[] = [];
  for (const row of rows) {
    if (seen.has(row.position)) continue;
    seen.add(row.position);
    latest.push({
      position: row.position as TirePosition,
      tireType: row.tireType,
      tireSize: row.part?.tireSize ?? null,
      installedAt: row.confirmedAt!.toISOString(),
      workOrderDisplayId: row.workOrderJob.workOrder.displayId,
    });
  }
  return latest;
}

/** P26 not answered: the size last put on each axle of the truck is the one proposed next time. */
export function suggestedSizes(installed: InstalledTireDto[]) {
  const pick = (axle: 'steer' | 'drive') => installed
    .filter((tire) => tireAxle(tire.position) === axle && tire.tireSize)
    .sort((left, right) => right.installedAt.localeCompare(left.installedAt))[0]?.tireSize ?? null;
  return { steer: pick('steer'), drive: pick('drive') };
}
