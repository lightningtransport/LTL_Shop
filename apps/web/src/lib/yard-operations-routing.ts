import { Priority, ReadinessPhase, WorkPlanPhase, YardReadinessFilter, WorkOrderStatus } from '@ltl-shop/shared';

export type YardOperationsFilters = {
  search: string;
  readiness: string;
  phase: string;
  workOrderStatus: string;
  priority: string;
  blocked: string;
};

export const DEFAULT_YARD_OPERATIONS_FILTERS: YardOperationsFilters = {
  search: '',
  readiness: '',
  phase: '',
  workOrderStatus: '',
  priority: '',
  blocked: '',
};

export function readYardOperationsFilters(params: URLSearchParams | { get(name: string): string | null }): YardOperationsFilters {
  return {
    search: params.get('search') ?? '',
    readiness: params.get('readiness') ?? '',
    phase: params.get('phase') ?? '',
    workOrderStatus: params.get('workOrderStatus') ?? '',
    priority: params.get('priority') ?? '',
    blocked: params.get('blocked') ?? '',
  };
}

export function buildYardOperationsQuery(filters: YardOperationsFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params;
}

const YARD_FILTER_KEYS = ['readiness', 'phase', 'workOrderStatus', 'priority', 'blocked'] as const satisfies ReadonlyArray<keyof YardOperationsFilters>;
export const YARD_TOOLBAR_FILTER_KEYS = ['readiness', 'phase', 'blocked'] as const satisfies ReadonlyArray<keyof YardOperationsFilters>;
export const YARD_OVERFLOW_FILTER_KEYS = ['workOrderStatus', 'priority'] as const satisfies ReadonlyArray<keyof YardOperationsFilters>;

/** Count of readiness/phase/WO status/priority/blocked values that are not defaults. Search is excluded. */
export function countActiveYardOperationsFilters(filters: YardOperationsFilters) {
  return YARD_FILTER_KEYS.filter((key) => filters[key] !== DEFAULT_YARD_OPERATIONS_FILTERS[key]).length;
}

export function countOverflowYardOperationsFilters(filters: YardOperationsFilters) {
  return YARD_OVERFLOW_FILTER_KEYS.filter((key) => filters[key] !== DEFAULT_YARD_OPERATIONS_FILTERS[key]).length;
}

/** Phase 1 six-gate board columns (flag off). */
export const YARD_PHASES = [
  ReadinessPhase.NEEDS_EVALUATION,
  ReadinessPhase.INSPECTION,
  ReadinessPhase.REQUIRED_WORK,
  ReadinessPhase.PM,
  ReadinessPhase.ALIGNMENT,
  ReadinessPhase.DETAILING,
  ReadinessPhase.QUALITY_CHECK,
  ReadinessPhase.READY_FOR_APPROVAL,
  ReadinessPhase.READY_TO_GO,
] as const;

/**
 * Slice 2 Work Plan board columns (opción A). QC is appended only when at least
 * one truck is currently in that phase.
 */
export const WORK_PLAN_YARD_PHASES = [
  WorkPlanPhase.INSPECTION,
  WorkPlanPhase.SHOP_WORK,
  WorkPlanPhase.ALIGNMENT,
  WorkPlanPhase.DETAILING,
  WorkPlanPhase.READY_TO_GO,
] as const;

export type YardBoardColumnPhase =
  | (typeof YARD_PHASES)[number]
  | (typeof WORK_PLAN_YARD_PHASES)[number]
  | typeof WorkPlanPhase.QUALITY_CHECK;

export function yardPhasesForBoard(options: {
  workPlanBoardCutover: boolean;
  itemPhases?: ReadonlyArray<string>;
}): YardBoardColumnPhase[] {
  if (!options.workPlanBoardCutover) return [...YARD_PHASES];
  const phases: YardBoardColumnPhase[] = [...WORK_PLAN_YARD_PHASES];
  if (options.itemPhases?.some((phase) => phase === WorkPlanPhase.QUALITY_CHECK)) {
    const readyIndex = phases.indexOf(WorkPlanPhase.READY_TO_GO);
    phases.splice(readyIndex, 0, WorkPlanPhase.QUALITY_CHECK);
  }
  return phases;
}

export const YARD_READINESS_FILTERS = [
  YardReadinessFilter.NOT_STARTED,
  YardReadinessFilter.UNDER_REVIEW,
  YardReadinessFilter.READY,
] as const;

export const YARD_WORK_ORDER_STATUSES = [
  WorkOrderStatus.CREATED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.WAITING_PAUSED,
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.CANCELLED,
] as const;

export const YARD_PRIORITIES = [Priority.LOW, Priority.NORMAL, Priority.HIGH, Priority.CRITICAL] as const;
