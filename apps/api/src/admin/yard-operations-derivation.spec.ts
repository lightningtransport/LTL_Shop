import { describe, expect, it } from 'vitest';
import {
  ReadinessAssessmentStatus,
  ReadinessPhase,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
} from '@ltl-shop/shared';
import { deriveReadiness, READINESS_REQUIREMENT_TYPES } from './yard-operations-derivation';

const assessment = (
  status: ReadinessAssessmentStatus = ReadinessAssessmentStatus.UNDER_REVIEW,
  outcome = ReadinessRequirementOutcome.NOT_EVALUATED,
  readyAt: string | null = null,
) => ({
  status,
  readyAt,
  requirements: READINESS_REQUIREMENT_TYPES.map((type) => ({
    id: `00000000-0000-4000-8000-00000000000${type.length % 9}`,
    type,
    outcome,
    waiverReason: null,
    evidenceWorkOrderId: null,
    evaluatedById: null,
    evaluatedAt: null,
    version: 1,
  })),
});

const withOutcomes = (
  overrides: Partial<Record<ReadinessRequirementType, ReadinessRequirementOutcome>>,
  status = ReadinessAssessmentStatus.UNDER_REVIEW,
  readyAt: string | null = null,
) => {
  const base = assessment(status, ReadinessRequirementOutcome.NOT_REQUIRED, readyAt);
  return {
    ...base,
    requirements: base.requirements.map((requirement) => ({
      ...requirement,
      outcome: overrides[requirement.type] ?? requirement.outcome,
    })),
  };
};

const openWorkOrder = {
  id: '00000000-0000-4000-8000-000000000001',
  status: 'in_progress' as never,
  priority: 'high' as never,
  category: { id: 'category-1', name: 'Engine' },
  currentPause: null,
};

describe('yard readiness derivation', () => {
  it('does not infer physical presence from a Work Order', () => {
    const result = deriveReadiness({ assessment: null, linkedWorkOrders: [openWorkOrder] });
    expect(result.phase).toBe(ReadinessPhase.NEEDS_EVALUATION);
    expect(result.readiness).toBe('not_started');
    expect(result.blockers).toEqual([]);
  });

  it('uses Inspection as the first unresolved gate on a fresh assessment', () => {
    const underReview = deriveReadiness({ assessment: assessment(), linkedWorkOrders: [] });
    expect(underReview.phase).toBe(ReadinessPhase.INSPECTION);
    expect(underReview.blockers).toHaveLength(READINESS_REQUIREMENT_TYPES.length);
  });

  it('keeps Detailing when Quality Check is still unevaluated', () => {
    const result = deriveReadiness({
      assessment: withOutcomes({
        [ReadinessRequirementType.INSPECTION]: ReadinessRequirementOutcome.COMPLETED,
        [ReadinessRequirementType.DETAILING]: ReadinessRequirementOutcome.REQUIRED,
        [ReadinessRequirementType.QUALITY_CHECK]: ReadinessRequirementOutcome.NOT_EVALUATED,
      }),
      linkedWorkOrders: [],
    });
    expect(result.phase).toBe(ReadinessPhase.DETAILING);
  });

  it('allows Detailing while a linked Work Order remains open', () => {
    const result = deriveReadiness({
      assessment: withOutcomes({
        [ReadinessRequirementType.INSPECTION]: ReadinessRequirementOutcome.COMPLETED,
        [ReadinessRequirementType.REQUIRED_REPAIRS]: ReadinessRequirementOutcome.COMPLETED,
        [ReadinessRequirementType.DETAILING]: ReadinessRequirementOutcome.REQUIRED,
        [ReadinessRequirementType.QUALITY_CHECK]: ReadinessRequirementOutcome.REQUIRED,
      }),
      linkedWorkOrders: [openWorkOrder],
    });
    expect(result.phase).toBe(ReadinessPhase.DETAILING);
    expect(result.blockers.map((blocker) => blocker.kind)).toContain('open_work_order');
  });

  it('shows Ready for Approval when every gate is resolved and Mark Ready has not run', () => {
    const result = deriveReadiness({
      assessment: assessment(ReadinessAssessmentStatus.UNDER_REVIEW, ReadinessRequirementOutcome.NOT_REQUIRED),
      linkedWorkOrders: [],
    });
    expect(result.phase).toBe(ReadinessPhase.READY_FOR_APPROVAL);
    expect(result.blockers).toEqual([]);
  });

  it('never reports Ready to Go while a linked Work Order is open', () => {
    const result = deriveReadiness({
      assessment: assessment(ReadinessAssessmentStatus.READY, ReadinessRequirementOutcome.NOT_REQUIRED, '2026-09-12T12:00:00.000Z'),
      linkedWorkOrders: [openWorkOrder],
    });
    expect(result.phase).toBe(ReadinessPhase.READY_FOR_APPROVAL);
    expect(result.blockers.map((blocker) => blocker.kind)).toEqual(
      expect.arrayContaining(['open_work_order', 'approval_conflict']),
    );
  });

  it('reports Ready to Go after explicit ready status and no open work', () => {
    const result = deriveReadiness({
      assessment: assessment(ReadinessAssessmentStatus.READY, ReadinessRequirementOutcome.NOT_REQUIRED, '2026-09-12T12:00:00.000Z'),
      linkedWorkOrders: [],
    });
    expect(result.phase).toBe(ReadinessPhase.READY_TO_GO);
    expect(result.blockers).toEqual([]);
  });

  it('keeps Ready to Go after a closed Ready assessment until new open work appears', () => {
    const residual = deriveReadiness({
      assessment: assessment(ReadinessAssessmentStatus.CLOSED, ReadinessRequirementOutcome.NOT_REQUIRED, '2026-09-12T12:00:00.000Z'),
      linkedWorkOrders: [],
    });
    expect(residual.phase).toBe(ReadinessPhase.READY_TO_GO);

    const invalidated = deriveReadiness({
      assessment: assessment(ReadinessAssessmentStatus.CLOSED, ReadinessRequirementOutcome.NOT_REQUIRED, '2026-09-12T12:00:00.000Z'),
      linkedWorkOrders: [openWorkOrder],
    });
    expect(invalidated.phase).toBe(ReadinessPhase.READY_FOR_APPROVAL);
  });
});
