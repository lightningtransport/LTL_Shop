import type { WorkOrderAttentionReason } from './attention';
import type { JobWorkStatus } from './job-work-status';
import type { TruckNextStepDto } from './truck-next-step';
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
  /** Last reported human address from `trucks.samsara_truck_location`. Not Yard Presence. */
  location: string | null;
  /** ISO date (`YYYY-MM-DD`) from `trucks.samsara_last_connected_date`. */
  locationUpdatedOn: string | null;
  /** LTR-140: the Truck's open Work Order, sent by `GET /trucks` so search results can mark it. */
  openWorkOrder?: TruckOpenWorkOrderRefDto | null;
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
  } | null;
  primaryCategoryId: string;
  primaryCategoryName: string;
  status: WorkOrderStatus;
  priority: Priority;
  jobsCompleted: number;
  jobsTotal: number;
  jobs: Pick<WorkOrderJobDto, 'id' | 'categoryId' | 'category' | 'displayName' | 'status' | 'assignedMechanic' | 'completedBy' | 'workStatus' | 'activeBlocker' | 'helperOfJobId' | 'external'>[];
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
  elsewhereWorkOrder?: { id: string; displayId: string; truckNumber: string } | null;
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

export interface WorkOrderDetailDto extends WorkOrderSummaryDto {
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
  /** LTR-164 (#6): the viewer already had a labor session here (the button reads Continue, not Start Work). */
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
}

export interface AdminMechanicDetailDto extends AdminMechanicSummaryDto {
  completedJobCount: number;
  recentClosedWorkOrders: AdminMechanicAssignmentDto[];
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
  /** LTR-146: when the PM job was started. */
  startedAt?: string | null;
  /** LTR-188 / D23: the Job this one helps (a helper Job); the web appends "· helper". */
  helperOfJobId?: string | null;
  /** LTR-188 / D24: set while the Job is at an external shop. */
  external?: JobExternalDto | null;
}

export interface AdminWorkOrderDetailDto extends AdminWorkOrderSummaryDto {
  truck: TruckDto;
  version: number;
  notes: string | null;
  createdBy: { id: string; name: string };
  completedBy: { id: string; name: string } | null;
  totalActiveLaborMs: number;
  totalWaitingMs: number;
  jobs: AdminWorkOrderJobDto[];
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
  /** LTR-126: mechanic work requests the Manager has not handled yet (newest first). */
  openWorkRequests?: AdminOpenWorkRequestDto[];
}

export interface AdminOpenWorkRequestDto {
  id: string;
  body: string;
  author: { id: string; name: string };
  createdAt: string;
  workOrderId: string;
  workOrderDisplayId: string;
  truckNumber: string;
}

export interface YardPresenceDto {
  state: YardPresenceState;
  provenance: 'phase_1_unavailable';
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
}

export interface YardOperationsCountsDto {
  /** LTR-100: Work Plan board only — trucks still in Inspection (counters add up to the board). */
  notStarted?: number;
  underReview: number;
  readyToGo: number;
  blocked: number;
  presenceUnknown: number;
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
  inspection: { outcome: WorkPlanInspectionOutcome };
  workOrder: {
    id: string;
    displayId: string;
    status: WorkOrderStatus;
    version: number;
    primaryCategoryName: string;
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
 * Presence / geofence is intentionally absent.
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
}

export interface PmServiceDto {
  workOrderId: string;
  canEdit: boolean;
  currentTruckMileage: number | null;
  observedMileage: number | null;
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
}

export interface AdminCatalogJobDto {
  id: string;
  displayName: string;
  status: CatalogStatus;
  aliases: string[];
}

/** LTR-77 write response. Same job id after rename or activate. */
export interface AdminCatalogJobWriteDto extends AdminCatalogJobDto {
  categoryId: string;
}

export interface AdminCatalogCategoryDetailDto extends AdminCatalogCategorySummaryDto {
  jobs: AdminCatalogJobDto[];
}

/** LTR-157 / D16: one row of Admin → Setup → Shop workflow. */
export interface ShopWorkflowStepDto {
  stepKey: string;
  sortOrder: number;
  active: boolean;
  catalogJob: { id: string; displayName: string; categoryName: string };
  defaultMechanic: { id: string; name: string; active: boolean } | null;
  /** D15: Quality Check has no default owner; the Manager completes it from the Truck. */
  allowsDefaultMechanic: boolean;
  /** Capability a default owner needs: `mechanic.pm` for PM, `mechanic.standard` otherwise. */
  requiredCapability: AppCapability | null;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}
