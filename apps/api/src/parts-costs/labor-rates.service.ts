import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityEventType, adminLaborRatePreviewQuerySchema, adminSetLaborRateSchema, type AdminLaborRateDto, type AdminLaborRatePreviewDto, type AdminLaborRatesDto } from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { syncWorkOrderLabor } from './labor-ledger';

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const rateInclude = { createdBy: { select: { id: true, name: true } } } satisfies Prisma.LaborRateInclude;
type RateRow = Prisma.LaborRateGetPayload<{ include: typeof rateInclude }>;

/**
 * LTR-201 / D34 (LB-1): the shop's labor rate. A new rate starts on a date; one already on that date is refused
 * (one rate a day). Setting it re-computes the labor of the completed Work Orders that have sessions from that date
 * on, with reversals in the ledger, so the trucks' costs follow the rate in effect when the work was done.
 */
@Injectable()
export class LaborRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(): Promise<AdminLaborRatesDto> {
    const rows = await this.prisma.laborRate.findMany({ include: rateInclude, orderBy: { effectiveFrom: 'desc' } });
    const today = dateOnly(new Date());
    // PCA7 (UX-10-005): the latest rate can be taken back while no sent invoice charges labor priced with it.
    const latestDeletable = rows[0] ? (await this.affected(this.prisma, rows[0].effectiveFrom)).invoiced === 0 : false;
    const rates = rows.map((row, index) => this.toDto(row, index === 0 && latestDeletable));
    return { rates, current: rates.find((rate) => rate.effectiveFrom <= today) ?? null };
  }

  /** PCA7 (UX-10-005): what a rate from that date would recalculate, said before saving it. */
  async preview(raw: unknown): Promise<AdminLaborRatePreviewDto> {
    const parsed = adminLaborRatePreviewQuerySchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { workOrders, invoiced } = await this.affected(this.prisma, asDate(parsed.data.effectiveFrom));
    return { workOrders: workOrders.length, invoiced };
  }

  /**
   * PCA7 (UX-10-005): a mistyped rate can be taken back. Only the latest one, and only while no sent or accepted
   * internal invoice charges labor priced with it; the Work Orders it priced are recalculated with reversals.
   */
  async remove(actor: AuthUser, id: string) {
    const rate = await this.prisma.laborRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException('Rate not found');
    const latest = await this.prisma.laborRate.findFirst({ orderBy: { effectiveFrom: 'desc' }, select: { id: true } });
    if (latest?.id !== rate.id) throw new ConflictException({ code: 'LABOR_RATE_NOT_LATEST', message: 'Only the latest rate can be removed.' });
    return this.prisma.$transaction(async (tx) => {
      const { workOrders, invoiced } = await this.affected(tx, rate.effectiveFrom);
      if (invoiced) throw new ConflictException({ code: 'LABOR_RATE_IN_USE', message: 'Labor priced with this rate is already on a sent invoice. Set a new rate from another date instead.' });
      await tx.laborRate.delete({ where: { id } });
      await this.activity.log(tx, {
        eventType: ActivityEventType.LABOR_RATE_SAVED,
        entityType: 'labor_rate',
        entityId: id,
        userId: actor.id,
        previousValue: { rateCentsPerHour: rate.rateCentsPerHour, effectiveFrom: dateOnly(rate.effectiveFrom) },
        relevantValue: { action: 'labor_rate_removed', rateCentsPerHour: rate.rateCentsPerHour, effectiveFrom: dateOnly(rate.effectiveFrom) },
      });
      for (const workOrder of workOrders) await syncWorkOrderLabor(tx, workOrder.id, actor.id);
      return { id, recalculatedWorkOrders: workOrders.length };
    }, { timeout: 60_000 });
  }

  /** The completed Work Orders with closed work from the date, and how many of them have their labor on a sent invoice. */
  private async affected(db: Prisma.TransactionClient | PrismaService, effectiveFrom: Date) {
    const workOrders = await db.workOrder.findMany({
      where: { status: 'completed', sessions: { some: { endedAt: { not: null }, startedAt: { gte: effectiveFrom } } } },
      select: { id: true },
    });
    if (!workOrders.length) return { workOrders, invoiced: 0 };
    const lines = await db.internalInvoiceLine.findMany({
      where: {
        active: true,
        invoice: { status: { in: ['sent', 'accepted'] } },
        costEntry: { sourceType: 'work_order_labor', sourceId: { in: workOrders.map((row) => row.id) }, reversesEntryId: null },
      },
      select: { costEntry: { select: { sourceId: true } } },
    });
    return { workOrders, invoiced: new Set(lines.map((line) => line.costEntry.sourceId)).size };
  }

  async set(actor: AuthUser, raw: unknown) {
    const parsed = adminSetLaborRateSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const effectiveFrom = asDate(input.effectiveFrom);
    if (await this.prisma.laborRate.findUnique({ where: { effectiveFrom }, select: { id: true } })) {
      throw new ConflictException({ code: 'LABOR_RATE_DATE_TAKEN', message: 'There is already a rate from that date.' });
    }
    return this.prisma.$transaction(async (tx) => {
      const rate = await tx.laborRate.create({
        data: { rateCentsPerHour: input.rateCentsPerHour, effectiveFrom, notes: input.notes ?? null, createdById: actor.id },
      });
      await this.activity.log(tx, {
        eventType: ActivityEventType.LABOR_RATE_SAVED,
        entityType: 'labor_rate',
        entityId: rate.id,
        userId: actor.id,
        newValue: { rateCentsPerHour: rate.rateCentsPerHour, effectiveFrom: input.effectiveFrom },
        relevantValue: { action: 'labor_rate_set', rateCentsPerHour: rate.rateCentsPerHour, effectiveFrom: input.effectiveFrom },
      });
      // The completed Work Orders with work on or after that date may now be priced differently.
      const affected = await tx.workOrder.findMany({
        where: { status: 'completed', sessions: { some: { endedAt: { not: null }, startedAt: { gte: effectiveFrom } } } },
        select: { id: true },
      });
      for (const workOrder of affected) await syncWorkOrderLabor(tx, workOrder.id, actor.id);
      return { id: rate.id, recalculatedWorkOrders: affected.length };
    }, { timeout: 60_000 });
  }

  private toDto(row: RateRow, deletable = false): AdminLaborRateDto {
    return {
      id: row.id,
      rateCentsPerHour: row.rateCentsPerHour,
      effectiveFrom: dateOnly(row.effectiveFrom),
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      deletable,
    };
  }
}
