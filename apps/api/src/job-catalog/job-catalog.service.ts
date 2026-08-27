import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function normalizeAlias(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

@Injectable()
export class JobCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.jobCategory.findMany({
      where: { status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, sortOrder: true },
    });
  }

  async listJobs(categoryId?: string, q?: string) {
    const query = q?.trim();
    if (query) {
      const norm = normalizeAlias(query);
      const byAlias = await this.prisma.jobAlias.findMany({
        where: {
          OR: [
            { aliasNorm: { contains: norm } },
            { aliasText: { contains: query, mode: 'insensitive' } },
          ],
          catalogJob: {
            status: 'active',
            ...(categoryId ? { categoryId } : {}),
          },
        },
        include: { catalogJob: { include: { aliases: true } } },
        take: 40,
      });
      const seen = new Set<string>();
      const jobs = [];
      for (const row of byAlias) {
        if (seen.has(row.catalogJobId)) continue;
        seen.add(row.catalogJobId);
        jobs.push(mapJob(row.catalogJob));
      }
      if (jobs.length) return jobs;
    }

    const jobs = await this.prisma.catalogJob.findMany({
      where: {
        status: 'active',
        ...(categoryId ? { categoryId } : {}),
        ...(query
          ? { displayName: { contains: query, mode: 'insensitive' } }
          : {}),
      },
      include: { aliases: true },
      orderBy: { displayName: 'asc' },
      take: 100,
    });
    return jobs.map(mapJob);
  }

  async listAliases(categoryId?: string, q?: string) {
    const query = q?.trim();
    const rows = await this.prisma.jobAlias.findMany({
      where: {
        catalogJob: {
          status: 'active',
          ...(categoryId ? { categoryId } : {}),
        },
        ...(query
          ? {
              OR: [
                { aliasNorm: { contains: normalizeAlias(query) } },
                { aliasText: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        catalogJob: {
          select: { id: true, categoryId: true, displayName: true },
        },
      },
      orderBy: { aliasText: 'asc' },
      take: 200,
    });

    return rows.map((row) => ({
      aliasText: row.aliasText,
      catalogJobId: row.catalogJobId,
      categoryId: row.catalogJob.categoryId,
      displayName: row.catalogJob.displayName,
    }));
  }
}

function mapJob(job: {
  id: string;
  categoryId: string;
  displayName: string;
  aliases: { aliasText: string }[];
}) {
  return {
    id: job.id,
    categoryId: job.categoryId,
    displayName: job.displayName,
    aliases: job.aliases.map((a) => a.aliasText),
  };
}

export { normalizeAlias };
