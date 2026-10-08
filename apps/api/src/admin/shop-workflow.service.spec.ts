import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { ShopWorkflowService } from './shop-workflow.service';

const DANIEL = '00000000-0000-4000-8000-0000000000d1';
const ANTHONY = '00000000-0000-4000-8000-0000000000a1';
const JOHN = '00000000-0000-4000-8000-0000000000b1';
const SAFETY = '00000000-0000-4000-8000-0000000000c1';

const people = {
  [DANIEL]: { id: DANIEL, name: 'Daniel', active: true, capabilities: [{ capability: 'MECHANIC_PM' }] },
  [ANTHONY]: { id: ANTHONY, name: 'Anthony', active: true, capabilities: [{ capability: 'MECHANIC_STANDARD' }] },
  [JOHN]: { id: JOHN, name: 'John', active: true, capabilities: [{ capability: 'MECHANIC_STANDARD' }] },
  [SAFETY]: { id: SAFETY, name: 'Safety 1', active: true, capabilities: [{ capability: 'QUALITY_CHECK_PERFORM' }] },
};

function actor(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'mgr', email: 'm@l.local', name: 'Manager', role: 'manager', active: true,
    capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
    ...overrides,
  };
}

function row(stepKey: string, displayName: string, categoryName: string, sortOrder: number, memberIds: string[] = []) {
  return {
    id: `step-${stepKey}`, stepKey, sortOrder, active: true, updatedAt: new Date('2026-09-28T12:00:00Z'),
    catalogJob: { id: `cj-${stepKey}`, displayName, status: 'active', category: { name: categoryName, status: 'active' } },
    members: memberIds.map((id) => ({ userId: id, user: people[id as keyof typeof people] })),
    updatedBy: null,
  };
}

function setup(teams: { pm?: string[]; detailing?: string[]; qc?: string[] } = {}) {
  const rows = [
    row('pm', 'PM A Service', 'PM', 10, teams.pm ?? [DANIEL]),
    row('alignment', 'Alignment', 'Suspension & Steering', 20, [ANTHONY]),
    row('detailing', 'Detailing', 'Detailing', 30, teams.detailing ?? [ANTHONY]),
    row('quality_check', 'Quality Check', 'Quality Check', 40, teams.qc ?? [SAFETY]),
  ];
  const tx = {
    shopWorkflowStepMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    shopWorkflowStep: { update: vi.fn() },
  };
  const prisma = {
    shopWorkflowStep: { findMany: vi.fn().mockResolvedValue(rows) },
    workOrderJob: { groupBy: vi.fn().mockResolvedValue([{ assignedMechanicId: ANTHONY, _count: { _all: 2 } }]) },
    user: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => people[id as keyof typeof people]).filter(Boolean)),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { prisma, tx, service: new ShopWorkflowService(prisma as never) };
}

describe('ShopWorkflowService (LTR-157 / D15, D16; LTR-197 / D28)', () => {
  it('lists each step with its team, who can be on it and what a new Work Order gets', async () => {
    const { service } = setup({ detailing: [ANTHONY, JOHN] });
    const steps = await service.list();
    expect(steps.map((item) => [item.stepKey, item.requiredCapability, item.assignment])).toEqual([
      ['pm', AppCapability.MECHANIC_PM, 'direct'],
      ['alignment', AppCapability.MECHANIC_STANDARD, 'direct'],
      ['detailing', AppCapability.MECHANIC_STANDARD, 'queue'],
      ['quality_check', AppCapability.QUALITY_CHECK_PERFORM, 'queue'],
    ]);
    expect(steps[0].catalogJob).toEqual({ id: 'cj-pm', displayName: 'PM A Service', categoryName: 'PM', active: true });
    expect(steps[2].members).toEqual([
      { id: ANTHONY, name: 'Anthony', active: true, eligible: true, pendingJobCount: 2 },
      { id: JOHN, name: 'John', active: true, eligible: true, pendingJobCount: 0 },
    ]);
    expect(steps[2].defaultMechanic).toBeNull();
  });

  it('saves a team: adds the new people, removes the ones left out, mirrors a team of one', async () => {
    const { service, tx } = setup();
    await service.update(actor(), { steps: [{ stepKey: 'detailing', memberIds: [ANTHONY, JOHN] }, { stepKey: 'pm', memberIds: [DANIEL] }] });
    expect(tx.shopWorkflowStepMember.createMany).toHaveBeenCalledWith({
      data: [{ stepId: 'step-detailing', userId: JOHN, addedById: 'mgr' }], skipDuplicates: true,
    });
    expect(tx.shopWorkflowStep.update).toHaveBeenCalledWith({ where: { id: 'step-detailing' }, data: { defaultMechanicId: null, updatedById: 'mgr' } });
    expect(tx.shopWorkflowStep.update).toHaveBeenCalledWith({ where: { id: 'step-pm' }, data: { defaultMechanicId: DANIEL, updatedById: 'mgr' } });
  });

  it('keeps someone already on the team who can no longer do the step (SW1, D-SET2)', async () => {
    const { service, tx } = setup({ detailing: [DANIEL] });
    await expect(service.update(actor(), { steps: [{ stepKey: 'detailing', memberIds: [DANIEL, ANTHONY] }] })).resolves.toHaveLength(4);
    expect(tx.shopWorkflowStepMember.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ userId: ANTHONY })] }));
  });

  it('rejects a new member who cannot do the step; Quality Check takes Safety, not one owner', async () => {
    const { service, prisma } = setup();
    await expect(service.update(actor(), { steps: [{ stepKey: 'pm', memberIds: [ANTHONY] }] }))
      .rejects.toMatchObject({ status: 400, response: { code: 'OWNER_NOT_ELIGIBLE', stepKey: 'pm', userId: ANTHONY } });
    await expect(service.update(actor(), { steps: [{ stepKey: 'quality_check', memberIds: [ANTHONY] }] }))
      .rejects.toMatchObject({ status: 400, response: { code: 'OWNER_NOT_ELIGIBLE' } });
    await expect(service.update(actor(), { steps: [{ stepKey: 'quality_check', defaultMechanicId: SAFETY }] }))
      .rejects.toMatchObject({ status: 400, response: { code: 'STEP_HAS_NO_OWNER' } });
    await expect(service.update(actor(), { steps: [
      { stepKey: 'pm', memberIds: [] }, { stepKey: 'pm', memberIds: [DANIEL] },
    ] })).rejects.toMatchObject({ response: { code: 'DUPLICATE_STEP' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reads the pre-team shape: one owner is a team of one; a null on Quality Check leaves Safety alone', async () => {
    const { service, tx } = setup();
    await service.update(actor(), { steps: [{ stepKey: 'detailing', defaultMechanicId: JOHN }, { stepKey: 'quality_check', defaultMechanicId: null }] });
    expect(tx.shopWorkflowStepMember.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.shopWorkflowStepMember.deleteMany).toHaveBeenCalledWith({ where: { stepId: 'step-detailing', userId: { notIn: [JOHN] } } });
  });

  it('lets the System Admin write and refuses an Admin reader without work_orders.manage (403)', async () => {
    const { service } = setup();
    await expect(service.update(actor({ role: 'admin', capabilities: [AppCapability.ADMIN_ACCESS] }), {
      steps: [{ stepKey: 'pm', memberIds: [] }],
    })).resolves.toHaveLength(4);
    await expect(service.update(actor({ capabilities: [AppCapability.ADMIN_ACCESS] }), {
      steps: [{ stepKey: 'pm', memberIds: [] }],
    })).rejects.toMatchObject({ status: 403 });
  });
});
