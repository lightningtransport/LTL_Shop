import {
  ActivityEventType,
  type JobStatus,
  type PauseReason,
  type Priority,
  type WorkOrderNoteKind,
  type WorkOrderStatus,
} from '@prisma/client';
import { isPmCategory, jobWorkStatus, type BlockerReason, type JobExternalKind } from '@ltl-shop/shared';
import { toTruckDto } from '../trucks/trucks.service';
import { computeTotals } from './work-order.timing';
import { workOrderTeam } from './work-order-team';

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
  helperOfJobId?: string | null;
  externalSince?: Date | null;
  externalKind?: string | null;
  externalNote?: string | null;
  workflowStepKey?: string | null;
};

/** LTR-188 / D24: a Job at an external shop, as the DTOs carry it (null when in the shop). */
function jobExternal(job: JobRow) {
  if (!job.externalSince || !job.externalKind || job.status !== 'to_do') return null;
  return {
    kind: job.externalKind as JobExternalKind,
    note: job.externalNote ?? '',
    since: job.externalSince.toISOString(),
  };
}

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
  jobId?: string | null;
  job?: { id: string; displayName: string } | null;
  blockerReason?: string | null;
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
  entityType?: string;
  entityId: string | null;
  newValue: unknown;
  createdAt?: Date;
  id?: string;
  user?: { id: string; name: string } | null;
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
  sessions?: { id: string; startedAt: Date; endedAt: Date | null; userId?: string | null; endReason?: string | null }[];
  mechanics?: MechanicRow[];
  activityLogs?: JobCompletionLog[];
  noteEntries?: NoteRow[];
};

/** LTR-186 / D21: the Work Order where the viewer's clock runs now (null: nowhere). */
export type ClockElsewhere = { id: string; displayId: string; truckNumber: string } | null;
type ViewerOptions = { clockElsewhere?: ClockElsewhere };

export function toWorkOrderSummary(wo: WorkOrderWithRelations, viewerId?: string, options: ViewerOptions = {}) {
  const isPm = wo.primaryCategory.name === 'PM';
  // PM is a single service. Legacy jobs remain in the database for audit but
  // are never presented as a checklist or progress metric.
  const activeJobs = isPm ? [] : wo.jobs.filter((j) => j.status !== 'cancelled');
  const jobsCompleted = activeJobs.filter((j) => j.status === 'completed').length;
  const jobsTotal = activeJobs.length;
  const jobs = activeJobs.map((j) => {
    const activeBlocker = activeBlockerForJob(wo.pauseEvents, j.id);
    return {
      id: j.id,
      categoryId: j.categoryId,
      category: j.category,
      displayName: j.displayName,
      status: j.status,
      workStatus: jobWorkStatus(
        {
          status: j.status, assignedMechanicId: jobAssigneeId(j), startedAt: j.startedAt,
          isPm: isPmCategory(j.category.name), blocked: Boolean(activeBlocker),
        },
        wo.sessions ?? [],
      ),
      activeBlocker: activeBlocker ? toJobActiveBlocker(activeBlocker) : null,
      assignedMechanic: j.assignedMechanic ?? null,
      completedBy: j.completedBy ?? null,
      helperOfJobId: j.helperOfJobId ?? null,
    // LTR-197 / D28: a Job from a team queue can be let go back to it.
    workflowStepKey: j.workflowStepKey ?? null,
      external: jobExternal(j),
      // Stage MG-1 (UX-1-011): Completed shows when each Job was closed and its closing note.
      completedAt: j.completedAt?.toISOString() ?? null,
      completionNotes: completionNotesForJob(wo.activityLogs, j.id),
    };
  });
  const currentPause = currentOfficialPause(wo.pauseEvents);
  // LTR-164 (#11) / D11: the team includes every Job owner, the PM mechanic too.
  const mechanics = workOrderTeam(wo.mechanics ?? [], wo.jobs, wo.createdAt)
    .map((member) => ({ mechanicId: member.mechanicId, mechanicName: member.mechanicName }));
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
    // Stage PM-1: since when the Manager paused it, and the pause note.
    pausedAt: currentPause?.startedAt.toISOString() ?? null,
    pauseNote: currentPause?.notes ?? null,
    createdAt: wo.createdAt.toISOString(),
    startedAt: wo.startedAt?.toISOString() ?? null,
    ...(viewerId ? { resolvedBlockerAwaitingContinue: resolvedBlockerAwaitingContinue(wo, viewerId) } : {}),
    ...(viewerId ? { myClockStopped: myClockStopped(wo, viewerId, options.clockElsewhere) } : {}),
  };
}

/**
 * LTR-186 / D20, D21: the app stopped my clock on this Work Order — the day close, or I started on
 * another Truck — and I still have workable Jobs here, so the card and the detail say "tap Continue".
 * `clockElsewhere` is where my clock runs now; when the caller did not look it up it is left out.
 */
export function myClockStopped(wo: WorkOrderWithRelations, viewerId: string, clockElsewhere?: ClockElsewhere) {
  if (wo.status !== 'in_progress') return null;
  const sessions = wo.sessions ?? [];
  if (sessions.some((session) => session.endedAt === null && (!session.userId || session.userId === viewerId))) return null;
  const workable = wo.jobs.some((job) => (
    job.status === 'to_do' && jobAssigneeId(job) === viewerId && !activeBlockerForJob(wo.pauseEvents, job.id)
  ));
  if (!workable) return null;
  const last = sessions
    .filter((session) => session.userId === viewerId && session.endedAt)
    .sort((left, right) => right.endedAt!.getTime() - left.endedAt!.getTime())[0];
  if (last?.endReason === 'day_close') return { reason: 'day_close' as const };
  if (last?.endReason === 'switched_truck') {
    if (clockElsewhere === undefined) return { reason: 'switched_truck' as const };
    return { reason: 'switched_truck' as const, elsewhereWorkOrder: clockElsewhere && clockElsewhere.id !== wo.id ? clockElsewhere : null };
  }
  return null;
}

/**
 * LTR-158 / D18: the Manager resolved a blocker on one of my Jobs after my time
 * stopped, and I have not tapped Continue yet (the mechanic Home badge).
 */
export function resolvedBlockerAwaitingContinue(wo: WorkOrderWithRelations, viewerId: string): boolean {
  return Boolean(resolvedBlockerForViewer(wo, viewerId));
}

/** LTR-164 (#9): that resolved blocker, newest first, so the mechanic sees the Manager's note. */
function resolvedBlockerForViewer(wo: WorkOrderWithRelations, viewerId: string): PauseRow | null {
  if (wo.status !== 'in_progress') return null;
  const sessions = wo.sessions ?? [];
  if (sessions.some((session) => session.endedAt === null && (!session.userId || session.userId === viewerId))) return null;
  const myPending = wo.jobs.filter((job) => job.status === 'to_do' && jobAssigneeId(job) === viewerId);
  if (!myPending.some((job) => !activeBlockerForJob(wo.pauseEvents, job.id))) return null;
  const lastStop = sessions
    .filter((session) => session.userId === viewerId && session.endedAt)
    .reduce((latest, session) => Math.max(latest, session.endedAt!.getTime()), 0);
  const myJobIds = new Set(myPending.map((job) => job.id));
  return [...(wo.pauseEvents ?? [])]
    .filter((pause) => (
      pause.isOfficialPause === false && pause.resolvedAt && pause.jobId && myJobIds.has(pause.jobId)
      && pause.resolvedAt.getTime() >= lastStop
    ))
    .sort((left, right) => right.resolvedAt!.getTime() - left.resolvedAt!.getTime())[0] ?? null;
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
export function toWorkOrderDetail(wo: WorkOrderWithRelations, viewerId?: string, options: ViewerOptions = {}) {
  const summary = toWorkOrderSummary(wo);
  const currentPause = currentOfficialPause(wo.pauseEvents);
  const sessions = wo.sessions ?? [];
  const isPmWorkOrder = wo.primaryCategory.name === 'PM';
  const jobs = isPmWorkOrder ? [] : wo.jobs.map((j) => {
    const activeBlocker = activeBlockerForJob(wo.pauseEvents, j.id);
    return {
    id: j.id,
    workOrderId: j.workOrderId,
    catalogJobId: j.catalogJobId,
    categoryId: j.categoryId,
    category: j.category,
    displayName: j.displayName,
    customDescription: j.customDescription,
    status: j.status,
    workStatus: jobWorkStatus(
      {
        status: j.status, assignedMechanicId: jobAssigneeId(j), startedAt: j.startedAt,
        isPm: isPmCategory(j.category.name), blocked: Boolean(activeBlocker),
      },
      sessions,
    ),
    activeBlocker: activeBlocker ? toJobActiveBlocker(activeBlocker) : null,
    completedAt: j.completedAt?.toISOString() ?? null,
    completedById: j.completedById,
    completionNotes: completionNotesForJob(wo.activityLogs, j.id),
    assignedMechanic: j.assignedMechanic ?? null,
    completedBy: j.completedBy ?? null,
    startedAt: j.startedAt?.toISOString() ?? null,
    // LTR-188 / D23, D24: helper Jobs and Jobs at an external shop (read-only for mechanics).
    helperOfJobId: j.helperOfJobId ?? null,
    workflowStepKey: j.workflowStepKey ?? null,
    external: jobExternal(j),
    };
  });
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
    mechanics: workOrderTeam(wo.mechanics ?? [], wo.jobs, wo.createdAt).map((member) => ({
      mechanicId: member.mechanicId,
      mechanicName: member.mechanicName,
      addedAt: member.addedAt.toISOString(),
      removedAt: null,
    })),
    currentPause: currentPause ? toPauseEventDto(currentPause) : null,
    activeBlockers: (wo.pauseEvents ?? [])
      .filter((pause) => pause.isOfficialPause === false && !pause.resolvedAt)
      .map((pause) => toPauseEventDto(pause, wo.activityLogs)),
    ...(viewerId ? { resolvedBlocker: resolvedBlockerOrNull(wo, viewerId) } : {}),
    ...(viewerId ? { myClockStopped: myClockStopped(wo, viewerId, options.clockElsewhere) } : {}),
    // LTR-164 (#6): "Start Work" until I have worked here once, then "Continue".
    ...(viewerId ? { myLaborStarted: sessions.some((session) => !session.userId || session.userId === viewerId) } : {}),
    // Stage MG-1 (MG5): the viewer's own time here, every day of this Work Order (D-MG2). The total stays for the Manager.
    ...(viewerId ? { myActiveLaborMs: myLaborMs(sessions, viewerId) } : {}),
    noteEntries: (wo.noteEntries ?? []).map(toWorkOrderNoteDto),
  };
}

function resolvedBlockerOrNull(wo: WorkOrderWithRelations, viewerId: string) {
  const pause = resolvedBlockerForViewer(wo, viewerId);
  return pause ? toPauseEventDto(pause, wo.activityLogs) : null;
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

/**
 * LTR-164 (#8): the blocker notes and resolution notes (Activity Log rows on the
 * `pause_event`) for Work Order lists, so the Dashboard and the Truck show them.
 */
export const blockerActivityLogsInclude = {
  where: {
    entityType: 'pause_event',
    eventType: { in: [ActivityEventType.note_added, ActivityEventType.blocker_resolved] },
  },
  select: {
    id: true,
    eventType: true,
    entityType: true,
    entityId: true,
    newValue: true,
    createdAt: true,
    user: { select: { id: true, name: true } },
  },
  orderBy: { createdAt: 'desc' as const },
};

export const workOrderNoteInclude = {
  include: {
    author: { select: { id: true, name: true } },
    handledBy: { select: { id: true, name: true } },
  },
  orderBy: { createdAt: 'asc' as const },
};

function myLaborMs(sessions: NonNullable<WorkOrderWithRelations['sessions']>, viewerId: string, now = new Date()) {
  return sessions
    .filter((session) => session.userId === viewerId)
    .reduce((total, session) => total + Math.max(0, (session.endedAt ?? now).getTime() - session.startedAt.getTime()), 0);
}

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

/** LTR-155 / D17: the unresolved mechanic blocker on a Job (newest first). */
function activeBlockerForJob(pauses: PauseRow[] | undefined, jobId: string): PauseRow | null {
  return pauses?.find((pause) => pause.isOfficialPause === false && !pause.resolvedAt && pause.jobId === jobId) ?? null;
}

function toJobActiveBlocker(pause: PauseRow) {
  return {
    id: pause.id,
    reason: (pause.blockerReason ?? pause.reason) as PauseReason,
    reportedAt: pause.startedAt.toISOString(),
    reportedBy: pause.reportedBy ?? null,
  };
}

/**
 * LTR-155 / D17: blocker notes and the resolution note live in the Activity Log
 * (note_added / blocker_resolved on entity `pause_event`), so no new table.
 */
export function blockerLogDetails(pauseId: string, logs: JobCompletionLog[] | undefined) {
  const own = (logs ?? []).filter((log) => log.entityType === 'pause_event' && log.entityId === pauseId);
  const blockerNotes = own
    .filter((log) => log.eventType === ActivityEventType.note_added)
    .map((log) => ({
      id: log.id ?? `${pauseId}-${log.createdAt?.getTime() ?? 0}`,
      body: String((log.newValue as { body?: unknown } | null)?.body ?? ''),
      author: log.user ?? { id: '', name: '' },
      createdAt: log.createdAt?.toISOString() ?? '',
    }))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const resolved = own.find((log) => log.eventType === ActivityEventType.blocker_resolved);
  const note = (resolved?.newValue as { notes?: unknown } | null)?.notes;
  return { blockerNotes, resolutionNote: typeof note === 'string' && note.trim() ? note : null };
}

export function toPauseEventDto(pause: PauseRow, logs?: JobCompletionLog[]) {
  return {
    ...(pause.isOfficialPause === false ? {
      job: pause.job ?? null,
      blockerReason: (pause.blockerReason ?? null) as BlockerReason | null,
      ...blockerLogDetails(pause.id, logs),
    } : {}),
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
    select: { id: true, startedAt: true, endedAt: true, userId: true, endReason: true },
  },
  pauseEvents: {
    include: {
      reportedBy: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
      job: { select: { id: true, displayName: true } },
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
    // LTR-155: blocker notes and resolution notes ride along with Job completion notes.
    where: {
      OR: [
        { eventType: ActivityEventType.job_completed },
        { entityType: 'pause_event', eventType: { in: [ActivityEventType.note_added, ActivityEventType.blocker_resolved] } },
      ],
    },
    select: {
      id: true,
      eventType: true,
      entityType: true,
      entityId: true,
      newValue: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
};
