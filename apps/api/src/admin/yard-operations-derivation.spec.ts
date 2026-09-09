import { describe, expect, it } from 'vitest';
import {
  ReadinessAssessmentStatus,
  ReadinessPhase,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
} from '@ltl-shop/shared';
import { deriveReadiness, READINESS_REQUIREMENT_TYPES } from './yard-operations-derivation';

const assessment = (status: ReadinessAssessmentStatus = ReadinessAssessmentStatus.UNDER_REVIEW, outcome = ReadinessRequirementOutcome.NOT_EVALUATED) => ({
  status,
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

  it('prioritizes unevaluated requirements and inspection', () => {
    const underReview = deriveReadiness({ assessment: assessment(), linkedWorkOrders: [] });
    expect(underReview.phase).toBe(ReadinessPhase.NEEDS_EVALUATION);
    expect(underReview.blockers).toHaveLength(READINESS_REQUIREMENT_TYPES.length);

    const requirements = assessment().requirements.map((requirement) => ({
      ...requirement,
      outcome: requirement.type === ReadinessRequirementType.INSPECTION
        ? ReadinessRequirementOutcome.REQUIRED
        : ReadinessRequirementOutcome.NOT_REQUIRED,
    }));
    const inspection = deriveReadiness({
      assessment: { ...assessment(), requirements },
      linkedWorkOrders: [],
    });
    expect(inspection.phase).toBe(ReadinessPhase.INSPECTION);
    expect(inspection.blockers).toContainEqual({
      kind: 'required_requirement',
      requirementType: ReadinessRequirementType.INSPECTION,
    });
  });

  it('never reports Ready to Go while a linked Work Order is open', () => {
    const result = deriveReadiness({
      assessment: assessment(ReadinessAssessmentStatus.READY, ReadinessRequirementOutcome.NOT_REQUIRED),
      linkedWorkOrders: [openWorkOrder],
    });
    expect(result.phase).toBe(ReadinessPhase.REQUIRED_WORK);
    expect(result.blockers.map((blocker) => blocker.kind)).toEqual(
      expect.arrayContaining(['open_work_order', 'approval_conflict']),
    );
  });

  it('reports Ready to Go only after explicit ready status and no blockers', () => {
    const result = deriveReadiness({
      assessment: assessment(ReadinessAssessmentStatus.READY, ReadinessRequirementOutcome.NOT_REQUIRED),
      linkedWorkOrders: [],
    });
    expect(result.phase).toBe(ReadinessPhase.READY_TO_GO);
    expect(result.blockers).toEqual([]);
  });
});
