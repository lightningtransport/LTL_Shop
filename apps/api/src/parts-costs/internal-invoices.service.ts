import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  adminCreateInternalInvoiceSchema,
  adminInternalInvoicesQuerySchema,
  adminInvoiceMonthSchema,
  adminVoidSchema,
  type AdminInternalInvoiceDetailDto,
  type AdminInvoiceMonthDto,
  type AdminInvoiceMonthRowDto,
  type AdminInternalInvoiceLineDto,
  type AdminInternalInvoiceSummaryDto,
} from '@ltl-shop/shared';
import type { InternalInvoiceStatus, Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

function parse<T>(schema: { safeParse(raw: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

const lineInclude = { costEntry: { select: { sourceType: true, sourceId: true, reversesEntryId: true, workOrder: { select: { id: true, displayId: true } } } } } satisfies Prisma.InternalInvoiceLineInclude;
const invoiceInclude = {
  truck: { select: { id: true, truckNumber: true } },
  lines: { include: lineInclude, orderBy: [{ kind: 'asc' }, { occurredOn: 'asc' }] },
  createdBy: { select: { id: true, name: true } },
  sentBy: { select: { id: true, name: true } },
  acceptedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} satisfies Prisma.InternalInvoiceInclude;
type InvoiceRow = Prisma.InternalInvoiceGetPayload<{ include: typeof invoiceInclude }>;
type Db = Prisma.TransactionClient | PrismaService;

/**
 * LTR-201 / D34 (LB-2): the internal invoice to Finance, one per truck and month.
 * - A **draft** takes the truck's ledger rows up to the end of the month that no other invoice charges (so a correction
 *   made after an invoice was sent lands on the next one). A row and its reversal, both uncharged, cancel out and stay
 *   off. Lines can be taken off (they stay uncharged, for a later invoice) and put back.
 * - **Send** gives it its number (SHOP-2026-0001) and freezes it; the Manager downloads the PDF and gives it to Finance.
 * - **Accepted** records that Finance took it. **Void** frees its rows for another invoice; the number is not reused.
 */
@Injectable()
export class InternalInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(raw: unknown): Promise<AdminInternalInvoiceSummaryDto[]> {
    const query = parse(adminInternalInvoicesQuerySchema, raw);
    const rows = await this.prisma.internalInvoice.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.truckId ? { truckId: query.truckId } : {}),
        // PCA14 (UX-5-009): one month.
        ...(query.month ? { periodStart: new Date(`${query.month}-01T00:00:00.000Z`) } : {}),
      },
      include: invoiceInclude,
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
    return rows.map((row) => this.summary(row));
  }

  async detail(id: string): Promise<AdminInternalInvoiceDetailDto> {
    const row = await this.row(this.prisma, id);
    const available = row.status === 'draft' ? (await this.available(this.prisma, row.truckId, row.periodEnd, row.id)).length : 0;
    const active = row.lines.filter((line) => line.active);
    // PCA4 (UX-10-002): a reversal line says which earlier invoice charged the row it cancels.
    const reversed = row.lines.map((line) => line.costEntry.reversesEntryId).filter((value): value is string => Boolean(value));
    const corrects = new Map<string, { id: string; number: string | null }>();
    if (reversed.length) {
      const earlier = await this.prisma.internalInvoiceLine.findMany({
        where: { costEntryId: { in: reversed }, active: true, invoiceId: { not: row.id }, invoice: { status: { not: 'void' } } },
        select: { costEntryId: true, invoice: { select: { id: true, number: true } } },
      });
      for (const line of earlier) corrects.set(line.costEntryId, line.invoice);
    }
    return {
      ...this.summary(row),
      subtotals: { partsCents: row.subtotalPartsCents, outsideCents: row.subtotalOutsideCents, laborCents: row.subtotalLaborCents },
      lines: active.map((line) => this.line(line, corrects)),
      removedLines: row.status === 'draft' ? row.lines.filter((line) => !line.active).map((line) => this.line(line, corrects)) : [],
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      sentBy: row.sentBy,
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      acceptedBy: row.acceptedBy,
      voidedAt: row.voidedAt?.toISOString() ?? null,
      voidedBy: row.voidedBy,
      voidReason: row.voidReason,
      availableCount: available,
    };
  }

  /**
   * PCA16 (D37, P15): the month's close as one screen. Every truck with something uncharged up to the end of the
   * month, or with an invoice for that month, with what it has and what it got. The invoice stays per truck.
   */
  async month(raw: unknown): Promise<AdminInvoiceMonthDto> {
    const { month } = parse(adminInvoiceMonthSchema, raw);
    const [year, monthNumber] = month.split('-').map(Number);
    const periodStart = new Date(Date.UTC(year, monthNumber - 1, 1));
    const periodEnd = new Date(Date.UTC(year, monthNumber, 0));
    const [trucks, invoices, rows] = await Promise.all([
      this.prisma.truck.findMany({ select: { id: true, truckNumber: true }, orderBy: { truckNumber: 'asc' } }),
      this.prisma.internalInvoice.findMany({ where: { periodStart }, include: invoiceInclude, orderBy: { createdAt: 'desc' } }),
      this.prisma.truckCostEntry.findMany({
        where: { occurredOn: { lte: periodEnd }, kind: { in: ['part_purchase', 'outside_repair', 'labor'] }, invoiceLines: { none: { active: true } } },
        select: { id: true, truckId: true, amountCents: true, reversesEntryId: true },
      }),
    ]);
    // A row and its reversal, both uncharged, cancel out (same rule as `available`).
    const ids = new Set(rows.map((row) => row.id));
    const netted = new Set<string>();
    for (const row of rows) {
      if (row.reversesEntryId && ids.has(row.reversesEntryId)) {
        netted.add(row.id);
        netted.add(row.reversesEntryId);
      }
    }
    const uncharged = new Map<string, { count: number; totalCents: number }>();
    for (const row of rows) {
      if (netted.has(row.id)) continue;
      const bucket = uncharged.get(row.truckId) ?? { count: 0, totalCents: 0 };
      bucket.count += 1;
      bucket.totalCents += row.amountCents;
      uncharged.set(row.truckId, bucket);
    }
    const invoiceByTruck = new Map<string, InvoiceRow>();
    for (const invoice of invoices) {
      const current = invoiceByTruck.get(invoice.truckId);
      if (!current || (current.status === 'void' && invoice.status !== 'void')) invoiceByTruck.set(invoice.truckId, invoice);
    }
    const result: AdminInvoiceMonthRowDto[] = [];
    for (const truck of trucks) {
      const invoice = invoiceByTruck.get(truck.id) ?? null;
      const open = uncharged.get(truck.id) ?? { count: 0, totalCents: 0 };
      if (!invoice && open.count === 0) continue;
      result.push({ truck, invoice: invoice ? this.summary(invoice) : null, uncharged: open });
    }
    return {
      month,
      periodStart: dateOnly(periodStart),
      periodEnd: dateOnly(periodEnd),
      rows: result,
      totals: {
        trucksToCharge: result.filter((row) => row.uncharged.count > 0 && (!row.invoice || row.invoice.status === 'void')).length,
        unchargedCents: result.reduce((sum, row) => sum + row.uncharged.totalCents, 0),
        invoicedCents: result.reduce((sum, row) => sum + (row.invoice && row.invoice.status !== 'void' ? row.invoice.totalCents : 0), 0),
      },
    };
  }

  /** PCA16: a draft for every truck that has something to charge and no live invoice for the month yet. */
  async createAll(actor: AuthUser, raw: unknown) {
    const { month } = parse(adminInvoiceMonthSchema, raw);
    const view = await this.month({ month });
    const ids: string[] = [];
    let skipped = 0;
    for (const row of view.rows) {
      if (row.uncharged.count === 0 || (row.invoice && row.invoice.status !== 'void')) { skipped += 1; continue; }
      try {
        ids.push((await this.create(actor, { truckId: row.truck.id, month })).id);
      } catch (error) {
        // Someone made that truck's draft meanwhile: it counts as already there.
        if (error instanceof ConflictException || error instanceof BadRequestException) skipped += 1;
        else throw error;
      }
    }
    return { created: ids.length, skipped, ids };
  }

  async create(actor: AuthUser, raw: unknown) {
    const input = parse(adminCreateInternalInvoiceSchema, raw);
    const [year, month] = input.month.split('-').map(Number);
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));
    const truck = await this.prisma.truck.findUnique({ where: { id: input.truckId }, select: { id: true } });
    if (!truck) throw new BadRequestException({ code: 'TRUCK_NOT_FOUND', message: 'That truck does not exist.' });
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`internal-invoice:${truck.id}`}))`;
      const draft = await tx.internalInvoice.findFirst({ where: { truckId: truck.id, periodStart, status: 'draft' }, select: { id: true } });
      if (draft) throw new ConflictException({ code: 'INTERNAL_INVOICE_DRAFT_EXISTS', message: 'There is already a draft for this truck and month.', id: draft.id });
      const entries = await this.available(tx, truck.id, periodEnd);
      if (!entries.length) throw new BadRequestException({ code: 'NOTHING_TO_CHARGE', message: 'This truck has nothing left to charge up to the end of that month.' });
      const invoice = await tx.internalInvoice.create({
        data: {
          truckId: truck.id,
          periodStart,
          periodEnd,
          notes: input.notes ?? null,
          createdById: actor.id,
          lines: { create: entries.map((entry) => ({ costEntryId: entry.id, kind: entry.kind, description: entry.description, occurredOn: entry.occurredOn, amountCents: entry.amountCents })) },
        },
      });
      await this.recompute(tx, invoice.id);
      return { id: invoice.id };
    });
  }

  /** Draft: brings in what became chargeable since (a new purchase, a correction), skipping lines taken off. */
  async refresh(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.draft(tx, id);
      const entries = await this.available(tx, row.truckId, row.periodEnd, row.id);
      if (entries.length) {
        await tx.internalInvoiceLine.createMany({
          data: entries.map((entry) => ({ invoiceId: row.id, costEntryId: entry.id, kind: entry.kind, description: entry.description, occurredOn: entry.occurredOn, amountCents: entry.amountCents })),
        });
      }
      await this.recompute(tx, row.id);
      return { id: row.id, added: entries.length };
    });
  }

  /** Draft: take a line off (it stays uncharged for a later invoice) or put it back. */
  async setLine(id: string, lineId: string, active: boolean) {
    if (!UUID.test(lineId)) throw new BadRequestException('Invalid line id');
    return this.prisma.$transaction(async (tx) => {
      const row = await this.draft(tx, id);
      const line = row.lines.find((item) => item.id === lineId);
      if (!line) throw new NotFoundException('Line not found');
      if (active && await tx.internalInvoiceLine.count({ where: { costEntryId: line.costEntryId, active: true } })) {
        throw new ConflictException({ code: 'LINE_ALREADY_CHARGED', message: 'That movement is already on another invoice.' });
      }
      await tx.internalInvoiceLine.update({ where: { id: lineId }, data: { active } });
      await this.recompute(tx, row.id);
      return { id: row.id };
    });
  }

  async send(actor: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      // PCA15: the lock comes first, so two sends of the same draft at the same moment cannot both pass the draft check
      // and number it twice.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('internal-invoice-number'))`;
      const row = await this.draft(tx, id);
      if (!row.lines.some((line) => line.active)) throw new BadRequestException({ code: 'INVOICE_EMPTY', message: 'Put at least one line on the invoice before sending it.' });
      const year = new Date().getUTCFullYear();
      const last = await tx.internalInvoice.findFirst({ where: { number: { startsWith: `SHOP-${year}-` } }, orderBy: { number: 'desc' }, select: { number: true } });
      const next = (last?.number ? Number(last.number.slice(-4)) : 0) + 1;
      const number = `SHOP-${year}-${String(next).padStart(4, '0')}`;
      const totals = await this.recompute(tx, row.id);
      await tx.internalInvoice.update({ where: { id: row.id }, data: { status: 'sent', number, sentAt: new Date(), sentById: actor.id } });
      await this.log(tx, actor, row.id, ActivityEventType.INTERNAL_INVOICE_SENT, { action: 'internal_invoice_sent', number, totalCents: totals.totalCents });
      return { id: row.id, number };
    });
  }

  async accept(actor: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.row(tx, id);
      if (row.status !== 'sent') throw new ConflictException({ code: 'INVOICE_NOT_SENT', message: 'Only a sent invoice can be marked accepted.' });
      await tx.internalInvoice.update({ where: { id }, data: { status: 'accepted', acceptedAt: new Date(), acceptedById: actor.id } });
      await this.log(tx, actor, id, ActivityEventType.INTERNAL_INVOICE_ACCEPTED, { action: 'internal_invoice_accepted', number: row.number });
      return { id };
    });
  }

  async void(actor: AuthUser, id: string, raw: unknown) {
    const { reason } = parse(adminVoidSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.row(tx, id);
      if (row.status !== 'sent' && row.status !== 'accepted') throw new ConflictException({ code: 'INVOICE_NOT_SENT', message: 'A draft is deleted, not voided.' });
      await tx.internalInvoiceLine.updateMany({ where: { invoiceId: id }, data: { active: false } });
      await tx.internalInvoice.update({ where: { id }, data: { status: 'void', voidedAt: new Date(), voidedById: actor.id, voidReason: reason } });
      await this.log(tx, actor, id, ActivityEventType.INTERNAL_INVOICE_VOIDED, { action: 'internal_invoice_voided', number: row.number, reason });
      return { id };
    });
  }

  async deleteDraft(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.draft(tx, id);
      await tx.internalInvoice.delete({ where: { id: row.id } });
      return { deleted: true };
    });
  }

  /**
   * The truck's ledger rows up to `periodEnd` that no invoice charges, nor (when given) were taken off this draft.
   * A row and its reversal that are both uncharged cancel out and are left out.
   */
  private async available(db: Db, truckId: string, periodEnd: Date, draftId?: string) {
    const rows = await db.truckCostEntry.findMany({
      where: {
        truckId,
        occurredOn: { lte: periodEnd },
        kind: { in: ['part_purchase', 'outside_repair', 'labor'] },
        invoiceLines: { none: draftId ? { OR: [{ active: true }, { invoiceId: draftId }] } : { active: true } },
      },
      orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
    });
    const ids = new Set(rows.map((row) => row.id));
    const netted = new Set<string>();
    for (const row of rows) {
      if (row.reversesEntryId && ids.has(row.reversesEntryId)) {
        netted.add(row.id);
        netted.add(row.reversesEntryId);
      }
    }
    return rows.filter((row) => !netted.has(row.id));
  }

  private async recompute(tx: Prisma.TransactionClient, id: string) {
    const lines = await tx.internalInvoiceLine.findMany({ where: { invoiceId: id, active: true }, select: { kind: true, amountCents: true } });
    const sum = (kind: string) => lines.filter((line) => line.kind === kind).reduce((total, line) => total + line.amountCents, 0);
    const totals = { subtotalPartsCents: sum('part_purchase'), subtotalOutsideCents: sum('outside_repair'), subtotalLaborCents: sum('labor') };
    const totalCents = totals.subtotalPartsCents + totals.subtotalOutsideCents + totals.subtotalLaborCents;
    await tx.internalInvoice.update({ where: { id }, data: { ...totals, totalCents } });
    return { ...totals, totalCents };
  }

  private async draft(tx: Prisma.TransactionClient, id: string) {
    const row = await this.row(tx, id);
    if (row.status !== 'draft') throw new ConflictException({ code: 'INVOICE_NOT_DRAFT', message: 'A sent invoice does not change. Void it and make another.' });
    return row;
  }

  private async row(db: Db, id: string): Promise<InvoiceRow> {
    if (!UUID.test(id)) throw new BadRequestException('Invalid invoice id');
    const row = await db.internalInvoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!row) throw new NotFoundException('Invoice not found');
    return row;
  }

  private async log(tx: Prisma.TransactionClient, actor: AuthUser, id: string, eventType: ActivityEventType, relevantValue: Record<string, unknown>) {
    await this.activity.log(tx, { eventType, entityType: 'internal_invoice', entityId: id, userId: actor.id, relevantValue });
  }

  private summary(row: InvoiceRow): AdminInternalInvoiceSummaryDto {
    return {
      id: row.id,
      number: row.number,
      truck: row.truck,
      periodStart: dateOnly(row.periodStart),
      periodEnd: dateOnly(row.periodEnd),
      status: row.status as InternalInvoiceStatus,
      totalCents: row.totalCents,
      // A voided invoice keeps saying how many lines it had (PCA14); its lines are inactive so another invoice can take them.
      lineCount: row.status === 'void' ? row.lines.length : row.lines.filter((line) => line.active).length,
      sentAt: row.sentAt?.toISOString() ?? null,
    };
  }

  private line(line: InvoiceRow['lines'][number], corrects: Map<string, { id: string; number: string | null }> = new Map()): AdminInternalInvoiceLineDto {
    return {
      id: line.id,
      costEntryId: line.costEntryId,
      kind: line.kind,
      description: line.description,
      occurredOn: dateOnly(line.occurredOn),
      amountCents: line.amountCents,
      sourceType: line.costEntry.sourceType,
      sourceId: line.costEntry.sourceId,
      workOrder: line.costEntry.workOrder,
      correctsInvoice: line.costEntry.reversesEntryId ? corrects.get(line.costEntry.reversesEntryId) ?? null : null,
    };
  }
}
