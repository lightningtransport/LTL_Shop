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
  displayName: string;
  customDescription: string | null;
  status: JobStatus;
  completedAt: Date | null;
  completedById: string | null;
};

type PauseRow = {
  id: string;
  workOrderId: string;
  reason: PauseReason;
  notes: string | null;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: bigint | null;
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
  const activeJobs = wo.jobs.filter((j) => j.status !== 'cancelled');
  const jobsCompleted = activeJobs.filter((j) => j.status === 'completed').length;
  const jobsTotal = activeJobs.length;
  const jobs = activeJobs.map((j) => ({
    id: j.id,
    displayName: j.displayName,
    status: j.status,
  }));
  const currentPause = wo.pauseEvents?.find((p) => !p.endedAt) ?? null;
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
    currentPauseReason: currentPause?.reason ?? null,
    createdAt: wo.createdAt.toISOString(),
    startedAt: wo.startedAt?.toISOString() ?? null,
  };
}

export function toWorkOrderDetail(wo: WorkOrderWithRelations) {
  const summary = toWorkOrderSummary(wo);
  const currentPause = wo.pauseEvents?.find((p) => !p.endedAt) ?? null;
  return {
    ...summary,
    notes: wo.notes,
    createdById: wo.createdById,
    completedAt: wo.completedAt?.toISOString() ?? null,
    totalActiveLaborMs: Number(wo.totalActiveLaborMs),
    totalWaitingMs: Number(wo.totalWaitingMs),
    version: wo.version,
    truck: toTruckDto(wo.truck),
    jobs: wo.jobs.map((j) => ({
      id: j.id,
      workOrderId: j.workOrderId,
      catalogJobId: j.catalogJobId,
      categoryId: j.categoryId,
      displayName: j.displayName,
      customDescription: j.customDescription,
      status: j.status,
      completedAt: j.completedAt?.toISOString() ?? null,
      completedById: j.completedById,
    })),
    mechanics: (wo.mechanics ?? [])
      .filter((m) => !m.removedAt)
      .map((m) => ({
        mechanicId: m.mechanicId,
        mechanicName: m.mechanic.name,
        addedAt: m.addedAt.toISOString(),
        removedAt: m.removedAt?.toISOString() ?? null,
      })),
    currentPause: currentPause
      ? {
          id: currentPause.id,
          workOrderId: currentPause.workOrderId,
          reason: currentPause.reason,
          notes: currentPause.notes,
          startedAt: currentPause.startedAt.toISOString(),
          endedAt: currentPause.endedAt?.toISOString() ?? null,
          durationMs: currentPause.durationMs
            ? Number(currentPause.durationMs)
            : null,
        }
      : null,
  };
}

export const workOrderDetailInclude = {
  truck: true,
  primaryCategory: true,
  jobs: { orderBy: { addedAt: 'asc' as const } },
  pauseEvents: { orderBy: { startedAt: 'desc' as const } },
  mechanics: {
    include: { mechanic: true },
    orderBy: { addedAt: 'asc' as const },
  },
};
