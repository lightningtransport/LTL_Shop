import { ConflictException } from '@nestjs/common';
import { Prisma, type StockAdjustReason, type StockMovementKind } from '@prisma/client';
import { reverseSource, writeEntries } from './cost-ledger';

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
    reasonCode?: StockAdjustReason | null;
    reversesId?: string | null;
    pmServiceId?: string | null;
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
      reasonCode: data.reasonCode ?? null,
      reversesId: data.reversesId ?? null,
      pmServiceId: data.pmServiceId ?? null,
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

export const ISSUE_SOURCE = 'stock_issue' as const;
const qty = (hundredths: number) => (hundredths / 100).toFixed(2);

/**
 * Takes `hundredths` of a part off the shelf for a Job inside the caller's transaction: locks the part, refuses
 * more than is on hand, writes the movement at the average cost (P27) and the truck's cost row on that Work Order.
 */
export async function issueToJob(
  tx: Prisma.TransactionClient,
  actorId: string,
  part: { id: string; displayName: string; partNumber: string | null },
  hundredths: number,
  job: { id: string | null; displayName: string; workOrderId: string; truckId: string },
  pmServiceId: string | null = null,
) {
  await lockPart(tx, part.id);
  const onHand = await balance(tx, part.id);
  if (hundredths > onHand.hundredths) {
    throw new ConflictException({ code: 'NOT_ENOUGH_STOCK', message: `Only ${qty(Math.max(0, onHand.hundredths))} in stock.`, onHand: qty(Math.max(0, onHand.hundredths)) });
  }
  const valueCents = outValue(onHand, hundredths);
  const movement = await writeMovement(tx, {
    partId: part.id, kind: 'issue', hundredths: -hundredths, valueCents: -valueCents,
    workOrderJobId: job.id, truckId: job.truckId, pmServiceId, actorId,
  });
  await writeEntries(tx, {
    sourceType: ISSUE_SOURCE, sourceId: movement.id, kind: 'part_purchase', occurredOn: new Date(new Date().toISOString().slice(0, 10)),
    vendorId: null, workOrderId: job.workOrderId, actorId,
  }, [{
    truckId: job.truckId,
    amountCents: valueCents,
    description: `Stock · ${part.displayName}${part.partNumber ? ` ${part.partNumber}` : ''} × ${hundredths / 100} → ${job.displayName}`,
  }]);
  return { movement, valueCents, onHand };
}

/** Puts an issued part back on the shelf at the same cost and reverses the truck's cost row. Once per issue. */
export async function undoIssue(
  tx: Prisma.TransactionClient,
  issue: { id: string; partId: string; quantity: Prisma.Decimal; valueCents: number; workOrderJobId: string | null; truckId: string | null; pmServiceId?: string | null },
  actorId: string,
  reason: string,
) {
  await lockPart(tx, issue.partId);
  let movement;
  try {
    movement = await writeMovement(tx, {
      partId: issue.partId, kind: 'return', hundredths: -toHundredths(issue.quantity), valueCents: -issue.valueCents,
      workOrderJobId: issue.workOrderJobId, truckId: issue.truckId, pmServiceId: issue.pmServiceId ?? null, reversesId: issue.id, reason, actorId,
    });
  } catch (error) {
    // Two returns at once: the unique index on reverses_id lets only one through.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({ code: 'STOCK_ALREADY_RETURNED', message: 'That part is already back in stock.' });
    }
    throw error;
  }
  await reverseSource(tx, { sourceType: ISSUE_SOURCE, sourceId: issue.id }, actorId);
  return movement;
}
