import {
  ActivityEventType,
  JobStatus,
  Priority,
  ReadinessPhase,
  WorkOrderStatus,
  WorkPlanPhase,
} from '@ltl-shop/shared';
import type { AdminMessages } from './admin-messages';

export type ChipVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';

export const WORK_ORDER_STATUS_VARIANT = {
  [WorkOrderStatus.CREATED]: 'outline',
  [WorkOrderStatus.IN_PROGRESS]: 'default',
  [WorkOrderStatus.WAITING_PAUSED]: 'warning',
  [WorkOrderStatus.COMPLETED]: 'success',
  [WorkOrderStatus.CANCELLED]: 'secondary',
} as const satisfies Record<WorkOrderStatus, ChipVariant>;

export const JOB_STATUS_VARIANT = {
  [JobStatus.TO_DO]: 'outline',
  [JobStatus.COMPLETED]: 'success',
  [JobStatus.CANCELLED]: 'secondary',
} as const satisfies Record<JobStatus, ChipVariant>;

export const PRIORITY_VARIANT = {
  [Priority.LOW]: 'secondary',
  [Priority.NORMAL]: 'outline',
  [Priority.HIGH]: 'warning',
  [Priority.CRITICAL]: 'destructive',
} as const satisfies Record<Priority, ChipVariant>;

export const PHASE_VARIANT = {
  [ReadinessPhase.NEEDS_EVALUATION]: 'warning',
  [ReadinessPhase.INSPECTION]: 'outline',
  [ReadinessPhase.REQUIRED_WORK]: 'outline',
  [ReadinessPhase.PM]: 'outline',
  [ReadinessPhase.ALIGNMENT]: 'outline',
  [ReadinessPhase.DETAILING]: 'outline',
  [ReadinessPhase.QUALITY_CHECK]: 'outline',
  [ReadinessPhase.READY_FOR_APPROVAL]: 'warning',
  [ReadinessPhase.READY_TO_GO]: 'success',
  [WorkPlanPhase.SHOP_WORK]: 'outline',
  [WorkPlanPhase.READY_TO_CLOSE]: 'warning',
} as const satisfies Record<
  ReadinessPhase | typeof WorkPlanPhase.SHOP_WORK | typeof WorkPlanPhase.READY_TO_CLOSE,
  ChipVariant
>;

export const ADMIN_WO_STATUS_KEY = {
  [WorkOrderStatus.CREATED]: 'woStatusCreated',
  [WorkOrderStatus.IN_PROGRESS]: 'woStatusInProgress',
  [WorkOrderStatus.WAITING_PAUSED]: 'woStatusPaused',
  [WorkOrderStatus.COMPLETED]: 'woStatusCompleted',
  [WorkOrderStatus.CANCELLED]: 'woStatusCancelled',
} as const;

export const ADMIN_JOB_STATUS_KEY = {
  [JobStatus.TO_DO]: 'jobStatusToDo',
  [JobStatus.COMPLETED]: 'jobStatusCompleted',
  [JobStatus.CANCELLED]: 'jobStatusCancelled',
} as const;

export const ADMIN_PRIORITY_KEY = {
  [Priority.LOW]: 'lowPriority',
  [Priority.NORMAL]: 'normalPriority',
  [Priority.HIGH]: 'highPriority',
  [Priority.CRITICAL]: 'criticalPriority',
} as const;

export const ADMIN_PHASE_KEY = {
  [ReadinessPhase.NEEDS_EVALUATION]: 'needsEvaluation',
  [ReadinessPhase.INSPECTION]: 'inspection',
  [ReadinessPhase.REQUIRED_WORK]: 'requiredWork',
  [ReadinessPhase.PM]: 'pm',
  [ReadinessPhase.ALIGNMENT]: 'alignment',
  [ReadinessPhase.DETAILING]: 'detailing',
  [ReadinessPhase.QUALITY_CHECK]: 'qualityCheck',
  [ReadinessPhase.READY_FOR_APPROVAL]: 'readyForApproval',
  [ReadinessPhase.READY_TO_GO]: 'readyToGo',
} as const;

export const ADMIN_ACTIVITY_EVENT_KEY = {
  [ActivityEventType.WORK_ORDER_CREATED]: 'activityWorkOrderCreated',
  [ActivityEventType.WORK_STARTED]: 'activityWorkStarted',
  [ActivityEventType.JOB_ADDED]: 'activityJobAdded',
  [ActivityEventType.JOB_COMPLETED]: 'activityJobCompleted',
  [ActivityEventType.JOB_CANCELLED]: 'activityJobCancelled',
  [ActivityEventType.WORK_PAUSED]: 'activityWorkPaused',
  [ActivityEventType.PAUSE_REASON_CHANGED]: 'activityPauseReasonChanged',
  [ActivityEventType.WORK_RESUMED]: 'activityWorkResumed',
  [ActivityEventType.BLOCKER_REPORTED]: 'activityBlockerReported',
  [ActivityEventType.BLOCKER_RESOLVED]: 'activityBlockerResolved',
  [ActivityEventType.NOTE_ADDED]: 'activityNoteAdded',
  [ActivityEventType.WORK_REQUEST_HANDLED]: 'activityWorkRequestHandled',
  [ActivityEventType.MECHANIC_ADDED]: 'activityMechanicAdded',
  [ActivityEventType.MECHANIC_REMOVED]: 'activityMechanicRemoved',
  [ActivityEventType.PRIORITY_CHANGED]: 'activityPriorityChanged',
  [ActivityEventType.NOTES_UPDATED]: 'activityNotesUpdated',
  [ActivityEventType.WORK_ORDER_COMPLETED]: 'activityWorkOrderCompleted',
  [ActivityEventType.MANAGER_CORRECTION]: 'activityManagerCorrection',
  [ActivityEventType.PM_DETAILS_UPDATED]: 'activityPmDetailsUpdated',
  [ActivityEventType.TRUCK_MILEAGE_CORRECTED]: 'activityTruckMileageCorrected',
  [ActivityEventType.TRUCK_RETURNED_TO_SERVICE]: 'activityTruckReturnedToService',
  [ActivityEventType.READINESS_ASSESSMENT_STARTED]: 'activityReadinessAssessmentStarted',
  [ActivityEventType.READINESS_REQUIREMENT_UPDATED]: 'activityReadinessRequirementUpdated',
  [ActivityEventType.READINESS_APPROVED]: 'activityReadinessApproved',
  [ActivityEventType.READINESS_APPROVAL_INVALIDATED]: 'activityReadinessApprovalInvalidated',
  [ActivityEventType.READINESS_ASSESSMENT_CLOSED]: 'activityReadinessAssessmentClosed',
  [ActivityEventType.VENDOR_SAVED]: 'activityVendorSaved',
  [ActivityEventType.PART_CATALOG_UPDATED]: 'activityPartCatalogUpdated',
  [ActivityEventType.PART_PURCHASE_SAVED]: 'activityPartPurchaseSaved',
  [ActivityEventType.PART_PURCHASE_VOIDED]: 'activityPartPurchaseVoided',
  [ActivityEventType.OUTSIDE_REPAIR_SAVED]: 'activityOutsideRepairSaved',
  [ActivityEventType.OUTSIDE_REPAIR_VOIDED]: 'activityOutsideRepairVoided',
  [ActivityEventType.LABOR_RATE_SAVED]: 'activityLaborRateSaved',
} as const;

export function workOrderStatusVariant(status: string): ChipVariant {
  return status in WORK_ORDER_STATUS_VARIANT
    ? WORK_ORDER_STATUS_VARIANT[status as WorkOrderStatus]
    : 'outline';
}

export function jobStatusVariant(status: string): ChipVariant {
  return status in JOB_STATUS_VARIANT
    ? JOB_STATUS_VARIANT[status as JobStatus]
    : 'outline';
}

export function priorityVariant(priority: string): ChipVariant {
  return priority in PRIORITY_VARIANT
    ? PRIORITY_VARIANT[priority as Priority]
    : 'outline';
}

export function phaseVariant(phase: string): ChipVariant {
  return phase in PHASE_VARIANT
    ? PHASE_VARIANT[phase as keyof typeof PHASE_VARIANT]
    : 'outline';
}

export function workOrderStatusLabel(status: string, catalog: AdminMessages): string {
  return status in ADMIN_WO_STATUS_KEY
    ? catalog[ADMIN_WO_STATUS_KEY[status as WorkOrderStatus]]
    : status;
}

export function jobStatusLabel(status: string, catalog: AdminMessages): string {
  return status in ADMIN_JOB_STATUS_KEY
    ? catalog[ADMIN_JOB_STATUS_KEY[status as JobStatus]]
    : status;
}

export function adminPriorityLabel(priority: string, catalog: AdminMessages): string {
  return priority in ADMIN_PRIORITY_KEY
    ? catalog[ADMIN_PRIORITY_KEY[priority as Priority]]
    : priority;
}

export function phaseLabel(phase: string, catalog: AdminMessages): string {
  return phase in ADMIN_PHASE_KEY
    ? catalog[ADMIN_PHASE_KEY[phase as ReadinessPhase]]
    : phase;
}

export function adminActivityEventLabel(eventType: string, catalog: AdminMessages): string {
  return eventType in ADMIN_ACTIVITY_EVENT_KEY
    ? catalog[ADMIN_ACTIVITY_EVENT_KEY[eventType as ActivityEventType]]
    : catalog.activityUnknown;
}

function activityString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field.trim() ? field : null;
}

export function adminActivityEventDetail(entry: { newValue: unknown; previousValue?: unknown }): string | null {
  const displayName = activityString(entry.newValue, 'displayName');
  const notes = activityString(entry.newValue, 'notes') ?? activityString(entry.previousValue, 'notes');
  const parts = [displayName, notes].filter(Boolean);
  return parts.length ? parts.join(' — ') : null;
}

/** LTR-121: shared attention reason → Admin copy (null for plain open or closed work). */
export function adminAttentionReasonLabel(reason: string | null | undefined, messages: AdminMessages): string | null {
  switch (reason) {
    case 'ready_to_close': return messages.attentionReasonReadyToClose;
    case 'critical': return messages.attentionReasonCritical;
    case 'high': return messages.attentionReasonHigh;
    case 'paused': return messages.attentionReasonPaused;
    case 'blocker': return messages.attentionReasonBlocker;
    case 'unassigned': return messages.attentionReasonUnassigned;
    case 'open_over_24h': return messages.attentionReasonOpenOver24h;
    default: return null;
  }
}
