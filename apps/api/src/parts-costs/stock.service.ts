import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  adminConfirmJobTiresSchema,
  adminStockAddSchema,
  adminStockCountBatchSchema,
  adminStockCountSchema,
  adminStockIssueSchema,
  adminStockQuerySchema,
  adminStockRemoveSchema,
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
import { averageCents, balance, fromHundredths, issueToJob, lockPart, outValue, toHundredths, undoIssue, writeMovement } from './stock-ledger';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parse<T>(schema: { safeParse(raw: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

const qty = (hundredths: number) => (hundredths / 100).toFixed(2);
const inStock = (item: AdminStockItemDto) => Number(item.onHand) > 0;
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
          // A part shows once it has movements, or a minimum to watch. D47 / HU-M20: with `all`, every active part
          // shows too (Parts is the inventory), with 0 on hand when it never moved.
          OR: [{ stockMovements: { some: {} } }, { minStock: { not: null }, active: true }, ...(query.all ? [{ active: true }] : [])],
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
      // D47 / HU-M20: Low first, then what is on the shelf, then the rest.
      .sort((left, right) => Number(right.low) - Number(left.low) || (query.all ? Number(inStock(right)) - Number(inStock(left)) : 0) || left.categoryName.localeCompare(right.categoryName) || left.displayName.localeCompare(right.displayName));
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
        reasonCode: movement.reasonCode,
        purchase: movement.purchase ? { id: movement.purchase.id, invoiceNumber: movement.purchase.invoiceNumber, vendorName: movement.purchase.vendor.name } : null,
        job: movement.workOrderJob
          ? { id: movement.workOrderJob.id, displayName: movement.workOrderJob.displayName, workOrderId: movement.workOrderJob.workOrder.id, workOrderDisplayId: movement.workOrderJob.workOrder.displayId }
          : null,
        truck: movement.truck,
        undone: movement.reversals.length > 0,
      })),
    };
  }

  /** P25: the Manager counts one part on the shelf. More than on hand enters at the cost typed (else the average); less leaves at the average. */
  async count(actor: AuthUser, raw: unknown) {
    const input = parse(adminStockCountSchema, raw);
    const counted = countToHundredths(input.counted);
    return this.prisma.$transaction(async (tx) => {
      const part = await this.findPart(tx, input.partId);
      const result = await this.adjustTo(tx, actor, part, counted, input.unitCostCents ?? null, input.reason);
      if (result === 'same') throw new BadRequestException({ code: 'STOCK_COUNT_SAME', message: 'That is what the stock already says.' });
      if (result === 'cost') throw new BadRequestException({ code: 'STOCK_COST_REQUIRED', message: 'Type what each one cost.', partIds: [part.id] });
      return { id: result.id, onHand: qty(counted) };
    });
  }

  /**
   * D47 / HU-M20 (LTR-246): Count stock in bulk, the first day and each count. Lines with no count or the same number
   * are left alone. All or nothing: if a part goes up with no cost to use (typed, average or reference), nothing is
   * saved and the answer names those parts.
   */
  async countBatch(actor: AuthUser, raw: unknown) {
    const input = parse(adminStockCountBatchSchema, raw);
    const lines = input.lines.filter((line) => line.counted !== undefined && line.counted !== null && line.counted !== '');
    return this.prisma.$transaction(async (tx) => {
      const missing: string[] = [];
      let changed = 0;
      for (const line of lines) {
        const part = await this.findPart(tx, line.partId);
        const result = await this.adjustTo(tx, actor, part, countToHundredths(line.counted as string | number), line.unitCostCents ?? null, input.note || null);
        if (result === 'cost') missing.push(part.id);
        else if (result !== 'same') changed += 1;
      }
      // Throwing rolls back every line already written.
      if (missing.length) throw new BadRequestException({ code: 'STOCK_COST_REQUIRED', message: 'Type what each one cost for the parts that go up.', partIds: missing });
      return { changed };
    });
  }

  /** D47 / HU-M20 (LTR-246): parts that came in without an invoice, at the cost typed. */
  async add(actor: AuthUser, raw: unknown) {
    const input = parse(adminStockAddSchema, raw);
    const hundredths = parseQuantityToHundredths(input.quantity)!;
    return this.prisma.$transaction(async (tx) => {
      const part = await this.findPart(tx, input.partId);
      await lockPart(tx, part.id);
      const valueCents = Math.round((input.unitCostCents * hundredths) / 100);
      const movement = await writeMovement(tx, { partId: part.id, kind: 'adjust', hundredths, valueCents, reason: input.note || null, reasonCode: 'received', actorId: actor.id });
      await this.logAdjust(tx, actor, movement.id, part, 'stock_added', { quantity: qty(hundredths), valueCents, note: input.note ?? null });
      return { id: movement.id, onHand: qty((await balance(tx, part.id)).hundredths) };
    });
  }

  /** D47 / HU-M20 (LTR-246): how many leave and why (Damaged, Lost, Other), at the average cost. No truck is charged. */
  async remove(actor: AuthUser, raw: unknown) {
    const input = parse(adminStockRemoveSchema, raw);
    const hundredths = parseQuantityToHundredths(input.quantity)!;
    return this.prisma.$transaction(async (tx) => {
      const part = await this.findPart(tx, input.partId);
      await lockPart(tx, part.id);
      const onHand = await balance(tx, part.id);
      if (hundredths > onHand.hundredths) {
        throw new ConflictException({ code: 'NOT_ENOUGH_STOCK', message: `Only ${qty(Math.max(0, onHand.hundredths))} in stock.`, onHand: qty(Math.max(0, onHand.hundredths)) });
      }
      const valueCents = outValue(onHand, hundredths);
      const movement = await writeMovement(tx, { partId: part.id, kind: 'adjust', hundredths: -hundredths, valueCents: -valueCents, reason: input.note || null, reasonCode: input.reason, actorId: actor.id });
      await this.logAdjust(tx, actor, movement.id, part, 'stock_removed', { quantity: qty(hundredths), valueCents: -valueCents, reason: input.reason, note: input.note ?? null });
      return { id: movement.id, onHand: qty(onHand.hundredths - hundredths) };
    });
  }

  private async findPart(tx: Prisma.TransactionClient, partId: string) {
    const part = await tx.part.findUnique({ where: { id: partId }, select: { id: true, displayName: true, unitCostCents: true } });
    if (!part) throw new BadRequestException({ code: 'PART_NOT_FOUND', message: 'That part is not in the catalog.' });
    return part;
  }

  /** Sets a part's shelf to `counted` (reason Count). 'same' when nothing changes; 'cost' when it goes up with no cost to use. */
  private async adjustTo(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    part: { id: string; displayName: string; unitCostCents: number | null },
    counted: number,
    unitCostCents: number | null,
    reason: string | null,
  ) {
    await lockPart(tx, part.id);
    const onHand = await balance(tx, part.id);
    const diff = counted - onHand.hundredths;
    if (diff === 0) return 'same' as const;
    let valueCents: number;
    if (diff > 0) {
      const unit = unitCostCents ?? averageCents(onHand) ?? part.unitCostCents;
      if (unit === null || unit === undefined) return 'cost' as const;
      valueCents = Math.round((unit * diff) / 100);
    } else {
      valueCents = -outValue(onHand, -diff);
    }
    const movement = await writeMovement(tx, { partId: part.id, kind: 'adjust', hundredths: diff, valueCents, reason, reasonCode: 'count', actorId: actor.id });
    await this.activity.log(tx, {
      eventType: ActivityEventType.PART_CATALOG_UPDATED,
      entityType: 'stock_movement',
      entityId: movement.id,
      userId: actor.id,
      newValue: { action: 'stock_counted', partId: part.id, before: qty(onHand.hundredths), counted: qty(counted), valueCents, reason },
      relevantValue: { action: 'stock_counted', part: part.displayName, counted: qty(counted) },
    });
    return movement;
  }

  private async logAdjust(tx: Prisma.TransactionClient, actor: AuthUser, movementId: string, part: { id: string; displayName: string }, action: string, detail: Record<string, unknown>) {
    await this.activity.log(tx, {
      eventType: ActivityEventType.PART_CATALOG_UPDATED,
      entityType: 'stock_movement',
      entityId: movementId,
      userId: actor.id,
      newValue: { action, partId: part.id, ...detail },
      relevantValue: { action, part: part.displayName, quantity: detail.quantity },
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

  /** ST-3 / ST-4: see `issueToJob`. */
  issueInTx(
    tx: Prisma.TransactionClient,
    actorId: string,
    part: { id: string; displayName: string; partNumber: string | null },
    hundredths: number,
    job: { id: string; displayName: string; workOrderId: string; truckId: string },
  ) {
    return issueToJob(tx, actorId, part, hundredths, job);
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
      const movement = await undoIssue(tx, issue, actor.id, reason);
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
