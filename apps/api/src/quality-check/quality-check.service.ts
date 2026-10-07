import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityEventType, BlockerReason, PauseReason, WorkPlanJobLane } from '@ltl-shop/shared';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.guard';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { classifyWorkPlanLane } from '../admin/yard-work-plan-derivation';
import { lockTruckMutation } from '../common/truck-mutation-lock';

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
});

const OPEN_STATUSES = ['created', 'in_progress'] as const;

const queueInclude = {
  truck: { select: { id: true, truckNumber: true, make: true, model: true, year: true } },
  primaryCategory: { select: { name: true } },
  jobs: {
    include: {
      category: { select: { name: true } },
      assignedMechanic: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: 'asc' as const },
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
  return row.jobs.find((job) => job.status !== 'cancelled' && classifyWorkPlanLane(job.category.name, job.displayName) === WorkPlanJobLane.QUALITY_CHECK) ?? null;
}

/** Every Job other than the Quality Check is completed or cancelled. */
function otherWorkDone(row: QueueRow, qcJobId: string) {
  return row.jobs.every((job) => job.id === qcJobId || job.status !== 'to_do');
}

function toQueueItem(row: QueueRow, viewerId: string) {
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
    readySince: readySince?.toISOString() ?? row.createdAt.toISOString(),
    takenBy: qcJob.assignedMechanic ? { id: qcJob.assignedMechanic.id, name: qcJob.assignedMechanic.name } : null,
    mine: qcJob.assignedMechanicId === viewerId,
  };
}

export type QualityCheckQueueDto = ReturnType<QualityCheckService['getQueue']> extends Promise<infer T> ? T : never;

@Injectable()
export class QualityCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  /** Trucks waiting for Quality Check, and the ones Safety returned that wait for the Manager. */
  async getQueue(user: AuthUser, client: QueueClient = this.prisma) {
    const rows = await queueRows(client);
    const pending: ReturnType<typeof toQueueItem>[] = [];
    const returned: Array<ReturnType<typeof toQueueItem> & { note: string | null; returnedBy: string | null; returnedAt: string }> = [];
    for (const row of rows) {
      const qcJob = qcJobOf(row);
      if (!qcJob || qcJob.status !== 'to_do') continue;
      const returnBlocker = row.pauseEvents.find((event) => event.jobId === qcJob.id && event.blockerReason === BlockerReason.QUALITY_CHECK_FAILED);
      if (returnBlocker) {
        returned.push({
          ...toQueueItem(row, user.id),
          note: returnBlocker.notes ?? null,
          returnedBy: returnBlocker.reportedBy?.name ?? null,
          returnedAt: returnBlocker.startedAt.toISOString(),
        });
        continue;
      }
      if (row.pauseEvents.some((event) => event.jobId === qcJob.id)) continue;
      if (!otherWorkDone(row, qcJob.id)) continue;
      pending.push(toQueueItem(row, user.id));
    }
    pending.sort((left, right) => left.readySince.localeCompare(right.readySince));
    return { pending, returned };
  }

  /** Safety takes a truck: the QC Job becomes theirs. First one wins. */
  async take(user: AuthUser, workOrderId: string) {
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
        newValue: { jobId: qcJob.id, assignedMechanicId: user.id, displayName: qcJob.displayName, actor: 'safety' },
        relevantValue: { action: 'quality_check_taken', displayName: qcJob.displayName },
      });
      return this.getQueue(user, tx);
    });
  }

  /** Safety approves: the QC Job completes and the Work Order is ready to close. */
  async approve(user: AuthUser, workOrderId: string) {
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
        relevantValue: { action: 'quality_check_approved', displayName: qcJob.displayName, actor: 'safety' },
      });
      return this.getQueue(user, tx);
    });
  }

  /** Safety returns the truck with what they found. The Manager adds the work and resolves. */
  async returnTruck(user: AuthUser, workOrderId: string, raw: unknown) {
    const parsed = returnQualityCheckSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'QC_NOTE_REQUIRED', message: 'Say what you found before returning the truck.' });
    return this.prisma.$transaction(async (tx) => {
      const row = await this.requireMine(tx, workOrderId, user);
      const qcJob = qcJobOf(row)!;
      const now = new Date();
      const blocker = await tx.pauseEvent.create({
        data: {
          workOrderId,
          jobId: qcJob.id,
          reason: PauseReason.OTHER,
          blockerReason: BlockerReason.QUALITY_CHECK_FAILED,
          notes: parsed.data.notes,
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
          notes: parsed.data.notes, laborStopped: false, actor: 'safety',
        },
      });
      return this.getQueue(user, tx);
    });
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
