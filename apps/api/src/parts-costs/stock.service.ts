import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  adminConfirmJobTiresSchema,
  adminStockCountSchema,
  adminStockIssueSchema,
  adminStockQuerySchema,
  adminStockReturnSchema,
  normalizeCatalogText,
  parseQuantityToHundredths,
  tireAxle,
  type AdminStockItemDto,
  type TirePosition,
  type AdminStockListDto,
  type AdminStockMovementDto,
  type AdminStockPartDto,
} from '@ltl-shop/shared';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { reverseSource, writeEntries } from './cost-ledger';
import { averageCents, balance, fromHundredths, lockPart, outValue, toHundredths, writeMovement } from './stock-ledger';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISSUE_SOURCE = 'stock_issue' as const;

function parse<T>(schema: { safeParse(raw: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

const qty = (hundredths: number) => (hundredths / 100).toFixed(2);
const countToHundredths = (value: string | number) => (Number(value) === 0 ? 0 : parseQuantityToHundredths(value)!);

const partSelect = {
  id: true, displayName: true, partNumber: true, active: true, tireSize: true, tireType: true, minStock: true,
  category: { select: { name: true, kind: true } },
} satisfies Prisma.PartSelect;

type PartRow = Prisma.PartGetPayload<{ select: typeof partSelect }>;

/**
 * D45 / ST-3 (LTR-223): the Shop's stock. It enters with a purchase line "To stock" (PurchasesService) or a count
 * (P25: the Manager types what is on the shelf), and leaves to a Job at the average cost (P27), which goes to that
 * truck's costs on that Work Order like any part. "Return to stock" undoes a part that left; nothing is deleted.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(raw: unknown): Promise<AdminStockListDto> {
    const query = parse(adminStockQuerySchema, raw);
    const [sums, parts] = await Promise.all([
      this.prisma.stockMovement.groupBy({ by: ['partId'], _sum: { quantity: true, valueCents: true }, _max: { createdAt: true } }),
      this.prisma.part.findMany({
        where: {
          ...(query.kind ? { category: { kind: query.kind } } : {}),
          // A part shows once it has movements, or a minimum to watch.
          OR: [{ stockMovements: { some: {} } }, { minStock: { not: null }, active: true }],
        },
        select: partSelect,
      }),
    ]);
    const byPart = new Map(sums.map((row) => [row.partId, row]));
    const needle = normalizeCatalogText(query.q ?? '');
    const items = parts
      .map((part) => this.item(part, byPart.get(part.id)))
      .filter((item) => !needle || normalizeCatalogText(`${item.displayName} ${item.partNumber ?? ''} ${item.tireSize ?? ''}`).includes(needle))
      .filter((item) => !query.low || item.low)
      .sort((left, right) => Number(right.low) - Number(left.low) || left.categoryName.localeCompare(right.categoryName) || left.displayName.localeCompare(right.displayName));
    return {
      items,
      totals: { valueCents: items.reduce((sum, item) => sum + item.valueCents, 0), lowCount: items.filter((item) => item.low).length },
    };
  }

  async part(partId: string): Promise<AdminStockPartDto> {
    this.assertId(partId);
    const part = await this.prisma.part.findUnique({ where: { id: partId }, select: partSelect });
    if (!part) throw new NotFoundException('Part not found');
    const [sum, movements] = await Promise.all([
      this.prisma.stockMovement.aggregate({ where: { partId }, _sum: { quantity: true, valueCents: true }, _max: { createdAt: true } }),
      this.prisma.stockMovement.findMany({
        where: { partId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          createdBy: { select: { name: true } },
          purchase: { select: { id: true, invoiceNumber: true, vendor: { select: { name: true } } } },
          workOrderJob: { select: { id: true, displayName: true, workOrder: { select: { id: true, displayId: true } } } },
          truck: { select: { id: true, truckNumber: true } },
          reversals: { select: { id: true } },
        },
      }),
    ]);
    return {
      item: this.item(part, sum),
      movements: movements.map((movement): AdminStockMovementDto => ({
        id: movement.id,
        kind: movement.kind,
        quantity: movement.quantity.toFixed(2),
        valueCents: movement.valueCents,
        createdAt: movement.createdAt.toISOString(),
        createdBy: movement.createdBy.name,
        reason: movement.reason,
        purchase: movement.purchase ? { id: movement.purchase.id, invoiceNumber: movement.purchase.invoiceNumber, vendorName: movement.purchase.vendor.name } : null,
        job: movement.workOrderJob
          ? { id: movement.workOrderJob.id, displayName: movement.workOrderJob.displayName, workOrderId: movement.workOrderJob.workOrder.id, workOrderDisplayId: movement.workOrderJob.workOrder.displayId }
          : null,
        truck: movement.truck,
        undone: movement.reversals.length > 0,
      })),
    };
  }

  /** P25: the Manager counts the shelf. More than on hand enters at the cost typed (else the average); less leaves at the average. */
  async count(actor: AuthUser, raw: unknown) {
    const input = parse(adminStockCountSchema, raw);
    const counted = countToHundredths(input.counted);
    return this.prisma.$transaction(async (tx) => {
      const part = await tx.part.findUnique({ where: { id: input.partId }, select: { id: true, displayName: true, unitCostCents: true } });
      if (!part) throw new BadRequestException({ code: 'PART_NOT_FOUND', message: 'That part is not in the catalog.' });
      await lockPart(tx, part.id);
      const onHand = await balance(tx, part.id);
      const diff = counted - onHand.hundredths;
      if (diff === 0) throw new BadRequestException({ code: 'STOCK_COUNT_SAME', message: 'That is what the stock already says.' });
      let valueCents: number;
      if (diff > 0) {
        const unit = input.unitCostCents ?? averageCents(onHand) ?? part.unitCostCents;
        if (unit === null || unit === undefined) throw new BadRequestException({ code: 'STOCK_COST_REQUIRED', message: 'Type what each one cost.' });
        valueCents = Math.round((unit * diff) / 100);
      } else {
        valueCents = -outValue(onHand, -diff);
      }
      const movement = await writeMovement(tx, { partId: part.id, kind: 'adjust', hundredths: diff, valueCents, reason: input.reason, actorId: actor.id });
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_CATALOG_UPDATED,
        entityType: 'stock_movement',
        entityId: movement.id,
        userId: actor.id,
        newValue: { action: 'stock_counted', partId: part.id, before: qty(onHand.hundredths), counted: qty(counted), valueCents, reason: input.reason },
        relevantValue: { action: 'stock_counted', part: part.displayName, counted: qty(counted) },
      });
      return { id: movement.id, onHand: qty(counted) };
    });
  }

  /** A part leaves the stock for a Job; its average cost goes to that truck on that Work Order. */
  async issue(actor: AuthUser, raw: unknown) {
    const input = parse(adminStockIssueSchema, raw);
    const hundredths = parseQuantityToHundredths(input.quantity)!;
    return this.prisma.$transaction(async (tx) => {
      const [part, job] = await Promise.all([
        tx.part.findUnique({ where: { id: input.partId }, select: { id: true, displayName: true, partNumber: true } }),
        tx.workOrderJob.findUnique({
          where: { id: input.workOrderJobId },
          select: { id: true, displayName: true, status: true, workOrder: { select: { id: true, status: true, truckId: true } } },
        }),
      ]);
      if (!part) throw new BadRequestException({ code: 'PART_NOT_FOUND', message: 'That part is not in the catalog.' });
      if (!job) throw new BadRequestException({ code: 'JOB_NOT_FOUND', message: 'That Job does not exist.' });
      if (job.status === 'cancelled' || job.workOrder.status === 'cancelled') {
        throw new BadRequestException({ code: 'JOB_CANCELLED', message: 'That Job was cancelled.' });
      }
      const { movement, valueCents } = await this.issueInTx(tx, actor.id, { id: part.id, displayName: part.displayName, partNumber: part.partNumber }, hundredths, {
        id: job.id, displayName: job.displayName, workOrderId: job.workOrder.id, truckId: job.workOrder.truckId,
      });
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_CATALOG_UPDATED,
        entityType: 'stock_movement',
        entityId: movement.id,
        userId: actor.id,
        workOrderId: job.workOrder.id,
        newValue: { action: 'stock_issued', partId: part.id, quantity: qty(hundredths), valueCents, workOrderJobId: job.id },
        relevantValue: { action: 'stock_issued', part: part.displayName, quantity: qty(hundredths), job: job.displayName },
      });
      return { id: movement.id, valueCents };
    });
  }

  /**
   * D45 / ST-4 (LTR-224): the Manager confirms the tires the inspection proposed on a Tires Job. Steer stays New;
   * each tire must be a tire part of that type. With one on the shelf it is taken now (average cost, to this truck
   * on this Work Order); with none it is confirmed "to buy" and can be taken later the same way.
   */
  async confirmTires(actor: AuthUser, jobId: string, raw: unknown) {
    this.assertId(jobId);
    const input = parse(adminConfirmJobTiresSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      // Two confirmations at once never take two tires for the same position.
      await tx.$queryRaw`SELECT id FROM job_tire_changes WHERE work_order_job_id = ${jobId}::uuid FOR UPDATE`;
      const job = await tx.workOrderJob.findUnique({
        where: { id: jobId },
        select: {
          id: true, displayName: true, status: true,
          workOrder: { select: { id: true, status: true, truckId: true } },
          tireChanges: { include: { stockMovement: { select: { reversals: { select: { id: true } } } } } },
        },
      });
      if (!job) throw new NotFoundException('Job not found');
      if (job.status === 'cancelled' || job.workOrder.status === 'cancelled') throw new BadRequestException({ code: 'JOB_CANCELLED', message: 'That Job was cancelled.' });
      const parts = await tx.part.findMany({
        where: { id: { in: input.tires.map((tire) => tire.partId) } },
        select: { id: true, displayName: true, partNumber: true, tireType: true, active: true, category: { select: { kind: true } } },
      });
      let issued = 0;
      let toBuy = 0;
      for (const tire of input.tires) {
        const row = job.tireChanges.find((change) => change.position === tire.position);
        if (!row) throw new BadRequestException({ code: 'TIRE_NOT_PROPOSED', message: `No tire to put at ${tire.position} on this Job.` });
        if (row.confirmedAt && row.stockMovement && !row.stockMovement.reversals.length) {
          throw new ConflictException({ code: 'TIRE_ALREADY_ISSUED', message: `The ${tire.position} tire was already taken from stock.` });
        }
        if (tireAxle(tire.position as TirePosition) === 'steer' && tire.tireType !== 'new') {
          throw new BadRequestException({ code: 'STEER_NEEDS_NEW', message: 'Steer tires are always new.' });
        }
        const part = parts.find((item) => item.id === tire.partId);
        if (!part || part.category.kind !== 'tire' || part.tireType !== tire.tireType || !part.active) {
          throw new BadRequestException({ code: 'TIRE_PART_MISMATCH', message: `Pick an active ${tire.tireType === 'new' ? 'new' : 'recap'} tire from the catalog.` });
        }
        await lockPart(tx, part.id);
        const onHand = await balance(tx, part.id);
        const movement = onHand.hundredths >= 100
          ? (await this.issueInTx(tx, actor.id, part, 100, { id: job.id, displayName: `${job.displayName} ${tire.position}`, workOrderId: job.workOrder.id, truckId: job.workOrder.truckId })).movement
          : null;
        if (movement) issued += 1;
        else toBuy += 1;
        await tx.jobTireChange.update({
          where: { id: row.id },
          data: { tireType: tire.tireType, partId: part.id, stockMovementId: movement?.id ?? null, confirmedAt: new Date(), confirmedById: actor.id },
        });
      }
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_CATALOG_UPDATED,
        entityType: 'work_order_job',
        entityId: job.id,
        userId: actor.id,
        workOrderId: job.workOrder.id,
        newValue: { action: 'tires_confirmed', tires: input.tires, issued, toBuy },
        relevantValue: { action: 'tires_confirmed', job: job.displayName, issued, toBuy },
      });
      return { issued, toBuy };
    });
  }

  /**
   * Takes `hundredths` of a part off the shelf for a Job inside the caller's transaction: locks the part, refuses
   * more than is on hand, writes the movement at the average cost (P27) and the truck's cost row on that Work Order.
   * ST-4 uses it to confirm tires.
   */
  async issueInTx(
    tx: Prisma.TransactionClient,
    actorId: string,
    part: { id: string; displayName: string; partNumber: string | null },
    hundredths: number,
    job: { id: string; displayName: string; workOrderId: string; truckId: string },
  ) {
    await lockPart(tx, part.id);
    const onHand = await balance(tx, part.id);
    if (hundredths > onHand.hundredths) {
      throw new ConflictException({ code: 'NOT_ENOUGH_STOCK', message: `Only ${qty(Math.max(0, onHand.hundredths))} in stock.`, onHand: qty(Math.max(0, onHand.hundredths)) });
    }
    const valueCents = outValue(onHand, hundredths);
    const movement = await writeMovement(tx, {
      partId: part.id, kind: 'issue', hundredths: -hundredths, valueCents: -valueCents,
      workOrderJobId: job.id, truckId: job.truckId, actorId,
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

  /** "Return to stock": the part comes back at the same cost and the truck's cost is reversed. Once per issue. */
  async returnToStock(actor: AuthUser, movementId: string, raw: unknown) {
    this.assertId(movementId);
    const { reason } = parse(adminStockReturnSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.stockMovement.findUnique({
        where: { id: movementId },
        include: { reversals: { select: { id: true } }, part: { select: { displayName: true } }, workOrderJob: { select: { displayName: true, workOrderId: true } } },
      });
      if (!issue || issue.kind !== 'issue') throw new NotFoundException('That part did not leave the stock.');
      if (issue.reversals.length) throw new ConflictException({ code: 'STOCK_ALREADY_RETURNED', message: 'That part is already back in stock.' });
      await lockPart(tx, issue.partId);
      let movement;
      try {
        movement = await writeMovement(tx, {
          partId: issue.partId, kind: 'return', hundredths: -toHundredths(issue.quantity), valueCents: -issue.valueCents,
          workOrderJobId: issue.workOrderJobId, truckId: issue.truckId, reversesId: issue.id, reason, actorId: actor.id,
        });
      } catch (error) {
        // Two returns at once: the unique index on reverses_id lets only one through.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException({ code: 'STOCK_ALREADY_RETURNED', message: 'That part is already back in stock.' });
        }
        throw error;
      }
      await reverseSource(tx, { sourceType: ISSUE_SOURCE, sourceId: issue.id }, actor.id);
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_CATALOG_UPDATED,
        entityType: 'stock_movement',
        entityId: movement.id,
        userId: actor.id,
        workOrderId: issue.workOrderJob?.workOrderId ?? undefined,
        newValue: { action: 'stock_returned', issueId: issue.id, quantity: issue.quantity.abs().toFixed(2), reason },
        relevantValue: { action: 'stock_returned', part: issue.part.displayName, job: issue.workOrderJob?.displayName ?? null },
      });
      return { id: movement.id };
    });
  }

  private item(part: PartRow, sum?: { _sum: { quantity: Prisma.Decimal | null; valueCents: number | null }; _max: { createdAt: Date | null } }): AdminStockItemDto {
    const onHand = { hundredths: toHundredths(sum?._sum.quantity ?? 0), valueCents: sum?._sum.valueCents ?? 0 };
    return {
      partId: part.id,
      displayName: part.displayName,
      partNumber: part.partNumber,
      categoryName: part.category.name,
      kind: part.category.kind,
      tireSize: part.tireSize,
      tireType: part.tireType,
      active: part.active,
      onHand: fromHundredths(onHand.hundredths).toFixed(2),
      avgCostCents: averageCents(onHand),
      valueCents: onHand.valueCents,
      minStock: part.minStock,
      low: part.minStock !== null && onHand.hundredths < part.minStock * 100,
      lastMovementAt: sum?._max.createdAt ? sum._max.createdAt.toISOString() : null,
    };
  }

  private assertId(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Invalid id');
  }
}
