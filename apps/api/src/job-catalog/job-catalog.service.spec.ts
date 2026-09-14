import { describe, expect, it, vi } from 'vitest';
import { JobCatalogService } from './job-catalog.service';

describe('JobCatalogService', () => {
  it('lists active jobs for a categoryId without a search query', async () => {
    const jobs = [
      {
        id: 'job-1',
        categoryId: 'cat-air-brake',
        displayName: 'Brake Inspection',
        aliases: [{ aliasText: 'brakes' }],
      },
    ];
    const prisma = {
      catalogJob: {
        findMany: vi.fn().mockResolvedValue(jobs),
      },
    };
    const service = new JobCatalogService(prisma as never);

    await expect(service.listJobs('cat-air-brake')).resolves.toEqual([
      {
        id: 'job-1',
        categoryId: 'cat-air-brake',
        displayName: 'Brake Inspection',
        aliases: ['brakes'],
      },
    ]);
    expect(prisma.catalogJob.findMany).toHaveBeenCalledWith({
      where: { status: 'active', categoryId: 'cat-air-brake' },
      include: { aliases: true },
      orderBy: { displayName: 'asc' },
      take: 100,
    });
  });

  it('does not list the PM category as a renamed Preventive Maintenance row', async () => {
    const prisma = {
      jobCategory: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'cat-pm', name: 'PM', sortOrder: 0 },
          { id: 'cat-inspection', name: 'Inspection', sortOrder: 1 },
        ]),
      },
    };
    const service = new JobCatalogService(prisma as never);
    await expect(service.listCategories()).resolves.toEqual([
      { id: 'cat-pm', name: 'PM', sortOrder: 0 },
      { id: 'cat-inspection', name: 'Inspection', sortOrder: 1 },
    ]);
    expect(prisma.jobCategory.findMany).toHaveBeenCalledWith({
      where: { status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, sortOrder: true },
    });
  });
});
