import { describe, expect, it, vi } from 'vitest';
import { normalizeCatalogText } from '@ltl-shop/shared';
import { CatalogAdminService } from './catalog-admin.service';

const JOB = '00000000-0000-4000-8000-000000000801';
const OTHER = '00000000-0000-4000-8000-000000000802';
const CATEGORY = '00000000-0000-4000-8000-000000000301';
const ALIAS = '00000000-0000-4000-8000-000000000901';

function service(prisma: Record<string, unknown>) {
  return new CatalogAdminService(prisma as never);
}

describe('normalizeCatalogText (LTR-198 / JC5)', () => {
  it('ignores accents, capitals, spaces and symbols', () => {
    expect(normalizeCatalogText('Líneas de combustible')).toBe(normalizeCatalogText('lineas  de-combustible'));
    expect(normalizeCatalogText('Alineación')).toBe('alineacion');
    expect(normalizeCatalogText('  ')).toBe('');
  });
});

describe('CatalogAdminService (LTR-198 / D30)', () => {
  it('deletes a Job only when no Work Order used it; a System Job never', async () => {
    const findUnique = vi.fn();
    const prisma = {
      catalogJob: { findUnique, delete: vi.fn() },
      workOrderJob: { count: vi.fn().mockResolvedValue(0) },
    };
    findUnique.mockResolvedValueOnce({ id: JOB, systemKey: null, _count: { workOrderJobs: 2, workflowSteps: 0 } });
    await expect(service(prisma).deleteJob(JOB)).rejects.toMatchObject({ status: 409, response: { code: 'CATALOG_JOB_IN_USE', workOrderCount: 2 } });
    findUnique.mockResolvedValueOnce({ id: JOB, systemKey: 'alignment', _count: { workOrderJobs: 0, workflowSteps: 1 } });
    await expect(service(prisma).deleteJob(JOB)).rejects.toMatchObject({ response: { code: 'SYSTEM_JOB_LOCKED' } });
    findUnique.mockResolvedValueOnce({ id: JOB, systemKey: null, _count: { workOrderJobs: 0, workflowSteps: 0 } });
    await expect(service(prisma).deleteJob(JOB)).resolves.toEqual({ deleted: true });
    expect(prisma.catalogJob.delete).toHaveBeenCalledWith({ where: { id: JOB } });
  });

  it('an alias that clashes says which Job and Category already have it', async () => {
    const prisma = {
      catalogJob: { findUnique: vi.fn().mockResolvedValue({ id: JOB }) },
      jobAlias: {
        findUnique: vi.fn().mockResolvedValue({ aliasText: 'Lights', catalogJobId: OTHER, catalogJob: { displayName: 'Lights', category: { name: 'Electrical & Starting' } } }),
        create: vi.fn(),
      },
    };
    await expect(service(prisma).addAlias(JOB, { text: 'líghts' })).rejects.toMatchObject({
      status: 409,
      response: { code: 'CATALOG_ALIAS_EXISTS', jobId: OTHER, jobName: 'Lights', categoryName: 'Electrical & Starting' },
    });
    expect(prisma.jobAlias.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { aliasNorm: 'lights' } }));
    expect(prisma.jobAlias.create).not.toHaveBeenCalled();
  });

  it('keeps the Job\'s own name as an alias', async () => {
    const prisma = {
      jobAlias: {
        findUnique: vi.fn().mockResolvedValue({ id: ALIAS, catalogJobId: JOB, aliasNorm: 'fuellines', catalogJob: { displayName: 'Fuel Lines' } }),
        delete: vi.fn(),
      },
    };
    await expect(service(prisma).removeAlias(JOB, ALIAS)).rejects.toMatchObject({ response: { code: 'ALIAS_IS_JOB_NAME' } });
    expect(prisma.jobAlias.delete).not.toHaveBeenCalled();
  });

  it('a Shop workflow Category is locked; one holding a System Job stays active', async () => {
    const findUnique = vi.fn();
    const prisma = { jobCategory: { findUnique, findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() } };
    findUnique.mockResolvedValueOnce({ id: CATEGORY, name: 'PM', status: 'active', systemKey: 'pm', inactiveReason: null, catalogJobs: [] });
    await expect(service(prisma).updateCategory(CATEGORY, { name: 'Preventive' })).rejects.toMatchObject({ response: { code: 'SYSTEM_CATEGORY_LOCKED' } });
    findUnique.mockResolvedValueOnce({
      id: CATEGORY, name: 'Suspension & Steering', status: 'active', systemKey: null, inactiveReason: null,
      catalogJobs: [{ status: 'active', systemKey: 'alignment', _count: { aliases: 1 } }],
    });
    await expect(service(prisma).updateCategory(CATEGORY, { status: 'inactive' })).rejects.toMatchObject({ response: { code: 'CATEGORY_HAS_SYSTEM_JOB' } });
    expect(prisma.jobCategory.update).not.toHaveBeenCalled();
  });

  it('deactivating keeps the reason; activating clears it', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: CATEGORY, name: 'Trailer', status: 'active', systemKey: null, inactiveReason: null, catalogJobs: [] });
    const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: CATEGORY, name: 'Trailer', sortOrder: 1, systemKey: null, status: data.status ?? 'active', inactiveReason: data.inactiveReason }));
    const prisma = { jobCategory: { findUnique, findFirst: vi.fn().mockResolvedValue(null), update } };
    await expect(service(prisma).updateCategory(CATEGORY, { status: 'inactive', inactiveReason: 'Later' })).resolves.toMatchObject({ status: 'inactive', inactiveReason: 'Later' });
    findUnique.mockResolvedValueOnce({ id: CATEGORY, name: 'Trailer', status: 'inactive', systemKey: null, inactiveReason: 'Later', catalogJobs: [] });
    await expect(service(prisma).updateCategory(CATEGORY, { status: 'active' })).resolves.toMatchObject({ status: 'active', inactiveReason: null });
  });
});
