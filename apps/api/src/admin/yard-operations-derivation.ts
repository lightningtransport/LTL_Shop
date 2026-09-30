import {
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
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

export function isResidualReady(assessment: { status: string; readyAt?: string | null } | null | undefined) {
  return assessment?.status === 'closed' && Boolean(assessment.readyAt);
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
