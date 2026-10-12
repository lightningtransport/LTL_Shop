import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  adminInvoiceCheckQuerySchema,
  adminPurchasesQuerySchema,
  adminRequestAttachmentSchema,
  adminSavePurchaseSchema,
  adminSetAttachmentSchema,
  adminVoidSchema,
  lineTotalCents,
  normalizeInvoiceNumber,
  parseQuantityToHundredths,
  type AdminInvoiceMatchDto,
  type AdminPurchaseDetailDto,
  type AdminPurchaseFormDataDto,
  type AdminPurchaseListDto,
  type AdminPurchaseSummaryDto,
} from '@ltl-shop/shared';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { chargedOnBySource, reverseSource, truckAmounts, writeEntries } from './cost-ledger';
import { INVOICE_BUCKET, InvoiceFiles } from './invoice-files';
import { assertNewInvoice, currentAttachment, duplicateInvoice, filedOwners, findInvoice, linkAttachment, lockVendorInvoices } from './invoice-registry';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE = 'part_purchase' as const;

function parse<T>(schema: { safeParse(raw: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const purchaseInclude = {
  vendor: { select: { id: true, name: true } },
  lines: { orderBy: { sortOrder: 'asc' }, include: { truck: { select: { id: true, truckNumber: true } } } },
  createdBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} satisfies Prisma.PartPurchaseInclude;

type PurchaseRow = Prisma.PartPurchaseGetPayload<{ include: typeof purchaseInclude }>;
type SaveInput = ReturnType<typeof adminSavePurchaseSchema.parse>;

/**
 * LTR-200 / D32 (PC-2): parts invoices. The API computes every total (lines, tax, freight) and writes the Truck cost
 * ledger: one row per truck with its lines plus its share of tax and freight (D-PC2); lines without a truck count
 * on no truck (D-PC5). Edit and void write reversals; nothing is deleted. One vendor + invoice number among the
 * purchases not voided (D-PC8), and the same Idempotency-Key never saves twice (A59).
 */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly files: InvoiceFiles,
  ) {}

  async list(raw: unknown): Promise<AdminPurchaseListDto> {
    const query = parse(adminPurchasesQuerySchema, raw);
    const where: Prisma.PartPurchaseWhereInput = {
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.from || query.to ? { invoiceDate: { ...(query.from ? { gte: asDate(query.from) } : {}), ...(query.to ? { lte: asDate(query.to) } : {}) } } : {}),
      ...(query.truckId === 'none' ? { lines: { some: { truckId: null } } } : query.truckId ? { lines: { some: { truckId: query.truckId } } } : {}),
      ...(query.q ? {
        OR: [
          { invoiceNorm: { contains: normalizeInvoiceNumber(query.q) || query.q } },
          { vendor: { name: { contains: query.q, mode: 'insensitive' } } },
          { lines: { some: { OR: [{ description: { contains: query.q, mode: 'insensitive' } }, { partNumber: { contains: query.q, mode: 'insensitive' } }] } } },
        ],
      } : {}),
    };
    const rows = await this.prisma.partPurchase.findMany({ where, include: purchaseInclude, orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }], take: 300 });
    const filed = await filedOwners(this.prisma, 'part_purchase', rows.map((row) => row.id));
    const items = rows.map((row) => this.summary(row, filed.has(row.id))).filter((item) => !query.noFile || !item.hasFile);
    const live = rows.filter((row) => !row.voidedAt && (!query.noFile || !filed.has(row.id)));
    return {
      items,
      totals: {
        count: live.length,
        totalCents: live.reduce((sum, row) => sum + row.totalCents, 0),
        noTruckCents: live.reduce((sum, row) => sum + this.amounts(row).noTruckCents, 0),
      },
    };
  }

  async detail(id: string): Promise<AdminPurchaseDetailDto> {
    const row = await this.row(id);
    const [attachment, chargedOn] = await Promise.all([currentAttachment(this.prisma, 'part_purchase', id), chargedOnBySource(this.prisma, { sourceType: SOURCE, sourceId: id })]);
    const { shares, noTruckCents } = this.amounts(row);
    return {
      ...this.summary(row, Boolean(attachment)),
      subtotalCents: row.subtotalCents,
      taxCents: row.taxCents,
      freightCents: row.freightCents,
      notes: row.notes,
      lines: row.lines.map((line) => ({
        id: line.id,
        partId: line.partId,
        description: line.description,
        partNumber: line.partNumber,
        quantity: line.quantity.toFixed(2),
        unitCostCents: line.unitCostCents,
        lineTotalCents: line.lineTotalCents,
        truck: line.truck,
      })),
      truckShares: shares,
      noTruckCents,
      attachment,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      voidedBy: row.voidedBy,
      voidReason: row.voidReason,
      chargedOn,
    };
  }

  /** What New purchase needs: every truck, the last price paid per part and vendor, and whether files work here. */
  async formData(): Promise<AdminPurchaseFormDataDto> {
    const [trucks, lastPaid] = await Promise.all([
      this.prisma.truck.findMany({ select: { id: true, truckNumber: true, make: true, model: true }, orderBy: { truckNumber: 'asc' } }),
      this.prisma.$queryRaw<Array<{ part_id: string; unit_cost_cents: number; invoice_date: Date; vendor_id: string; vendor_name: string }>>`
        SELECT DISTINCT ON (l.part_id, p.vendor_id) l.part_id, l.unit_cost_cents, p.invoice_date, p.vendor_id, v.name AS vendor_name
        FROM part_purchase_lines l
        JOIN part_purchases p ON p.id = l.purchase_id AND p.voided_at IS NULL
        JOIN vendors v ON v.id = p.vendor_id
        WHERE l.part_id IS NOT NULL
        ORDER BY l.part_id, p.vendor_id, p.invoice_date DESC, p.created_at DESC`,
    ]);
    return {
      trucks: trucks.sort((left, right) => left.truckNumber.localeCompare(right.truckNumber, 'en', { numeric: true })),
      lastPaid: lastPaid.map((row) => ({
        partId: row.part_id,
        unitCostCents: row.unit_cost_cents,
        invoiceDate: dateOnly(row.invoice_date),
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
      })),
      filesEnabled: this.files.isConfigured(),
    };
  }

  /** The warning when leaving the invoice # field (D-PC8). */
  async checkInvoice(raw: unknown): Promise<AdminInvoiceMatchDto> {
    const query = parse(adminInvoiceCheckQuerySchema, raw);
    return (await findInvoice(this.prisma, query.vendorId, normalizeInvoiceNumber(query.number), query.excludeId)) ?? { exists: false };
  }

  async create(actor: AuthUser, raw: unknown, idempotencyKey: string | undefined) {
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Send an Idempotency-Key header.' });
    const replay = await this.prisma.partPurchase.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
    if (replay) return { id: replay.id, replayed: true };
    const input = parse(adminSavePurchaseSchema, raw);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const prepared = await this.prepare(tx, input);
        await lockVendorInvoices(tx, input.vendorId);
        // A second send that waited on the lock finds what the first one saved (A59).
        const saved = await tx.partPurchase.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
        if (saved) return { id: saved.id, replayed: true };
        await assertNewInvoice(tx, input.vendorId, prepared.invoiceNorm);
        const purchase = await tx.partPurchase.create({
          data: {
            vendorId: input.vendorId,
            invoiceNumber: input.invoiceNumber,
            invoiceNorm: prepared.invoiceNorm,
            invoiceDate: asDate(input.invoiceDate),
            subtotalCents: prepared.subtotalCents,
            taxCents: input.taxCents,
            freightCents: input.freightCents,
            totalCents: prepared.totalCents,
            notes: input.notes ?? null,
            idempotencyKey: key,
            createdById: actor.id,
            lines: { create: prepared.lines },
          },
          include: purchaseInclude,
        });
        await this.writeLedger(tx, purchase, actor.id);
        await linkAttachment(tx, 'part_purchase', purchase.id, input.attachmentId);
        await this.activity.log(tx, {
          eventType: ActivityEventType.PART_PURCHASE_SAVED,
          entityType: SOURCE,
          entityId: purchase.id,
          userId: actor.id,
          newValue: this.auditValue(purchase),
          relevantValue: { action: 'part_purchase_created', vendor: purchase.vendor.name, invoiceNumber: purchase.invoiceNumber, totalCents: purchase.totalCents },
        });
        return { id: purchase.id, replayed: false };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Two sends at once: the same key returns the purchase the first one saved.
        const saved = await this.prisma.partPurchase.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
        if (saved) return { id: saved.id, replayed: true };
        throw duplicateInvoice(await findInvoice(this.prisma, input.vendorId, normalizeInvoiceNumber(input.invoiceNumber)));
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, raw: unknown) {
    const before = await this.row(id);
    if (before.voidedAt) throw new ConflictException({ code: 'PURCHASE_VOIDED', message: 'This purchase is voided. Load it again instead.' });
    const input = parse(adminSavePurchaseSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const prepared = await this.prepare(tx, input, before.vendorId);
      await assertNewInvoice(tx, input.vendorId, prepared.invoiceNorm, id);
      await tx.partPurchaseLine.deleteMany({ where: { purchaseId: id } });
      const purchase = await tx.partPurchase.update({
        where: { id },
        data: {
          vendorId: input.vendorId,
          invoiceNumber: input.invoiceNumber,
          invoiceNorm: prepared.invoiceNorm,
          invoiceDate: asDate(input.invoiceDate),
          subtotalCents: prepared.subtotalCents,
          taxCents: input.taxCents,
          freightCents: input.freightCents,
          totalCents: prepared.totalCents,
          notes: input.notes ?? null,
          lines: { create: prepared.lines },
        },
        include: purchaseInclude,
      });
      // PCA6 (UX-10-004): the ledger is rewritten only when something that reaches it changed (vendor, number, date,
      // lines, trucks, tax, freight). A new file or a note leaves the trucks' costs, and the invoices, as they are.
      if (this.ledgerKey(before) !== this.ledgerKey(purchase)) {
        await reverseSource(tx, { sourceType: SOURCE, sourceId: id }, actor.id);
        await this.writeLedger(tx, purchase, actor.id);
      }
      if (input.attachmentId !== undefined) await linkAttachment(tx, 'part_purchase', id, input.attachmentId);
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_PURCHASE_SAVED,
        entityType: SOURCE,
        entityId: id,
        userId: actor.id,
        previousValue: this.auditValue(before),
        newValue: this.auditValue(purchase),
        relevantValue: { action: 'part_purchase_updated', vendor: purchase.vendor.name, invoiceNumber: purchase.invoiceNumber, totalCents: purchase.totalCents },
      });
      return { id };
    });
  }

  /** PCA6 (UX-10-004): attach, replace or remove the invoice file on its own; nothing else changes. */
  async setAttachment(actor: AuthUser, id: string, raw: unknown) {
    const { attachmentId } = parse(adminSetAttachmentSchema, raw);
    const before = await this.row(id);
    if (before.voidedAt) throw new ConflictException({ code: 'PURCHASE_VOIDED', message: 'This purchase is voided. Load it again instead.' });
    await this.prisma.$transaction(async (tx) => {
      await linkAttachment(tx, 'part_purchase', id, attachmentId);
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_PURCHASE_SAVED,
        entityType: SOURCE,
        entityId: id,
        userId: actor.id,
        relevantValue: { action: attachmentId ? 'part_purchase_file_attached' : 'part_purchase_file_removed', vendor: before.vendor.name, invoiceNumber: before.invoiceNumber },
      });
    });
    return { id };
  }

  /** What the ledger is written from; two purchases with the same key write the same rows. */
  private ledgerKey(row: PurchaseRow) {
    return JSON.stringify({
      vendorId: row.vendorId,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: dateOnly(row.invoiceDate),
      taxCents: row.taxCents,
      freightCents: row.freightCents,
      lines: row.lines
        .map((line) => [line.partId, line.description, line.partNumber, line.quantity.toString(), line.unitCostCents, line.truckId])
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    });
  }

  async void(actor: AuthUser, id: string, raw: unknown) {
    const { reason } = parse(adminVoidSchema, raw);
    const before = await this.row(id);
    if (before.voidedAt) return { id };
    await this.prisma.$transaction(async (tx) => {
      await tx.partPurchase.update({ where: { id }, data: { voidedAt: new Date(), voidedById: actor.id, voidReason: reason } });
      await reverseSource(tx, { sourceType: SOURCE, sourceId: id }, actor.id);
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_PURCHASE_VOIDED,
        entityType: SOURCE,
        entityId: id,
        userId: actor.id,
        previousValue: this.auditValue(before),
        relevantValue: { action: 'part_purchase_voided', vendor: before.vendor.name, invoiceNumber: before.invoiceNumber, totalCents: before.totalCents, reason },
      });
    });
    return { id };
  }

  /** Validates the file, then gives the browser a URL to upload it straight to the private bucket. */
  async requestAttachment(actor: AuthUser, raw: unknown) {
    const input = parse(adminRequestAttachmentSchema, raw);
    const id = randomUUID();
    const safeName = input.fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'invoice';
    const objectPath = `${new Date().toISOString().slice(0, 7)}/${id}/${safeName}`;
    const uploadUrl = await this.files.uploadUrl(objectPath);
    await this.prisma.attachment.create({
      data: { id, bucket: INVOICE_BUCKET, objectPath, fileName: input.fileName, contentType: input.contentType, sizeBytes: input.sizeBytes, uploadedById: actor.id },
    });
    return { id, uploadUrl };
  }

  async openAttachment(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Invalid file id');
    const file = await this.prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!file) throw new NotFoundException('File not found');
    return { url: await this.files.downloadUrl(file.objectPath, file.fileName) };
  }

  /** Lines with their totals in cents, the invoice total, and the parts' names and numbers copied. */
  private async prepare(tx: Prisma.TransactionClient, input: SaveInput, keepVendorId?: string) {
    const vendor = await tx.vendor.findUnique({ where: { id: input.vendorId }, select: { active: true } });
    // A purchase being corrected keeps its vendor even if that vendor was turned off since.
    if (!vendor || (!vendor.active && input.vendorId !== keepVendorId)) throw new BadRequestException({ code: 'VENDOR_NOT_ACTIVE', message: 'Pick an active vendor.' });
    const partIds = [...new Set(input.lines.map((line) => line.partId).filter((value): value is string => Boolean(value)))];
    const truckIds = [...new Set(input.lines.map((line) => line.truckId).filter((value): value is string => Boolean(value)))];
    const [parts, trucks] = await Promise.all([
      tx.part.findMany({ where: { id: { in: partIds } }, select: { id: true, displayName: true, partNumber: true } }),
      tx.truck.count({ where: { id: { in: truckIds } } }),
    ]);
    if (parts.length !== partIds.length) throw new BadRequestException({ code: 'PART_NOT_FOUND', message: 'A part on this purchase is no longer in the catalog.' });
    if (trucks !== truckIds.length) throw new BadRequestException({ code: 'TRUCK_NOT_FOUND', message: 'A truck on this purchase does not exist.' });
    const partById = new Map(parts.map((part) => [part.id, part]));
    const lines = input.lines.map((line, index) => {
      const part = line.partId ? partById.get(line.partId)! : null;
      const hundredths = parseQuantityToHundredths(line.quantity)!;
      return {
        partId: part?.id ?? null,
        description: line.description?.trim() || part!.displayName,
        partNumber: part?.partNumber ?? null,
        quantity: new Prisma.Decimal(hundredths).div(100),
        unitCostCents: line.unitCostCents,
        lineTotalCents: lineTotalCents(hundredths, line.unitCostCents),
        truckId: line.truckId ?? null,
        sortOrder: index,
      };
    });
    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const totalCents = subtotalCents + input.taxCents + input.freightCents;
    if (input.expectedTotalCents !== undefined && input.expectedTotalCents !== totalCents) {
      throw new BadRequestException({ code: 'TOTAL_MISMATCH', message: 'The total does not match the lines, tax and freight.', totalCents });
    }
    return { lines, subtotalCents, totalCents, invoiceNorm: normalizeInvoiceNumber(input.invoiceNumber) || input.invoiceNumber.toUpperCase() };
  }

  private async writeLedger(tx: Prisma.TransactionClient, purchase: PurchaseRow, actorId: string) {
    const { shares } = this.amounts(purchase);
    await writeEntries(tx, {
      sourceType: SOURCE,
      sourceId: purchase.id,
      kind: 'part_purchase',
      occurredOn: purchase.invoiceDate,
      vendorId: purchase.vendorId,
      actorId,
    }, shares.map((share) => ({
      truckId: share.id,
      amountCents: share.amountCents,
      description: `${purchase.vendor.name} · ${purchase.invoiceNumber} · ${purchase.lines
        .filter((line) => line.truckId === share.id)
        .map((line) => `${line.description}${line.partNumber ? ` ${line.partNumber}` : ''} × ${Number(line.quantity)}`)
        .join(', ')}`,
    })));
  }

  /** Each truck's amount (lines + share of tax and freight) and what has no truck. */
  private amounts(row: Pick<PurchaseRow, 'lines' | 'taxCents' | 'freightCents'>) {
    const groups = truckAmounts(row.lines.map((line) => ({ truckId: line.truckId, lineTotalCents: line.lineTotalCents })), row.taxCents + row.freightCents);
    const numbers = new Map(row.lines.filter((line) => line.truck).map((line) => [line.truck!.id, line.truck!.truckNumber]));
    return {
      shares: groups
        .filter((group): group is { truckId: string; amountCents: number } => group.truckId !== null)
        .map((group) => ({ id: group.truckId, truckNumber: numbers.get(group.truckId) ?? '', amountCents: group.amountCents }))
        .sort((left, right) => left.truckNumber.localeCompare(right.truckNumber, 'en', { numeric: true })),
      noTruckCents: groups.find((group) => group.truckId === null)?.amountCents ?? 0,
    };
  }

  private summary(row: PurchaseRow, hasFile: boolean): AdminPurchaseSummaryDto {
    const trucks = new Map<string, string>();
    for (const line of row.lines) if (line.truck) trucks.set(line.truck.id, line.truck.truckNumber);
    return {
      id: row.id,
      vendor: row.vendor,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: dateOnly(row.invoiceDate),
      lineCount: row.lines.length,
      trucks: [...trucks.entries()].map(([id, truckNumber]) => ({ id, truckNumber })).sort((left, right) => left.truckNumber.localeCompare(right.truckNumber, 'en', { numeric: true })),
      hasNoTruckLines: row.lines.some((line) => !line.truckId),
      totalCents: row.totalCents,
      hasFile,
      voidedAt: row.voidedAt?.toISOString() ?? null,
    };
  }

  private auditValue(row: PurchaseRow) {
    return {
      vendorId: row.vendorId,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: dateOnly(row.invoiceDate),
      subtotalCents: row.subtotalCents,
      taxCents: row.taxCents,
      freightCents: row.freightCents,
      totalCents: row.totalCents,
      lines: row.lines.map((line) => ({ partId: line.partId, description: line.description, quantity: line.quantity.toFixed(2), unitCostCents: line.unitCostCents, truckId: line.truckId })),
    };
  }

  private async row(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Invalid purchase id');
    const row = await this.prisma.partPurchase.findUnique({ where: { id }, include: purchaseInclude });
    if (!row) throw new NotFoundException('Purchase not found');
    return row;
  }
}

