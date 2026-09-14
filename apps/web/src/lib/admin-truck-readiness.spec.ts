import { describe, expect, it } from 'vitest';
import { ReadinessRequirementOutcome, ReadinessRequirementType } from '@ltl-shop/shared';
import { getAdminMessages } from './admin-messages';
import {
  collapseReadinessBlockers,
  evidenceRequired,
  firstUnresolvedType,
  gateLabel,
  hasUnevaluatedGate,
  localizeReadinessBlocker,
  markReadyBlockState,
  newWorkOrderHref,
  outcomeHelp,
  readinessGateDomId,
  requiredNeedsWorkOrder,
  withGateName,
} from './admin-truck-readiness';

const en = getAdminMessages('en');
const es = getAdminMessages('es');

describe('admin truck readiness copy helpers', () => {
  it('keeps Ready to Go / Truck / Work Order as canonical terms in Spanish helpers', () => {
    expect(en.outcomeHelpRequired).toBe(
      'This still has to happen. Ready to Go stays blocked until Completed or Waived.',
    );
    expect(es.outcomeHelpRequired).toContain('Ready to Go');
    expect(es.closeAssessmentDescription).toContain('Truck');
    expect(es.requiredNextStepNeedsWo).toContain('Work Order');
    expect(en.closeAssessment).toBe('End review');
    expect(es.closeAssessment).toBe('Terminar revisión');
  });

  it('returns outcome helpers for each specified outcome', () => {
    expect(outcomeHelp(ReadinessRequirementType.INSPECTION, ReadinessRequirementOutcome.REQUIRED, en)).toBe(
      en.outcomeHelpRequired,
    );
    expect(outcomeHelp(ReadinessRequirementType.DETAILING, ReadinessRequirementOutcome.NOT_REQUIRED, en)).toBe(
      en.outcomeHelpNotRequired,
    );
    expect(outcomeHelp(ReadinessRequirementType.QUALITY_CHECK, ReadinessRequirementOutcome.COMPLETED, en)).toBe(
      en.outcomeHelpCompleted,
    );
    expect(outcomeHelp(ReadinessRequirementType.PM, ReadinessRequirementOutcome.COMPLETED, en)).toBe(
      en.outcomeHelpCompletedLinkWo,
    );
    expect(outcomeHelp(ReadinessRequirementType.ALIGNMENT, ReadinessRequirementOutcome.COMPLETED, es)).toBe(
      es.outcomeHelpCompletedLinkWo,
    );
    expect(outcomeHelp(ReadinessRequirementType.INSPECTION, ReadinessRequirementOutcome.NOT_EVALUATED, en)).toBe(
      en.outcomeHelpNotEvaluated,
    );
    expect(outcomeHelp(ReadinessRequirementType.INSPECTION, ReadinessRequirementOutcome.WAIVED, en)).toBeNull();
  });

  it('treats PM, Alignment, and Required Repairs as Work Order evidence gates', () => {
    expect(requiredNeedsWorkOrder(ReadinessRequirementType.INSPECTION)).toBe(false);
    expect(requiredNeedsWorkOrder(ReadinessRequirementType.DETAILING)).toBe(false);
    expect(requiredNeedsWorkOrder(ReadinessRequirementType.QUALITY_CHECK)).toBe(false);
    expect(requiredNeedsWorkOrder(ReadinessRequirementType.REQUIRED_REPAIRS)).toBe(true);
    expect(requiredNeedsWorkOrder(ReadinessRequirementType.PM)).toBe(true);
    expect(requiredNeedsWorkOrder(ReadinessRequirementType.ALIGNMENT)).toBe(true);
    expect(evidenceRequired(ReadinessRequirementType.PM, ReadinessRequirementOutcome.COMPLETED)).toBe(true);
    expect(evidenceRequired(ReadinessRequirementType.INSPECTION, ReadinessRequirementOutcome.COMPLETED)).toBe(false);
  });

  it('points Mark Ready at the first unresolved gate and open Work Order', () => {
    const requirements = [
      { type: ReadinessRequirementType.INSPECTION, outcome: ReadinessRequirementOutcome.REQUIRED },
      { type: ReadinessRequirementType.QUALITY_CHECK, outcome: ReadinessRequirementOutcome.NOT_EVALUATED },
    ];
    expect(firstUnresolvedType(requirements)).toBe(ReadinessRequirementType.INSPECTION);
    expect(hasUnevaluatedGate(requirements)).toBe(true);
    expect(markReadyBlockState(requirements, true)).toEqual({
      disabled: true,
      incomplete: true,
      hasOpenWorkOrder: true,
      firstUnresolved: ReadinessRequirementType.INSPECTION,
    });
    expect(markReadyBlockState([
      { type: ReadinessRequirementType.INSPECTION, outcome: ReadinessRequirementOutcome.NOT_REQUIRED },
    ], false).disabled).toBe(false);
  });

  it('makes gate blockers actionable with names and in-page links', () => {
    expect(withGateName(en.gateRequiredUnfinished, 'Inspection')).toBe(
      'Inspection is required and not finished — mark Completed or Waived.',
    );
    expect(withGateName(en.gateNotEvaluatedYet, 'Quality Check')).toBe('Quality Check is not evaluated yet.');
    expect(localizeReadinessBlocker({
      kind: 'required_requirement',
      requirementType: ReadinessRequirementType.INSPECTION,
    }, en)).toEqual({
      text: 'Inspection is required and not finished — mark Completed or Waived.',
      href: '#readiness-gate-inspection',
    });
    expect(localizeReadinessBlocker({
      kind: 'unevaluated_requirement',
      requirementType: ReadinessRequirementType.QUALITY_CHECK,
    }, es).text).toContain(gateLabel(ReadinessRequirementType.QUALITY_CHECK, es));
    expect(newWorkOrderHref('truck-1')).toBe('/admin/work-orders/new?truck=truck-1');
    expect(readinessGateDomId(ReadinessRequirementType.PM)).toBe('readiness-gate-pm');
  });

  it('collapses gate blockers out of the inert stack and keeps Work Order blockers', () => {
    const collapsed = collapseReadinessBlockers([
      { kind: 'unevaluated_requirement', requirementType: ReadinessRequirementType.INSPECTION },
      { kind: 'required_requirement', requirementType: ReadinessRequirementType.QUALITY_CHECK },
      { kind: 'open_work_order', workOrderId: 'wo-1', categoryName: 'PM' },
    ]);
    expect(collapsed.rowBlockers).toHaveLength(2);
    expect(collapsed.listBlockers).toEqual([
      { kind: 'open_work_order', workOrderId: 'wo-1', categoryName: 'PM' },
    ]);
  });
});
