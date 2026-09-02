import type {
  JobStatus,
  PauseReason,
  Priority,
  UserRole,
  WorkOrderStatus,
} from './enums';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  pmAuthorized: boolean;
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
}

export interface JobCategoryDto {
  id: string;
  name: string;
  sortOrder: number;
}

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
  displayName: string;
  customDescription: string | null;
  status: JobStatus;
  completedAt: string | null;
  completedById: string | null;
}

export interface PauseEventDto {
  id: string;
  workOrderId: string;
  reason: PauseReason;
  notes: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
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
  jobs: Pick<WorkOrderJobDto, 'id' | 'displayName' | 'status'>[];
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
  jobs: string[];
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
