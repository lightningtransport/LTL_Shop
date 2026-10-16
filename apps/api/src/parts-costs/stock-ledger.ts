import { ConflictException } from '@nestjs/common';
import { Prisma, type StockMovementKind } from '@prisma/client';

/**
 * D45 / ST-3 (LTR-223): the Shop's stock is a list of movements that is only added to. On hand = the sum of the
 * quantities; its value = the sum of `value_cents`. A part leaves at the average cost of what is on hand (P27);
 * the last unit takes the whole value left, so the value never keeps cents with nothing on the shelf.
 */

export const toHundredths = (value: Prisma.Decimal | number | string) => Math.round(Number(value) * 100);
export const fromHundredths = (hundredths: number) => new Prisma.Decimal(hundredths).div(100);

/** Locks the part's row so two movements of the same part never read the same balance. */
export async function lockPart(tx: Prisma.TransactionClient, partId: string) {
  await tx.$queryRaw`SELECT id FROM parts WHERE id = ${partId}::uuid FOR UPDATE`;
}

export async function balance(tx: Prisma.TransactionClient, partId: string) {
  const sum = await tx.stockMovement.aggregate({ where: { partId }, _sum: { quantity: true, valueCents: true } });
  return { hundredths: toHundredths(sum._sum.quantity ?? 0), valueCents: sum._sum.valueCents ?? 0 };
}

/** What `hundredths` units cost leaving now: their share of the value on hand (all of it for the last ones). */
export function outValue(onHand: { hundredths: number; valueCents: number }, hundredths: number) {
  if (hundredths >= onHand.hundredths) return onHand.valueCents;
  return Math.round((onHand.valueCents * hundredths) / onHand.hundredths);
}

export function averageCents(onHand: { hundredths: number; valueCents: number }) {
  return onHand.hundredths > 0 ? Math.round((onHand.valueCents * 100) / onHand.hundredths) : null;
}

export async function writeMovement(
  tx: Prisma.TransactionClient,
  data: {
    partId: string;
    kind: StockMovementKind;
    hundredths: number;
    valueCents: number;
    actorId: string;
    purchaseId?: string | null;
    workOrderJobId?: string | null;
    truckId?: string | null;
    reason?: string | null;
    reversesId?: string | null;
  },
) {
  return tx.stockMovement.create({
    data: {
      partId: data.partId,
      kind: data.kind,
      quantity: fromHundredths(data.hundredths),
      valueCents: data.valueCents,
      purchaseId: data.purchaseId ?? null,
      workOrderJobId: data.workOrderJobId ?? null,
      truckId: data.truckId ?? null,
      reason: data.reason ?? null,
      reversesId: data.reversesId ?? null,
      createdById: data.actorId,
    },
  });
}

/** After a purchase is corrected or voided: no part may be left with less than nothing on the shelf. */
export async function assertNotBelowZero(tx: Prisma.TransactionClient, partIds: string[]) {
  for (const partId of [...new Set(partIds)]) {
    const onHand = await balance(tx, partId);
    if (onHand.hundredths < 0) {
      const part = await tx.part.findUnique({ where: { id: partId }, select: { displayName: true } });
      throw new ConflictException({
        code: 'STOCK_ALREADY_USED',
        message: `${part?.displayName ?? 'A part'} from this invoice already left the stock. Return it to stock or count the shelf first.`,
        partId,
      });
    }
  }
}
