import { Priority, WorkPlanPhase, YardReadinessFilter, WorkOrderStatus } from '@ltl-shop/shared';

export type YardOperationsFilters = {
  search: string;
  readiness: string;
  phase: string;
  workOrderStatus: string;
  priority: string;
  blocked: string;
  outOfShop: string;
};

export const DEFAULT_YARD_OPERATIONS_FILTERS: YardOperationsFilters = {
  search: '',
  readiness: '',
  phase: '',
  workOrderStatus: '',
  priority: '',
  blocked: '',
  outOfShop: '',
};

export function readYardOperationsFilters(params: URLSearchParams | { get(name: string): string | null }): YardOperationsFilters {
  return {
    search: params.get('search') ?? '',
    readiness: params.get('readiness') ?? '',
    phase: params.get('phase') ?? '',
    workOrderStatus: params.get('workOrderStatus') ?? '',
    priority: params.get('priority') ?? '',
    blocked: params.get('blocked') ?? '',
    outOfShop: params.get('outOfShop') ?? '',
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
/** Stage 6: the filters in the "More filters" sheet (the quick filters cover blocked, high priority and out of shop). */
export const YARD_SHEET_FILTER_KEYS = ['readiness', 'phase', 'workOrderStatus', 'priority'] as const satisfies ReadonlyArray<keyof YardOperationsFilters>;
export const YARD_OVERFLOW_FILTER_KEYS = ['workOrderStatus', 'priority'] as const satisfies ReadonlyArray<keyof YardOperationsFilters>;

/** Count of readiness/phase/WO status/priority/blocked values that are not defaults. Search is excluded. */
export function countActiveYardOperationsFilters(filters: YardOperationsFilters) {
  return YARD_FILTER_KEYS.filter((key) => filters[key] !== DEFAULT_YARD_OPERATIONS_FILTERS[key]).length;
}

export function countOverflowYardOperationsFilters(filters: YardOperationsFilters) {
  return YARD_OVERFLOW_FILTER_KEYS.filter((key) => filters[key] !== DEFAULT_YARD_OPERATIONS_FILTERS[key]).length;
}

/**
 * Work Plan board columns (LTR-39 / LTR-144): Inspection → Shop Work → PM →
 * Alignment → Detailing → QC → Ready to close → Ready to Go.
 */
export const WORK_PLAN_YARD_PHASES = [
  WorkPlanPhase.INSPECTION,
  WorkPlanPhase.SHOP_WORK,
  WorkPlanPhase.PM,
  WorkPlanPhase.ALIGNMENT,
  WorkPlanPhase.DETAILING,
  WorkPlanPhase.QUALITY_CHECK,
  WorkPlanPhase.READY_TO_CLOSE,
  WorkPlanPhase.READY_TO_GO,
] as const;

export type YardBoardColumnPhase = (typeof WORK_PLAN_YARD_PHASES)[number];

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

/**
 * D4 / UX-5-006: where the Truck's back link returns from a Yard card — the Yard with its current
 * search, filters, view and tab, so "Back to Yard Operations" never drops what the Manager set.
 * The pagination cursor is not kept: going back starts at the first page.
 */
export function yardOperationsFromPath(query: string) {
  const params = new URLSearchParams(query);
  params.delete('cursor');
  const kept = params.toString();
  return kept ? `/admin/yard-operations?${kept}` : '/admin/yard-operations';
}

/**
 * Stage 6 (UX-5-009, UX-6-002): the quick filters on top of the board. They apply on tap, one at a
 * time, and stay in the URL like every other filter.
 */
export const YARD_QUICK_FILTERS = ['all', 'blocked', 'high', 'out'] as const;
export type YardQuickFilter = (typeof YARD_QUICK_FILTERS)[number];

const HIGH_PRIORITIES = `${Priority.HIGH},${Priority.CRITICAL}`;

export function yardQuickFilterOf(filters: YardOperationsFilters): YardQuickFilter {
  if (filters.blocked === 'true') return 'blocked';
  if (filters.priority === HIGH_PRIORITIES) return 'high';
  if (filters.outOfShop === 'true') return 'out';
  return 'all';
}

export function withYardQuickFilter(filters: YardOperationsFilters, quick: YardQuickFilter): YardOperationsFilters {
  const next = { ...filters, blocked: '', priority: '', outOfShop: '' };
  if (quick === 'blocked') next.blocked = 'true';
  if (quick === 'high') next.priority = HIGH_PRIORITIES;
  if (quick === 'out') next.outOfShop = 'true';
  return next;
}
