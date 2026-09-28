import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { ShopWorkflowService } from './shop-workflow.service';

const DANIEL = '00000000-0000-4000-8000-0000000000d1';
const ANTHONY = '00000000-0000-4000-8000-0000000000a1';

function actor(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'mgr', email: 'm@l.local', name: 'Manager', role: 'manager', active: true, pmAuthorized: false,
    capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], supabaseAuthId: null,
    ...overrides,
  };
}

function row(stepKey: string, displayName: string, categoryName: string, sortOrder: number) {
  return {
    stepKey, sortOrder, active: true, updatedAt: new Date('2026-09-28T12:00:00Z'),
    catalogJob: { id: `cj-${stepKey}`, displayName, category: { name: categoryName } },
    defaultMechanic: null, updatedBy: null,
  };
}

function setup() {
  const rows = [
    row('pm', 'PM A Service', 'PM', 10),
    row('alignment', 'Alignment', 'Suspension & Steering', 20),
    row('detailing', 'Detailing', 'Detailing', 30),
    row('quality_check', 'Quality Check', 'Quality Check', 40),
  ];
  const prisma = {
    shopWorkflowStep: {
      findMany: vi.fn(async (args: { select?: { stepKey?: boolean; sortOrder?: boolean } }) => (
        args.select && !args.select.sortOrder ? rows.map((item) => ({ stepKey: item.stepKey })) : rows
      )),
      update: vi.fn((args: unknown) => args),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([
        { id: DANIEL, active: true, capabilities: [{ capability: 'MECHANIC_PM' }] },
        { id: ANTHONY, active: true, capabilities: [{ capability: 'MECHANIC_STANDARD' }] },
      ]),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  return { prisma, service: new ShopWorkflowService(prisma as never) };
}

describe('ShopWorkflowService (LTR-157 / D15, D16)', () => {
  it('lists the steps with the capability each owner needs; QC takes no owner', async () => {
    const { service } = setup();
    const steps = await service.list();
    expect(steps.map((item) => [item.stepKey, item.allowsDefaultMechanic, item.requiredCapability])).toEqual([
      ['pm', true, AppCapability.MECHANIC_PM],
      ['alignment', true, AppCapability.MECHANIC_STANDARD],
      ['detailing', true, AppCapability.MECHANIC_STANDARD],
      ['quality_check', false, null],
    ]);
    expect(steps[0].catalogJob).toEqual({ id: 'cj-pm', displayName: 'PM A Service', categoryName: 'PM' });
  });

  it('saves default owners who have the right capability', async () => {
    const { service, prisma } = setup();
    await service.update(actor(), { steps: [
      { stepKey: 'pm', defaultMechanicId: DANIEL },
      { stepKey: 'detailing', defaultMechanicId: ANTHONY },
      { stepKey: 'quality_check', defaultMechanicId: null },
    ] });
    expect(prisma.shopWorkflowStep.update).toHaveBeenCalledWith({
      where: { stepKey: 'pm' }, data: { defaultMechanicId: DANIEL, updatedById: 'mgr' },
    });
    expect(prisma.shopWorkflowStep.update).toHaveBeenCalledTimes(3);
  });

  it('rejects an owner on Quality Check (400) and an owner without the capability (400)', async () => {
    const { service, prisma } = setup();
    await expect(service.update(actor(), { steps: [{ stepKey: 'quality_check', defaultMechanicId: ANTHONY }] }))
      .rejects.toMatchObject({ status: 400, response: { code: 'STEP_HAS_NO_OWNER' } });
    await expect(service.update(actor(), { steps: [{ stepKey: 'pm', defaultMechanicId: ANTHONY }] }))
      .rejects.toMatchObject({ status: 400, response: { code: 'OWNER_NOT_ELIGIBLE' } });
    await expect(service.update(actor(), { steps: [
      { stepKey: 'pm', defaultMechanicId: null }, { stepKey: 'pm', defaultMechanicId: DANIEL },
    ] })).rejects.toMatchObject({ response: { code: 'DUPLICATE_STEP' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lets the System Admin write and refuses an Admin reader without work_orders.manage (403)', async () => {
    const { service } = setup();
    await expect(service.update(actor({ role: 'admin', capabilities: [AppCapability.ADMIN_ACCESS] }), {
      steps: [{ stepKey: 'pm', defaultMechanicId: null }],
    })).resolves.toHaveLength(4);
    await expect(service.update(actor({ capabilities: [AppCapability.ADMIN_ACCESS] }), {
      steps: [{ stepKey: 'pm', defaultMechanicId: null }],
    })).rejects.toMatchObject({ status: 403 });
  });
});
