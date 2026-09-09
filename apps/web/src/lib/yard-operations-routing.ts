import { Priority, ReadinessPhase, YardReadinessFilter, WorkOrderStatus } from '@ltl-shop/shared';

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

export const YARD_PHASES = [
  ReadinessPhase.NEEDS_EVALUATION,
  ReadinessPhase.INSPECTION,
  ReadinessPhase.REQUIRED_WORK,
  ReadinessPhase.PM,
  ReadinessPhase.ALIGNMENT,
  ReadinessPhase.DETAILING,
  ReadinessPhase.QUALITY_CHECK,
  ReadinessPhase.READY_TO_GO,
] as const;

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
