import { describe, expect, it, vi } from 'vitest';
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

type Owner = { id: string; active: boolean; capabilities: { capability: string }[] } | null;
const daniel: Owner = { id: 'daniel', active: true, capabilities: [{ capability: 'MECHANIC_PM' }] };
const anthony: Owner = { id: 'anthony', active: true, capabilities: [{ capability: 'MECHANIC_STANDARD' }] };

const alejandro: Owner = { id: 'alejandro', active: true, capabilities: [{ capability: 'MECHANIC_STANDARD' }] };
const safety: Owner = { id: 'safety', active: true, capabilities: [{ capability: 'QUALITY_CHECK_PERFORM' }] };

/** LTR-197 / D28: a step's team (`owner` alone is a team of one; an array is the whole team). */
function step(stepKey: string, jobName: string, categoryName: string, owner: Owner | Owner[] = null) {
  const job = catalog[jobName];
  const team = (Array.isArray(owner) ? owner : [owner]).filter((member): member is NonNullable<Owner> => member !== null);
  return {
    stepKey,
    catalogJob: { id: job.id, categoryId: job.categoryId, displayName: job.displayName, category: { name: categoryName } },
    members: team.map((user) => ({ user })),
  };
}

const configuredSteps = (overrides: { pm?: Owner; detailing?: Owner | Owner[]; qc?: Owner | Owner[] } = {}) => [
  step('pm', 'PM A Service', 'PM', overrides.pm ?? daniel),
  step('alignment', 'Alignment', 'Suspension & Steering', anthony),
  step('detailing', 'Detailing', 'Detailing', overrides.detailing ?? anthony),
  step('quality_check', 'Quality Check', 'Quality Check', overrides.qc ?? null),
];

const client = (steps: unknown[] = configuredSteps()) => ({
  shopWorkflowStep: { findMany: vi.fn().mockResolvedValue(steps) },
  catalogJob: {
    findFirst: vi.fn(async ({ where }: { where: { displayName: string } }) => catalog[where.displayName] ?? null),
  },
});

describe('mandatory Work Plan jobs from the shop workflow (LTR-157 / D13, D15)', () => {
  it('adds the four steps in order with their default owners; QC has none', async () => {
    const jobs = await resolveMandatoryJobs(client() as never, []);
    expect(jobs.map((job) => [job.displayName, job.assignedMechanicId])).toEqual([
      ['PM A Service', 'daniel'],
      ['Alignment', 'anthony'],
      ['Detailing', 'anthony'],
      ['Quality Check', null],
    ]);
  });

  it('leaves a Job unassigned when its default owner is inactive or lacks the capability', async () => {
    const jobs = await resolveMandatoryJobs(client(configuredSteps({
      pm: { id: 'daniel', active: false, capabilities: [{ capability: 'MECHANIC_PM' }] },
      detailing: { id: 'pm-only', active: true, capabilities: [{ capability: 'MECHANIC_PM' }] },
      qc: anthony,
    })) as never, []);
    expect(Object.fromEntries(jobs.map((job) => [job.displayName, job.assignedMechanicId]))).toEqual({
      'PM A Service': null,
      Alignment: 'anthony',
      Detailing: null,
      'Quality Check': null,
    });
  });

  it('LTR-197 / D28: a team of two or more sends the Job to the team queue; QC always waits in Safety\'s queue', async () => {
    const jobs = await resolveMandatoryJobs(client(configuredSteps({ detailing: [anthony, alejandro], qc: [safety] })) as never, []);
    expect(jobs.map((job) => [job.displayName, job.assignedMechanicId, job.workflowStepKey])).toEqual([
      ['PM A Service', 'daniel', null],
      ['Alignment', 'anthony', null],
      ['Detailing', null, 'detailing'],
      ['Quality Check', null, 'quality_check'],
    ]);
  });

  it('LTR-197 / D-SET2: a team member who changed type counts for nobody; the one left gets the Job', async () => {
    const changed: Owner = { id: 'now-pm', active: true, capabilities: [{ capability: 'MECHANIC_PM' }] };
    const jobs = await resolveMandatoryJobs(client(configuredSteps({ detailing: [changed, alejandro] })) as never, []);
    expect(jobs.find((job) => job.displayName === 'Detailing')).toMatchObject({ assignedMechanicId: 'alejandro', workflowStepKey: null });
  });

  it('skips steps the Manager already picked (PM B counts as PM)', async () => {
    const jobs = await resolveMandatoryJobs(client() as never, [
      { categoryName: 'PM', displayName: 'PM B Service' },
      { categoryName: 'Suspension & Steering', displayName: 'Alignment' },
    ]);
    expect(jobs.map((job) => job.displayName)).toEqual(['Detailing', 'Quality Check']);
  });

  it('falls back to the catalog names, unassigned, when no step is configured', async () => {
    const empty = client([]);
    const jobs = await resolveMandatoryJobs(empty as never, [{ categoryName: 'Air & Brake', displayName: 'Brake Repair' }]);
    expect(jobs.map((job) => [job.displayName, job.assignedMechanicId])).toEqual([
      ['PM A Service', null], ['Alignment', null], ['Detailing', null], ['Quality Check', null],
    ]);
    expect(empty.catalogJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { displayName: 'PM A Service', status: 'active', category: { name: 'PM', status: 'active' } },
    }));
  });

  it('lets the Manager create a Work Order with only the truck (no Category, no Jobs)', async () => {
    const manager: AuthUser = {
      id: 'mgr', email: 'm@l.local', name: 'Manager', role: 'manager', active: true,
      capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
    };
    const truckId = '11111111-1111-4111-8111-111111111111';
    const inspection = { id: '33333333-3333-4333-8333-333333333333', name: 'Inspection' };
    const prisma = {
      ...client(),
      workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      jobCategory: {
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(inspection),
        findMany: vi.fn().mockResolvedValue([{ id: 'cat-pm' }]),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn().mockRejectedValue(new Error('reached-transaction')),
    };
    const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never);

    await expect(service.createByManager(manager, { truckId })).rejects.toThrow('reached-transaction');
    // D13: primary Category is derived (Inspection), never PM; the steps come from shop_workflow_steps.
    expect(prisma.jobCategory.findUnique).not.toHaveBeenCalled();
    expect(prisma.jobCategory.findFirst).toHaveBeenCalledWith({ where: { name: 'Inspection', status: 'active' } });
    expect(prisma.shopWorkflowStep.findMany).toHaveBeenCalled();
  });
});
