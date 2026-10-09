import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  adminCustomJobGroupSchema,
  adminCustomJobsQuerySchema,
  adminReviewCustomJobsSchema,
  normalizeCatalogText,
  type AdminCustomJobGroupDto,
  type CustomJobReviewStatus,
} from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const REVIEWED: CustomJobReviewStatus[] = ['mapped', 'added', 'kept'];

function parse<T>(schema: { safeParse(raw: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

/** The key of a Custom Job's group: the name compared like catalog names, or its lowercase text when it has no letters. */
export function customJobNameNorm(displayName: string) {
  return normalizeCatalogText(displayName) || displayName.trim().toLowerCase();
}

const jobSelect = {
  id: true,
  displayName: true,
  customDescription: true,
  categoryId: true,
  addedAt: true,
  reviewStatus: true,
  mappedCatalogJobId: true,
  category: { select: { name: true } },
  workOrder: { select: { id: true, displayId: true, truck: { select: { truckNumber: true } } } },
} satisfies Prisma.WorkOrderJobSelect;
type JobRow = Prisma.WorkOrderJobGetPayload<{ select: typeof jobSelect }>;

/**
 * LTR-57 / D25: the Custom Jobs review inbox. A Custom Job is born `pending_review`; the inbox groups them by category
 * and name (capitals, accents and spaces ignored) and settles a whole group at once:
 * - **map**: it is a catalog Job — `mapped_catalog_job_id`, and the group's name becomes an alias of that Job;
 * - **add**: it is missing from the catalog — a new catalog Job (same checks as Add Job), and the group is tied to it;
 * - **keep**: it was a one-off.
 * The Work Orders keep their names and history; Undo puts a group back in the inbox.
 */
@Injectable()
export class CustomJobsReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(raw: unknown): Promise<AdminCustomJobGroupDto[]> {
    const { status } = parse(adminCustomJobsQuerySchema, raw);
    const jobs = await this.prisma.workOrderJob.findMany({
      where: {
        isCustom: true,
        ...(status === 'pending'
          ? { OR: [{ reviewStatus: 'pending_review' }, { reviewStatus: null }] }
          : { reviewStatus: { in: REVIEWED } }),
      },
      select: jobSelect,
      orderBy: { addedAt: 'desc' },
    });
    const groups = new Map<string, JobRow[]>();
    for (const job of jobs) {
      const key = `${job.categoryId}|${customJobNameNorm(job.displayName)}`;
      groups.set(key, [...(groups.get(key) ?? []), job]);
    }

    const catalog = status === 'pending'
      ? await this.prisma.catalogJob.findMany({
        where: { status: 'active' },
        select: { id: true, displayName: true, categoryId: true, category: { select: { name: true } }, aliases: { select: { aliasText: true, aliasNorm: true } } },
      })
      : [];
    const mappedIds = [...new Set(jobs.map((job) => job.mappedCatalogJobId).filter((id): id is string => Boolean(id)))];
    const mapped = mappedIds.length
      ? new Map((await this.prisma.catalogJob.findMany({ where: { id: { in: mappedIds } }, select: { id: true, displayName: true } })).map((row) => [row.id, row]))
      : new Map<string, { id: string; displayName: string }>();

    const result = [...groups.values()].map((rows): AdminCustomJobGroupDto => {
      const names = new Map<string, number>();
      for (const row of rows) names.set(row.displayName, (names.get(row.displayName) ?? 0) + 1);
      const [displayName] = [...names.entries()].sort((left, right) => right[1] - left[1])[0];
      const nameNorm = customJobNameNorm(displayName);
      const first = rows[0];
      return {
        categoryId: first.categoryId,
        categoryName: first.category.name,
        nameNorm,
        displayName,
        otherNames: [...names.keys()].filter((name) => name !== displayName),
        count: rows.length,
        lastAddedAt: first.addedAt.toISOString(),
        workOrders: [...new Map(rows.map((row) => [row.workOrder.id, { id: row.workOrder.id, displayId: row.workOrder.displayId, truckNumber: row.workOrder.truck.truckNumber }])).values()].slice(0, 5),
        descriptions: [...new Set(rows.map((row) => row.customDescription?.trim()).filter((text): text is string => Boolean(text)))].slice(0, 3),
        status: (first.reviewStatus as CustomJobReviewStatus | null) ?? 'pending_review',
        mappedTo: first.mappedCatalogJobId ? mapped.get(first.mappedCatalogJobId) ?? null : null,
        suggestions: status === 'pending' ? this.suggest(nameNorm, first.categoryId, catalog) : [],
      };
    });
    return result.sort((left, right) => right.count - left.count || right.lastAddedAt.localeCompare(left.lastAddedAt));
  }

  async review(actor: AuthUser, raw: unknown) {
    const input = parse(adminReviewCustomJobsSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const jobs = await this.groupJobs(tx, input.categoryId, input.nameNorm, 'pending');
      if (!jobs.length) throw new NotFoundException({ code: 'CUSTOM_JOB_GROUP_NOT_FOUND', message: 'Those Custom Jobs were already reviewed. Reload the inbox.' });
      const groupName = this.mostUsedName(jobs);
      let catalogJob: { id: string; displayName: string } | null = null;
      let aliasAdded = false;

      if (input.action === 'map') {
        catalogJob = await tx.catalogJob.findUnique({ where: { id: input.catalogJobId! }, select: { id: true, displayName: true } });
        if (!catalogJob) throw new BadRequestException({ code: 'CATALOG_JOB_NOT_FOUND', message: 'That catalog Job does not exist.' });
        if (input.addAlias && customJobNameNorm(catalogJob.displayName) !== input.nameNorm) {
          const taken = await tx.jobAlias.findUnique({ where: { aliasNorm: input.nameNorm }, select: { id: true } });
          if (!taken && normalizeCatalogText(groupName)) {
            await tx.jobAlias.create({ data: { catalogJobId: catalogJob.id, aliasText: groupName, aliasNorm: input.nameNorm } });
            aliasAdded = true;
          }
        }
      }

      if (input.action === 'add') {
        const displayName = input.displayName ?? groupName;
        const aliasNorm = normalizeCatalogText(displayName);
        if (!aliasNorm) throw new BadRequestException({ code: 'CATALOG_NAME_INVALID', message: 'Use letters or numbers in the name.' });
        const category = await tx.jobCategory.findUnique({ where: { id: input.categoryId }, select: { status: true } });
        if (!category) throw new NotFoundException('Category not found');
        if (category.status !== 'active') throw new ConflictException({ code: 'CATALOG_CATEGORY_INACTIVE', message: 'Activate the category before adding Jobs to it.' });
        const clash = await tx.jobAlias.findUnique({
          where: { aliasNorm },
          select: { catalogJob: { select: { id: true, displayName: true, category: { select: { name: true } } } } },
        });
        if (clash) {
          throw new ConflictException({
            code: 'CATALOG_JOB_EXISTS',
            message: `"${clash.catalogJob.displayName}" (${clash.catalogJob.category.name}) already has that name. Tie the group to it instead.`,
            jobId: clash.catalogJob.id,
            jobName: clash.catalogJob.displayName,
          });
        }
        catalogJob = await tx.catalogJob.create({
          data: { categoryId: input.categoryId, displayName, status: 'active', createdById: actor.id, aliases: { create: { aliasText: displayName, aliasNorm } } },
          select: { id: true, displayName: true },
        });
        if (aliasNorm !== input.nameNorm && normalizeCatalogText(groupName) && !(await tx.jobAlias.findUnique({ where: { aliasNorm: input.nameNorm }, select: { id: true } }))) {
          await tx.jobAlias.create({ data: { catalogJobId: catalogJob.id, aliasText: groupName, aliasNorm: input.nameNorm } });
          aliasAdded = true;
        }
      }

      const status: CustomJobReviewStatus = input.action === 'map' ? 'mapped' : input.action === 'add' ? 'added' : 'kept';
      await tx.workOrderJob.updateMany({
        where: { id: { in: jobs.map((job) => job.id) } },
        data: { reviewStatus: status, mappedCatalogJobId: catalogJob?.id ?? null },
      });
      await this.activity.log(tx, {
        eventType: ActivityEventType.CUSTOM_JOBS_REVIEWED,
        entityType: 'custom_job_group',
        entityId: catalogJob?.id,
        userId: actor.id,
        newValue: { action: input.action, categoryId: input.categoryId, name: groupName, jobIds: jobs.map((job) => job.id), catalogJobId: catalogJob?.id ?? null, aliasAdded },
        relevantValue: { action: `custom_jobs_${status}`, name: groupName, count: jobs.length, catalogJob: catalogJob?.displayName ?? null },
      });
      return { updated: jobs.length, status, catalogJob, aliasAdded };
    });
  }

  /** Puts a reviewed group back in the inbox. The catalog Job or alias it created stays. */
  async undo(actor: AuthUser, raw: unknown) {
    const input = parse(adminCustomJobGroupSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const jobs = await this.groupJobs(tx, input.categoryId, input.nameNorm, 'reviewed');
      if (!jobs.length) throw new NotFoundException({ code: 'CUSTOM_JOB_GROUP_NOT_FOUND', message: 'Nothing to undo for that group.' });
      await tx.workOrderJob.updateMany({ where: { id: { in: jobs.map((job) => job.id) } }, data: { reviewStatus: 'pending_review', mappedCatalogJobId: null } });
      await this.activity.log(tx, {
        eventType: ActivityEventType.CUSTOM_JOBS_REVIEWED,
        entityType: 'custom_job_group',
        userId: actor.id,
        newValue: { action: 'undo', categoryId: input.categoryId, name: this.mostUsedName(jobs), jobIds: jobs.map((job) => job.id) },
        relevantValue: { action: 'custom_jobs_back_to_review', name: this.mostUsedName(jobs), count: jobs.length },
      });
      return { updated: jobs.length };
    });
  }

  private async groupJobs(tx: Prisma.TransactionClient, categoryId: string, nameNorm: string, which: 'pending' | 'reviewed') {
    const candidates = await tx.workOrderJob.findMany({
      where: {
        isCustom: true,
        categoryId,
        ...(which === 'pending' ? { OR: [{ reviewStatus: 'pending_review' }, { reviewStatus: null }] } : { reviewStatus: { in: REVIEWED } }),
      },
      select: { id: true, displayName: true },
    });
    return candidates.filter((job) => customJobNameNorm(job.displayName) === nameNorm);
  }

  private mostUsedName(jobs: Array<{ displayName: string }>) {
    const counts = new Map<string, number>();
    for (const job of jobs) counts.set(job.displayName, (counts.get(job.displayName) ?? 0) + 1);
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
  }

  /** Catalog Jobs whose name or an alias equals or contains the group's name (or the other way), same category first. */
  private suggest(
    nameNorm: string,
    categoryId: string,
    catalog: Array<{ id: string; displayName: string; categoryId: string; category: { name: string }; aliases: Array<{ aliasText: string; aliasNorm: string }> }>,
  ) {
    const scored: Array<{ score: number; item: AdminCustomJobGroupDto['suggestions'][number] }> = [];
    for (const job of catalog) {
      let best = 0;
      let matchedAlias: string | null = null;
      for (const alias of job.aliases) {
        const exact = alias.aliasNorm === nameNorm;
        const near = nameNorm.length >= 4 && alias.aliasNorm.length >= 4 && (alias.aliasNorm.includes(nameNorm) || nameNorm.includes(alias.aliasNorm));
        const score = exact ? 3 : near ? 1 : 0;
        if (score > best) {
          best = score;
          matchedAlias = normalizeCatalogText(job.displayName) === alias.aliasNorm ? null : alias.aliasText;
        }
      }
      if (best) scored.push({ score: best + (job.categoryId === categoryId ? 0.5 : 0), item: { catalogJobId: job.id, displayName: job.displayName, categoryName: job.category.name, matchedAlias } });
    }
    return scored.sort((left, right) => right.score - left.score).slice(0, 3).map((entry) => entry.item);
  }
}
