import { WorkPlanJobLane, isPmCategory } from '@ltl-shop/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { classifyWorkPlanLane } from '../admin/yard-work-plan-derivation';

/**
 * LTR-141 / LTR-145: every truck Work Order gets PM,
 * Alignment, Detailing and Quality Check. Catalog ids differ per environment,
 * so the jobs are resolved by their stable catalog names.
 */
export const MANDATORY_WORK_PLAN_JOBS = [
  { lane: WorkPlanJobLane.PM, categoryName: 'PM', jobName: 'PM A Service' },
  { lane: WorkPlanJobLane.ALIGNMENT, categoryName: 'Suspension & Steering', jobName: 'Alignment' },
  { lane: WorkPlanJobLane.DETAILING, categoryName: 'Detailing', jobName: 'Detailing' },
  { lane: WorkPlanJobLane.QUALITY_CHECK, categoryName: 'Quality Check', jobName: 'Quality Check' },
] as const;

export type MandatoryJob = { catalogJobId: string; categoryId: string; displayName: string };

type CatalogClient = Pick<PrismaClient | Prisma.TransactionClient, 'catalogJob'>;

/** Mandatory jobs whose lane is not already covered by the Jobs the Manager picked. */
export async function resolveMandatoryJobs(
  client: CatalogClient,
  existing: Array<{ categoryName: string; displayName: string }>,
): Promise<MandatoryJob[]> {
  const coveredLanes = new Set(existing.map((job) => classifyWorkPlanLane(job.categoryName, job.displayName)));
  const missing = MANDATORY_WORK_PLAN_JOBS.filter((item) => !coveredLanes.has(item.lane));
  const resolved: MandatoryJob[] = [];
  for (const item of missing) {
    const catalogJob = await client.catalogJob.findFirst({
      where: { displayName: item.jobName, status: 'active', category: { name: item.categoryName, status: 'active' } },
      select: { id: true, categoryId: true, displayName: true },
    });
    // A missing catalog row must not block the Work Order; the Work Plan shows the step as pending.
    if (catalogJob) resolved.push({ catalogJobId: catalogJob.id, categoryId: catalogJob.categoryId, displayName: catalogJob.displayName });
  }
  return resolved;
}

/** LTR-145: the PM job is completed from the PM service (mileage + parts), not a plain Job complete. */
export function isPmJobCategory(categoryName: string | null | undefined) {
  return isPmCategory(categoryName);
}
