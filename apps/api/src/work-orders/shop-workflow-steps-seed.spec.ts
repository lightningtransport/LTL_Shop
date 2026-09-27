import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ShopWorkflowStepKey, WorkPlanJobLane } from '@ltl-shop/shared';
import { SHOP_WORKFLOW_STEP_SEEDS, applyShopWorkflowSteps } from '../../prisma/shop-workflow-steps';
import { MANDATORY_WORK_PLAN_JOBS } from './mandatory-jobs';

const migrationsDir = resolve(__dirname, '../../prisma/migrations');

function shopWorkflowMigrationSql() {
  const folder = readdirSync(migrationsDir).find((name) => name.endsWith('_shop_workflow_steps_ltr156'));
  if (!folder) throw new Error('shop_workflow_steps migration not found');
  return readFileSync(resolve(migrationsDir, folder, 'migration.sql'), 'utf8');
}

describe('Shop workflow steps seed (LTR-156)', () => {
  it('seeds one step per mandatory Work Plan job, in the same order and by the same catalog names', () => {
    expect(SHOP_WORKFLOW_STEP_SEEDS.map((step) => step.stepKey)).toEqual([
      ShopWorkflowStepKey.PM,
      ShopWorkflowStepKey.ALIGNMENT,
      ShopWorkflowStepKey.DETAILING,
      ShopWorkflowStepKey.QUALITY_CHECK,
    ]);
    expect(SHOP_WORKFLOW_STEP_SEEDS.map(({ categoryName, jobName }) => ({ categoryName, jobName }))).toEqual(
      MANDATORY_WORK_PLAN_JOBS.map(({ categoryName, jobName }) => ({ categoryName, jobName })),
    );
    const sortOrders = SHOP_WORKFLOW_STEP_SEEDS.map((step) => step.sortOrder);
    expect([...sortOrders].sort((a, b) => a - b)).toEqual(sortOrders);
  });

  it('keeps step keys aligned with the Work Plan lanes they configure', () => {
    const lanes = new Set<string>(Object.values(WorkPlanJobLane));
    for (const key of Object.values(ShopWorkflowStepKey)) expect(lanes.has(key)).toBe(true);
  });

  it('migration seeds the same rows with no default mechanic', () => {
    const sql = shopWorkflowMigrationSql();
    for (const step of SHOP_WORKFLOW_STEP_SEEDS) {
      expect(sql).toContain(`('${step.stepKey}', '${step.categoryName}', '${step.jobName}', ${step.sortOrder})`);
    }
    expect(sql).toContain('ON CONFLICT ("step_key") DO NOTHING');
    expect(sql).not.toMatch(/INSERT INTO "shop_workflow_steps"[^;]*"default_mechanic_id"/);
  });

  it('local seed creates missing steps without overwriting a saved configuration', async () => {
    const client = {
      catalogJob: {
        findFirst: vi.fn(async ({ where }: { where: { displayName: string } }) =>
          where.displayName === 'Detailing' ? null : { id: `cj-${where.displayName}` }),
      },
      shopWorkflowStep: { upsert: vi.fn(async () => ({})) },
    };

    const seeded = await applyShopWorkflowSteps(client);

    expect(seeded).toBe(3);
    expect(client.shopWorkflowStep.upsert).toHaveBeenCalledTimes(3);
    expect(client.shopWorkflowStep.upsert).toHaveBeenCalledWith({
      where: { stepKey: ShopWorkflowStepKey.PM },
      create: { stepKey: ShopWorkflowStepKey.PM, catalogJobId: 'cj-PM A Service', sortOrder: 10, defaultMechanicId: null },
      update: {},
    });
  });
});
