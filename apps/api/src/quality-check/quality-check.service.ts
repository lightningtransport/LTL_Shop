import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ActivityEventType, BlockerReason, PauseReason, Priority, ReadinessRequirementType, WorkPlanJobLane } from '@ltl-shop/shared';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.guard';
import { isQualityCheckBackup } from '../auth/quality-check-access.guard';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { classifyWorkPlanLane } from '../admin/yard-work-plan-derivation';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import { addLocalDays, localDateTimeIn, SHOP_TIME_ZONE, type LocalDate } from '../common/shop-time';
import { YardDataBoundaryService } from '../admin/yard-data-boundary.service';
import { buildInspectionDto, inspectionInclude } from '../inspection/inspection.service';

/**
 * LTR-185 / D19: Safety does the Quality Check.
 *
 * Safety sees the trucks whose every other Job is done, takes one, and either
 * approves it (the QC Job completes, the Work Order is ready to close) or
 * returns it with a note. A return is a blocker on the QC Job with reason
 * `quality_check_failed`, so the Manager sees it where every blocker shows
 * (Dashboard, Truck, Work Order), adds the work and resolves it; the truck
 * then comes back to Safety once that work is done. Safety keeps no labor clock.
 */

export const returnQualityCheckSchema = z.object({
  notes: z.string().trim().min(1).max(1000),
  /** D-QC3: the Job Safety found the problem in (optional; "Other" sends none). */
  jobId: z.string().uuid().optional(),
});

const historyDaysSchema = z.coerce.number().int().min(1).max(31).default(7);

/** What Dispatch knows about a truck: when it leaves next and where it is. Never required. */
type DispatchInfo = { leavesOn: Map<string, string>; location: Map<string, string> };

function isoDate(date: LocalDate) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

const PRIORITY_RANK: Record<string, number> = { [Priority.CRITICAL]: 0, [Priority.HIGH]: 1 };

const OPEN_STATUSES = ['created', 'in_progress'] as const;

// Q11: Jobs added together share `addedAt`; the id breaks the tie so the card keeps its order.
const jobOrder: Prisma.WorkOrderJobOrderByWithRelationInput[] = [{ addedAt: 'asc' }, { id: 'asc' }];

const queueInclude = {
  truck: { select: { id: true, truckNumber: true, make: true, model: true, year: true } },
  primaryCategory: { select: { name: true } },
  jobs: {
    include: {
      category: { select: { name: true } },
      assignedMechanic: { select: { id: true, name: true } },
    },
    orderBy: jobOrder,
  },
  pauseEvents: {
    where: { isOfficialPause: false, resolvedAt: null },
    include: { reportedBy: { select: { id: true, name: true } } },
    orderBy: { startedAt: 'desc' as const },
  },
} as const;

type QueueRow = Awaited<ReturnType<typeof queueRows>>[number];

/** Q1: the actions read the queue inside their own transaction, so the reply already shows the change. */
type QueueClient = Pick<PrismaService, 'workOrder'>;

function queueRows(prisma: QueueClient) {
  return prisma.workOrder.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, primaryCategory: { name: { not: 'PM' } } },
    include: queueInclude,
    orderBy: { createdAt: 'asc' },
  });
}

function qcJobOf(row: QueueRow) {
  return row.jobs.find((job) => job.status !== 'cancelled' && classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey) === WorkPlanJobLane.QUALITY_CHECK) ?? null;
}

/** Every Job other than the Quality Check is completed or cancelled. */
function otherWorkDone(row: QueueRow, qcJobId: string) {
  return row.jobs.every((job) => job.id === qcJobId || job.status !== 'to_do');
}

function toQueueItem(row: QueueRow, viewerId: string, dispatch: DispatchInfo | null = null) {
  const qcJob = qcJobOf(row)!;
  const done = row.jobs.filter((job) => job.status === 'completed');
  const mechanics = [...new Map(done.map((job) => job.assignedMechanic).filter(Boolean).map((m) => [m!.id, m!.name])).values()];
  const readySince = done.reduce<Date | null>((latest, job) => (job.completedAt && (!latest || job.completedAt > latest) ? job.completedAt : latest), null);
  return {
    workOrderId: row.id,
    displayId: row.displayId,
    version: row.version,
    truck: { id: row.truck.id, truckNumber: row.truck.truckNumber, make: row.truck.make, model: row.truck.model, year: row.truck.year },
    doneJobs: done.map((job) => job.displayName),
    mechanics,
    // Stage QC-1: who did each Job (the card's chips and avatars), the priority, and what Dispatch knows.
    doneBy: done.map((job) => ({ jobId: job.id, job: job.displayName, mechanic: job.assignedMechanic ? { id: job.assignedMechanic.id, name: job.assignedMechanic.name } : null })),
    priority: row.priority,
    leavesOn: dispatch?.leavesOn.get(row.truck.truckNumber) ?? null,
    location: dispatch?.location.get(row.truck.truckNumber) ?? null,
    readySince: readySince?.toISOString() ?? row.createdAt.toISOString(),
    takenBy: qcJob.assignedMechanic ? { id: qcJob.assignedMechanic.id, name: qcJob.assignedMechanic.name } : null,
    mine: qcJob.assignedMechanicId === viewerId,
  };
}

type QueueItem = ReturnType<typeof toQueueItem>;

/**
 * D-QC5: most urgent first — leaves today or the next day (Dispatch), then Critical and High, then the one
 * ready the longest. `soonUntil` is the last shop date that counts as "soon".
 */
export function byQcUrgency(soonUntil: string) {
  const soon = (item: QueueItem) => Boolean(item.leavesOn && item.leavesOn.slice(0, 10) <= soonUntil);
  return (left: QueueItem, right: QueueItem) => {
    const leftSoon = soon(left);
    const rightSoon = soon(right);
    if (leftSoon !== rightSoon) return leftSoon ? -1 : 1;
    if (leftSoon && rightSoon && left.leavesOn !== right.leavesOn) return left.leavesOn!.localeCompare(right.leavesOn!);
    const leftRank = PRIORITY_RANK[left.priority] ?? 2;
    const rightRank = PRIORITY_RANK[right.priority] ?? 2;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.readySince.localeCompare(right.readySince);
  };
}

export type QualityCheckQueueDto = ReturnType<QualityCheckService['getQueue']> extends Promise<infer T> ? T : never;

@Injectable()
export class QualityCheckService {
  private dispatchCache: { at: number; info: DispatchInfo | null } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    @Optional() private readonly dispatch?: YardDataBoundaryService,
  ) {}

  /**
   * D-QC5: when each truck leaves (Dispatch) and where it is. Cached for a minute, since both Safety
   * screens refresh every 20 s; if Dispatch does not answer the list still works, without those chips.
   */
  private async dispatchInfo(): Promise<DispatchInfo | null> {
    if (!this.dispatch) return null;
    if (this.dispatchCache && Date.now() - this.dispatchCache.at < 60_000) return this.dispatchCache.info;
    let info: DispatchInfo | null = null;
    try {
      const boundary = await this.dispatch.get();
      const today = isoDate(localDateTimeIn(new Date(), SHOP_TIME_ZONE));
      const leavesOn = new Map<string, string>();
      if (boundary.upcomingDepartures.status === 'ok') {
        for (const item of boundary.upcomingDepartures.items) {
          if (!item.outDate || item.outDate.slice(0, 10) < today) continue;
          const current = leavesOn.get(item.truckNumber);
          if (!current || item.outDate < current) leavesOn.set(item.truckNumber, item.outDate);
        }
      }
      const location = new Map<string, string>();
      if (boundary.workLocation.status === 'ok') {
        for (const item of boundary.workLocation.items) if (item.location) location.set(item.truckNumber, item.location);
      }
      info = { leavesOn, location };
    } catch {
      info = null;
    }
    this.dispatchCache = { at: Date.now(), info };
    return info;
  }

  /** Trucks waiting for Quality Check, and the ones Safety returned that wait for the Manager. */
  async getQueue(user: AuthUser, client: QueueClient = this.prisma) {
    // LTR-197 / D-SET7: Safety sees the queue only while on Quality Check's team; the Manager always (D29).
    if (!(await this.onQualityCheckTeam(user))) return { pending: [], returned: [], onTeam: false };
    const rows = await queueRows(client);
    const dispatch = await this.dispatchInfo();
    const pending: QueueItem[] = [];
    const returned: Array<QueueItem & { note: string | null; returnedBy: string | null; returnedAt: string }> = [];
    for (const row of rows) {
      const qcJob = qcJobOf(row);
      if (!qcJob || qcJob.status !== 'to_do') continue;
      const returnBlocker = row.pauseEvents.find((event) => event.jobId === qcJob.id && event.blockerReason === BlockerReason.QUALITY_CHECK_FAILED);
      if (returnBlocker) {
        returned.push({
          ...toQueueItem(row, user.id, dispatch),
          note: returnBlocker.notes ?? null,
          returnedBy: returnBlocker.reportedBy?.name ?? null,
          returnedAt: returnBlocker.startedAt.toISOString(),
        });
        continue;
      }
      if (row.pauseEvents.some((event) => event.jobId === qcJob.id)) continue;
      if (!otherWorkDone(row, qcJob.id)) continue;
      pending.push(toQueueItem(row, user.id, dispatch));
    }
    const today = localDateTimeIn(new Date(), SHOP_TIME_ZONE);
    pending.sort(byQcUrgency(isoDate(addLocalDays(today, 1))));
    return { pending, returned, onTeam: true };
  }

  /** LTR-197 / D-SET7: a Safety person works the queue while on Quality Check's team. The Manager is backup (D29). */
  private async onQualityCheckTeam(user: AuthUser): Promise<boolean> {
    if (isQualityCheckBackup(user)) return true;
    const member = await this.prisma.shopWorkflowStepMember.findFirst({
      where: { userId: user.id, step: { stepKey: 'quality_check' } },
      select: { userId: true },
    });
    return Boolean(member);
  }

  private async assertOnQualityCheckTeam(user: AuthUser) {
    if (!(await this.onQualityCheckTeam(user))) {
      throw new ForbiddenException({ code: 'NOT_ON_STEP_TEAM', message: 'You are not on the Quality Check team. Ask the Shop Manager.' });
    }
  }

  /** Safety takes a truck: the QC Job becomes theirs. First one wins. */
  async take(user: AuthUser, workOrderId: string) {
    await this.assertOnQualityCheckTeam(user);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.requireReady(tx, workOrderId);
      const qcJob = qcJobOf(row)!;
      if (qcJob.assignedMechanicId && qcJob.assignedMechanicId !== user.id) {
        throw new ConflictException({ code: 'QC_TAKEN', message: `${qcJob.assignedMechanic?.name ?? 'Someone'} already took this truck.` });
      }
      if (qcJob.assignedMechanicId === user.id) return this.getQueue(user, tx);
      await tx.workOrderJob.update({ where: { id: qcJob.id }, data: { assignedMechanicId: user.id } });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { version: { increment: 1 } } });
      await this.activity.log(tx, {
        workOrderId,
        eventType: ActivityEventType.MECHANIC_ADDED,
        entityType: 'work_order_job',
        entityId: qcJob.id,
        userId: user.id,
        newValue: { jobId: qcJob.id, assignedMechanicId: user.id, displayName: qcJob.displayName, actor: qcActor(user) },
        relevantValue: { action: 'quality_check_taken', displayName: qcJob.displayName },
      });
      return this.getQueue(user, tx);
    });
  }

  /** Safety approves: the QC Job completes and the Work Order is ready to close. */
  async approve(user: AuthUser, workOrderId: string) {
    await this.assertOnQualityCheckTeam(user);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.requireMine(tx, workOrderId, user);
      const qcJob = qcJobOf(row)!;
      const now = new Date();
      await tx.workOrderJob.update({
        where: { id: qcJob.id },
        data: { status: 'completed', completedAt: now, completedById: user.id },
      });
      // LTR-175: work on the Work Order puts it in progress, whoever does it.
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: row.status === 'created'
          ? { status: 'in_progress', startedAt: now, version: { increment: 1 } }
          : { version: { increment: 1 } },
      });
      await this.activity.log(tx, {
        workOrderId,
        eventType: ActivityEventType.JOB_COMPLETED,
        entityType: 'work_order_job',
        entityId: qcJob.id,
        userId: user.id,
        previousValue: { status: 'to_do', displayName: qcJob.displayName },
        newValue: { status: 'completed', displayName: qcJob.displayName },
        relevantValue: { action: 'quality_check_approved', displayName: qcJob.displayName, actor: qcActor(user) },
      });
      return this.getQueue(user, tx);
    });
  }

  /** Safety returns the truck with what they found. The Manager adds the work and resolves. */
  async returnTruck(user: AuthUser, workOrderId: string, raw: unknown) {
    await this.assertOnQualityCheckTeam(user);
    const parsed = returnQualityCheckSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'QC_NOTE_REQUIRED', message: 'Say what you found before returning the truck.' });
    return this.prisma.$transaction(async (tx) => {
      const row = await this.requireMine(tx, workOrderId, user);
      const qcJob = qcJobOf(row)!;
      const now = new Date();
      // D-QC3: the Job that failed, when Safety says which. The Manager reads it at the start of the note.
      const failedJob = parsed.data.jobId ? row.jobs.find((job) => job.id === parsed.data.jobId && job.status === 'completed') ?? null : null;
      if (parsed.data.jobId && !failedJob) {
        throw new BadRequestException({ code: 'QC_JOB_NOT_DONE', message: 'Pick a Job that was done on this truck, or Other.' });
      }
      const notes = failedJob ? `${failedJob.displayName}: ${parsed.data.notes}` : parsed.data.notes;
      const blocker = await tx.pauseEvent.create({
        data: {
          workOrderId,
          jobId: qcJob.id,
          reason: PauseReason.OTHER,
          blockerReason: BlockerReason.QUALITY_CHECK_FAILED,
          notes,
          startedAt: now,
          endedAt: now,
          durationMs: 0n,
          isOfficialPause: false,
          reportedById: user.id,
          createdById: user.id,
        },
      });
      // The truck goes back to the queue for either Safety person once the Manager resolves.
      await tx.workOrderJob.update({ where: { id: qcJob.id }, data: { assignedMechanicId: null } });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { version: { increment: 1 } } });
      await this.activity.log(tx, {
        workOrderId,
        eventType: ActivityEventType.BLOCKER_REPORTED,
        entityType: 'pause_event',
        entityId: blocker.id,
        userId: user.id,
        newValue: {
          jobId: qcJob.id, jobName: qcJob.displayName, reason: BlockerReason.QUALITY_CHECK_FAILED,
          notes, laborStopped: false, actor: qcActor(user),
          ...(failedJob ? { failedJobId: failedJob.id, failedJobName: failedJob.displayName } : {}),
        },
      });
      return this.getQueue(user, tx);
    });
  }

  /** D-QC2: Safety lets go of a truck they took, so the other Safety person can take it. */
  async release(user: AuthUser, workOrderId: string) {
    await this.assertOnQualityCheckTeam(user);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.requireMine(tx, workOrderId, user);
      const qcJob = qcJobOf(row)!;
      await tx.workOrderJob.update({ where: { id: qcJob.id }, data: { assignedMechanicId: null } });
      await tx.workOrder.update({ where: { id: workOrderId }, data: { version: { increment: 1 } } });
      await this.activity.log(tx, {
        workOrderId,
        eventType: ActivityEventType.MECHANIC_REMOVED,
        entityType: 'work_order_job',
        entityId: qcJob.id,
        userId: user.id,
        previousValue: { jobId: qcJob.id, assignedMechanicId: user.id, displayName: qcJob.displayName, actor: qcActor(user) },
        relevantValue: { action: 'quality_check_released', displayName: qcJob.displayName },
      });
      return this.getQueue(user, tx);
    });
  }

  /**
   * D-QC1 / Q2: everything Safety needs to decide on one truck — what was done (who, when, closing note),
   * the PM, the arrival inspection, the blockers it had and earlier returns. Only for a truck in the
   * Safety list (to review, or returned).
   */
  async review(user: AuthUser, workOrderId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(workOrderId)) throw new NotFoundException('Work Order not found');
    const row = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        truck: true,
        jobs: {
          include: { category: { select: { name: true } }, assignedMechanic: { select: { id: true, name: true } } },
          orderBy: jobOrder,
        },
        pauseEvents: {
          where: { isOfficialPause: false },
          include: { reportedBy: { select: { id: true, name: true } }, resolvedBy: { select: { id: true, name: true } }, job: { select: { displayName: true } } },
          orderBy: { startedAt: 'asc' },
        },
        pmService: { include: { parts: { include: { partCategory: { select: { name: true, sortOrder: true } }, part: { select: { partNumber: true, displayName: true } } } } } },
        readinessAssessment: { include: { requirements: true } },
        activityLogs: {
          where: { eventType: { in: [ActivityEventType.JOB_COMPLETED, ActivityEventType.BLOCKER_RESOLVED] as never } },
          select: { eventType: true, entityId: true, newValue: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Work Order not found');
    const queue = await this.getQueue(user);
    const listed = queue.pending.find((item) => item.workOrderId === workOrderId) ?? queue.returned.find((item) => item.workOrderId === workOrderId);
    if (!listed) throw new NotFoundException({ code: 'QC_NOT_LISTED', message: 'This truck is not in the Safety list.' });

    const noteFor = (eventType: string, entityId: string) => {
      const log = row.activityLogs.find((entry) => entry.eventType === eventType && entry.entityId === entityId);
      const notes = (log?.newValue as { notes?: unknown } | null)?.notes;
      return typeof notes === 'string' && notes.trim() ? notes : null;
    };
    const qcJobId = row.jobs.find((job) => job.status !== 'cancelled' && classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey) === WorkPlanJobLane.QUALITY_CHECK)?.id ?? null;
    const lanes = row.jobs.map((job) => classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey));
    const inspectionRequirement = row.readinessAssessment?.requirements.find((requirement) => requirement.type === ReadinessRequirementType.INSPECTION) ?? null;
    const hasShopWork = row.jobs.some((job, index) => lanes[index] === WorkPlanJobLane.SHOP_WORK && job.status !== 'cancelled');
    const inspectionOutcome = hasShopWork
      ? 'issues_found'
      : inspectionRequirement && ['completed', 'waived', 'not_required'].includes(inspectionRequirement.outcome) ? 'no_issues_found' : 'not_recorded';
    const pmJob = row.jobs.find((job, index) => lanes[index] === WorkPlanJobLane.PM && job.status === 'completed') ?? null;
    // D46 / SQ-2 (LTR-231): the sheet the truck was inspected with on this visit, to read (Safety does not inspect).
    const sheetRow = await this.prisma.truckInspection.findFirst({ where: { workOrderId }, include: inspectionInclude, orderBy: { inspectedAt: 'desc' } });
    const sheet = sheetRow ? await buildInspectionDto(this.prisma, sheetRow) : null;

    return {
      ...listed,
      truck: {
        ...listed.truck,
        vin: row.truck.vin,
        mileage: row.truck.mileage,
        company: row.truck.company,
      },
      jobs: row.jobs
        .filter((job) => job.status === 'completed' && job.id !== qcJobId)
        .map((job) => ({
          id: job.id,
          name: job.displayName,
          category: job.category.name,
          mechanic: job.assignedMechanic ? { id: job.assignedMechanic.id, name: job.assignedMechanic.name } : null,
          completedAt: job.completedAt?.toISOString() ?? null,
          note: noteFor(ActivityEventType.JOB_COMPLETED, job.id),
          isPm: job.id === pmJob?.id,
        })),
      pm: pmJob && row.pmService
        ? {
            service: pmJob.displayName,
            observedMileage: row.pmService.observedMileage,
            parts: [...row.pmService.parts]
              .sort((left, right) => left.partCategory.sortOrder - right.partCategory.sortOrder)
              .map((item) => ({ category: item.partCategory.name, partNumber: item.part.partNumber, name: item.part.displayName })),
          }
        : null,
      inspection: { outcome: sheet ? (sheet.issuesFound ? 'issues_found' : 'no_issues_found') : inspectionOutcome, recordedAt: sheet?.inspectedAt ?? inspectionRequirement?.evaluatedAt?.toISOString() ?? null, sheet },
      blockers: row.pauseEvents
        .filter((event) => event.jobId !== qcJobId && event.resolvedAt)
        .map((event) => ({
          job: event.job?.displayName ?? null,
          reason: event.blockerReason ?? event.reason,
          note: event.notes,
          reportedBy: event.reportedBy?.name ?? null,
          startedAt: event.startedAt.toISOString(),
          resolvedAt: event.resolvedAt!.toISOString(),
          resolvedBy: event.resolvedBy?.name ?? null,
          resolution: noteFor(ActivityEventType.BLOCKER_RESOLVED, event.id),
        })),
      previousReturns: row.pauseEvents
        .filter((event) => event.jobId === qcJobId && event.blockerReason === BlockerReason.QUALITY_CHECK_FAILED && event.resolvedAt)
        .map((event) => ({
          note: event.notes,
          returnedBy: event.reportedBy?.name ?? null,
          returnedAt: event.startedAt.toISOString(),
          resolvedAt: event.resolvedAt!.toISOString(),
          resolvedBy: event.resolvedBy?.name ?? null,
          resolution: noteFor(ActivityEventType.BLOCKER_RESOLVED, event.id),
        })),
    };
  }

  /** D-QC6: what I approved or returned in the last `days` days, newest first. */
  async history(user: AuthUser, rawDays: unknown) {
    const parsed = historyDaysSchema.safeParse(rawDays ?? undefined);
    const days = parsed.success ? parsed.data : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const logs = await this.prisma.activityLog.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: since },
        OR: [
          { eventType: ActivityEventType.JOB_COMPLETED as never, relevantValue: { path: ['action'], equals: 'quality_check_approved' } },
          { eventType: ActivityEventType.BLOCKER_REPORTED as never, newValue: { path: ['reason'], equals: BlockerReason.QUALITY_CHECK_FAILED } },
        ],
      },
      include: { workOrder: { select: { id: true, displayId: true, truck: { select: { id: true, truckNumber: true, make: true, model: true, year: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      days,
      items: logs.filter((log) => log.workOrder).map((log) => ({
        workOrderId: log.workOrder!.id,
        displayId: log.workOrder!.displayId,
        truck: log.workOrder!.truck,
        outcome: log.eventType === (ActivityEventType.JOB_COMPLETED as never) ? 'approved' as const : 'returned' as const,
        at: log.createdAt.toISOString(),
        note: log.eventType === (ActivityEventType.BLOCKER_REPORTED as never) ? ((log.newValue as { notes?: string } | null)?.notes ?? null) : null,
      })),
    };
  }

  private async requireReady(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], workOrderId: string) {
    const row = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: queueInclude });
    if (!row) throw new NotFoundException('Work Order not found');
    await lockTruckMutation(tx, row.truckId);
    const fresh = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: queueInclude });
    if (!fresh) throw new NotFoundException('Work Order not found');
    const qcJob = qcJobOf(fresh);
    if (!(OPEN_STATUSES as readonly string[]).includes(fresh.status) || !qcJob || qcJob.status !== 'to_do') {
      throw new BadRequestException({ code: 'QC_NOT_PENDING', message: 'This truck has no Quality Check pending.' });
    }
    if (fresh.pauseEvents.some((event) => event.jobId === qcJob.id)) {
      throw new BadRequestException({ code: 'QC_RETURNED', message: 'This truck was returned; the Manager has to resolve it first.' });
    }
    if (!otherWorkDone(fresh, qcJob.id)) {
      throw new BadRequestException({ code: 'QC_NOT_READY', message: 'This truck still has work pending before Quality Check.' });
    }
    return fresh;
  }

  private async requireMine(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], workOrderId: string, user: AuthUser) {
    const row = await this.requireReady(tx, workOrderId);
    if (qcJobOf(row)!.assignedMechanicId !== user.id) {
      throw new BadRequestException({ code: 'QC_NOT_TAKEN', message: 'Take the truck first.' });
    }
    return row;
  }
}

/** D29: who did it — Safety, or the Shop Manager / System Admin as backup. */
function qcActor(user: AuthUser): 'safety' | 'manager_backup' {
  return isQualityCheckBackup(user) ? 'manager_backup' : 'safety';
}
