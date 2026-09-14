import {
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  type ReadinessBlockerDto,
  type ReadinessRequirementDto,
} from '@ltl-shop/shared';
import type { AdminMessages } from './admin-messages';
import { workOrderStatusLabel } from './status-chips';

export const REQUIREMENT_MESSAGE_KEY = {
  inspection: 'inspection',
  required_repairs: 'requiredWork',
  pm: 'pm',
  alignment: 'alignment',
  detailing: 'detailing',
  quality_check: 'qualityCheck',
} as const satisfies Record<ReadinessRequirementType, keyof AdminMessages>;

export const OUTCOME_MESSAGE_KEY = {
  not_evaluated: 'notEvaluatedOutcome',
  required: 'requiredOutcome',
  not_required: 'notRequiredOutcome',
  completed: 'completedOutcome',
  waived: 'waivedOutcome',
} as const satisfies Record<ReadinessRequirementOutcome, keyof AdminMessages>;

export const READINESS_REQUIREMENT_TYPES = Object.values(ReadinessRequirementType) as ReadinessRequirementType[];
export const READINESS_OUTCOMES = Object.values(ReadinessRequirementOutcome) as ReadinessRequirementOutcome[];

const EVIDENCE_REQUIREMENT_TYPES: ReadonlyArray<ReadinessRequirementType> = [
  ReadinessRequirementType.PM,
  ReadinessRequirementType.ALIGNMENT,
  ReadinessRequirementType.REQUIRED_REPAIRS,
];

export type CompletedWorkOrderOption = { id: string; displayId: string };

export function evidenceRequired(type: ReadinessRequirementType, outcome: ReadinessRequirementOutcome) {
  return outcome === ReadinessRequirementOutcome.COMPLETED && EVIDENCE_REQUIREMENT_TYPES.includes(type);
}

export function requiredNeedsWorkOrder(type: ReadinessRequirementType) {
  return EVIDENCE_REQUIREMENT_TYPES.includes(type);
}

export function isUnresolvedOutcome(outcome: ReadinessRequirementOutcome) {
  return outcome === ReadinessRequirementOutcome.NOT_EVALUATED || outcome === ReadinessRequirementOutcome.REQUIRED;
}

export function withGateName(template: string, gateName: string) {
  return template.replaceAll('{gate}', gateName);
}

export function newWorkOrderHref(truckId: string) {
  return `/admin/work-orders/new?truck=${encodeURIComponent(truckId)}`;
}

export function readinessGateDomId(type: ReadinessRequirementType) {
  return `readiness-gate-${type}`;
}

export function gateLabel(type: ReadinessRequirementType, messages: AdminMessages) {
  return messages[REQUIREMENT_MESSAGE_KEY[type]];
}

export function firstUnresolvedType(requirements: ReadonlyArray<Pick<ReadinessRequirementDto, 'type' | 'outcome'>>) {
  for (const type of READINESS_REQUIREMENT_TYPES) {
    const requirement = requirements.find((candidate) => candidate.type === type);
    if (!requirement || isUnresolvedOutcome(requirement.outcome)) return type;
  }
  return null;
}

export function hasUnevaluatedGate(requirements: ReadonlyArray<Pick<ReadinessRequirementDto, 'outcome'>>) {
  return requirements.some((requirement) => requirement.outcome === ReadinessRequirementOutcome.NOT_EVALUATED);
}

export function markReadyBlockState(
  requirements: ReadonlyArray<Pick<ReadinessRequirementDto, 'type' | 'outcome'>>,
  hasOpenWorkOrder: boolean,
) {
  const incomplete = requirements.some((requirement) => isUnresolvedOutcome(requirement.outcome));
  return {
    disabled: incomplete || hasOpenWorkOrder,
    incomplete,
    hasOpenWorkOrder,
    firstUnresolved: incomplete ? firstUnresolvedType(requirements) : null,
  };
}

export function outcomeHelp(
  type: ReadinessRequirementType,
  outcome: ReadinessRequirementOutcome,
  messages: AdminMessages,
) {
  if (outcome === ReadinessRequirementOutcome.REQUIRED) return messages.outcomeHelpRequired;
  if (outcome === ReadinessRequirementOutcome.NOT_REQUIRED) return messages.outcomeHelpNotRequired;
  if (outcome === ReadinessRequirementOutcome.COMPLETED) {
    return requiredNeedsWorkOrder(type) ? messages.outcomeHelpCompletedLinkWo : messages.outcomeHelpCompleted;
  }
  if (outcome === ReadinessRequirementOutcome.NOT_EVALUATED) return messages.outcomeHelpNotEvaluated;
  return null;
}

export function localizeReadinessBlocker(blocker: ReadinessBlockerDto, messages: AdminMessages) {
  if (blocker.kind === 'required_requirement' && blocker.requirementType) {
    return {
      text: withGateName(messages.gateRequiredUnfinished, gateLabel(blocker.requirementType, messages)),
      href: `#${readinessGateDomId(blocker.requirementType)}`,
    };
  }
  if (blocker.kind === 'unevaluated_requirement' && blocker.requirementType) {
    return {
      text: withGateName(messages.gateNotEvaluatedYet, gateLabel(blocker.requirementType, messages)),
      href: `#${readinessGateDomId(blocker.requirementType)}`,
    };
  }
  if (blocker.kind === 'open_work_order') {
    const status = blocker.status ? workOrderStatusLabel(blocker.status, messages) : '';
    const details = [blocker.categoryName, status].filter(Boolean).join(' · ');
    return {
      text: details ? `${messages.openWorkOrderBlocker} ${details}` : messages.openWorkOrderBlocker,
      href: blocker.workOrderId ? `/admin/work-orders/${blocker.workOrderId}` : undefined,
    };
  }
  return { text: messages.approvalConflictBlocker };
}

export function collapseReadinessBlockers(blockers: ReadonlyArray<ReadinessBlockerDto>) {
  const gateKinds = new Set(['required_requirement', 'unevaluated_requirement']);
  const rowBlockers = blockers.filter((blocker) => gateKinds.has(blocker.kind));
  const listBlockers = blockers.filter((blocker) => !gateKinds.has(blocker.kind));
  return { rowBlockers, listBlockers };
}
