import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  OPEN_WORK_ORDER_STATUSES,
  adminCreatePartCategorySchema,
  adminCreatePartSchema,
  adminCreateVendorSchema,
  adminPartsQuerySchema,
  adminUpdatePartSchema,
  adminUpdateVendorSchema,
  normalizeCatalogText,
  partFitsTruck,
  type AdminPartDto,
  type AdminPartOpenPmDto,
  type AdminPartsCatalogDto,
  type AdminVendorDto,
} from '@ltl-shop/shared';
import { Prisma, type WorkOrderStatus } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OpenPm = AdminPartOpenPmDto & { make: string | null; model: string | null };

function parse<T>(schema: { safeParse(raw: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

const fitKey = (fit: { make?: string | null; model?: string | null }) => `${normalizeCatalogText(fit.make ?? '')}|${normalizeCatalogText(fit.model ?? '')}`;

/**
 * LTR-200 / D32 (PC-1): the part catalog the PM uses — reference cost, usual vendor and "Fits" — and the vendors.
 * The PM picker never sees a cost (`getPmService` is unchanged). A part picked in a PM in progress keeps working:
 * it cannot be turned off or lose that truck (`PART_IN_OPEN_PM`), because the mechanic's next save re-checks it.
 */
@Injectable()
export class PartsCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async catalog(raw: unknown): Promise<AdminPartsCatalogDto> {
    const query = parse(adminPartsQuerySchema, raw);
    const [categories, usage, openPms, makes, lastPaid] = await Promise.all([
      this.prisma.partCategory.findMany({
        where: { active: true, ...(query.kind ? { kind: query.kind } : {}) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          parts: {
            where: query.includeInactive ? {} : { active: true },
            orderBy: [{ active: 'desc' }, { displayName: 'asc' }],
            include: { fitments: true, defaultVendor: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.$queryRaw<Array<{ part_id: string; uses: bigint; last_used_at: Date | null }>>`
        SELECT psp.part_id, count(*) AS uses, max(ps.updated_at) AS last_used_at
        FROM pm_service_parts psp JOIN pm_services ps ON ps.id = psp.pm_service_id
        GROUP BY psp.part_id`,
      this.openPms(),
      // D44: makes of the trucks still in the fleet.
      this.prisma.truck.findMany({ where: { make: { not: null }, deactivatedAt: null }, distinct: ['make'], select: { make: true }, orderBy: { make: 'asc' } }),
      // PC-2: the last line of each part on a purchase not voided.
      this.prisma.$queryRaw<Array<{ part_id: string; unit_cost_cents: number; invoice_date: Date; vendor_name: string }>>`
        SELECT DISTINCT ON (l.part_id) l.part_id, l.unit_cost_cents, p.invoice_date, v.name AS vendor_name
        FROM part_purchase_lines l
        JOIN part_purchases p ON p.id = l.purchase_id AND p.voided_at IS NULL
        JOIN vendors v ON v.id = p.vendor_id
        WHERE l.part_id IS NOT NULL
        ORDER BY l.part_id, p.invoice_date DESC, p.created_at DESC`,
    ]);
    const lastPaidByPart = new Map(lastPaid.map((row) => [row.part_id, row]));
    const usageByPart = new Map(usage.map((row) => [row.part_id, row]));
    const needle = normalizeCatalogText(query.q ?? '');
    const make = query.make ? { make: query.make, model: null } : null;
    let costedPartCount = 0;
    const result = categories.map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind,
      parts: category.parts
        .filter((part) => !needle || normalizeCatalogText(`${part.displayName} ${part.partNumber ?? ''}`).includes(needle))
        .filter((part) => !make || !part.fitments.length || part.fitments.some((fit) => fit.make && normalizeCatalogText(fit.make) === normalizeCatalogText(make.make)))
        .map((part): AdminPartDto => {
          if (part.unitCostCents !== null) costedPartCount += 1;
          const used = usageByPart.get(part.id);
          return {
            id: part.id,
            categoryId: part.categoryId,
            partNumber: part.partNumber,
            displayName: part.displayName,
            active: part.active,
            source: part.source,
            unitCostCents: part.unitCostCents,
            defaultVendor: part.defaultVendor,
            fits: part.fitments.map((fit) => ({ make: fit.make, model: fit.model })),
            tireSize: part.tireSize,
            tireType: part.tireType,
            minStock: part.minStock,
            usedInPmCount: Number(used?.uses ?? 0),
            lastUsedAt: used?.last_used_at ? used.last_used_at.toISOString() : null,
            openPms: (openPms.get(part.id) ?? []).map(({ make: _make, model: _model, ...pm }) => pm),
            lastPaid: lastPaidByPart.has(part.id)
              ? {
                  unitCostCents: lastPaidByPart.get(part.id)!.unit_cost_cents,
                  invoiceDate: lastPaidByPart.get(part.id)!.invoice_date.toISOString().slice(0, 10),
                  vendorName: lastPaidByPart.get(part.id)!.vendor_name,
                }
              : null,
          };
        }),
    }));
    return { categories: result, truckMakes: makes.map((truck) => truck.make!).filter(Boolean), costedPartCount };
  }

  async createPart(actor: AuthUser, raw: unknown) {
    const input = parse(adminCreatePartSchema, raw);
    const category = await this.prisma.partCategory.findUnique({ where: { id: input.categoryId }, select: { id: true, kind: true } });
    if (!category) throw new BadRequestException({ code: 'PART_CATEGORY_NOT_FOUND', message: 'That category does not exist.' });
    if (input.defaultVendorId) await this.activeVendor(input.defaultVendorId);
    const fits = this.uniqueFits(input.fits);
    const tire = this.tireFields(category.kind, input.tireSize ?? null, input.tireType ?? null);
    return this.prisma.$transaction(async (tx) => {
      await this.assertNoTwin(tx, category.id, input.partNumber ?? null, input.displayName);
      await this.assertNumberFree(tx, input.partNumber ?? null);
      const part = await tx.part.create({
        data: {
          categoryId: category.id,
          partNumber: input.partNumber ?? null,
          displayName: input.displayName,
          unitCostCents: input.unitCostCents ?? null,
          defaultVendorId: input.defaultVendorId ?? null,
          source: 'app',
          ...tire,
          minStock: input.minStock ?? null,
          fitments: { create: fits },
        },
      });
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_CATALOG_UPDATED,
        entityType: 'part',
        entityId: part.id,
        userId: actor.id,
        newValue: { action: 'part_created', displayName: part.displayName, partNumber: part.partNumber, unitCostCents: part.unitCostCents, fits, tireSize: part.tireSize, tireType: part.tireType, minStock: part.minStock },
        relevantValue: { action: 'part_created', displayName: part.displayName },
      });
      return { id: part.id };
    });
  }

  async updatePart(actor: AuthUser, id: string, raw: unknown) {
    this.assertId(id, 'Part');
    const input = parse(adminUpdatePartSchema, raw);
    const part = await this.prisma.part.findUnique({ where: { id }, include: { fitments: true, category: { select: { kind: true } } } });
    if (!part) throw new NotFoundException('Part not found');
    if (input.defaultVendorId && input.defaultVendorId !== part.defaultVendorId) await this.activeVendor(input.defaultVendorId);
    const fits = input.fits ? this.uniqueFits(input.fits) : null;

    // A54: the mechanic's next PM save re-checks every picked part (active and fits the truck).
    if (input.active === false || fits) {
      const openPms = (await this.openPms(id)).get(id) ?? [];
      const blocked = openPms.filter((pm) => input.active === false || !partFitsTruck(fits!, pm));
      if (blocked.length) {
        throw new ConflictException({
          code: 'PART_IN_OPEN_PM',
          message: `Used in the PM in progress on Truck ${blocked[0].truckNumber}. Change it after that PM is finished.`,
          openPms: blocked.map(({ make: _make, model: _model, ...pm }) => pm),
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const partNumber = input.partNumber !== undefined ? input.partNumber : part.partNumber;
      const displayName = input.displayName ?? part.displayName;
      if (partNumber !== part.partNumber || displayName !== part.displayName) {
        await this.assertNoTwin(tx, part.categoryId, partNumber, displayName, part.id);
      }
      if (partNumber !== part.partNumber) await this.assertNumberFree(tx, partNumber, part.id);
      const tire = input.tireSize !== undefined || input.tireType !== undefined
        ? this.tireFields(part.category.kind, input.tireSize !== undefined ? input.tireSize : part.tireSize, input.tireType !== undefined ? input.tireType : part.tireType)
        : {};
      const updated = await tx.part.update({
        where: { id },
        data: {
          partNumber,
          displayName,
          ...tire,
          ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
          ...(input.unitCostCents !== undefined ? { unitCostCents: input.unitCostCents } : {}),
          ...(input.defaultVendorId !== undefined ? { defaultVendorId: input.defaultVendorId } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      if (fits) {
        await tx.partFitment.deleteMany({ where: { partId: id } });
        if (fits.length) await tx.partFitment.createMany({ data: fits.map((fit) => ({ partId: id, ...fit })) });
      }
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_CATALOG_UPDATED,
        entityType: 'part',
        entityId: id,
        userId: actor.id,
        previousValue: {
          displayName: part.displayName, partNumber: part.partNumber, unitCostCents: part.unitCostCents,
          defaultVendorId: part.defaultVendorId, active: part.active, fits: part.fitments.map(({ make, model }) => ({ make, model })),
          tireSize: part.tireSize, tireType: part.tireType, minStock: part.minStock,
        },
        newValue: {
          displayName: updated.displayName, partNumber: updated.partNumber, unitCostCents: updated.unitCostCents,
          defaultVendorId: updated.defaultVendorId, active: updated.active, ...(fits ? { fits } : {}),
          tireSize: updated.tireSize, tireType: updated.tireType, minStock: updated.minStock,
        },
        relevantValue: { action: 'part_updated', displayName: updated.displayName },
      });
      return { id };
    });
  }

  /** D45 / ST-2: a repair or tire category; the PM categories come from the base list and are not added here. */
  async createCategory(actor: AuthUser, raw: unknown) {
    const input = parse(adminCreatePartCategorySchema, raw);
    const existing = await this.prisma.partCategory.findMany({ select: { id: true, name: true, slug: true, sortOrder: true } });
    const twin = existing.find((category) => normalizeCatalogText(category.name) === normalizeCatalogText(input.name));
    if (twin) throw new ConflictException({ code: 'PART_CATEGORY_EXISTS', message: `"${twin.name}" already exists.`, categoryId: twin.id, categoryName: twin.name });
    const base = input.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
    const slugs = new Set(existing.map((category) => category.slug));
    let slug = base;
    for (let n = 2; slugs.has(slug); n += 1) slug = `${base}-${n}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.partCategory.create({
          data: { name: input.name, slug, kind: input.kind, sortOrder: Math.max(0, ...existing.map((row) => row.sortOrder)) + 10 },
        });
        await this.activity.log(tx, {
          eventType: ActivityEventType.PART_CATALOG_UPDATED,
          entityType: 'part_category',
          entityId: category.id,
          userId: actor.id,
          newValue: { action: 'part_category_created', name: category.name, kind: category.kind },
          relevantValue: { action: 'part_category_created', name: category.name },
        });
        return { id: category.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'PART_CATEGORY_EXISTS', message: 'A category with that name already exists.' });
      }
      throw error;
    }
  }

  async vendors(): Promise<AdminVendorDto[]> {
    const [vendors, purchases, repairs] = await Promise.all([
      this.prisma.vendor.findMany({
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        include: { _count: { select: { parts: true } } },
      }),
      // PCA9 (UX-5-004): how much history each vendor has, so the row can open it.
      this.prisma.partPurchase.groupBy({ by: ['vendorId'], where: { voidedAt: null }, _count: { _all: true }, _max: { invoiceDate: true } }),
      this.prisma.outsideRepair.groupBy({ by: ['vendorId'], where: { voidedAt: null }, _count: { _all: true }, _max: { invoiceDate: true } }),
    ]);
    const bought = new Map(purchases.map((row) => [row.vendorId, row]));
    const repaired = new Map(repairs.map((row) => [row.vendorId, row]));
    return vendors.map(({ _count, createdById: _by, createdAt: _at, updatedAt: _up, ...vendor }) => {
      const dates = [bought.get(vendor.id)?._max.invoiceDate, repaired.get(vendor.id)?._max.invoiceDate].filter((value): value is Date => Boolean(value));
      return {
        ...vendor,
        partCount: _count.parts,
        purchaseCount: bought.get(vendor.id)?._count._all ?? 0,
        repairCount: repaired.get(vendor.id)?._count._all ?? 0,
        lastInvoiceDate: dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString().slice(0, 10) : null,
      };
    });
  }

  async createVendor(actor: AuthUser, raw: unknown) {
    const input = parse(adminCreateVendorSchema, raw);
    return this.saveVendor(actor, null, input);
  }

  async updateVendor(actor: AuthUser, id: string, raw: unknown) {
    this.assertId(id, 'Vendor');
    const input = parse(adminUpdateVendorSchema, raw);
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const doesParts = input.doesParts ?? vendor.doesParts;
    const doesRepairs = input.doesRepairs ?? vendor.doesRepairs;
    if (!doesParts && !doesRepairs) throw new BadRequestException({ code: 'VENDOR_NEEDS_KIND', message: 'A vendor sells parts, does repairs, or both.' });
    return this.saveVendor(actor, vendor, input);
  }

  private async saveVendor(
    actor: AuthUser,
    previous: Prisma.VendorGetPayload<object> | null,
    input: { name?: string; doesParts?: boolean; doesRepairs?: boolean; phone?: string | null; email?: string | null; accountNumber?: string | null; notes?: string | null; active?: boolean },
  ) {
    if (input.name !== undefined) {
      const taken = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name FROM vendors WHERE lower(btrim(name)) = lower(btrim(${input.name})) LIMIT 1`;
      if (taken[0] && taken[0].id !== previous?.id) {
        throw new ConflictException({ code: 'VENDOR_NAME_TAKEN', message: `"${taken[0].name}" already exists.`, vendorId: taken[0].id, vendorName: taken[0].name });
      }
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
        const vendor = previous
          ? await tx.vendor.update({ where: { id: previous.id }, data })
          : await tx.vendor.create({ data: { ...(data as { name: string }), createdById: actor.id } });
        await this.activity.log(tx, {
          eventType: ActivityEventType.VENDOR_SAVED,
          entityType: 'vendor',
          entityId: vendor.id,
          userId: actor.id,
          previousValue: previous ?? undefined,
          newValue: vendor,
          relevantValue: { action: previous ? 'vendor_updated' : 'vendor_created', name: vendor.name },
        });
        return { id: vendor.id };
      });
    } catch (error) {
      // Two saves at once: the lower(name) index is the last word.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'VENDOR_NAME_TAKEN', message: 'A vendor with that name already exists.' });
      }
      throw error;
    }
  }

  /** Parts picked in a PM that is still being done (its PM Job not finished, its Work Order open), by part. */
  private async openPms(partId?: string): Promise<Map<string, OpenPm[]>> {
    const rows = await this.prisma.pmServicePart.findMany({
      where: {
        ...(partId ? { partId } : {}),
        pmService: {
          workOrder: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
          OR: [{ workOrderJobId: null }, { workOrderJob: { status: 'to_do' } }],
        },
      },
      select: {
        partId: true,
        pmService: { select: { workOrder: { select: { id: true, displayId: true, truck: { select: { id: true, truckNumber: true, make: true, model: true } } } } } },
      },
    });
    const byPart = new Map<string, OpenPm[]>();
    for (const row of rows) {
      const { workOrder } = row.pmService;
      const list = byPart.get(row.partId) ?? [];
      list.push({
        workOrderId: workOrder.id,
        displayId: workOrder.displayId,
        truckId: workOrder.truck.id,
        truckNumber: workOrder.truck.truckNumber,
        make: workOrder.truck.make,
        model: workOrder.truck.model,
      });
      byPart.set(row.partId, list);
    }
    return byPart;
  }

  private uniqueFits(fits: Array<{ make?: string | null; model?: string | null }>) {
    const seen = new Set<string>();
    return fits
      .map((fit) => ({ make: fit.make ?? null, model: fit.model ?? null }))
      .filter((fit) => !seen.has(fitKey(fit)) && Boolean(seen.add(fitKey(fit))));
  }

  /** The same category, number and name already exist (ignoring capitals and spaces). */
  private async assertNoTwin(tx: Prisma.TransactionClient, categoryId: string, partNumber: string | null, displayName: string, exceptId?: string) {
    const siblings = await tx.part.findMany({ where: { categoryId, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true, partNumber: true, displayName: true } });
    const twin = siblings.find((part) =>
      normalizeCatalogText(part.partNumber ?? '') === normalizeCatalogText(partNumber ?? '')
      && normalizeCatalogText(part.displayName) === normalizeCatalogText(displayName));
    if (twin) throw new ConflictException({ code: 'PART_EXISTS', message: 'That part is already in this category.', partId: twin.id });
  }

  /** D45 / ST-2: a tire needs its size and New or Recap; other kinds never carry them. */
  private tireFields(kind: string, size: string | null, type: 'new' | 'recap' | null) {
    if (kind !== 'tire') return { tireSize: null, tireType: null };
    if (!size || !type) throw new BadRequestException({ code: 'TIRE_FIELDS_REQUIRED', message: 'A tire needs its size and New or Recap.' });
    return { tireSize: size, tireType: type };
  }

  /** D45 / ST-2 (HU-R2): a part number belongs to one part in the whole catalog (ignoring capitals, spaces and dashes). */
  private async assertNumberFree(tx: Prisma.TransactionClient, partNumber: string | null, exceptId?: string) {
    if (!partNumber) return;
    const wanted = normalizeCatalogText(partNumber).replace(/[^a-z0-9]/g, '');
    if (!wanted) return;
    const others = await tx.part.findMany({
      where: { partNumber: { not: null }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, partNumber: true, displayName: true, category: { select: { name: true } } },
    });
    const twin = others.find((other) => normalizeCatalogText(other.partNumber!).replace(/[^a-z0-9]/g, '') === wanted);
    if (twin) {
      throw new ConflictException({
        code: 'PART_NUMBER_EXISTS',
        message: `Part number ${twin.partNumber} is already "${twin.displayName}" in ${twin.category.name}.`,
        partId: twin.id, partName: twin.displayName, categoryName: twin.category.name,
      });
    }
  }

  private async activeVendor(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id }, select: { active: true } });
    if (!vendor || !vendor.active) throw new BadRequestException({ code: 'VENDOR_NOT_ACTIVE', message: 'Pick an active vendor.' });
  }

  private assertId(id: string, label: string) {
    if (!UUID.test(id)) throw new BadRequestException(`Invalid ${label} id`);
  }
}
