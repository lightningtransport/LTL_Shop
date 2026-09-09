import {
  OPEN_WORK_ORDER_STATUSES,
  ReadinessPhase,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  type AdminWorkOrderSummaryDto,
  type ReadinessBlockerDto,
  type ReadinessAssessmentDto,
  type ReadinessAssessmentStatus,
} from '@ltl-shop/shared';

export const READINESS_REQUIREMENT_TYPES: ReadinessRequirementType[] = [
  ReadinessRequirementType.INSPECTION,
  ReadinessRequirementType.REQUIRED_REPAIRS,
  ReadinessRequirementType.PM,
  ReadinessRequirementType.ALIGNMENT,
  ReadinessRequirementType.DETAILING,
  ReadinessRequirementType.QUALITY_CHECK,
];

type DerivationWorkOrder = Pick<AdminWorkOrderSummaryDto, 'id' | 'status' | 'priority' | 'category' | 'currentPause'>;

export interface ReadinessDerivationInput {
  assessment: Pick<ReadinessAssessmentDto, 'status' | 'requirements'> | null;
  linkedWorkOrders: DerivationWorkOrder[];
}

export interface ReadinessDerivationResult {
  phase: ReadinessPhase;
  blockers: ReadinessBlockerDto[];
  readiness: 'not_started' | ReadinessAssessmentStatus;
}

const isUnresolvedRequired = (outcome: ReadinessRequirementOutcome | undefined) =>
  outcome === ReadinessRequirementOutcome.REQUIRED;

/**
 * Derive the operational phase from maintenance evidence only. In particular,
 * no Work Order status is interpreted as yard presence or a visit.
 */
export function deriveReadiness({ assessment, linkedWorkOrders }: ReadinessDerivationInput): ReadinessDerivationResult {
  if (!assessment) {
    return { phase: ReadinessPhase.NEEDS_EVALUATION, blockers: [], readiness: 'not_started' };
  }

  const byType = new Map(assessment.requirements.map((requirement) => [requirement.type, requirement]));
  const blockers: ReadinessBlockerDto[] = [];
  const requirements = READINESS_REQUIREMENT_TYPES.map((type) => byType.get(type));

  for (const [index, requirement] of requirements.entries()) {
    if (!requirement || requirement.outcome === ReadinessRequirementOutcome.NOT_EVALUATED) {
      blockers.push({
        kind: 'unevaluated_requirement',
        requirementType: requirement?.type ?? READINESS_REQUIREMENT_TYPES[index],
      });
    }
  }

  const openWorkOrders = linkedWorkOrders.filter((workOrder) =>
    (OPEN_WORK_ORDER_STATUSES as string[]).includes(workOrder.status),
  );
  for (const workOrder of openWorkOrders) {
    blockers.push({
      kind: 'open_work_order',
      workOrderId: workOrder.id,
      status: workOrder.status,
      priority: workOrder.priority,
      categoryName: workOrder.category.name,
      pauseReason: workOrder.currentPause?.reason ?? null,
    });
  }

  const requiredRepairs = byType.get(ReadinessRequirementType.REQUIRED_REPAIRS);
  const unresolvedRequired = requirements.filter((requirement) => isUnresolvedRequired(requirement?.outcome));
  for (const requirement of unresolvedRequired) {
    blockers.push({ kind: 'required_requirement', requirementType: requirement!.type });
  }

  if (assessment.status === 'ready' && openWorkOrders.length) {
    blockers.push({ kind: 'approval_conflict', message: 'A Work Order is open after approval.' });
  }

  const hasUnevaluated = requirements.some((requirement) =>
    !requirement || requirement.outcome === ReadinessRequirementOutcome.NOT_EVALUATED,
  );
  if (hasUnevaluated) {
    return { phase: ReadinessPhase.NEEDS_EVALUATION, blockers, readiness: assessment.status };
  }
  if (requirements[0] && isUnresolvedRequired(requirements[0]!.outcome)) {
    return { phase: ReadinessPhase.INSPECTION, blockers, readiness: assessment.status };
  }
  if (openWorkOrders.length || (requiredRepairs && isUnresolvedRequired(requiredRepairs.outcome))) {
    return { phase: ReadinessPhase.REQUIRED_WORK, blockers, readiness: assessment.status };
  }

  const phaseRequirements: [ReadinessRequirementType, ReadinessPhase][] = [
    [ReadinessRequirementType.PM, ReadinessPhase.PM],
    [ReadinessRequirementType.ALIGNMENT, ReadinessPhase.ALIGNMENT],
    [ReadinessRequirementType.DETAILING, ReadinessPhase.DETAILING],
    [ReadinessRequirementType.QUALITY_CHECK, ReadinessPhase.QUALITY_CHECK],
  ];
  for (const [type, phase] of phaseRequirements) {
    if (isUnresolvedRequired(byType.get(type)?.outcome)) {
      return { phase, blockers, readiness: assessment.status };
    }
  }

  if (assessment.status === 'ready' && !openWorkOrders.length && !blockers.length) {
    return { phase: ReadinessPhase.READY_TO_GO, blockers, readiness: assessment.status };
  }

  return { phase: ReadinessPhase.NEEDS_EVALUATION, blockers, readiness: assessment.status };
}

export function toReadinessAssessmentDto(row: {
  id: string;
  truckId: string;
  status: ReadinessAssessmentStatus;
  version: number;
  startedAt: Date;
  startedById: string;
  readyAt: Date | null;
  approvedById: string | null;
  closedAt: Date | null;
  closedById: string | null;
  closedReason: string | null;
  requirements: Array<{
    id: string;
    type: ReadinessRequirementType;
    outcome: ReadinessRequirementOutcome;
    waiverReason: string | null;
    evidenceWorkOrderId: string | null;
    evaluatedById: string | null;
    evaluatedAt: Date | null;
    version: number;
  }>;
}): ReadinessAssessmentDto {
  return {
    id: row.id,
    truckId: row.truckId,
    status: row.status,
    version: row.version,
    startedAt: row.startedAt.toISOString(),
    startedById: row.startedById,
    readyAt: row.readyAt?.toISOString() ?? null,
    approvedById: row.approvedById,
    closedAt: row.closedAt?.toISOString() ?? null,
    closedById: row.closedById,
    closedReason: row.closedReason,
    requirements: row.requirements.map((requirement) => ({
      id: requirement.id,
      type: requirement.type,
      outcome: requirement.outcome,
      waiverReason: requirement.waiverReason,
      evidenceWorkOrderId: requirement.evidenceWorkOrderId,
      evaluatedById: requirement.evaluatedById,
      evaluatedAt: requirement.evaluatedAt?.toISOString() ?? null,
      version: requirement.version,
    })),
  };
}
