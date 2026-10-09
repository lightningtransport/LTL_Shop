import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  OPEN_WORK_ORDER_STATUSES,
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
    const [categories, usage, openPms, makes] = await Promise.all([
      this.prisma.partCategory.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
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
      this.prisma.truck.findMany({ where: { make: { not: null } }, distinct: ['make'], select: { make: true }, orderBy: { make: 'asc' } }),
    ]);
    const usageByPart = new Map(usage.map((row) => [row.part_id, row]));
    const needle = normalizeCatalogText(query.q ?? '');
    const make = query.make ? { make: query.make, model: null } : null;
    let costedPartCount = 0;
    const result = categories.map((category) => ({
      id: category.id,
      name: category.name,
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
            usedInPmCount: Number(used?.uses ?? 0),
            lastUsedAt: used?.last_used_at ? used.last_used_at.toISOString() : null,
            openPms: (openPms.get(part.id) ?? []).map(({ make: _make, model: _model, ...pm }) => pm),
          };
        }),
    }));
    return { categories: result, truckMakes: makes.map((truck) => truck.make!).filter(Boolean), costedPartCount };
  }

  async createPart(actor: AuthUser, raw: unknown) {
    const input = parse(adminCreatePartSchema, raw);
    const category = await this.prisma.partCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category) throw new BadRequestException({ code: 'PART_CATEGORY_NOT_FOUND', message: 'That category does not exist.' });
    if (input.defaultVendorId) await this.activeVendor(input.defaultVendorId);
    const fits = this.uniqueFits(input.fits);
    return this.prisma.$transaction(async (tx) => {
      await this.assertNoTwin(tx, category.id, input.partNumber ?? null, input.displayName);
      const part = await tx.part.create({
        data: {
          categoryId: category.id,
          partNumber: input.partNumber ?? null,
          displayName: input.displayName,
          unitCostCents: input.unitCostCents ?? null,
          defaultVendorId: input.defaultVendorId ?? null,
          source: 'app',
          fitments: { create: fits },
        },
      });
      await this.activity.log(tx, {
        eventType: ActivityEventType.PART_CATALOG_UPDATED,
        entityType: 'part',
        entityId: part.id,
        userId: actor.id,
        newValue: { action: 'part_created', displayName: part.displayName, partNumber: part.partNumber, unitCostCents: part.unitCostCents, fits },
        relevantValue: { action: 'part_created', displayName: part.displayName },
      });
      return { id: part.id };
    });
  }

  async updatePart(actor: AuthUser, id: string, raw: unknown) {
    this.assertId(id, 'Part');
    const input = parse(adminUpdatePartSchema, raw);
    const part = await this.prisma.part.findUnique({ where: { id }, include: { fitments: true } });
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
      const updated = await tx.part.update({
        where: { id },
        data: {
          partNumber,
          displayName,
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
        },
        newValue: {
          displayName: updated.displayName, partNumber: updated.partNumber, unitCostCents: updated.unitCostCents,
          defaultVendorId: updated.defaultVendorId, active: updated.active, ...(fits ? { fits } : {}),
        },
        relevantValue: { action: 'part_updated', displayName: updated.displayName },
      });
      return { id };
    });
  }

  async vendors(): Promise<AdminVendorDto[]> {
    const vendors = await this.prisma.vendor.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { parts: true } } },
    });
    return vendors.map(({ _count, createdById: _by, createdAt: _at, updatedAt: _up, ...vendor }) => ({ ...vendor, partCount: _count.parts }));
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

  private async activeVendor(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id }, select: { active: true } });
    if (!vendor || !vendor.active) throw new BadRequestException({ code: 'VENDOR_NOT_ACTIVE', message: 'Pick an active vendor.' });
  }

  private assertId(id: string, label: string) {
    if (!UUID.test(id)) throw new BadRequestException(`Invalid ${label} id`);
  }
}
