import type { WorkOrderAttentionReason } from './attention';
import type { JobWorkStatus } from './job-work-status';
import type { TruckNextStepDto } from './truck-next-step';
import type { TruckFaultSummaryDto, TruckSamsaraDto } from './samsara';
import type {
  AppCapability,
  ActivityEventType,
  WorkSessionEndReason,
  BlockerReason,
  JobStatus,
  JobExternalKind,
  PauseReason,
  WorkOrderNoteKind,
  Priority,
  ReadinessAssessmentStatus,
  ReadinessPhase,
  YardBoardPhase,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  UserRole,
  YardPresenceState,
  WorkOrderStatus,
  TruckOperationalStatus,
  CatalogStatus,
  WorkPlanPhase,
  WorkPlanInspectionOutcome,
  WorkPlanJobUiStatus,
  WorkPlanJobLane,
  WorkPlanMandatoryStatus,
  WorkPlanReadiness,
  WorkPlanNotReadyReason,
} from './enums';

export type AdminDataSource = 'supabase_postgres';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  capabilities: AppCapability[];
}

/**
 * D22 / LTR-187: `POST /admin/mechanics` also creates the Supabase Auth account. The temporary
 * password is returned once and never stored; it is null when the API has no Supabase service key
 * (local dev, flow tests).
 */
export interface AdminMechanicCreatedDto extends UserDto {
  temporaryPassword: string | null;
}

/** D22: `POST /admin/mechanics/:id/reset-password`. Returned once, never stored. */
export interface AdminMechanicPasswordResetDto {
  temporaryPassword: string;
}

/** D22: a Job still to do that keeps a person from being deactivated. */
export interface AdminMechanicPendingJobDto {
  workOrderId: string;
  workOrderDisplayId: string;
  truckNumber: string;
  jobDisplayName: string;
  /** LTR-199: present on the person detail. */
  jobId?: string;
  /** LTR-199 / D28: set when the Job came from a team queue, so it can be sent back there. */
  workflowStepKey?: string | null;
}

/** D22: the `MECHANIC_HAS_OPEN_WORK` body — what the Manager must reassign or stop first. */
export interface AdminMechanicOpenWorkDto {
  code: 'MECHANIC_HAS_OPEN_WORK';
  message: string;
  pendingJobs: AdminMechanicPendingJobDto[];
  runningSession: boolean;
}

export interface TruckDto {
  id: string;
  truckNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  company: string | null;
  owner: string | null;
  vin: string | null;
  /** Last reported address: the Samsara sync's (S-2) when there is one, else `trucks.samsara_truck_location`. Not Yard Presence. */
  location: string | null;
  /**
   * ISO date (`YYYY-MM-DD`) of `location`: the Samsara sync's GPS time when there is one (S-2), else
   * `trucks.samsara_last_connected_date` (the old Ninox copy).
   */
  locationUpdatedOn: string | null;
  /** D35 / S-2: Samsara's odometer and last GPS point, when the truck is paired and synced. */
  samsara?: TruckSamsaraDto | null;
  /** LTR-140: the Truck's open Work Order, sent by `GET /trucks` so search results can mark it. */
  openWorkOrder?: TruckOpenWorkOrderRefDto | null;
  /** D44: the rest of the truck's card (Admin → Trucks). */
  licensePlate?: string | null;
  dispatcher?: string | null;
  insurance?: string | null;
  /** D44: set when the truck left the fleet; it is out of the lists and of New Work Order. */
  deactivatedAt?: string | null;
}

export interface TruckOpenWorkOrderRefDto {
  id: string;
  displayId: string;
  status: WorkOrderStatus;
}

export interface JobCategoryDto {
  id: string;
  name: string;
  sortOrder: number;
}

export type JobCategoryReferenceDto = Pick<JobCategoryDto, 'id' | 'name'>;

export interface CatalogJobDto {
  id: string;
  categoryId: string;
  displayName: string;
  aliases?: string[];
}

export interface JobAliasOptionDto {
  aliasText: string;
  catalogJobId: string;
  categoryId: string;
  displayName: string;
}

export interface WorkOrderJobDto {
  id: string;
  workOrderId: string;
  catalogJobId: string | null;
  categoryId: string;
  category: JobCategoryReferenceDto;
  displayName: string;
  customDescription: string | null;
  status: JobStatus;
  completedAt: string | null;
  completedById: string | null;
  completionNotes: string | null;
  /** LTR-154 / D11: the one mechanic who owns the Job; null means unassigned. */
  assignedMechanic: { id: string; name: string } | null;
  /** LTR-154 / D18: Pending / In Progress derived from the assignee's labor session (Blocked wins, LTR-155). */
  workStatus?: JobWorkStatus;
  /** LTR-155 / D17: the Job's active blocker, if any. */
  activeBlocker?: JobActiveBlockerDto | null;
  /** LTR-127: who completed the Job (additive; absent on older API responses). */
  completedBy?: { id: string; name: string } | null;
  /** LTR-146: when the PM job was started. */
  startedAt?: string | null;
  /** LTR-188 / D23: the Job this one helps (a helper Job); the web appends "· helper". */
  helperOfJobId?: string | null;
  /** LTR-188 / D24: set while the Job is at an external shop. */
  external?: JobExternalDto | null;
  /** LTR-197 / D28: the step whose team queue the Job came from (it can be let go back there). */
  workflowStepKey?: string | null;
  /** D42 / S-6: the Samsara faults this Job takes care of, so the mechanic sees why. */
  samsaraFaults?: Array<{ code: string; description: string }>;
  /** D45 / ST-1: the parts bought for this Job (name and quantity; the mechanic never sees costs). */
  parts?: Array<{ description: string; partNumber: string | null; quantity: string }>;
  /** D46 / SQ-3: what Safety found that this Job takes care of ("Plate light out"), never who. */
  qcFindings?: string[];
  /** D45 / ST-4: the tires to put, as the Manager confirmed them ("RF · New 11R22.5"), never their cost. */
  tires?: Array<{ position: string; tireType: 'new' | 'recap'; tireSize: string | null; status: 'proposed' | 'issued' | 'to_buy' }>;
  /** D52: the tires from the inspection that made this Job, and why ("RF · 72 PSI (should be 110) · low pressure"). */
  tireFindings?: JobTireFindingDto[];
  /** D52: what the inspection sheet said for this Job ("Lights: left lens cracked"). */
  inspectionNotes?: string[];
}

/** D52: one tire reading behind a Job. `worn` = tread under the minimum; otherwise the pressure is off. */
export interface JobTireFindingDto {
  position: string;
  psi: number;
  targetPsi: number;
  tread: number;
  minTread: number;
  reason: 'low_pressure' | 'high_pressure' | 'worn';
}


/** LTR-188 / D24: a Job at an external shop — what went out, the Manager's note and since when. */
export interface JobExternalDto {
  kind: JobExternalKind;
  note: string;
  since: string;
}

/** LTR-155 / D17: short form of a Job's active blocker for lists and cards. */
export interface JobActiveBlockerDto {
  id: string;
  reason: BlockerReason | PauseReason;
  reportedAt: string;
  reportedBy: { id: string; name: string } | null;
}

/** LTR-155 / D17: an append-only note on a blocker (author and time). */
export interface BlockerNoteDto {
  id: string;
  body: string;
  author: { id: string; name: string };
  createdAt: string;
}

export interface PauseEventDto {
  id: string;
  workOrderId: string;
  reason: PauseReason;
  notes: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  // Official Manager/legacy pauses are true. Mechanic reports are false and
  // must not drive currentPause, waiting totals, or time correction.
  isOfficialPause?: boolean;
  reportedBy?: { id: string; name: string } | null;
  /** LTR-98: set when a reported blocker was resolved (null = still active). */
  resolvedAt?: string | null;
  resolvedBy?: { id: string; name: string } | null;
  /** LTR-155 / D17: the blocked Job (null for official pauses and older reports). */
  job?: { id: string; displayName: string } | null;
  blockerReason?: BlockerReason | null;
  /** LTR-155: mechanic notes after the report, oldest first. */
  blockerNotes?: BlockerNoteDto[];
  /** LTR-155: the Manager's optional note when resolving. */
  resolutionNote?: string | null;
}

/** LTR-126 / D8: one append-only Work Order note (never edited or overwritten). */
export interface WorkOrderNoteDto {
  id: string;
  kind: WorkOrderNoteKind;
  body: string;
  author: { id: string; name: string };
  createdAt: string;
  /** Work requests only: set when the Manager handled the request. */
  handledAt: string | null;
  handledBy: { id: string; name: string } | null;
}

export interface MechanicAssignmentDto {
  mechanicId: string;
  mechanicName: string;
  addedAt: string;
  removedAt: string | null;
}

export interface WorkOrderSummaryDto {
  id: string;
  displayId: string;
  truckId: string;
  truckNumber: string;
  /** LTR-130: year / make / model so a card identifies the Truck (additive). */
  truckVehicle?: { year: number | null; make: string | null; model: string | null };
  /** LTR-146: the PM job of a truck Work Order. */
  pmJob?: {
    id: string;
    displayName: string;
    status: JobStatus;
    startedAt: string | null;
    completedAt: string | null;
    assignedMechanic: { id: string; name: string } | null;
    /** Stage PM-1 (PM workspace list only): the PM's mileage and how many parts it has. */
    observedMileage?: number | null;
    partsCount?: number;
  } | null;
  /** Stage PM-1 (PM workspace list only): the truck's previous finished PM ("Last PM: 196,400 mi · May 30"). */
  lastPm?: { observedMileage: number | null; completedAt: string } | null;
  /** Stage PM-1: when the Manager paused it and the pause note ("paused yesterday · fuel filters arrive Thursday"). */
  pausedAt?: string | null;
  pauseNote?: string | null;
  primaryCategoryId: string;
  primaryCategoryName: string;
  status: WorkOrderStatus;
  priority: Priority;
  jobsCompleted: number;
  jobsTotal: number;
  /** Stage MG-1: `completedAt` and `completionNotes` feed Completed; older API responses omit them. */
  jobs: (Pick<WorkOrderJobDto, 'id' | 'categoryId' | 'category' | 'displayName' | 'status' | 'assignedMechanic' | 'completedBy' | 'workStatus' | 'activeBlocker' | 'helperOfJobId' | 'external'>
    & Partial<Pick<WorkOrderJobDto, 'completedAt' | 'completionNotes'>>)[];
  mechanics: Pick<MechanicAssignmentDto, 'mechanicId' | 'mechanicName'>[];
  currentPauseReason: PauseReason | null;
  createdAt: string;
  startedAt: string | null;
  /** LTR-158 / D18: the Manager resolved my blocker and my time is stopped — tap Continue. */
  resolvedBlockerAwaitingContinue?: boolean;
  /** LTR-164 (#10): PM workspace only. `status` buckets by the PM job; this is the Work Order's own status. */
  workOrderStatus?: WorkOrderStatus;
  /**
   * LTR-186 / D20, D21 (mechanic endpoints only): the app stopped my clock here — the day close, or I
   * started on another Truck — and I still have work here. Tap Continue. Null when it does not apply.
   */
  myClockStopped?: MyClockStoppedDto | null;
}

/** LTR-186: why my clock stopped on this Work Order and, after a switch, where it runs now. */
export interface MyClockStoppedDto {
  reason: `${WorkSessionEndReason}`;
  /** switched_truck only: the Work Order where my clock is running now (absent when it is not running anywhere). */
  elsewhereWorkOrder?: { id: string; displayId: string; truckNumber: string; since?: string } | null;
}

/** LTR-186 / D20: Admin → Setup → Shop workflow → Shop hours. */
export interface ShopHoursDto {
  /** Day close in shop time, 24-hour "HH:MM". */
  cutoff: string;
  /** ISO weekdays (Monday = 1 … Sunday = 7). */
  workdays: number[];
  timeZone: string;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}

/** Stage MG-1 (MG1): where the mechanic's clock runs now, and since when. */
export interface MechanicClockDto {
  workOrderId: string;
  displayId: string;
  truckNumber: string;
  since: string;
}

export interface WorkOrderDetailDto extends WorkOrderSummaryDto {
  /** Stage MG-1 (MG5): the viewer's own active time on this Work Order, every day (D-MG2). Mechanic endpoints only. */
  myActiveLaborMs?: number;
  /** Block A (MG2), Start only: the Truck my clock left when I started here (D21), or null. */
  clockMovedFrom?: { id: string; displayId: string; truckNumber: string } | null;
  notes: string | null;
  createdById: string;
  completedAt: string | null;
  totalActiveLaborMs: number;
  totalWaitingMs: number;
  /**
   * LTR-154 / D18: for a mechanic assigned to a Job here, true while their own
   * labor session is open; for anyone else, true while any session is open.
   */
  laborRunning: boolean;
  /** LTR-154: the viewer's own Jobs (mechanic endpoints only). */
  myJobs?: WorkOrderJobDto[];
  /** LTR-154: other mechanics' and unassigned Jobs, read-only for the viewer. */
  otherJobs?: WorkOrderJobDto[];
  /** LTR-154: the viewer had Jobs here and none is pending ("You finished your part"). */
  myPartDone?: boolean;
  jobs: WorkOrderJobDto[];
  mechanics: MechanicAssignmentDto[];
  currentPause: PauseEventDto | null;
  /** LTR-128: unresolved mechanic-reported blockers (newest first). */
  activeBlockers?: PauseEventDto[];
  /** LTR-164 (#9): the blocker the Manager resolved on my Job while I wait to tap Continue, with their note. */
  resolvedBlocker?: PauseEventDto | null;
  /** LTR-164 (#6): the viewer already had a labor session here (the button reads Continue, not Start work). */
  myLaborStarted?: boolean;
  /** LTR-126: append-only notes and work requests (oldest first). */
  noteEntries?: WorkOrderNoteDto[];
  truck: TruckDto;
  version: number;
}

export interface RepairHistoryItemDto {
  workOrderId: string;
  displayId: string;
  date: string;
  primaryCategoryName: string;
  truckNumber: string;
  mechanicNames: string[];
  mileage: number | null;
  // Legacy display-only field retained for existing clients.
  jobs: string[];
  // Additive, canonical Job identity and Category data for multi-Category readers.
  jobDetails: Pick<WorkOrderJobDto, 'id' | 'categoryId' | 'category' | 'displayName' | 'status'>[];
}

export interface OpenWorkOrderConflictDto {
  exists: true;
  workOrder: WorkOrderSummaryDto;
}

export interface ApiErrorDto {
  statusCode: number;
  message: string;
  code?: string;
}

export interface AdminPage<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface AdminMechanicAssignmentDto {
  workOrderId: string;
  displayId: string;
  truckNumber: string;
  status: WorkOrderStatus;
  primaryCategoryName: string;
}

export interface AdminMechanicSummaryDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  capabilities: AppCapability[];
  openWorkOrderCount: number;
  currentAssignments: AdminMechanicAssignmentDto[];
  /** LTR-199 / ME1: Jobs still to do in their name on open Work Orders. */
  pendingJobCount?: number;
  /** LTR-199 / D28: the Shop workflow steps whose team they are on. */
  teamStepKeys?: string[];
  /** LTR-199 / D31: when they were removed from the Shop (null while still in it). */
  removedAt?: string | null;
}

export interface AdminMechanicDetailDto extends AdminMechanicSummaryDto {
  completedJobCount: number;
  /** Closed Work Orders where this person completed a Job, newest first (up to 10). */
  recentClosedWorkOrders: AdminMechanicAssignmentDto[];
  /** D22: Jobs still to do that block deactivating, shown before the Manager confirms (ME2). */
  pendingJobs: AdminMechanicPendingJobDto[];
  runningSession: boolean;
  /** Shop workflow steps whose team this person is on (SW3); `memberCount` is the team's size. */
  defaultOwnerOfSteps: Array<{ stepKey: string; jobDisplayName: string; memberCount?: number }>;
  /** LTR-199 / ME4: the Jobs they completed lately, newest first (up to 10). */
  recentCompletedJobs?: Array<{ jobId: string; displayName: string; workOrderId: string; displayId: string; truckNumber: string; completedAt: string | null }>;
  /** LTR-199 / D31: true when they never did anything (no Jobs, notes, time or Work Orders), so Delete is offered. */
  canDelete?: boolean;
  removedBy?: { id: string; name: string } | null;
}

export interface AdminMutationMeta {
  expectedVersion: number;
  idempotencyKey: string;
  reason?: string;
}

export interface AdminWorkOrderSummaryDto {
  id: string;
  displayId: string;
  truck: Pick<TruckDto, 'id' | 'truckNumber' | 'make' | 'model' | 'year'>;
  category: { id: string; name: string };
  status: WorkOrderStatus;
  priority: Priority;
  jobsCompleted: number;
  jobsTotal: number;
  mechanics: MechanicAssignmentDto[];
  currentPause: PauseEventDto | null;
  latestReportedBlocker: PauseEventDto | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  /** LTR-121: why this open Work Order needs attention (null when closed). Additive. */
  attentionReason?: WorkOrderAttentionReason | null;
  /** LTR-157: the next pending Job in flow order (Inspection → Shop Work → PM → Alignment → Detailing → QC). */
  nextJobName?: string | null;
  /** LTR-159: the one Next step rule (same as Truck Detail and the Yard). */
  nextStep?: TruckNextStepDto | null;
}

export interface AdminActivityLogDto {
  id: string;
  eventType: ActivityEventType;
  entityType: string;
  entityId: string | null;
  user: { id: string; name: string };
  previousValue: unknown;
  newValue: unknown;
  relevantValue: unknown;
  createdAt: string;
}

export interface AdminWorkOrderJobDto {
  id: string;
  catalogJobId: string | null;
  displayName: string;
  customDescription: string | null;
  category: JobCategoryReferenceDto;
  status: JobStatus;
  // Manager-first ownership: optional per-Job assignment. Null means the Job
  // inherits the Work Order general mechanic team.
  assignedMechanic: { id: string; name: string } | null;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  completionNotes: string | null;
  /** Stage 8: why a cancelled Job was cancelled (null otherwise). */
  cancelledReason?: string | null;
  /** LTR-146: when the PM job was started. */
  startedAt?: string | null;
  /** LTR-188 / D23: the Job this one helps (a helper Job); the web appends "· helper". */
  helperOfJobId?: string | null;
  /** LTR-188 / D24: set while the Job is at an external shop. */
  external?: JobExternalDto | null;
  /** LTR-197 / D28: the step whose team queue the Job came from (it can be let go back there). */
  workflowStepKey?: string | null;
  /** LTR-200 / PC-3: outside shop invoices tied to this Job (Manager and System Admin only; others get none). */
  outsideInvoices?: Array<{ id: string; amountCents: number; vendorName: string }>;
  /** D45 / ST-1: parts bought for this Job on a purchase; `lineTotalCents` only for Manager and System Admin. */
  parts?: Array<{ purchaseId: string; description: string; partNumber: string | null; quantity: string; vendorName: string; lineTotalCents?: number }>;
  /** D45 / ST-3: what left the stock for this Job (`valueCents` only for Manager and System Admin). */
  stockParts?: Array<{ movementId: string; partId: string; description: string; quantity: string; returned: boolean; valueCents?: number }>;
  /** D45 / ST-4: the tires to put on this Job, one per position (`valueCents` only for Manager and System Admin). */
  tires?: import('./parts-costs').AdminJobTireDto[];
  /** PCA3 (UX-10-001): the Job went to an external shop at some point (out now or already back), so its invoice can still be loaded. */
  wentExternal?: boolean;
}

export interface AdminWorkOrderDetailDto extends AdminWorkOrderSummaryDto {
  truck: TruckDto;
  version: number;
  /** PCA10 (UX-5-005): what this Work Order has cost so far from the truck's ledger (Manager and System Admin only). */
  costs?: { partsCents: number; outsideCents: number; laborCents: number };
  notes: string | null;
  createdBy: { id: string; name: string };
  completedBy: { id: string; name: string } | null;
  totalActiveLaborMs: number;
  totalWaitingMs: number;
  jobs: AdminWorkOrderJobDto[];
  /** D46 / SQ-3: what Safety found at the Quality Check, handled or not. */
  qcFindings?: AdminQcFindingDto[];
  laborSessions: AdminTimeSegmentDto[];
  pauseHistory: (PauseEventDto & {
    createdBy: { id: string; name: string };
  })[];
  reportedBlockers: (PauseEventDto & {
    createdBy: { id: string; name: string };
  })[];
  activityLog: AdminActivityLogDto[];
  /** LTR-126: append-only notes and work requests (oldest first). */
  noteEntries?: WorkOrderNoteDto[];
  /** LTR-119 / D6: the Truck Work Plan is where Jobs are added. @deprecated LTR-150: always true; kept for web/API deploy skew. */
  addWorkInWorkPlan?: boolean;
  /** LTR-146: PM service recorded on this Work Order (legacy PM WO or PM job). */
  pmService?: { observedMileage: number | null; partsCount: number; workOrderJobId: string | null } | null;
  returnedToServiceAt: string | null;
}

export interface AdminTimeSegmentDto {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  /** LTR-184 / D18: whose clock this is. Null on sessions from before per-mechanic labor. */
  mechanic?: { id: string; name: string } | null;
  /** LTR-186: the app closed it at the day close (D20) or when the mechanic switched Truck (D21). */
  endReason?: `${WorkSessionEndReason}` | null;
}

export interface AdminRepairHistoryDto {
  truck: TruckDto;
  items: RepairHistoryItemDto[];
  nextCursor: string | null;
}

export interface AdminDashboardDto {
  generatedAt: string;
  source: AdminDataSource;
  timeZone: 'America/New_York';
  windows: {
    openOlderThan24h: { before: string };
    today: { from: string; to: string };
    last7Days: { from: string; to: string };
  };
  counts: {
    open: number;
    waitingPaused: number;
    highCriticalOpen: number;
    openOlderThan24h: number;
    completedToday: number;
    completedLast7Days: number;
    /** LTR-159: trucks Ready to Go (same window as the Yard board). */
    readyToGo?: number;
  };
  attention: AdminWorkOrderSummaryDto[];
  /**
   * D1 / UX-5-002 (stage 3): every open Work Order and every Truck still Ready to Go, each with its
   * Next step (same rule as everywhere). The Dashboard groups them by the action the Manager takes.
   * Additive: `attention` stays for older clients.
   */
  queue?: AdminWorkOrderSummaryDto[];
  /** LTR-126: mechanic work requests the Manager has not handled yet (newest first). */
  openWorkRequests?: AdminOpenWorkRequestDto[];
  /** D46 / SQ-3: Safety findings the Manager has not added or set aside yet. */
  openQcFindings?: AdminOpenQcFindingDto[];
}

/** D46 / SQ-3: something Safety found at the Quality Check (never who found it). */
export interface AdminQcFindingDto {
  id: string;
  workOrderId: string;
  /** `blocking` = the truck was returned for it; `note` = left when approving. */
  kind: 'blocking' | 'note';
  text: string;
  catalogJob: { id: string; displayName: string; categoryId: string; categoryName: string } | null;
  createdAt: string;
  resolution: 'job_added' | 'added_to_job' | 'dismissed' | null;
  resolvedJob: { id: string; displayName: string } | null;
  dismissReason: string | null;
  resolvedAt: string | null;
}

/** D46 / SQ-3: Safety findings still waiting for the Manager, on the Dashboard. */
export interface AdminOpenQcFindingDto {
  id: string;
  kind: 'blocking' | 'note';
  text: string;
  createdAt: string;
  workOrderId: string;
  workOrderDisplayId: string;
  truckId: string;
  truckNumber: string;
}

export interface AdminOpenWorkRequestDto {
  id: string;
  body: string;
  author: { id: string; name: string };
  createdAt: string;
  workOrderId: string;
  workOrderDisplayId: string;
  truckNumber: string;
  /** Stage 8: the Dashboard row links to the Truck. */
  truckId?: string;
}

export interface YardPresenceDto {
  state: YardPresenceState;
  /** D49: `samsara_geofence` once the truck has a Samsara GPS point; `phase_1_unavailable` while it has none. */
  provenance: 'phase_1_unavailable' | 'samsara_geofence';
  /** D49: when it entered the shop geofence (only `IN_YARD`). */
  since?: string | null;
  /** D49: time of the GPS point the answer comes from. */
  at?: string | null;
}

export interface ReadinessRequirementDto {
  id: string;
  type: ReadinessRequirementType;
  outcome: ReadinessRequirementOutcome;
  waiverReason: string | null;
  evidenceWorkOrderId: string | null;
  evaluatedById: string | null;
  evaluatedAt: string | null;
  version: number;
}

export interface ReadinessAssessmentDto {
  id: string;
  truckId: string;
  status: ReadinessAssessmentStatus;
  version: number;
  startedAt: string;
  startedById: string;
  readyAt: string | null;
  approvedById: string | null;
  closedAt: string | null;
  closedById: string | null;
  closedReason: string | null;
  requirements: ReadinessRequirementDto[];
}

export interface ReadinessBlockerDto {
  kind: 'open_work_order' | 'required_requirement' | 'unevaluated_requirement' | 'approval_conflict';
  requirementType?: ReadinessRequirementType;
  workOrderId?: string;
  status?: WorkOrderStatus;
  priority?: Priority;
  categoryName?: string;
  pauseReason?: PauseReason | null;
  message?: string;
}

export interface YardOperationsTruckDto {
  truck: TruckDto;
  presence: YardPresenceDto;
  operationalStatus: TruckOperationalStatus;
  operationalStatusAt: string | null;
  assessment: ReadinessAssessmentDto | null;
  /**
   * `WorkPlanPhase` (LTR-150: the only board). `ReadinessPhase` stays in the
   * type for historical Phase 1 values. Overlapping string values are intentional.
   */
  phase: YardBoardPhase | ReadinessPhase | WorkPlanPhase;
  blockers: ReadinessBlockerDto[];
  activeWorkOrder: AdminWorkOrderSummaryDto | null;
  /** LTR-101: Work Plan board only — why the Truck is not Ready to Go yet (`WorkPlanNotReadyReason`). */
  readyReason?: string;
  /** Work Plan board only — Shop Work Jobs still to do (excludes PM, Alignment, Detailing, QC). */
  shopWorkRemainingCount?: number;
  /** LTR-159: the one Next step rule (same as Truck Detail, Dashboard and Work Order). */
  nextStep?: TruckNextStepDto | null;
  /** LTR-188 / D24: a pending Job of the truck's Work Order sent the whole truck to an external shop. */
  outOfShop?: boolean;
  /** Stage 8: the Job that sent it out ("Out of shop · Radiator Repair"). */
  outOfShopJobName?: string | null;
}

export interface YardOperationsCountsDto {
  /** LTR-100: Work Plan board only — trucks still in Inspection (counters add up to the board). */
  notStarted?: number;
  underReview: number;
  readyToGo: number;
  blocked: number;
  presenceUnknown: number;
  /** Stage 6 (D6): trucks matching every filter of the request (the buckets above count only these). */
  matching?: number;
  /** Stage 6: trucks on the board with no filter. */
  total?: number;
  /** Stage 6: the quick filters' counts — every filter applied except the quick ones (blocked, priority, out of shop). */
  quick?: { all: number; blocked: number; highPriority: number; outOfShop: number; leavingSoon?: number };
  /** Stage 8: Trucks per board step, every filter applied (the lane counts, over every page). */
  byPhase?: Record<string, number>;
}

export interface YardOperationsPageDto extends AdminPage<YardOperationsTruckDto> {
  counts: YardOperationsCountsDto;
  workLocation: YardFeedDto;
  incomingTrucks: YardFeedDto;
  upcomingDepartures: YardFeedDto;
  /** @deprecated LTR-150: always true (Work Plan board is the only mode); kept for web/API deploy skew. */
  workPlanBoardCutover?: boolean;
  /** @deprecated LTR-150: always true (PM column and QC always shown); kept for web/API deploy skew. */
  pmPhaseEnabled?: boolean;
}

export interface AdminTruckSummaryDto {
  truck: TruckDto;
  operationalStatus: TruckOperationalStatus;
  operationalStatusAt: string | null;
  openWorkOrder: {
    id: string;
    displayId: string;
    status: WorkOrderStatus;
    primaryCategoryName: string;
  } | null;
  /** LTR-159: the one Next step rule, as on Truck Detail. */
  nextStep?: TruckNextStepDto | null;
  /** D35 / S-3: active Samsara faults (count and the worst). */
  faults?: TruckFaultSummaryDto;
  /** D44: the sync proposes this Samsara vehicle (exact VIN); the Manager connects it. */
  samsaraProposedVehicleId?: string | null;
}

export interface AdminTruckDetailDto extends YardOperationsTruckDto {
  repairHistory: Pick<AdminRepairHistoryDto, 'items' | 'nextCursor'>;
  repairHistoryUrl: string;
  incomingTrucks: YardOperationsUnavailableDto;
  upcomingDepartures: YardOperationsUnavailableDto;
  /** Truck Work Plan (LTR-34): Inspection, jobs of the open Work Order and derived Ready. */
  workPlan: TruckWorkPlanDto;
  /** LTR-158 / D14: the one thing the Manager should do next on this Truck. */
  nextStep?: TruckNextStepDto | null;
  /** D44: what the Manager and the System Admin can do with the truck's card. */
  admin?: AdminTruckAdminDto;
}

/** D44: delete only a truck created by mistake (no history at all); Samsara connection and the sync's proposal. */
export interface AdminTruckAdminDto {
  canDelete: boolean;
  samsara: {
    /** Connected iff set: the Manager's decision (or the old Ninox Samsara id), kept by the sync. */
    connectedVehicleId: string | null;
    connectedVehicleName: string | null;
    /** The sync saw a vehicle with this exact VIN; it is only proposed, the Manager connects it. */
    proposedVehicleId: string | null;
  };
}

/** D44: the `TRUCK_HAS_OPEN_WORK_ORDER` body — the Work Order to close before deactivating. */
export interface AdminTruckOpenWorkOrderConflictDto {
  code: 'TRUCK_HAS_OPEN_WORK_ORDER';
  message: string;
  workOrder: { id: string; displayId: string };
}

export interface WorkPlanJobDto {
  id: string;
  catalogJobId: string | null;
  displayName: string;
  customDescription: string | null;
  category: JobCategoryReferenceDto;
  status: JobStatus;
  uiStatus: WorkPlanJobUiStatus;
  lane: WorkPlanJobLane;
  /** LTR-154 / D11: the Job's owner on the Truck Work Plan (null = unassigned). */
  assignedMechanic?: { id: string; name: string } | null;
  /** LTR-188 / D23: the Job this one helps (a helper Job). */
  helperOfJobId?: string | null;
  /** LTR-188 / D24: set while the Job is at an external shop (uiStatus `external`). */
  external?: JobExternalDto | null;
  /** LTR-197 / D28: set while the Job waits, with no owner, in this step's team queue. */
  teamQueueStepKey?: string | null;
  /** Stage 8: when the Job was completed ("Done 3:53 PM"). */
  completedAt?: string | null;
}

export interface WorkPlanMandatoryPhaseDto {
  required: boolean;
  status: WorkPlanMandatoryStatus;
  jobCount: number;
  remainingCount: number;
}

export interface WorkPlanCapabilitiesDto {
  canRead: boolean;
  canAddWork: boolean;
  canRecordInspection: boolean;
}

export interface TruckWorkPlanDto {
  /** @deprecated LTR-150: always true; kept for web/API deploy skew. */
  sliceEnabled: boolean;
  /** Stage 8: `recordedAt` is when the inspection result was recorded (null while pending). */
  inspection: { outcome: WorkPlanInspectionOutcome; recordedAt?: string | null };
  workOrder: {
    id: string;
    displayId: string;
    status: WorkOrderStatus;
    version: number;
    primaryCategoryName: string;
    /** Stage 8: for the Work Order chip and the Close step. */
    priority?: Priority;
    completedAt?: string | null;
  } | null;
  jobs: WorkPlanJobDto[];
  remainingJobCount: number;
  readiness: WorkPlanReadiness;
  readyReason: WorkPlanNotReadyReason;
  phase: WorkPlanPhase;
  mandatory: {
    /** LTR-144: PM is a mandatory step of every truck Work Order. */
    pm: WorkPlanMandatoryPhaseDto;
    alignment: WorkPlanMandatoryPhaseDto;
    detailing: WorkPlanMandatoryPhaseDto;
    qualityCheck: WorkPlanMandatoryPhaseDto;
  };
  /** @deprecated LTR-150: always true (PM phase, QC always required); kept for web/API deploy skew. */
  pmPhaseEnabled?: boolean;
  capabilities: WorkPlanCapabilitiesDto;
  phase1: {
    assessmentId: string | null;
    gatesRemainDefault: true;
  };
  /** D46 / SQ-3: what Safety found on this Work Order and the Manager has not handled yet. */
  qcFindings?: AdminQcFindingDto[];
}

export interface YardOperationsUnavailableDto {
  status: 'unavailable';
  reason: 'integration_not_connected';
}

export type YardFeedSource = 'open_work_order' | 'reported_yard' | 'expected_return' | 'planned_out';

export interface YardFeedItemDto {
  truckNumber: string;
  truckId: string | null;
  detail: string | null;
  scheduledOn: string | null;
  source: YardFeedSource;
}

export interface YardFeedDto {
  status: 'ok' | 'unavailable';
  reason?: 'integration_not_connected' | 'upstream_error';
  items: YardFeedItemDto[];
  total: number;
}

/** Phase 1 card source status from `GET /api/admin/yard/data-boundary`. */
export type YardDataBoundaryStatus = 'ok' | 'unavailable' | 'error';

/**
 * Calendar bucket for Incoming Trucks / Upcoming Departures.
 * Weeks are Monday–Sunday in `America/New_York`.
 */
export type YardMovementWindow = 'this_week' | 'next_week' | 'undated';

export interface YardDataBoundaryWindowsDto {
  timeZone: 'America/New_York';
  thisWeek: { from: string; to: string };
  nextWeek: { from: string; to: string };
}

export interface YardWorkLocationItemDto {
  truckNumber: string;
  location: string | null;
}

/** D50: a truck Dispatch names that the Shop app does not have; `samsaraVehicleId` is Dispatch's own link, when it sends one. */
export interface YardDispatchMissingTruckDto {
  truckNumber: string;
  samsaraVehicleId: string | null;
}

/** D50: one chip of "Where trucks are · Samsara". `dispatch` is what Dispatch typed, only when it disagrees with Samsara. */
export interface YardSamsaraTruckDto {
  truckNumber: string;
  truckId: string;
  inYardSince: string | null;
  openWorkOrder: { id: string; displayId: string } | null;
  dispatch: string | null;
}

/** D50: where our trucks are by Samsara (D49), read from our trucks, not from Dispatch. */
export interface YardSamsaraPlacesDto {
  inShop: YardSamsaraTruckDto[];
  inYard: YardSamsaraTruckDto[];
  /** Trucks with a Samsara point outside our yard, and trucks with none. */
  outside: number;
  noGps: number;
  /** Trucks where Dispatch's typed location ("301 Yard", "Outside", a vendor) says the opposite of Samsara. */
  dispatchDisagrees: Array<{ truckNumber: string; truckId: string; dispatch: string; samsara: 'in_yard' | 'outside' }>;
}

export interface YardIncomingTruckItemDto {
  truckNumber: string;
  returnDate: string | null;
  drivers?: string[];
  window?: YardMovementWindow;
}

export interface YardUpcomingDepartureItemDto {
  truckNumber: string;
  outDate: string | null;
  drivers?: string[];
  window?: YardMovementWindow;
}

export interface YardDataBoundarySectionDto<T> {
  status: YardDataBoundaryStatus;
  items: T[];
  /**
   * Set only for `unavailable` and `error`. Nest sends the English PD string
   * `YARD_DATA_BOUNDARY_COPY.en.unavailable` ("Data unavailable.").
   * FE localizes labels, empty states, and the UNAVAILABLE badge from
   * `YARD_DATA_BOUNDARY_COPY`. Do not send empty-state copy when `status` is
   * `ok` and `items` is empty.
   */
  message?: string;
}

export interface YardWorkLocationSectionDto extends YardDataBoundarySectionDto<YardWorkLocationItemDto> {
  /**
   * Set when one non-empty `yard_location` accounts for strictly more than
   * half of `items` (the compact Admin-card headline).
   */
  summary?: string;
}

/**
 * Server-side agent-reporting proxy for Admin Yard Phase 1 cards.
 * D50: the place of each truck comes from Samsara (D49), sent next to Dispatch's lists.
 *
 * Card copy (PD 2026-09-21) lives in `YARD_DATA_BOUNDARY_COPY`:
 * labels, empty (`ok` + 0 rows), unavailable/error, and the UNAVAILABLE badge.
 * Canonical English in ES UI: Work Order, Jobs, Incoming Trucks.
 */
export interface YardDataBoundaryDto {
  asOf: string;
  windows: YardDataBoundaryWindowsDto;
  workLocation: YardWorkLocationSectionDto;
  incomingTrucks: YardDataBoundarySectionDto<YardIncomingTruckItemDto>;
  upcomingDepartures: YardDataBoundarySectionDto<YardUpcomingDepartureItemDto>;
  /**
   * Stage 6 (D8, UX-5-004): the shop's side of each Truck Dispatch names — so the Dispatch tab links
   * to the Truck and says when Dispatch and the shop disagree. Only Trucks the shop knows.
   */
  shop?: YardDispatchShopTruckDto[];
  /** D50: Trucks Dispatch names that the Shop app does not have (Add from Samsara). */
  missing?: YardDispatchMissingTruckDto[];
  /** D50: "Where trucks are · Samsara" (replaces Dispatch status on screen). */
  samsaraPlaces?: YardSamsaraPlacesDto;
}

export interface YardDispatchShopTruckDto {
  truckNumber: string;
  truckId: string;
  openWorkOrder: { id: string; displayId: string } | null;
  /** LTR-188 / D24: a pending Job sent the whole truck to an external shop. */
  outOfShop: boolean;
  /** Stage 8: where the Truck is in the shop (Work Plan step) and how many Jobs are left. */
  phase?: string | null;
  readyToGo?: boolean;
  jobsLeft?: number;
  /** D50: the truck's Samsara reading, for the D49 place (In shop / In yard / city / no GPS). */
  samsara?: TruckSamsaraDto | null;
}

export interface PmPartDto {
  id: string;
  partNumber: string | null;
  displayName: string;
}

export interface PmPartCategoryDto {
  id: string;
  slug: string;
  name: string;
  parts: PmPartDto[];
  /**
   * Stage PM-1 (D-PM1): the part used most on finished PMs of trucks with this make and model, how many of
   * those PMs used it, and how many there are. Null without history.
   */
  mostUsedPartId?: string | null;
  mostUsedCount?: number;
  pmCountForModel?: number;
}

export interface PmServiceDto {
  workOrderId: string;
  canEdit: boolean;
  currentTruckMileage: number | null;
  observedMileage: number | null;
  /** D35 / S4-1: Samsara's last odometer reading, a reference only (the field is never filled from it). */
  samsaraOdometer?: { miles: number; at: string | null; source: 'obd' | 'gps' | null } | null;
  /** LTR-137: set when this PM Work Order is completed (read-only history view). */
  serviceCompletedAt?: string | null;
  lastCompletedPm: {
    workOrderId: string;
    displayId: string;
    completedAt: string;
    observedMileage: number | null;
  } | null;
  categories: PmPartCategoryDto[];
  selections: { partCategoryId: string; partId: string }[];
}

export interface AdminCatalogCategorySummaryDto {
  id: string;
  name: string;
  status: CatalogStatus;
  sortOrder: number;
  activeJobCount: number;
  inactiveJobCount: number;
  aliasCount: number;
  /** LTR-198 / D30: PM, Detailing or Quality Check — locked (no rename, deactivate or delete). */
  systemKey?: string | null;
  /** D-SET9: why it is inactive. */
  inactiveReason?: string | null;
  /** True when it holds a System Job, so it cannot be deactivated or deleted (e.g. Suspension & Steering). */
  holdsSystemJob?: boolean;
}

export interface AdminCatalogJobDto {
  id: string;
  displayName: string;
  status: CatalogStatus;
  aliases: string[];
  /** LTR-198 / D30: pm_a, pm_b, alignment, detailing, quality_check — cannot be deactivated or deleted. */
  systemKey?: string | null;
  /** Aliases with their ids, to remove one. The alias equal to the Job's name cannot be removed. */
  aliasItems?: Array<{ id: string; text: string }>;
  /** Work Order Jobs made from it (any status). Zero means it can be deleted. */
  workOrderCount?: number;
  /** The Shop workflow step it is the Job of, if any. */
  usedByStep?: string | null;
}

/** LTR-198 / JC2: one hit of the catalog search (Jobs and aliases, accents and capitals ignored). */
export interface AdminCatalogSearchHitDto {
  jobId: string;
  displayName: string;
  status: CatalogStatus;
  categoryId: string;
  categoryName: string;
  categoryStatus: CatalogStatus;
  /** The alias that matched, when it was not the name. */
  matchedAlias: string | null;
}

/** LTR-77 write response. Same job id after rename or activate. */
export interface AdminCatalogJobWriteDto extends AdminCatalogJobDto {
  categoryId: string;
}

export interface AdminCatalogCategoryDetailDto extends AdminCatalogCategorySummaryDto {
  jobs: AdminCatalogJobDto[];
}

/** LTR-157 / D16: one row of Admin → Setup → Shop workflow. */
/** LTR-197 / D28: a Job waiting in the mechanic's team queue (GET /team-queue). */
export interface TeamQueueItemDto {
  jobId: string;
  displayName: string;
  stepKey: string;
  /** How many people share this queue. */
  teamSize: number;
  addedAt: string;
  workOrderId: string;
  workOrderDisplayId: string;
  priority: Priority;
  truck: { truckNumber: string; make: string | null; model: string | null; year: number | null };
}

/** LTR-197 / D28: one person on a step's team. */
export interface ShopWorkflowStepMemberDto {
  id: string;
  name: string;
  active: boolean;
  eligible: boolean;
  /** Jobs still to do in this person's name on open Work Orders. */
  pendingJobCount: number;
}

export interface ShopWorkflowStepDto {
  stepKey: string;
  sortOrder: number;
  active: boolean;
  /** `active` is false when the Job or its category is inactive: new Work Orders skip the step (SW2). */
  catalogJob: { id: string; displayName: string; categoryName: string; active: boolean };
  /** The only member when the team has exactly one; kept for screens from before teams (LTR-197). */
  defaultMechanic: { id: string; name: string; active: boolean; eligible: boolean } | null;
  /** LTR-197 / D28: the step's team. `eligible` is false for someone inactive or of another type (D-SET2). */
  members: ShopWorkflowStepMemberDto[];
  /** What a new Work Order gets: `direct` (the one eligible member), `queue` (team queue) or `none` (unassigned). */
  assignment: 'direct' | 'queue' | 'none';
  /** Pre-team flag: false for Quality Check (its Job always waits in Safety's queue). */
  allowsDefaultMechanic: boolean;
  /** Capability a team member needs: `mechanic.pm`, `mechanic.standard`, or `quality_check.perform` for QC. */
  requiredCapability: AppCapability | null;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}
