import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityEventType, AppCapability, OPEN_WORK_ORDER_STATUSES, SHOP_WORK_QUEUE_KEY, ShopWorkflowStepKey, type TeamQueueItemDto } from '@ltl-shop/shared';
import type { WorkOrderStatus } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import { PrismaService } from '../prisma/prisma.service';
import { eligibleTeamMember } from './mandatory-jobs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * LTR-197 / D28: a mandatory step with two or more people shares a queue. Its Jobs are born with no owner and
 * `workflow_step_key`; anyone eligible on that step's team takes one (first wins) and can let it go back.
 * Quality Check's queue stays on the Safety screen (`/qc`). D57 §5 (LTR-305): the Shop Work queue is every active
 * Standard mechanic's, with no team to set up.
 */
@Injectable()
export class TeamQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  /** The queues (other than QC) this person can take from: their steps' teams, and Shop Work for a Standard mechanic. */
  private async myStepKeys(user: AuthUser): Promise<string[]> {
    const shopWork = user.active && user.capabilities.includes(AppCapability.MECHANIC_STANDARD) ? [SHOP_WORK_QUEUE_KEY] : [];
    const memberships = await this.prisma.shopWorkflowStepMember.findMany({
      where: { userId: user.id, step: { active: true, stepKey: { not: ShopWorkflowStepKey.QUALITY_CHECK } } },
      select: {
        step: { select: { stepKey: true } },
        user: { select: { id: true, active: true, role: true, capabilities: { select: { capability: true } } } },
      },
    });
    return [...memberships.filter((membership) => eligibleTeamMember(membership.step.stepKey, membership.user)).map((membership) => membership.step.stepKey), ...shopWork];
  }

  async list(user: AuthUser): Promise<TeamQueueItemDto[]> {
    const stepKeys = await this.myStepKeys(user);
    if (!stepKeys.length) return [];
    const [jobs, teamSizes, steps, shopWorkSize] = await Promise.all([
      this.prisma.workOrderJob.findMany({
        where: {
          workflowStepKey: { in: stepKeys },
          assignedMechanicId: null,
          status: 'to_do',
          externalSince: null,
          workOrder: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
        },
        select: {
          id: true,
          displayName: true,
          workflowStepKey: true,
          addedAt: true,
          workOrder: {
            select: {
              id: true,
              displayId: true,
              priority: true,
              truck: { select: { truckNumber: true, make: true, model: true, year: true } },
            },
          },
        },
        orderBy: { addedAt: 'asc' },
      }),
      this.prisma.shopWorkflowStepMember.groupBy({
        by: ['stepId'],
        where: { step: { stepKey: { in: stepKeys } } },
        _count: { _all: true },
      }),
      this.prisma.shopWorkflowStep.findMany({ where: { stepKey: { in: stepKeys } }, select: { id: true, stepKey: true } }),
      stepKeys.includes(SHOP_WORK_QUEUE_KEY)
        ? this.prisma.user.count({ where: { active: true, capabilities: { some: { capability: 'MECHANIC_STANDARD' } } } })
        : Promise.resolve(0),
    ]);
    const sizeByKey = new Map(steps.map((step) => [step.stepKey, teamSizes.find((row) => row.stepId === step.id)?._count._all ?? 0]));
    sizeByKey.set(SHOP_WORK_QUEUE_KEY, shopWorkSize);
    return jobs.map((job) => ({
      jobId: job.id,
      displayName: job.displayName,
      stepKey: job.workflowStepKey!,
      teamSize: sizeByKey.get(job.workflowStepKey!) ?? 0,
      addedAt: job.addedAt.toISOString(),
      workOrderId: job.workOrder.id,
      workOrderDisplayId: job.workOrder.displayId,
      priority: job.workOrder.priority as TeamQueueItemDto['priority'],
      truck: job.workOrder.truck,
    }));
  }

  /** Take a queued Job: it becomes yours. First one wins (`JOB_ALREADY_TAKEN`). */
  async take(user: AuthUser, jobId: string): Promise<TeamQueueItemDto[]> {
    if (!UUID.test(jobId)) throw new BadRequestException('Invalid Job id');
    const stepKeys = await this.myStepKeys(user);
    await this.prisma.$transaction(async (tx) => {
      const job = await this.queuedJob(tx, jobId);
      if (!job.workflowStepKey || !stepKeys.includes(job.workflowStepKey)) {
        throw new ForbiddenException({
          code: 'NOT_ON_STEP_TEAM',
          message: job.workflowStepKey === SHOP_WORK_QUEUE_KEY ? 'Only a general mechanic can take it.' : 'Only someone on this step\'s team can take it.',
        });
      }
      // Conditional on "still nobody's" so two people tapping Take at once cannot both win.
      const taken = await tx.workOrderJob.updateMany({
        where: { id: job.id, assignedMechanicId: null, status: 'to_do' },
        data: { assignedMechanicId: user.id },
      });
      if (taken.count !== 1) {
        throw new ConflictException({ code: 'JOB_ALREADY_TAKEN', message: 'Someone else already took this Job.' });
      }
      if (job.workflowStepKey !== ShopWorkflowStepKey.PM) {
        // D11: the Work Order team is derived from the Job owners (PM owners reach the WO through their PM Job).
        await tx.mechanicAssignment.upsert({
          where: { workOrderId_mechanicId: { workOrderId: job.workOrderId, mechanicId: user.id } },
          create: { workOrderId: job.workOrderId, mechanicId: user.id, addedById: user.id },
          update: { removedAt: null },
        });
      }
      await tx.workOrder.update({ where: { id: job.workOrderId }, data: { version: { increment: 1 } } });
      await this.activity.log(tx, {
        workOrderId: job.workOrderId,
        eventType: ActivityEventType.MECHANIC_ADDED,
        entityType: 'work_order_job',
        entityId: job.id,
        userId: user.id,
        newValue: { jobId: job.id, assignedMechanicId: user.id, displayName: job.displayName, stepKey: job.workflowStepKey },
        relevantValue: { action: 'job_taken_from_team_queue', displayName: job.displayName },
      });
    });
    return this.list(user);
  }

  /** Let a taken queue Job go back to the team queue. Not while your time runs on that truck. */
  async release(user: AuthUser, jobId: string): Promise<TeamQueueItemDto[]> {
    if (!UUID.test(jobId)) throw new BadRequestException('Invalid Job id');
    await this.prisma.$transaction(async (tx) => {
      const job = await tx.workOrderJob.findUnique({
        where: { id: jobId },
        select: { id: true, displayName: true, status: true, assignedMechanicId: true, workflowStepKey: true, startedAt: true, workOrderId: true, workOrder: { select: { truckId: true, status: true } } },
      });
      if (!job) throw new NotFoundException('Job not found');
      await lockTruckMutation(tx, job.workOrder.truckId);
      if (!job.workflowStepKey || job.workflowStepKey === ShopWorkflowStepKey.QUALITY_CHECK) {
        throw new BadRequestException({ code: 'JOB_NOT_IN_TEAM_QUEUE', message: 'This Job is not from a team queue. Ask the Shop Manager to reassign it.' });
      }
      if (job.assignedMechanicId !== user.id || job.status !== 'to_do') {
        throw new BadRequestException({ code: 'JOB_NOT_ASSIGNED_TO_YOU', message: 'This Job is not yours to let go.' });
      }
      const running = await tx.workSession.findFirst({ where: { workOrderId: job.workOrderId, userId: user.id, endedAt: null }, select: { id: true } });
      if (running || job.startedAt) {
        throw new ConflictException({ code: 'JOB_RELEASE_CLOCK_RUNNING', message: 'Your time is running on this truck. Finish or report a blocker, or ask the Shop Manager to reassign it.' });
      }
      await tx.workOrderJob.update({ where: { id: job.id }, data: { assignedMechanicId: null } });
      const stillMine = await tx.workOrderJob.count({ where: { workOrderId: job.workOrderId, assignedMechanicId: user.id, status: { not: 'cancelled' } } });
      if (!stillMine) {
        await tx.mechanicAssignment.updateMany({ where: { workOrderId: job.workOrderId, mechanicId: user.id, removedAt: null }, data: { removedAt: new Date() } });
      }
      await tx.workOrder.update({ where: { id: job.workOrderId }, data: { version: { increment: 1 } } });
      await this.activity.log(tx, {
        workOrderId: job.workOrderId,
        eventType: ActivityEventType.MECHANIC_REMOVED,
        entityType: 'work_order_job',
        entityId: job.id,
        userId: user.id,
        previousValue: { jobId: job.id, assignedMechanicId: user.id, displayName: job.displayName, stepKey: job.workflowStepKey },
        relevantValue: { action: 'job_released_to_team_queue', displayName: job.displayName },
      });
    });
    return this.list(user);
  }

  private async queuedJob(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], jobId: string) {
    const job = await tx.workOrderJob.findUnique({
      where: { id: jobId },
      select: { id: true, displayName: true, status: true, assignedMechanicId: true, workflowStepKey: true, externalSince: true, workOrderId: true, workOrder: { select: { truckId: true, status: true } } },
    });
    if (!job) throw new NotFoundException('Job not found');
    await lockTruckMutation(tx, job.workOrder.truckId);
    if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(job.workOrder.status) || job.status !== 'to_do' || job.externalSince || !job.workflowStepKey) {
      throw new BadRequestException({ code: 'JOB_NOT_IN_TEAM_QUEUE', message: 'This Job is no longer waiting in a team queue.' });
    }
    if (job.assignedMechanicId) {
      throw new ConflictException({ code: 'JOB_ALREADY_TAKEN', message: 'Someone else already took this Job.' });
    }
    return job;
  }
}
