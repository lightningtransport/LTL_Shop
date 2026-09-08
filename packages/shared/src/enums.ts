export enum UserRole {
  MECHANIC = 'mechanic',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

export enum AppCapability {
  ADMIN_ACCESS = 'admin.access',
  MECHANIC_STANDARD = 'mechanic.standard',
  MECHANIC_PM = 'mechanic.pm',
}

export enum MechanicMode {
  STANDARD = 'standard',
  PM = 'pm',
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

export enum ActivityEventType {
  WORK_ORDER_CREATED = 'work_order_created',
  WORK_STARTED = 'work_started',
  JOB_ADDED = 'job_added',
  JOB_COMPLETED = 'job_completed',
  JOB_CANCELLED = 'job_cancelled',
  WORK_PAUSED = 'work_paused',
  PAUSE_REASON_CHANGED = 'pause_reason_changed',
  WORK_RESUMED = 'work_resumed',
  MECHANIC_ADDED = 'mechanic_added',
  MECHANIC_REMOVED = 'mechanic_removed',
  PRIORITY_CHANGED = 'priority_changed',
  NOTES_UPDATED = 'notes_updated',
  WORK_ORDER_COMPLETED = 'work_order_completed',
  MANAGER_CORRECTION = 'manager_correction',
  PM_DETAILS_UPDATED = 'pm_details_updated',
  TRUCK_MILEAGE_CORRECTED = 'truck_mileage_corrected',
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
