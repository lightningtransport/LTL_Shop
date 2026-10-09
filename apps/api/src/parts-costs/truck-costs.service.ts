import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { adminTruckCostsQuerySchema, type AdminTruckCostEntryDto, type AdminTruckCostsDto } from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

/**
 * LTR-200 / D32 (PC-4): Truck → Costs only reads the ledger (`truck_cost_entries`): totals by kind and by month in
 * the period (by invoice date), and every row, reversals included, so a void or an edit lowers the totals. Labor hours
 * are the closed sessions of the truck's Work Orders that started in the period (D18, D21); the labor amount is the
 * ledger's `labor` rows (D34, written when a Work Order is completed).
 */
@Injectable()
export class TruckCostsService {
  constructor(private readonly prisma: PrismaService) {}

  async costs(truckId: string, raw: unknown): Promise<AdminTruckCostsDto> {
    if (!UUID.test(truckId)) throw new BadRequestException('Invalid Truck id');
    const parsed = adminTruckCostsQuerySchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { from, to } = parsed.data;
    const truck = await this.prisma.truck.findUnique({ where: { id: truckId }, select: { id: true, truckNumber: true } });
    if (!truck) throw new NotFoundException('Truck not found');

    const period: Prisma.DateTimeFilter | undefined = from || to ? { ...(from ? { gte: asDate(from) } : {}), ...(to ? { lte: asDate(to) } : {}) } : undefined;
    const [rows, sessions] = await Promise.all([
      this.prisma.truckCostEntry.findMany({
        where: { truckId, ...(period ? { occurredOn: period } : {}) },
        include: { workOrder: { select: { id: true, displayId: true } } },
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.workSession.findMany({
        where: {
          endedAt: { not: null },
          workOrder: { truckId },
          ...(from || to ? { startedAt: { ...(from ? { gte: asDate(from) } : {}), ...(to ? { lt: new Date(asDate(to).getTime() + 24 * 60 * 60 * 1000) } : {}) } } : {}),
        },
        select: { startedAt: true, endedAt: true },
      }),
    ]);

    const voided = await this.voidedSources(rows);
    const months = new Map<string, { partsCents: number; outsideCents: number; laborCents: number }>();
    let partsCents = 0;
    let outsideCents = 0;
    let laborCents = 0;
    for (const row of rows) {
      const month = dateOnly(row.occurredOn).slice(0, 7);
      const bucket = months.get(month) ?? { partsCents: 0, outsideCents: 0, laborCents: 0 };
      if (row.kind === 'part_purchase') { partsCents += row.amountCents; bucket.partsCents += row.amountCents; }
      if (row.kind === 'outside_repair') { outsideCents += row.amountCents; bucket.outsideCents += row.amountCents; }
      // LTR-201 / D34: labor of completed Work Orders (hours × the shop rate).
      if (row.kind === 'labor') { laborCents += row.amountCents; bucket.laborCents += row.amountCents; }
      months.set(month, bucket);
    }
    const laborRateSet = (await this.prisma.laborRate.count()) > 0;
    const minutes = sessions.reduce((sum, session) => sum + Math.max(0, session.endedAt!.getTime() - session.startedAt.getTime()) / 60_000, 0);

    return {
      truck,
      from: from ?? null,
      to: to ?? null,
      totals: { partsCents, outsideCents, laborCents, totalCents: partsCents + outsideCents + laborCents },
      months: [...months.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, value]) => ({ month, ...value })),
      entries: rows.map((row): AdminTruckCostEntryDto => ({
        id: row.id,
        occurredOn: dateOnly(row.occurredOn),
        kind: row.kind,
        amountCents: row.amountCents,
        description: row.description,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        workOrder: row.workOrder,
        reversal: row.reversesEntryId ? (voided.has(row.sourceId) ? 'voided' : 'corrected') : null,
      })),
      laborHours: Math.round((minutes / 60) * 100) / 100,
      laborRateSet,
    };
  }

  /** Purchases and outside repairs of these rows that are voided. */
  private async voidedSources(rows: Array<{ sourceType: string; sourceId: string; reversesEntryId: string | null }>) {
    const reversed = rows.filter((row) => row.reversesEntryId);
    const ids = (type: string) => [...new Set(reversed.filter((row) => row.sourceType === type).map((row) => row.sourceId))];
    const [purchases, repairs] = await Promise.all([
      ids('part_purchase').length ? this.prisma.partPurchase.findMany({ where: { id: { in: ids('part_purchase') }, voidedAt: { not: null } }, select: { id: true } }) : [],
      ids('outside_repair').length ? this.prisma.outsideRepair.findMany({ where: { id: { in: ids('outside_repair') }, voidedAt: { not: null } }, select: { id: true } }) : [],
    ]);
    return new Set([...purchases, ...repairs].map((row) => row.id));
  }
}
