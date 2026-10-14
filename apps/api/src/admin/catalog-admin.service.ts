import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogStatus,
  adminCreateCatalogAliasSchema,
  adminCreateCatalogCategorySchema,
  adminUpdateCatalogCategorySchema,
  normalizeCatalogText,
  type AdminCatalogCategorySummaryDto,
  type AdminCatalogSearchHitDto,
} from '@ltl-shop/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireId(id: string, what: string) {
  if (!UUID.test(id)) throw new BadRequestException(`Invalid ${what} id`);
}

/**
 * LTR-198 / D30: the Shop Manager manages the Job Catalog — Categories (create, rename, activate, deactivate with an
 * optional reason, delete if never used), Jobs (delete if never used), aliases (add, remove) and a search across
 * Jobs and aliases. System Jobs and Categories (PM, Alignment, Detailing, Quality Check) are protected.
 * Creating and renaming a Job stay in SystemAdminWritesService (D25).
 */
@Injectable()
export class CatalogAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(raw: unknown): Promise<AdminCatalogCategorySummaryDto> {
    const parsed = adminCreateCatalogCategorySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.assertCategoryNameAvailable(parsed.data.name);
    const last = await this.prisma.jobCategory.aggregate({ _max: { sortOrder: true } });
    const created = await this.prisma.jobCategory.create({
      data: { name: parsed.data.name, sortOrder: (last._max.sortOrder ?? 0) + 1, status: 'active' },
    });
    return { ...this.summary(created, []), holdsSystemJob: false };
  }

  async updateCategory(id: string, raw: unknown): Promise<AdminCatalogCategorySummaryDto> {
    requireId(id, 'Category');
    const parsed = adminUpdateCatalogCategorySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const current = await this.prisma.jobCategory.findUnique({
      where: { id },
      include: { catalogJobs: { select: { status: true, systemKey: true, _count: { select: { aliases: true } } } } },
    });
    if (!current) throw new NotFoundException('Category not found');
    const renaming = input.name !== undefined && input.name !== current.name;
    const deactivating = input.status === CatalogStatus.INACTIVE && current.status === 'active';
    if (current.systemKey && (renaming || deactivating)) {
      // The app reads PM, Detailing and Quality Check Categories by name; they stay as they are.
      throw new ConflictException({ code: 'SYSTEM_CATEGORY_LOCKED', message: 'This Category belongs to the Shop workflow and cannot be renamed or deactivated.' });
    }
    if (deactivating && current.catalogJobs.some((job) => job.systemKey)) {
      throw new ConflictException({ code: 'CATEGORY_HAS_SYSTEM_JOB', message: 'This Category holds a Shop workflow Job, so it stays active.' });
    }
    if (renaming) await this.assertCategoryNameAvailable(input.name!, id);
    const status = input.status ?? current.status;
    const updated = await this.prisma.jobCategory.update({
      where: { id },
      data: {
        ...(renaming ? { name: input.name } : {}),
        ...(input.status ? { status: input.status } : {}),
        // An active Category has no reason; an inactive one keeps the one given (or the one it had).
        inactiveReason: status === 'active' ? null : (input.inactiveReason !== undefined ? input.inactiveReason || null : current.inactiveReason),
      },
    });
    return this.summary(updated, current.catalogJobs);
  }

  async deleteCategory(id: string) {
    requireId(id, 'Category');
    const current = await this.prisma.jobCategory.findUnique({
      where: { id },
      select: { id: true, systemKey: true, _count: { select: { catalogJobs: true, workOrders: true, workOrderJobs: true } } },
    });
    if (!current) throw new NotFoundException('Category not found');
    if (current.systemKey) {
      throw new ConflictException({ code: 'SYSTEM_CATEGORY_LOCKED', message: 'This Category belongs to the Shop workflow and cannot be deleted.' });
    }
    const used = current._count.workOrders + current._count.workOrderJobs;
    if (current._count.catalogJobs || used) {
      throw new ConflictException({
        code: 'CATALOG_CATEGORY_IN_USE',
        message: 'Only an empty Category that was never used can be deleted. Deactivate it instead.',
        jobCount: current._count.catalogJobs,
        workOrderCount: used,
      });
    }
    await this.prisma.jobCategory.delete({ where: { id } });
    return { deleted: true };
  }

  /** Delete a Job only if no Work Order ever used it; otherwise the Manager deactivates it. */
  async deleteJob(id: string) {
    requireId(id, 'Catalog Job');
    const job = await this.prisma.catalogJob.findUnique({
      where: { id },
      select: { id: true, systemKey: true, _count: { select: { workOrderJobs: true, workflowSteps: true, inspectionChecklistItems: true, inspectionItems: true } } },
    });
    if (!job) throw new NotFoundException('Catalog job not found');
    if (job.systemKey) {
      throw new ConflictException({ code: 'SYSTEM_JOB_LOCKED', message: 'This Job is part of the Shop workflow; it cannot be deactivated or deleted.' });
    }
    if (job._count.workflowSteps) {
      throw new ConflictException({ code: 'CATALOG_JOB_IN_WORKFLOW', message: 'This Job is a Shop workflow step.' });
    }
    const mapped = await this.prisma.workOrderJob.count({ where: { mappedCatalogJobId: id } });
    const workOrderCount = job._count.workOrderJobs + mapped;
    if (workOrderCount) {
      throw new ConflictException({
        code: 'CATALOG_JOB_IN_USE',
        message: 'Work Orders already use this Job, so it cannot be deleted. Deactivate it instead.',
        workOrderCount,
      });
    }
    // D41: the inspection checklist (or a saved inspection) points to it.
    if (job._count.inspectionChecklistItems || job._count.inspectionItems) {
      throw new ConflictException({ code: 'CATALOG_JOB_IN_INSPECTION_CHECKLIST', message: 'Inspection checks use this Job. Change them in Setup → Inspection checklist first.' });
    }
    await this.prisma.catalogJob.delete({ where: { id } });
    return { deleted: true };
  }

  async addAlias(jobId: string, raw: unknown) {
    requireId(jobId, 'Catalog Job');
    const parsed = adminCreateCatalogAliasSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const aliasNorm = normalizeCatalogText(parsed.data.text);
    if (!aliasNorm) throw new BadRequestException({ code: 'ALIAS_EMPTY', message: 'An alias needs a letter or a number.' });
    const job = await this.prisma.catalogJob.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) throw new NotFoundException('Catalog job not found');
    await this.assertAliasFree(aliasNorm, jobId);
    try {
      const alias = await this.prisma.jobAlias.create({ data: { catalogJobId: jobId, aliasText: parsed.data.text, aliasNorm } });
      return { id: alias.id, text: alias.aliasText };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.assertAliasFree(aliasNorm, jobId);
        throw new ConflictException({ code: 'CATALOG_ALIAS_EXISTS', message: 'That alias is already used.' });
      }
      throw error;
    }
  }

  async removeAlias(jobId: string, aliasId: string) {
    requireId(jobId, 'Catalog Job');
    requireId(aliasId, 'Alias');
    const alias = await this.prisma.jobAlias.findUnique({
      where: { id: aliasId },
      select: { id: true, catalogJobId: true, aliasNorm: true, catalogJob: { select: { displayName: true } } },
    });
    if (!alias || alias.catalogJobId !== jobId) throw new NotFoundException('Alias not found');
    if (alias.aliasNorm === normalizeCatalogText(alias.catalogJob.displayName)) {
      throw new BadRequestException({ code: 'ALIAS_IS_JOB_NAME', message: 'The Job\'s own name is always an alias. Rename the Job instead.' });
    }
    await this.prisma.jobAlias.delete({ where: { id: aliasId } });
    return { deleted: true };
  }

  /** JC2: Jobs whose name or an alias contains the text, accents and capitals ignored. Inactive ones too (marked). */
  async search(rawQuery: unknown): Promise<AdminCatalogSearchHitDto[]> {
    const q = typeof rawQuery === 'string' ? rawQuery : '';
    const norm = normalizeCatalogText(q);
    if (!norm) return [];
    const jobs = await this.prisma.catalogJob.findMany({
      where: {
        OR: [
          { displayName: { contains: q.trim(), mode: 'insensitive' } },
          { aliases: { some: { aliasNorm: { contains: norm } } } },
        ],
      },
      include: {
        category: { select: { id: true, name: true, status: true } },
        aliases: { select: { aliasText: true, aliasNorm: true } },
      },
      orderBy: [{ status: 'asc' }, { displayName: 'asc' }],
      take: 50,
    });
    return jobs.map((job) => {
      const nameMatches = normalizeCatalogText(job.displayName).includes(norm);
      const alias = nameMatches ? null : job.aliases.find((item) => item.aliasNorm.includes(norm)) ?? null;
      return {
        jobId: job.id,
        displayName: job.displayName,
        status: job.status as CatalogStatus,
        categoryId: job.category.id,
        categoryName: job.category.name,
        categoryStatus: job.category.status as CatalogStatus,
        matchedAlias: alias?.aliasText ?? null,
      };
    });
  }

  private async assertCategoryNameAvailable(name: string, excludeId?: string) {
    const duplicate = await this.prisma.jobCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({ code: 'CATALOG_CATEGORY_EXISTS', message: 'A Category with this name already exists.', categoryId: duplicate.id });
    }
  }

  /** UX-7-003: a clashing alias says which Job and Category already have it. */
  private async assertAliasFree(aliasNorm: string, jobId: string) {
    const taken = await this.prisma.jobAlias.findUnique({
      where: { aliasNorm },
      select: { aliasText: true, catalogJobId: true, catalogJob: { select: { displayName: true, category: { select: { name: true } } } } },
    });
    if (!taken) return;
    if (taken.catalogJobId === jobId) {
      throw new ConflictException({ code: 'CATALOG_ALIAS_EXISTS', message: 'This Job already has that alias.', jobId, jobName: taken.catalogJob.displayName, categoryName: taken.catalogJob.category.name, aliasText: taken.aliasText });
    }
    throw new ConflictException({
      code: 'CATALOG_ALIAS_EXISTS',
      message: `"${taken.aliasText}" is already an alias of ${taken.catalogJob.displayName} (${taken.catalogJob.category.name}).`,
      jobId: taken.catalogJobId,
      jobName: taken.catalogJob.displayName,
      categoryName: taken.catalogJob.category.name,
      aliasText: taken.aliasText,
    });
  }

  private summary(
    row: { id: string; name: string; status: string; sortOrder: number; systemKey: string | null; inactiveReason: string | null },
    jobs: Array<{ status: string; systemKey?: string | null; _count: { aliases: number } }>,
  ): AdminCatalogCategorySummaryDto {
    return {
      id: row.id,
      name: row.name,
      status: row.status as CatalogStatus,
      sortOrder: row.sortOrder,
      activeJobCount: jobs.filter((job) => job.status === 'active').length,
      inactiveJobCount: jobs.filter((job) => job.status !== 'active').length,
      aliasCount: jobs.reduce((sum, job) => sum + job._count.aliases, 0),
      systemKey: row.systemKey,
      inactiveReason: row.inactiveReason,
      holdsSystemJob: jobs.some((job) => Boolean(job.systemKey)),
    };
  }
}
