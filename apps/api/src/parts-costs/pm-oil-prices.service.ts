import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ActivityEventType, adminSetPmOilPriceSchema, type AdminPmOilPriceDto, type AdminPmOilPricesDto } from '@ltl-shop/shared';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

/**
 * D45 / ST-5 (LTR-225): the flat price a PM's oil change costs the truck. A new price starts today or later (one a
 * day); PMs completed before it keep the price they had, so nothing already charged is recalculated.
 */
@Injectable()
export class PmOilPricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(): Promise<AdminPmOilPricesDto> {
    const rows = await this.prisma.pmOilPrice.findMany({ include: { createdBy: { select: { name: true } } }, orderBy: { effectiveFrom: 'desc' } });
    const today = dateOnly(new Date());
    const prices = rows.map((row): AdminPmOilPriceDto => ({
      id: row.id,
      amountCents: row.amountCents,
      effectiveFrom: dateOnly(row.effectiveFrom),
      createdBy: row.createdBy?.name ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
    return { prices, current: prices.find((price) => price.effectiveFrom <= today) ?? null };
  }

  async set(actor: AuthUser, raw: unknown) {
    const parsed = adminSetPmOilPriceSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    if (input.effectiveFrom < dateOnly(new Date())) {
      throw new BadRequestException({ code: 'PM_OIL_PRICE_PAST', message: 'A new price starts today or later.' });
    }
    const effectiveFrom = new Date(`${input.effectiveFrom}T00:00:00.000Z`);
    if (await this.prisma.pmOilPrice.findUnique({ where: { effectiveFrom }, select: { id: true } })) {
      throw new ConflictException({ code: 'PM_OIL_PRICE_DATE_TAKEN', message: 'There is already a price from that date.' });
    }
    return this.prisma.$transaction(async (tx) => {
      const price = await tx.pmOilPrice.create({ data: { amountCents: input.amountCents, effectiveFrom, createdById: actor.id } });
      await this.activity.log(tx, {
        eventType: ActivityEventType.LABOR_RATE_SAVED,
        entityType: 'pm_oil_price',
        entityId: price.id,
        userId: actor.id,
        newValue: { amountCents: price.amountCents, effectiveFrom: input.effectiveFrom },
        relevantValue: { action: 'pm_oil_price_set', amountCents: price.amountCents, effectiveFrom: input.effectiveFrom },
      });
      return { id: price.id };
    });
  }
}
