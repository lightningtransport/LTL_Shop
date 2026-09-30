export enum UserRole {
  MECHANIC = 'mechanic',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

export enum AppCapability {
  ADMIN_ACCESS = 'admin.access',
  MECHANIC_STANDARD = 'mechanic.standard',
  MECHANIC_PM = 'mechanic.pm',
  YARD_OPERATIONS_MANAGE = 'yard.operations.manage',
  WORK_ORDERS_MANAGE = 'work_orders.manage',
  /** LTR-185 / D19: Safety takes, approves or returns the Quality Check. */
  QUALITY_CHECK_PERFORM = 'quality_check.perform',
}

/** Roster type (D22): exactly one of these capabilities per person with `role: mechanic`. */
export enum MechanicMode {
  STANDARD = 'standard',
  PM = 'pm',
  /** LTR-187 / D22: Safety (`quality_check.perform`) is created from the roster like the others. */
  SAFETY = 'safety',
}

export enum WorkOrderStatus {
  CREATED = 'created',
  IN_PROGRESS = 'in_progress',
  WAITING_PAUSED = 'waiting_paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum JobStatus {
  TO_DO = 'to_do',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum PauseReason {
  WAITING_FOR_PARTS = 'waiting_for_parts',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
  WAITING_FOR_VENDOR = 'waiting_for_vendor',
  WAITING_FOR_EQUIPMENT = 'waiting_for_equipment',
  WAITING_FOR_BAY = 'waiting_for_bay',
  WAITING_FOR_DRIVER = 'waiting_for_driver',
  TRUCK_UNAVAILABLE = 'truck_unavailable',
  WORKING_ON_ANOTHER_WO = 'working_on_another_wo',
  BREAK = 'break',
  END_OF_SHIFT = 'end_of_shift',
  OTHER = 'other',
}

export const PAUSE_REASON_LABELS: Record<PauseReason, string> = {
  [PauseReason.WAITING_FOR_PARTS]: 'Waiting for Parts',
  [PauseReason.WAITING_FOR_APPROVAL]: 'Waiting for Approval',
  [PauseReason.WAITING_FOR_VENDOR]: 'Waiting for Vendor',
  [PauseReason.WAITING_FOR_EQUIPMENT]: 'Waiting for Equipment / Tool',
  [PauseReason.WAITING_FOR_BAY]: 'Waiting for Bay',
  [PauseReason.WAITING_FOR_DRIVER]: 'Waiting for Driver',
  [PauseReason.TRUCK_UNAVAILABLE]: 'Truck Unavailable',
  [PauseReason.WORKING_ON_ANOTHER_WO]: 'Working on Another Work Order',
  [PauseReason.BREAK]: 'Break',
  [PauseReason.END_OF_SHIFT]: 'End of Shift',
  [PauseReason.OTHER]: 'Other',
};

// LTR-153 / D17: reasons a mechanic can give when a Job is blocked. A subset of
// PauseReason without Break, End of Shift, Working on Another WO or Truck
// Unavailable. PauseReason stays for the Manager's official Work Order pause.
export enum BlockerReason {
  WAITING_FOR_PARTS = 'waiting_for_parts',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
  WAITING_FOR_VENDOR = 'waiting_for_vendor',
  WAITING_FOR_EQUIPMENT = 'waiting_for_equipment',
  WAITING_FOR_BAY = 'waiting_for_bay',
  WAITING_FOR_DRIVER = 'waiting_for_driver',
  OTHER = 'other',
  /** LTR-185 / D19: Safety returned the truck from Quality Check with a note. Not offered to mechanics. */
  QUALITY_CHECK_FAILED = 'quality_check_failed',
}

/** LTR-185: the reasons a mechanic can pick; `quality_check_failed` is only written by Safety. */
export const MECHANIC_BLOCKER_REASONS: BlockerReason[] = Object.values(BlockerReason).filter(
  (reason) => reason !== BlockerReason.QUALITY_CHECK_FAILED,
);

export const BLOCKER_REASON_LABELS: Record<BlockerReason, string> = {
  [BlockerReason.WAITING_FOR_PARTS]: 'Waiting for Parts',
  [BlockerReason.WAITING_FOR_APPROVAL]: 'Waiting for Approval',
  [BlockerReason.WAITING_FOR_VENDOR]: 'Waiting for Vendor',
  [BlockerReason.WAITING_FOR_EQUIPMENT]: 'Waiting for Equipment / Tool',
  [BlockerReason.WAITING_FOR_BAY]: 'Waiting for Bay',
  [BlockerReason.WAITING_FOR_DRIVER]: 'Waiting for Driver',
  [BlockerReason.OTHER]: 'Other',
  [BlockerReason.QUALITY_CHECK_FAILED]: 'Returned by Safety',
};

export const BLOCKER_REASON_LABELS_ES: Record<BlockerReason, string> = {
  [BlockerReason.WAITING_FOR_PARTS]: 'En espera de piezas',
  [BlockerReason.WAITING_FOR_APPROVAL]: 'En espera de aprobación',
  [BlockerReason.WAITING_FOR_VENDOR]: 'En espera del proveedor',
  [BlockerReason.WAITING_FOR_EQUIPMENT]: 'En espera de equipo o herramienta',
  [BlockerReason.WAITING_FOR_BAY]: 'En espera de bahía',
  [BlockerReason.WAITING_FOR_DRIVER]: 'En espera del conductor',
  [BlockerReason.OTHER]: 'Otro',
  [BlockerReason.QUALITY_CHECK_FAILED]: 'Devuelto por Safety',
};

export enum ActivityEventType {
  WORK_ORDER_CREATED = 'work_order_created',
  WORK_STARTED = 'work_started',
  JOB_ADDED = 'job_added',
  JOB_COMPLETED = 'job_completed',
  JOB_CANCELLED = 'job_cancelled',
  WORK_PAUSED = 'work_paused',
  PAUSE_REASON_CHANGED = 'pause_reason_changed',
  WORK_RESUMED = 'work_resumed',
  BLOCKER_REPORTED = 'blocker_reported',
  BLOCKER_RESOLVED = 'blocker_resolved',
  NOTE_ADDED = 'note_added',
  WORK_REQUEST_HANDLED = 'work_request_handled',
  MECHANIC_ADDED = 'mechanic_added',
  MECHANIC_REMOVED = 'mechanic_removed',
  PRIORITY_CHANGED = 'priority_changed',
  NOTES_UPDATED = 'notes_updated',
  WORK_ORDER_COMPLETED = 'work_order_completed',
  MANAGER_CORRECTION = 'manager_correction',
  PM_DETAILS_UPDATED = 'pm_details_updated',
  TRUCK_MILEAGE_CORRECTED = 'truck_mileage_corrected',
  TRUCK_RETURNED_TO_SERVICE = 'truck_returned_to_service',
  READINESS_ASSESSMENT_STARTED = 'readiness_assessment_started',
  READINESS_REQUIREMENT_UPDATED = 'readiness_requirement_updated',
  READINESS_APPROVED = 'readiness_approved',
  READINESS_APPROVAL_INVALIDATED = 'readiness_approval_invalidated',
  READINESS_ASSESSMENT_CLOSED = 'readiness_assessment_closed',
}

/** LTR-126 / D8: kind of an append-only Work Order note entry. */
export enum WorkOrderNoteKind {
  NOTE = 'note',
  WORK_REQUEST = 'work_request',
}

export enum YardPresenceState {
  UNKNOWN = 'unknown',
}

export enum ReadinessAssessmentStatus {
  UNDER_REVIEW = 'under_review',
  READY = 'ready',
  CLOSED = 'closed',
}

/** Readiness filters for the active Yard Operations workspace. */
export enum YardReadinessFilter {
  NOT_STARTED = 'not_started',
  UNDER_REVIEW = 'under_review',
  READY = 'ready',
}

export enum ReadinessRequirementType {
  INSPECTION = 'inspection',
  REQUIRED_REPAIRS = 'required_repairs',
  PM = 'pm',
  ALIGNMENT = 'alignment',
  DETAILING = 'detailing',
  QUALITY_CHECK = 'quality_check',
}

export enum ReadinessRequirementOutcome {
  NOT_EVALUATED = 'not_evaluated',
  REQUIRED = 'required',
  NOT_REQUIRED = 'not_required',
  COMPLETED = 'completed',
  WAIVED = 'waived',
}

export enum ReadinessPhase {
  NEEDS_EVALUATION = 'needs_evaluation',
  INSPECTION = 'inspection',
  REQUIRED_WORK = 'required_work',
  PM = 'pm',
  ALIGNMENT = 'alignment',
  DETAILING = 'detailing',
  QUALITY_CHECK = 'quality_check',
  READY_FOR_APPROVAL = 'ready_for_approval',
  READY_TO_GO = 'ready_to_go',
}

/**
 * Work Plan phase for Truck Detail and the Yard board/list (LTR-150: the only
 * mode). Phase 1 `ReadinessPhase` stays for historical assessments. Shop Work
 * is one phase; jobs live on Truck Detail.
 */
export enum WorkPlanPhase {
  INSPECTION = 'inspection',
  SHOP_WORK = 'shop_work',
  /** LTR-141 / LTR-144: mandatory PM between Shop Work and Alignment. */
  PM = 'pm',
  ALIGNMENT = 'alignment',
  DETAILING = 'detailing',
  QUALITY_CHECK = 'quality_check',
  /** LTR-90 / D1: plan complete but the Work Order is still open. */
  READY_TO_CLOSE = 'ready_to_close',
  READY_TO_GO = 'ready_to_go',
}

/**
 * Yard board `phase` query values. The board uses Work Plan phases (LTR-150);
 * Phase 1 values still validate so old bookmarked URLs do not 400.
 */
export const YardBoardPhase = {
  ...ReadinessPhase,
  SHOP_WORK: WorkPlanPhase.SHOP_WORK,
  READY_TO_CLOSE: WorkPlanPhase.READY_TO_CLOSE,
} as const;

export type YardBoardPhase = (typeof YardBoardPhase)[keyof typeof YardBoardPhase];

export enum WorkPlanInspectionOutcome {
  NOT_STARTED = 'not_started',
  ISSUES_FOUND = 'issues_found',
  NO_ISSUES_FOUND = 'no_issues_found',
}

export enum WorkPlanJobUiStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  /** LTR-155 / D17: the Job has an active blocker. */
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum WorkPlanJobLane {
  /** LTR-89: Jobs in the Inspection Category are discovery, not Shop Work. */
  INSPECTION = 'inspection',
  SHOP_WORK = 'shop_work',
  /** LTR-144: Jobs in the PM Category (PM A / PM B Service). */
  PM = 'pm',
  ALIGNMENT = 'alignment',
  DETAILING = 'detailing',
  QUALITY_CHECK = 'quality_check',
}

/**
 * LTR-156 / D15, D16: mandatory steps of the shop workflow (`shop_workflow_steps.step_key`).
 * Stored as text so new steps can be added without a Postgres enum change.
 */
export enum ShopWorkflowStepKey {
  PM = 'pm',
  ALIGNMENT = 'alignment',
  DETAILING = 'detailing',
  QUALITY_CHECK = 'quality_check',
}

export enum WorkPlanMandatoryStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  NOT_APPLICABLE = 'not_applicable',
}

export enum WorkPlanReadiness {
  NOT_READY = 'not_ready',
  READY = 'ready',
}

export enum WorkPlanNotReadyReason {
  INSPECTION_PENDING = 'inspection_pending',
  JOBS_REMAINING = 'jobs_remaining',
  /** LTR-144: the mandatory PM is not done. */
  PM_PENDING = 'pm_pending',
  ALIGNMENT_PENDING = 'alignment_pending',
  DETAILING_PENDING = 'detailing_pending',
  QC_PENDING = 'qc_pending',
  /** LTR-90 / D1: every step is done; the Manager must complete the Work Order. */
  WORK_ORDER_OPEN = 'work_order_open',
  PLAN_COMPLETE = 'plan_complete',
}

export enum TruckServiceStatus {
  IN_SERVICE = 'in_service',
  OFF_DUTY = 'off_duty',
}

export enum TruckOperationalStatus {
  UNKNOWN = 'unknown',
  IN_SERVICE = 'in_service',
  OFF_DUTY = 'off_duty',
}

export enum CatalogStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** Open WO statuses that block creating another WO on the same truck */
export const OPEN_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.CREATED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.WAITING_PAUSED,
];
