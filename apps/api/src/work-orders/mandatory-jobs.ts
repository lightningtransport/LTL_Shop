import { AppCapability, ShopWorkflowStepKey, WorkPlanJobLane, isPmCategory } from '@ltl-shop/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { classifyWorkPlanLane } from '../admin/yard-work-plan-derivation';

/**
 * LTR-141 / LTR-145: every truck Work Order gets PM,
 * Alignment, Detailing and Quality Check. Catalog ids differ per environment,
 * so the jobs are resolved by their stable catalog names.
 * LTR-157: `shop_workflow_steps` is the source; this list seeds it and is the
 * fallback for a database without steps.
 */
export const MANDATORY_WORK_PLAN_JOBS = [
  { lane: WorkPlanJobLane.PM, categoryName: 'PM', jobName: 'PM A Service' },
  { lane: WorkPlanJobLane.ALIGNMENT, categoryName: 'Suspension & Steering', jobName: 'Alignment' },
  { lane: WorkPlanJobLane.DETAILING, categoryName: 'Detailing', jobName: 'Detailing' },
  { lane: WorkPlanJobLane.QUALITY_CHECK, categoryName: 'Quality Check', jobName: 'Quality Check' },
] as const;

/**
 * LTR-157 / D15: the capability a step's default owner needs. Quality Check has
 * no owner (null): the Manager completes it from the Truck.
 */
export const WORKFLOW_STEP_OWNER_CAPABILITY: Record<ShopWorkflowStepKey, AppCapability | null> = {
  [ShopWorkflowStepKey.PM]: AppCapability.MECHANIC_PM,
  [ShopWorkflowStepKey.ALIGNMENT]: AppCapability.MECHANIC_STANDARD,
  [ShopWorkflowStepKey.DETAILING]: AppCapability.MECHANIC_STANDARD,
  [ShopWorkflowStepKey.QUALITY_CHECK]: null,
};

export function workflowStepOwnerCapability(stepKey: string): AppCapability | null {
  return WORKFLOW_STEP_OWNER_CAPABILITY[stepKey as ShopWorkflowStepKey] ?? null;
}

/**
 * LTR-197 / D28: who can be on a step's team. Quality Check's team is Safety (D-SET7); its Job always waits in
 * the queue, because Safety takes a truck only when everything else is done (D19).
 */
export function workflowStepMemberCapability(stepKey: string): AppCapability | null {
  if (stepKey === ShopWorkflowStepKey.QUALITY_CHECK) return AppCapability.QUALITY_CHECK_PERFORM;
  return workflowStepOwnerCapability(stepKey);
}

type TeamMember = { id: string; active: boolean; role?: string; capabilities: { capability: string }[] };

/** A member who left (inactive) or changed type stays on the team, marked, and gets no new Jobs (D-SET2). */
export function eligibleTeamMember(stepKey: string, member: TeamMember): boolean {
  const capability = workflowStepMemberCapability(stepKey);
  // A System Admin row can hold mechanic capabilities; like the Job pickers, teams are for the shop's people.
  if (!capability || !member.active || member.role === 'admin') return false;
  return member.capabilities.some((item) => item.capability === capability || item.capability === capabilityDbValue(capability));
}

/** D28: one eligible member → their Job; two or more → the team queue; none → unassigned (the Dashboard flags it). */
export function teamAssignment(stepKey: string, members: TeamMember[]): { mode: 'direct' | 'queue' | 'none'; ownerId: string | null } {
  const eligible = members.filter((member) => eligibleTeamMember(stepKey, member));
  if (!eligible.length) return { mode: 'none', ownerId: null };
  if (stepKey === ShopWorkflowStepKey.QUALITY_CHECK || eligible.length > 1) return { mode: 'queue', ownerId: null };
  return { mode: 'direct', ownerId: eligible[0].id };
}

export type MandatoryJob = {
  catalogJobId: string;
  categoryId: string;
  displayName: string;
  /** LTR-197 / D28: the only eligible team member; null for a queue or an empty team. */
  assignedMechanicId: string | null;
  /** Set only when the Job is born in a team queue (two or more eligible members, or Quality Check). */
  workflowStepKey: string | null;
};

type CatalogClient = Pick<PrismaClient | Prisma.TransactionClient, 'catalogJob' | 'shopWorkflowStep'>;

type DefaultOwner = {
  id: string;
  active: boolean;
  capabilities: { capability: string }[];
} | null;

/** LTR-157: a default owner who left or lost the capability leaves the Job unassigned. */
export function usableDefaultOwner(stepKey: string, owner: DefaultOwner): string | null {
  const capability = workflowStepOwnerCapability(stepKey);
  if (!owner || !capability || !owner.active) return null;
  const granted = owner.capabilities.some((item) => item.capability === capability || item.capability === capabilityDbValue(capability));
  return granted ? owner.id : null;
}

/** AppCapability values are dotted (`mechanic.pm`); the DB enum uses `MECHANIC_PM`. */
function capabilityDbValue(capability: AppCapability) {
  return capability.toUpperCase().replace(/\./g, '_');
}

/** Mandatory jobs whose lane is not already covered by the Jobs the Manager picked. */
export async function resolveMandatoryJobs(
  client: CatalogClient,
  existing: Array<{ categoryName: string; displayName: string; systemKey?: string | null }>,
): Promise<MandatoryJob[]> {
  const coveredLanes = new Set(existing.map((job) => classifyWorkPlanLane(job.categoryName, job.displayName, job.systemKey)));
  const steps = await client.shopWorkflowStep.findMany({
    where: { active: true, catalogJob: { status: 'active', category: { status: 'active' } } },
    orderBy: { sortOrder: 'asc' },
    select: {
      stepKey: true,
      catalogJob: { select: { id: true, categoryId: true, displayName: true, systemKey: true, category: { select: { name: true } } } },
      members: { select: { user: { select: { id: true, active: true, role: true, capabilities: { select: { capability: true } } } } } },
    },
  });
  if (steps.length) {
    return steps
      .filter((step) => !coveredLanes.has(classifyWorkPlanLane(step.catalogJob.category.name, step.catalogJob.displayName, step.catalogJob.systemKey)))
      .map((step) => {
        const team = teamAssignment(step.stepKey, step.members.map((member) => member.user));
        return {
          catalogJobId: step.catalogJob.id,
          categoryId: step.catalogJob.categoryId,
          displayName: step.catalogJob.displayName,
          assignedMechanicId: team.ownerId,
          // Only a queued Job carries its step: that is what keeps it out of "Nobody is assigned".
          workflowStepKey: team.mode === 'queue' ? step.stepKey : null,
        };
      });
  }
  // No configured steps (fresh database before the seed): fall back to the catalog names, unassigned.
  const missing = MANDATORY_WORK_PLAN_JOBS.filter((item) => !coveredLanes.has(item.lane));
  const resolved: MandatoryJob[] = [];
  for (const item of missing) {
    const catalogJob = await client.catalogJob.findFirst({
      where: { displayName: item.jobName, status: 'active', category: { name: item.categoryName, status: 'active' } },
      select: { id: true, categoryId: true, displayName: true },
    });
    // A missing catalog row must not block the Work Order; the Work Plan shows the step as pending.
    if (catalogJob) resolved.push({ catalogJobId: catalogJob.id, categoryId: catalogJob.categoryId, displayName: catalogJob.displayName, assignedMechanicId: null, workflowStepKey: null });
  }
  return resolved;
}

/** LTR-145: the PM job is completed from the PM service (mileage + parts), not a plain Job complete. */
export function isPmJobCategory(categoryName: string | null | undefined) {
  return isPmCategory(categoryName);
}
