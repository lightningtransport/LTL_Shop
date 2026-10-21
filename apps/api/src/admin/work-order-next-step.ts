import {
  deriveTruckNextStep,
  isPmCategory,
  readyToGoYardMove,
  type TruckNextStepDto,
  type TruckSamsaraDto,
} from '@ltl-shop/shared';
import { Prisma, ReadinessAssessmentStatus, ReadinessRequirementType } from '@prisma/client';
import { deriveInspectionOutcome, toWorkPlanJobDto } from './yard-work-plan-derivation';

/**
 * LTR-159: one "Next step" for a Work Order row, on every surface (Dashboard,
 * Work Order list and detail, Yard card, Truck list). It feeds the shared
 * `deriveTruckNextStep` exactly like Truck Detail (LTR-158) does: the Work
 * Plan lanes of the Jobs, the Inspection outcome from the truck's active
 * readiness assessment, the unresolved mechanic blocker and the official pause.
 */
export type NextStepWorkOrderRow = {
  id: string;
  status: string;
  completedAt?: Date | null;
  primaryCategory: { name: string };
  jobs: Array<{
    id?: string;
    displayName?: string;
    status: string;
    category?: { id?: string; name: string } | null;
    catalogJobId?: string | null;
    customDescription?: string | null;
    assignedMechanic?: { id: string; name: string } | null;
    assignedMechanicId?: string | null;
    helperOfJobId?: string | null;
    externalSince?: Date | null;
    externalKind?: string | null;
    externalNote?: string | null;
    workflowStepKey?: string | null;
    systemKey?: string | null;
  }>;
  pauseEvents?: Array<{
    id: string;
    reason: string;
    blockerReason?: string | null;
    isOfficialPause?: boolean | null;
    endedAt: Date | null;
    resolvedAt?: Date | null;
    startedAt: Date;
    job?: { id: string; displayName: string } | null;
    reportedBy?: { name: string } | null;
  }>;
};

export function workOrderNextStep(
  row: NextStepWorkOrderRow,
  options: {
    inspectionRequirementOutcome?: string | null;
    returnedToService?: boolean;
    /** D52 (LTR-260): the truck's Samsara reading, to say it left the yard (or came back) while Ready to Go. */
    samsara?: TruckSamsaraDto | null;
  } = {},
): TruckNextStepDto | null {
  // A legacy PM Work Order has no Work Plan steps.
  if (isPmCategory(row.primaryCategory.name)) return null;
  if (row.status === 'completed' && options.returnedToService) return null;
  const jobs = row.jobs.map((job) => {
    const owner = job.assignedMechanic ?? (job.assignedMechanicId ? { id: job.assignedMechanicId, name: '' } : null);
    return toWorkPlanJobDto({
      id: job.id ?? '',
      catalogJobId: job.catalogJobId ?? null,
      displayName: job.displayName ?? '',
      customDescription: job.customDescription ?? null,
      category: { id: job.category?.id ?? '', name: job.category?.name ?? '' },
      status: job.status as never,
      assignedMechanic: owner,
      helperOfJobId: job.helperOfJobId ?? null,
      externalSince: job.externalSince ?? null,
      externalKind: job.externalKind ?? null,
      externalNote: job.externalNote ?? null,
      workflowStepKey: job.workflowStepKey ?? null,
      systemKey: job.systemKey ?? null,
    }, row.status as never);
  });
  const blocker = (row.pauseEvents ?? []).find((pause) => pause.isOfficialPause === false && !pause.resolvedAt) ?? null;
  const pause = (row.pauseEvents ?? []).find((item) => item.isOfficialPause !== false && !item.endedAt) ?? null;
  const step = deriveTruckNextStep({
    workOrder: { id: row.id, status: row.status },
    inspectionOutcome: deriveInspectionOutcome(jobs, options.inspectionRequirementOutcome as never),
    jobs,
    activeBlocker: blocker
      ? {
          id: blocker.id,
          reason: blocker.reason,
          blockerReason: blocker.blockerReason ?? null,
          job: blocker.job ?? null,
          reportedBy: blocker.reportedBy ?? null,
          startedAt: blocker.startedAt.toISOString(),
        }
      : null,
    currentPause: pause ? { reason: pause.reason } : null,
  });
  if (step?.kind !== 'return_to_service') return step;
  const yardMove = readyToGoYardMove(options.samsara, row.completedAt);
  return yardMove ? { ...step, yardMove } : step;
}

/** The truck's active readiness assessment Inspection outcome, as Truck Detail reads it. */
export const activeInspectionInclude = {
  readinessAssessments: {
    where: { status: { in: [ReadinessAssessmentStatus.under_review, ReadinessAssessmentStatus.ready] } },
    orderBy: { updatedAt: 'desc' as const },
    take: 1,
    select: { requirements: { where: { type: ReadinessRequirementType.inspection }, select: { outcome: true } } },
  },
} satisfies Prisma.TruckInclude;

export function activeInspectionOutcome(truck: {
  readinessAssessments?: Array<{ requirements: Array<{ outcome: string }> }>;
} | null | undefined): string | null {
  return truck?.readinessAssessments?.[0]?.requirements?.[0]?.outcome ?? null;
}
