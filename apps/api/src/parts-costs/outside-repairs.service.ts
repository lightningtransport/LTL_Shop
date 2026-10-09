import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  adminExternalJobsQuerySchema,
  adminOutsideRepairsQuerySchema,
  adminSaveOutsideRepairSchema,
  adminVoidSchema,
  normalizeInvoiceNumber,
  type AdminExternalJobDto,
  type AdminOutsideRepairDetailDto,
  type AdminOutsideRepairListDto,
  type AdminOutsideRepairSummaryDto,
} from '@ltl-shop/shared';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { reverseSource, writeEntries } from './cost-ledger';
import { assertNewInvoice, currentAttachment, duplicateInvoice, filedOwners, findInvoice, linkAttachment, lockVendorInvoices } from './invoice-registry';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE = 'outside_repair' as const;
/** The Jobs offered to tie an invoice to: still out, or sent out within this many days. */
export const EXTERNAL_JOB_WINDOW_DAYS = 90;

function parse<T>(schema: { safeParse(raw: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const actionOf = (value: Prisma.JsonValue | null) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).action : undefined);
const kindOf = (value: Prisma.JsonValue | null) => {
  const kind = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).kind : undefined;
  return kind === 'part' || kind === 'truck' ? kind : null;
};

const repairInclude = {
  truck: { select: { id: true, truckNumber: true } },
  vendor: { select: { id: true, name: true } },
  workOrderJob: { select: { id: true, displayName: true, workOrder: { select: { id: true, displayId: true } } } },
  createdBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} satisfies Prisma.OutsideRepairInclude;

type RepairRow = Prisma.OutsideRepairGetPayload<{ include: typeof repairInclude }>;
type SaveInput = ReturnType<typeof adminSaveOutsideRepairSchema.parse>;

/**
 * LTR-200 / D32 (PC-3): invoices from an outside shop. One truck each, optionally tied to the Job sent to an
 * external shop (D24, out now or back within 90 days). "Send to external shop" and "Returned" do not change: the
 * invoice keeps the Job's id. One ledger row on the truck; edit and void write reversals (as purchases do).
 */
@Injectable()
export class OutsideRepairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(raw: unknown): Promise<AdminOutsideRepairListDto> {
    const query = parse(adminOutsideRepairsQuerySchema, raw);
    const where: Prisma.OutsideRepairWhereInput = {
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.truckId ? { truckId: query.truckId } : {}),
      ...(query.from || query.to ? { invoiceDate: { ...(query.from ? { gte: asDate(query.from) } : {}), ...(query.to ? { lte: asDate(query.to) } : {}) } } : {}),
      ...(query.q ? {
        OR: [
          { invoiceNorm: { contains: normalizeInvoiceNumber(query.q) || query.q } },
          { vendor: { name: { contains: query.q, mode: 'insensitive' } } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { truck: { truckNumber: { contains: query.q } } },
        ],
      } : {}),
    };
    const rows = await this.prisma.outsideRepair.findMany({ where, include: repairInclude, orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }], take: 300 });
    const filed = await filedOwners(this.prisma, 'outside_repair', rows.map((row) => row.id));
    const items = rows.map((row) => this.summary(row, filed.has(row.id))).filter((item) => !query.noFile || !item.hasFile);
    const live = items.filter((item) => !item.voidedAt);
    return { items, totals: { count: live.length, totalCents: live.reduce((sum, item) => sum + item.amountCents, 0) } };
  }

  async detail(id: string): Promise<AdminOutsideRepairDetailDto> {
    const row = await this.row(id);
    const attachment = await currentAttachment(this.prisma, 'outside_repair', id);
    return {
      ...this.summary(row, Boolean(attachment)),
      notes: row.notes,
      attachment,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      voidedBy: row.voidedBy,
      voidReason: row.voidReason,
    };
  }

  /** The Jobs of this truck that are at an external shop now, or went out within 90 days (from the Activity Log). */
  async externalJobs(raw: unknown): Promise<AdminExternalJobDto[]> {
    const { truckId } = parse(adminExternalJobsQuerySchema, raw);
    const since = new Date(Date.now() - EXTERNAL_JOB_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [outNow, logs] = await Promise.all([
      this.prisma.workOrderJob.findMany({
        where: { externalSince: { not: null }, workOrder: { truckId } },
        select: { id: true, displayName: true, externalSince: true, externalKind: true, workOrder: { select: { id: true, displayId: true } } },
      }),
      this.prisma.activityLog.findMany({
        where: { entityType: 'work_order_job', eventType: 'manager_correction', createdAt: { gte: since }, workOrder: { truckId } },
        select: { entityId: true, relevantValue: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const jobs = new Map<string, AdminExternalJobDto>();
    for (const job of outNow) {
      jobs.set(job.id, {
        jobId: job.id, displayName: job.displayName, workOrderId: job.workOrder.id, workOrderDisplayId: job.workOrder.displayId,
        kind: job.externalKind, sentAt: job.externalSince!.toISOString(), returnedAt: null, out: true,
      });
    }
    const sent = logs.filter((log) => log.entityId && actionOf(log.relevantValue) === 'job_sent_external');
    const returned = new Map(logs.filter((log) => log.entityId && actionOf(log.relevantValue) === 'job_returned_external').map((log) => [log.entityId!, log.createdAt]));
    const pastIds = [...new Set(sent.map((log) => log.entityId!))].filter((id) => !jobs.has(id));
    if (pastIds.length) {
      const past = await this.prisma.workOrderJob.findMany({
        where: { id: { in: pastIds }, workOrder: { truckId } },
        select: { id: true, displayName: true, workOrder: { select: { id: true, displayId: true } } },
      });
      for (const job of past) {
        const log = sent.filter((item) => item.entityId === job.id).at(-1)!;
        jobs.set(job.id, {
          jobId: job.id, displayName: job.displayName, workOrderId: job.workOrder.id, workOrderDisplayId: job.workOrder.displayId,
          kind: kindOf(log.relevantValue), sentAt: log.createdAt.toISOString(), returnedAt: returned.get(job.id)?.toISOString() ?? null, out: false,
        });
      }
    }
    return [...jobs.values()].sort((left, right) => Number(right.out) - Number(left.out) || (right.sentAt ?? '').localeCompare(left.sentAt ?? ''));
  }

  async create(actor: AuthUser, raw: unknown, idempotencyKey: string | undefined) {
    const key = idempotencyKey?.trim();
    if (!key || key.length > 100) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Send an Idempotency-Key header.' });
    const replay = await this.prisma.outsideRepair.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
    if (replay) return { id: replay.id, replayed: true };
    const input = parse(adminSaveOutsideRepairSchema, raw);
    const invoiceNorm = normalizeInvoiceNumber(input.invoiceNumber) || input.invoiceNumber.toUpperCase();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const link = await this.prepare(tx, input);
        await lockVendorInvoices(tx, input.vendorId);
        const saved = await tx.outsideRepair.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
        if (saved) return { id: saved.id, replayed: true };
        await assertNewInvoice(tx, input.vendorId, invoiceNorm);
        const repair = await tx.outsideRepair.create({
          data: { ...this.fields(input, invoiceNorm, link), idempotencyKey: key, createdById: actor.id },
          include: repairInclude,
        });
        await this.writeLedger(tx, repair, actor.id);
        await linkAttachment(tx, 'outside_repair', repair.id, input.attachmentId);
        await this.activity.log(tx, {
          workOrderId: repair.workOrderId ?? undefined,
          eventType: ActivityEventType.OUTSIDE_REPAIR_SAVED,
          entityType: SOURCE,
          entityId: repair.id,
          userId: actor.id,
          newValue: this.auditValue(repair),
          relevantValue: { action: 'outside_repair_created', vendor: repair.vendor.name, invoiceNumber: repair.invoiceNumber, amountCents: repair.amountCents, displayName: repair.workOrderJob?.displayName ?? null },
        });
        return { id: repair.id, replayed: false };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const saved = await this.prisma.outsideRepair.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
        if (saved) return { id: saved.id, replayed: true };
        throw duplicateInvoice(await findInvoice(this.prisma, input.vendorId, invoiceNorm));
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, raw: unknown) {
    const before = await this.row(id);
    if (before.voidedAt) throw new ConflictException({ code: 'REPAIR_VOIDED', message: 'This outside repair is voided. Load it again instead.' });
    const input = parse(adminSaveOutsideRepairSchema, raw);
    const invoiceNorm = normalizeInvoiceNumber(input.invoiceNumber) || input.invoiceNumber.toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      const link = await this.prepare(tx, input, before.vendorId);
      await assertNewInvoice(tx, input.vendorId, invoiceNorm, id);
      const repair = await tx.outsideRepair.update({ where: { id }, data: this.fields(input, invoiceNorm, link), include: repairInclude });
      await reverseSource(tx, { sourceType: SOURCE, sourceId: id }, actor.id);
      await this.writeLedger(tx, repair, actor.id);
      if (input.attachmentId !== undefined) await linkAttachment(tx, 'outside_repair', id, input.attachmentId);
      await this.activity.log(tx, {
        workOrderId: repair.workOrderId ?? undefined,
        eventType: ActivityEventType.OUTSIDE_REPAIR_SAVED,
        entityType: SOURCE,
        entityId: id,
        userId: actor.id,
        previousValue: this.auditValue(before),
        newValue: this.auditValue(repair),
        relevantValue: { action: 'outside_repair_updated', vendor: repair.vendor.name, invoiceNumber: repair.invoiceNumber, amountCents: repair.amountCents },
      });
      return { id };
    });
  }

  async void(actor: AuthUser, id: string, raw: unknown) {
    const { reason } = parse(adminVoidSchema, raw);
    const before = await this.row(id);
    if (before.voidedAt) return { id };
    await this.prisma.$transaction(async (tx) => {
      await tx.outsideRepair.update({ where: { id }, data: { voidedAt: new Date(), voidedById: actor.id, voidReason: reason } });
      await reverseSource(tx, { sourceType: SOURCE, sourceId: id }, actor.id);
      await this.activity.log(tx, {
        workOrderId: before.workOrderId ?? undefined,
        eventType: ActivityEventType.OUTSIDE_REPAIR_VOIDED,
        entityType: SOURCE,
        entityId: id,
        userId: actor.id,
        previousValue: this.auditValue(before),
        relevantValue: { action: 'outside_repair_voided', vendor: before.vendor.name, invoiceNumber: before.invoiceNumber, amountCents: before.amountCents, reason },
      });
    });
    return { id };
  }

  /** The vendor, the truck, and — when tied to a Job — that the Job is this truck's and went to an external shop. */
  private async prepare(tx: Prisma.TransactionClient, input: SaveInput, keepVendorId?: string) {
    const [vendor, truck] = await Promise.all([
      tx.vendor.findUnique({ where: { id: input.vendorId }, select: { active: true } }),
      tx.truck.findUnique({ where: { id: input.truckId }, select: { id: true } }),
    ]);
    if (!vendor || (!vendor.active && input.vendorId !== keepVendorId)) throw new BadRequestException({ code: 'VENDOR_NOT_ACTIVE', message: 'Pick an active vendor.' });
    if (!truck) throw new BadRequestException({ code: 'TRUCK_NOT_FOUND', message: 'That truck does not exist.' });
    if (!input.workOrderJobId) return { workOrderId: null, workOrderJobId: null, externalKind: null };
    const job = await tx.workOrderJob.findUnique({
      where: { id: input.workOrderJobId },
      select: { id: true, externalSince: true, externalKind: true, workOrder: { select: { id: true, truckId: true } } },
    });
    if (!job || job.workOrder.truckId !== input.truckId) {
      throw new BadRequestException({ code: 'JOB_NOT_ON_TRUCK', message: 'That Job is not on this truck.' });
    }
    let externalKind = job.externalKind;
    if (!job.externalSince) {
      const sent = await tx.activityLog.findFirst({
        where: { entityType: 'work_order_job', entityId: job.id, relevantValue: { path: ['action'], equals: 'job_sent_external' } },
        orderBy: { createdAt: 'desc' },
        select: { relevantValue: true },
      });
      if (!sent) throw new BadRequestException({ code: 'JOB_NEVER_EXTERNAL', message: 'That Job was never sent to an external shop.' });
      externalKind = kindOf(sent.relevantValue);
    }
    return { workOrderId: job.workOrder.id, workOrderJobId: job.id, externalKind };
  }

  private fields(input: SaveInput, invoiceNorm: string, link: { workOrderId: string | null; workOrderJobId: string | null; externalKind: 'part' | 'truck' | null }) {
    return {
      truckId: input.truckId,
      vendorId: input.vendorId,
      invoiceNumber: input.invoiceNumber,
      invoiceNorm,
      invoiceDate: asDate(input.invoiceDate),
      description: input.description,
      amountCents: input.amountCents,
      notes: input.notes ?? null,
      ...link,
    };
  }

  private async writeLedger(tx: Prisma.TransactionClient, repair: RepairRow, actorId: string) {
    await writeEntries(tx, {
      sourceType: SOURCE,
      sourceId: repair.id,
      kind: 'outside_repair',
      occurredOn: repair.invoiceDate,
      vendorId: repair.vendorId,
      workOrderId: repair.workOrderId,
      actorId,
    }, [{ truckId: repair.truckId, amountCents: repair.amountCents, description: `${repair.vendor.name} · ${repair.invoiceNumber} · ${repair.description}` }]);
  }

  private summary(row: RepairRow, hasFile: boolean): AdminOutsideRepairSummaryDto {
    return {
      id: row.id,
      truck: row.truck,
      vendor: row.vendor,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: dateOnly(row.invoiceDate),
      description: row.description,
      amountCents: row.amountCents,
      job: row.workOrderJob
        ? { id: row.workOrderJob.id, displayName: row.workOrderJob.displayName, workOrderId: row.workOrderJob.workOrder.id, workOrderDisplayId: row.workOrderJob.workOrder.displayId, kind: row.externalKind }
        : null,
      hasFile,
      voidedAt: row.voidedAt?.toISOString() ?? null,
    };
  }

  private auditValue(row: RepairRow) {
    return {
      truckId: row.truckId, vendorId: row.vendorId, invoiceNumber: row.invoiceNumber, invoiceDate: dateOnly(row.invoiceDate),
      description: row.description, amountCents: row.amountCents, workOrderJobId: row.workOrderJobId,
    };
  }

  private async row(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Invalid outside repair id');
    const row = await this.prisma.outsideRepair.findUnique({ where: { id }, include: repairInclude });
    if (!row) throw new NotFoundException('Outside repair not found');
    return row;
  }
}
