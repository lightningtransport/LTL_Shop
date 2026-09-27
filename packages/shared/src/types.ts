import type { WorkOrderAttentionReason } from './attention';
import type {
  AppCapability,
  ActivityEventType,
  JobStatus,
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
  pmAuthorized: boolean;
  capabilities: AppCapability[];
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
  // Null means the Job inherits the Work Order general mechanic team.
  assignedMechanic: { id: string; name: string } | null;
  /** LTR-127: who completed the Job (additive; absent on older API responses). */
  completedBy?: { id: string; name: string } | null;
  /** LTR-146: when the PM job was started. */
  startedAt?: string | null;
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
  /** LTR-146: the PM job of a truck Work Order (`WORK_PLAN_PM_PHASE`). */
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
  jobs: Pick<WorkOrderJobDto, 'id' | 'categoryId' | 'category' | 'displayName' | 'status' | 'assignedMechanic' | 'completedBy'>[];
  mechanics: Pick<MechanicAssignmentDto, 'mechanicId' | 'mechanicName'>[];
  currentPauseReason: PauseReason | null;
  createdAt: string;
  startedAt: string | null;
}

export interface WorkOrderDetailDto extends WorkOrderSummaryDto {
  notes: string | null;
  createdById: string;
  completedAt: string | null;
  totalActiveLaborMs: number;
  totalWaitingMs: number;
  /** True while a labor session is open (LTR-124: closes when no Job is pending). */
  laborRunning: boolean;
  jobs: WorkOrderJobDto[];
  mechanics: MechanicAssignmentDto[];
  currentPause: PauseEventDto | null;
  /** LTR-128: unresolved mechanic-reported blockers (newest first). */
  activeBlockers?: PauseEventDto[];
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
  /** LTR-119 / D6: the Truck Work Plan is where Jobs are added (Slice 1 on). */
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
   * Phase 1: `ReadinessPhase`. Slice 2 board cutover: `WorkPlanPhase`
   * (includes `shop_work`). Overlapping string values are intentional.
   */
  phase: YardBoardPhase | ReadinessPhase | WorkPlanPhase;
  blockers: ReadinessBlockerDto[];
  activeWorkOrder: AdminWorkOrderSummaryDto | null;
  /** LTR-101: Work Plan board only — why the Truck is not Ready to Go yet (`WorkPlanNotReadyReason`). */
  readyReason?: string;
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
  /**
   * Slice 2 board cutover (`YARD_WORK_PLAN_SLICE2`). When true, board columns
   * follow Work Plan phases (incl. `shop_work`) instead of Phase 1 gates.
   */
  workPlanBoardCutover?: boolean;
  /** LTR-144: `WORK_PLAN_PM_PHASE` is on (board shows the PM column and QC always). */
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
}

export interface AdminTruckDetailDto extends YardOperationsTruckDto {
  repairHistory: Pick<AdminRepairHistoryDto, 'items' | 'nextCursor'>;
  repairHistoryUrl: string;
  incomingTrucks: YardOperationsUnavailableDto;
  upcomingDepartures: YardOperationsUnavailableDto;
  /**
   * Additive Slice 1 Work Plan. Present only when `YARD_WORK_PLAN_SLICE1` is
   * enabled. Phase 1 `assessment` / `phase` / `blockers` remain canonical.
   */
  workPlan?: TruckWorkPlanDto;
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
    /** LTR-144: present only when `WORK_PLAN_PM_PHASE` is on. */
    pm?: WorkPlanMandatoryPhaseDto;
    alignment: WorkPlanMandatoryPhaseDto;
    detailing: WorkPlanMandatoryPhaseDto;
    qualityCheck: WorkPlanMandatoryPhaseDto;
  };
  /** LTR-144: `WORK_PLAN_PM_PHASE` is on (PM phase, QC always required). */
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
