import {
  ActivityEventType,
  type JobStatus,
  type PauseReason,
  type Priority,
  type WorkOrderNoteKind,
  type WorkOrderStatus,
} from '@prisma/client';
import { isPmCategory, jobWorkStatus } from '@ltl-shop/shared';
import { toTruckDto } from '../trucks/trucks.service';
import { computeTotals } from './work-order.timing';

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
  assignedMechanicId?: string | null;
  assignedMechanic?: { id: string; name: string } | null;
  completedBy?: { id: string; name: string } | null;
  startedAt?: Date | null;
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
  resolvedAt?: Date | null;
  resolvedBy?: { id: string; name: string } | null;
};

export type NoteRow = {
  id: string;
  kind: WorkOrderNoteKind;
  body: string;
  createdAt: Date;
  handledAt: Date | null;
  author: { id: string; name: string };
  handledBy?: { id: string; name: string } | null;
};

type MechanicRow = {
  mechanicId: string;
  addedAt: Date;
  removedAt: Date | null;
  mechanic: { name: string };
};

type JobCompletionLog = {
  eventType: string;
  entityId: string | null;
  newValue: unknown;
  createdAt?: Date;
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
  sessions?: { id: string; startedAt: Date; endedAt: Date | null; userId?: string | null }[];
  mechanics?: MechanicRow[];
  activityLogs?: JobCompletionLog[];
  noteEntries?: NoteRow[];
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
    completedBy: j.completedBy ?? null,
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
    truckVehicle: { year: wo.truck.year, make: wo.truck.make, model: wo.truck.model },
    pmJob: pmJobSummary(wo),
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

/** LTR-146: the active PM job of a truck Work Order (never on a legacy PM Work Order). */
function pmJobSummary(wo: WorkOrderWithRelations) {
  if (isPmCategory(wo.primaryCategory.name)) return null;
  const job = wo.jobs.find((item) => item.status !== 'cancelled' && isPmCategory(item.category.name));
  if (!job) return null;
  return {
    id: job.id,
    displayName: job.displayName,
    status: job.status,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    assignedMechanic: job.assignedMechanic ?? null,
  };
}

/**
 * LTR-154: `viewerId` is the mechanic asking. Their labor, their Jobs and the
 * rest of the truck's work are split out; without it (Manager) labor is running
 * while any mechanic has a session open.
 */
export function toWorkOrderDetail(wo: WorkOrderWithRelations, viewerId?: string) {
  const summary = toWorkOrderSummary(wo);
  const currentPause = currentOfficialPause(wo.pauseEvents);
  const sessions = wo.sessions ?? [];
  const isPmWorkOrder = wo.primaryCategory.name === 'PM';
  const jobs = isPmWorkOrder ? [] : wo.jobs.map((j) => ({
    id: j.id,
    workOrderId: j.workOrderId,
    catalogJobId: j.catalogJobId,
    categoryId: j.categoryId,
    category: j.category,
    displayName: j.displayName,
    customDescription: j.customDescription,
    status: j.status,
    workStatus: jobWorkStatus(
      { status: j.status, assignedMechanicId: jobAssigneeId(j), startedAt: j.startedAt, isPm: isPmCategory(j.category.name) },
      sessions,
    ),
    completedAt: j.completedAt?.toISOString() ?? null,
    completedById: j.completedById,
    completionNotes: completionNotesForJob(wo.activityLogs, j.id),
    assignedMechanic: j.assignedMechanic ?? null,
    completedBy: j.completedBy ?? null,
    startedAt: j.startedAt?.toISOString() ?? null,
  }));
  const viewerOwnsJobs = !!viewerId && wo.jobs.some((j) => jobAssigneeId(j) === viewerId);
  const myJobs = viewerOwnsJobs ? jobs.filter((j) => j.assignedMechanic?.id === viewerId && j.status !== 'cancelled') : [];
  const laborRunning = viewerOwnsJobs
    ? sessions.some((session) => session.endedAt === null && (!session.userId || session.userId === viewerId))
    : sessions.some((session) => session.endedAt === null);
  return {
    ...summary,
    notes: wo.notes,
    createdById: wo.createdById,
    completedAt: wo.completedAt?.toISOString() ?? null,
    // LTR-94: live totals from persisted segments when they were loaded.
    ...(wo.sessions
      ? computeTotals({ sessions: wo.sessions, pauses: wo.pauseEvents ?? [] })
      : { totalActiveLaborMs: Number(wo.totalActiveLaborMs), totalWaitingMs: Number(wo.totalWaitingMs) }),
    laborRunning,
    version: wo.version,
    truck: toTruckDto(wo.truck),
    jobs,
    ...(viewerId
      ? {
          myJobs,
          otherJobs: jobs.filter((j) => j.status !== 'cancelled' && !myJobs.includes(j)),
          myPartDone: myJobs.length > 0 && myJobs.every((j) => j.status !== 'to_do'),
        }
      : {}),
    mechanics: (wo.mechanics ?? [])
      .filter((m) => !m.removedAt)
      .map((m) => ({
        mechanicId: m.mechanicId,
        mechanicName: m.mechanic.name,
        addedAt: m.addedAt.toISOString(),
        removedAt: m.removedAt?.toISOString() ?? null,
      })),
    currentPause: currentPause ? toPauseEventDto(currentPause) : null,
    activeBlockers: (wo.pauseEvents ?? [])
      .filter((pause) => pause.isOfficialPause === false && !pause.resolvedAt)
      .map(toPauseEventDto),
    noteEntries: (wo.noteEntries ?? []).map(toWorkOrderNoteDto),
  };
}

/** LTR-126 / D8: append-only note entry. */
export function toWorkOrderNoteDto(note: NoteRow) {
  return {
    id: note.id,
    kind: note.kind,
    body: note.body,
    author: note.author,
    createdAt: note.createdAt.toISOString(),
    handledAt: note.handledAt?.toISOString() ?? null,
    handledBy: note.handledBy ?? null,
  };
}

export const workOrderNoteInclude = {
  include: {
    author: { select: { id: true, name: true } },
    handledBy: { select: { id: true, name: true } },
  },
  orderBy: { createdAt: 'asc' as const },
};

function completionNotesForJob(logs: JobCompletionLog[] | undefined, jobId: string): string | null {
  const matches = (logs ?? []).filter((event) => (
    event.eventType === ActivityEventType.job_completed && event.entityId === jobId
  ));
  const entry = [...matches].sort((left, right) => (
    (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0)
  ))[0];
  const notes = (entry?.newValue as { notes?: unknown } | null)?.notes;
  return typeof notes === 'string' && notes.trim() ? notes : null;
}

function jobAssigneeId(job: JobRow): string | null {
  return job.assignedMechanicId ?? job.assignedMechanic?.id ?? null;
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
    resolvedAt: pause.resolvedAt?.toISOString() ?? null,
    resolvedBy: pause.resolvedBy ?? null,
  };
}

export const workOrderDetailInclude = {
  truck: true,
  primaryCategory: true,
  jobs: {
    include: {
      category: { select: { id: true, name: true } },
      assignedMechanic: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  sessions: {
    select: { id: true, startedAt: true, endedAt: true, userId: true },
  },
  pauseEvents: {
    include: {
      reportedBy: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: 'desc' as const },
  },
  mechanics: {
    include: { mechanic: true },
    orderBy: { addedAt: 'asc' as const },
  },
  noteEntries: workOrderNoteInclude,
  // Finish notes are stored on job_completed activity rows, not on the job.
  activityLogs: {
    where: { eventType: ActivityEventType.job_completed },
    select: {
      eventType: true,
      entityId: true,
      newValue: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
};
