import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { resolveMandatoryJobs } from './mandatory-jobs';
import { WorkOrdersService } from './work-orders.service';

const catalog: Record<string, { id: string; categoryId: string; displayName: string }> = {
  'PM A Service': { id: 'cj-pm-a', categoryId: 'cat-pm', displayName: 'PM A Service' },
  Alignment: { id: 'cj-align', categoryId: 'cat-susp', displayName: 'Alignment' },
  Detailing: { id: 'cj-detail', categoryId: 'cat-detail', displayName: 'Detailing' },
  'Quality Check': { id: 'cj-qc', categoryId: 'cat-qc', displayName: 'Quality Check' },
};
const catalogClient = () => ({
  catalogJob: {
    findFirst: vi.fn(async ({ where }: { where: { displayName: string } }) => catalog[where.displayName] ?? null),
  },
});

describe('mandatory Work Plan jobs (LTR-145)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('adds PM A, Alignment, Detailing and QC by catalog name', async () => {
    const client = catalogClient();
    const jobs = await resolveMandatoryJobs(client as never, [{ categoryName: 'Air & Brake', displayName: 'Brake Repair' }]);
    expect(jobs.map((job) => job.displayName)).toEqual(['PM A Service', 'Alignment', 'Detailing', 'Quality Check']);
    expect(client.catalogJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { displayName: 'PM A Service', status: 'active', category: { name: 'PM', status: 'active' } },
    }));
  });

  it('skips steps the Manager already picked (PM B counts as PM) and missing catalog rows', async () => {
    const client = catalogClient();
    delete (catalog as Record<string, unknown>)['Quality Check'];
    const jobs = await resolveMandatoryJobs(client as never, [
      { categoryName: 'PM', displayName: 'PM B Service' },
      { categoryName: 'Suspension & Steering', displayName: 'Alignment' },
    ]);
    expect(jobs.map((job) => job.displayName)).toEqual(['Detailing']);
    catalog['Quality Check'] = { id: 'cj-qc', categoryId: 'cat-qc', displayName: 'Quality Check' };
  });

  it('resolves mandatory jobs on Manager create only when WORK_PLAN_PM_PHASE is on', async () => {
    const manager: AuthUser = {
      id: 'mgr', email: 'm@l.local', name: 'Manager', role: 'manager', active: true, pmAuthorized: false,
      capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
    };
    const truckId = '11111111-1111-4111-8111-111111111111';
    const categoryId = '33333333-3333-4333-8333-333333333333';
    const build = () => {
      const prisma = {
        ...catalogClient(),
        workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
        truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
        jobCategory: {
          findUnique: vi.fn().mockResolvedValue({ id: categoryId, name: 'Air & Brake' }),
          findMany: vi.fn().mockResolvedValue([{ id: categoryId, name: 'Air & Brake' }]),
        },
        $transaction: vi.fn().mockRejectedValue(new Error('reached-transaction')),
      };
      return { prisma, service: new WorkOrdersService(prisma as never, { log: vi.fn() } as never) };
    };
    const body = { truckId, primaryCategoryId: categoryId, jobs: [{ categoryId, displayName: 'Brake Repair' }] };

    const off = build();
    await expect(off.service.createByManager(manager, body)).rejects.toThrow('reached-transaction');
    expect(off.prisma.catalogJob.findFirst).not.toHaveBeenCalled();

    vi.stubEnv('WORK_PLAN_PM_PHASE', 'true');
    const on = build();
    await expect(on.service.createByManager(manager, body)).rejects.toThrow('reached-transaction');
    expect(on.prisma.catalogJob.findFirst).toHaveBeenCalledTimes(4);
  });
});
