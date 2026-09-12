import type {
  JobStatus,
  PauseReason,
  Priority,
  WorkOrderStatus,
} from '@prisma/client';
import { toTruckDto } from '../trucks/trucks.service';

type JobRow = {
  id: string;
  workOrderId: string;
  catalogJobId: string | null;
  categoryId: string;
  category: { id: string; name: string };
  displayName: string;
  customDescription: string | null;
  status: JobStatus;
  completedAt: Date | null;
  completedById: string | null;
  assignedMechanic?: { id: string; name: string } | null;
};

type PauseRow = {
  id: string;
  workOrderId: string;
  reason: PauseReason;
  notes: string | null;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: bigint | null;
  isOfficialPause?: boolean;
  reportedBy?: { id: string; name: string } | null;
};

type MechanicRow = {
  mechanicId: string;
  addedAt: Date;
  removedAt: Date | null;
  mechanic: { name: string };
};

export type WorkOrderWithRelations = {
  id: string;
  displayId: string;
  truckId: string;
  primaryCategoryId: string;
  status: WorkOrderStatus;
  priority: Priority;
  notes: string | null;
  createdAt: Date;
  createdById: string;
  startedAt: Date | null;
  completedAt: Date | null;
  completedById: string | null;
  totalActiveLaborMs: bigint;
  totalWaitingMs: bigint;
  version: number;
  truck: {
    id: string;
    truckNumber: string;
    make: string | null;
    model: string | null;
    year: number | null;
    mileage: number | null;
    company: string | null;
    owner: string | null;
  };
  primaryCategory: { id: string; name: string };
  jobs: JobRow[];
  pauseEvents?: PauseRow[];
  mechanics?: MechanicRow[];
};

export function toWorkOrderSummary(wo: WorkOrderWithRelations) {
  const isPm = wo.primaryCategory.name === 'PM';
  // PM is a single service. Legacy jobs remain in the database for audit but
  // are never presented as a checklist or progress metric.
  const activeJobs = isPm ? [] : wo.jobs.filter((j) => j.status !== 'cancelled');
  const jobsCompleted = activeJobs.filter((j) => j.status === 'completed').length;
  const jobsTotal = activeJobs.length;
  const jobs = activeJobs.map((j) => ({
    id: j.id,
    categoryId: j.categoryId,
    category: j.category,
    displayName: j.displayName,
    status: j.status,
    assignedMechanic: j.assignedMechanic ?? null,
  }));
  const currentPause = currentOfficialPause(wo.pauseEvents);
  const mechanics = (wo.mechanics ?? [])
    .filter((m) => !m.removedAt)
    .map((m) => ({
      mechanicId: m.mechanicId,
      mechanicName: m.mechanic.name,
    }));
  return {
    id: wo.id,
    displayId: wo.displayId,
    truckId: wo.truckId,
    truckNumber: wo.truck.truckNumber,
    primaryCategoryId: wo.primaryCategoryId,
    primaryCategoryName: wo.primaryCategory.name,
    status: wo.status,
    priority: wo.priority,
    jobsCompleted,
    jobsTotal,
    jobs,
    mechanics,
    currentPauseReason: currentPause?.reason ?? null,
    createdAt: wo.createdAt.toISOString(),
    startedAt: wo.startedAt?.toISOString() ?? null,
  };
}

export function toWorkOrderDetail(wo: WorkOrderWithRelations) {
  const summary = toWorkOrderSummary(wo);
  const currentPause = currentOfficialPause(wo.pauseEvents);
  return {
    ...summary,
    notes: wo.notes,
    createdById: wo.createdById,
    completedAt: wo.completedAt?.toISOString() ?? null,
    totalActiveLaborMs: Number(wo.totalActiveLaborMs),
    totalWaitingMs: Number(wo.totalWaitingMs),
    version: wo.version,
    truck: toTruckDto(wo.truck),
    jobs: wo.primaryCategory.name === 'PM' ? [] : wo.jobs.map((j) => ({
      id: j.id,
      workOrderId: j.workOrderId,
      catalogJobId: j.catalogJobId,
      categoryId: j.categoryId,
      category: j.category,
      displayName: j.displayName,
      customDescription: j.customDescription,
      status: j.status,
      completedAt: j.completedAt?.toISOString() ?? null,
      completedById: j.completedById,
      assignedMechanic: j.assignedMechanic ?? null,
    })),
    mechanics: (wo.mechanics ?? [])
      .filter((m) => !m.removedAt)
      .map((m) => ({
        mechanicId: m.mechanicId,
        mechanicName: m.mechanic.name,
        addedAt: m.addedAt.toISOString(),
        removedAt: m.removedAt?.toISOString() ?? null,
      })),
    currentPause: currentPause ? toPauseEventDto(currentPause) : null,
  };
}

function currentOfficialPause(pauses?: PauseRow[]) {
  return pauses?.find((pause) => !pause.endedAt && pause.isOfficialPause !== false) ?? null;
}

export function toPauseEventDto(pause: PauseRow) {
  return {
    id: pause.id,
    workOrderId: pause.workOrderId,
    reason: pause.reason,
    notes: pause.notes,
    startedAt: pause.startedAt.toISOString(),
    endedAt: pause.endedAt?.toISOString() ?? null,
    durationMs: pause.durationMs === null || pause.durationMs === undefined
      ? null
      : Number(pause.durationMs),
    isOfficialPause: pause.isOfficialPause !== false,
    reportedBy: pause.reportedBy ?? null,
  };
}

export const workOrderDetailInclude = {
  truck: true,
  primaryCategory: true,
  jobs: {
    include: {
      category: { select: { id: true, name: true } },
      assignedMechanic: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  pauseEvents: {
    include: { reportedBy: { select: { id: true, name: true } } },
    orderBy: { startedAt: 'desc' as const },
  },
  mechanics: {
    include: { mechanic: true },
    orderBy: { addedAt: 'asc' as const },
  },
};
