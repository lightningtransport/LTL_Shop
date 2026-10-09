import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ActivityEventType, adminSetLaborRateSchema, type AdminLaborRateDto, type AdminLaborRatesDto } from '@ltl-shop/shared';
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
    const rates = rows.map((row) => this.toDto(row));
    return { rates, current: rates.find((rate) => rate.effectiveFrom <= today) ?? null };
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

  private toDto(row: RateRow): AdminLaborRateDto {
    return {
      id: row.id,
      rateCentsPerHour: row.rateCentsPerHour,
      effectiveFrom: dateOnly(row.effectiveFrom),
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
