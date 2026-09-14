import type {
  AppCapability,
  ActivityEventType,
  JobStatus,
  PauseReason,
  Priority,
  ReadinessAssessmentStatus,
  ReadinessPhase,
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
  // Null means the Job inherits the Work Order general mechanic team.
  assignedMechanic: { id: string; name: string } | null;
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
  primaryCategoryId: string;
  primaryCategoryName: string;
  status: WorkOrderStatus;
  priority: Priority;
  jobsCompleted: number;
  jobsTotal: number;
  jobs: Pick<WorkOrderJobDto, 'id' | 'categoryId' | 'category' | 'displayName' | 'status' | 'assignedMechanic'>[];
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
  jobs: WorkOrderJobDto[];
  mechanics: MechanicAssignmentDto[];
  currentPause: PauseEventDto | null;
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
  phase: ReadinessPhase;
  blockers: ReadinessBlockerDto[];
  activeWorkOrder: AdminWorkOrderSummaryDto | null;
}

export interface YardOperationsCountsDto {
  underReview: number;
  readyToGo: number;
  blocked: number;
  presenceUnknown: number;
}

export interface YardOperationsPageDto extends AdminPage<YardOperationsTruckDto> {
  counts: YardOperationsCountsDto;
  incomingTrucks: YardOperationsUnavailableDto;
  upcomingDepartures: YardOperationsUnavailableDto;
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
    alignment: WorkPlanMandatoryPhaseDto;
    detailing: WorkPlanMandatoryPhaseDto;
    qualityCheck: WorkPlanMandatoryPhaseDto;
  };
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

export interface AdminCatalogCategoryDetailDto extends AdminCatalogCategorySummaryDto {
  jobs: AdminCatalogJobDto[];
}
