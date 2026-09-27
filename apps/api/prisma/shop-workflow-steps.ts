import { ShopWorkflowStepKey, WorkPlanJobLane } from '@ltl-shop/shared';
import { MANDATORY_WORK_PLAN_JOBS } from '../src/work-orders/mandatory-jobs';

const STEP_KEY_BY_LANE: Partial<Record<WorkPlanJobLane, ShopWorkflowStepKey>> = {
  [WorkPlanJobLane.PM]: ShopWorkflowStepKey.PM,
  [WorkPlanJobLane.ALIGNMENT]: ShopWorkflowStepKey.ALIGNMENT,
  [WorkPlanJobLane.DETAILING]: ShopWorkflowStepKey.DETAILING,
  [WorkPlanJobLane.QUALITY_CHECK]: ShopWorkflowStepKey.QUALITY_CHECK,
};

/**
 * LTR-156: initial shop workflow steps, one per mandatory Work Plan job.
 * Must match the seed rows in the `shop_workflow_steps_ltr156` migration.
 */
export const SHOP_WORKFLOW_STEP_SEEDS = MANDATORY_WORK_PLAN_JOBS.map((item, index) => {
  const stepKey = STEP_KEY_BY_LANE[item.lane];
  if (!stepKey) throw new Error(`No shop workflow step for lane ${item.lane}`);
  return { stepKey, categoryName: item.categoryName, jobName: item.jobName, sortOrder: (index + 1) * 10 };
});

type ShopWorkflowSeedClient = {
  catalogJob: {
    findFirst(args: {
      where: { displayName: string; status: 'active'; category: { name: string; status: 'active' } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  shopWorkflowStep: {
    upsert(args: {
      where: { stepKey: string };
      create: { stepKey: string; catalogJobId: string; sortOrder: number; defaultMechanicId: null };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
};

/**
 * Local seed: the migration only seeds steps whose catalog Job already exists, and a fresh
 * database gets its catalog after migrating. Existing rows are left as configured.
 */
export async function applyShopWorkflowSteps(client: ShopWorkflowSeedClient) {
  let seeded = 0;
  for (const step of SHOP_WORKFLOW_STEP_SEEDS) {
    const catalogJob = await client.catalogJob.findFirst({
      where: { displayName: step.jobName, status: 'active', category: { name: step.categoryName, status: 'active' } },
      select: { id: true },
    });
    if (!catalogJob) continue;
    await client.shopWorkflowStep.upsert({
      where: { stepKey: step.stepKey },
      create: { stepKey: step.stepKey, catalogJobId: catalogJob.id, sortOrder: step.sortOrder, defaultMechanicId: null },
      update: {},
    });
    seeded += 1;
  }
  return seeded;
}
