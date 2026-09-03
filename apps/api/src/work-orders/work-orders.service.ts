import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEventType,
  OPEN_WORK_ORDER_STATUSES,
  PauseReason,
  addJobSchema,
  changePauseReasonSchema,
  createWorkOrderSchema,
  pauseWorkOrderSchema,
  updateWorkOrderNotesSchema,
  updatePmServiceSchema,
  type CreateWorkOrderInput,
} from '@ltl-shop/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  toWorkOrderDetail,
  toWorkOrderSummary,
  workOrderDetailInclude,
} from './work-order.mapper';
import {
  canCompleteJob,
  canFinishWorkOrder,
  computeTotals,
  nextDisplayId,
} from './work-order.timing';
import type { AuthUser } from '../auth/auth.guard';

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async listForMechanic(userId: string) {
    const rows = await this.prisma.workOrder.findMany({
      where: {
        status: { in: ['created', 'in_progress', 'waiting_paused', 'completed'] },
        OR: [
          { createdById: userId },
          { mechanics: { some: { mechanicId: userId, removedAt: null } } },
        ],
      },
      include: workOrderDetailInclude,
      orderBy: { updatedAt: 'desc' },
    });

    const mapped = rows.map(toWorkOrderSummary);
    return {
      created: mapped.filter((w) => w.status === 'created'),
      active: mapped.filter((w) => w.status === 'in_progress'),
      paused: mapped.filter((w) => w.status === 'waiting_paused'),
      completed: mapped.filter((w) => w.status === 'completed'),
    };
  }

  async getById(user: AuthUser, id: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: workOrderDetailInclude,
    });
    if (!wo) throw new NotFoundException('Work Order not found');
    this.assertPmReadAccess(user, wo.primaryCategory.name);
    return toWorkOrderDetail(wo);
  }

  async create(user: AuthUser, raw: unknown) {
    const parsed = createWorkOrderSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input: CreateWorkOrderInput = parsed.data;

    if (input.idempotencyKey) {
      const existing = await this.prisma.workOrder.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: workOrderDetailInclude,
      });
      if (existing) return toWorkOrderDetail(existing);
    }

    const open = await this.prisma.workOrder.findFirst({
      where: {
        truckId: input.truckId,
        status: { in: OPEN_WORK_ORDER_STATUSES },
      },
      include: workOrderDetailInclude,
    });
    if (open) {
      throw new ConflictException({
        code: 'OPEN_WORK_ORDER_EXISTS',
        message: `Truck already has an open Work Order.`,
        workOrder: toWorkOrderSummary(open),
      });
    }

    const truck = await this.prisma.truck.findUnique({
      where: { id: input.truckId },
    });
    if (!truck) throw new BadRequestException('Invalid truck');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id: input.primaryCategoryId },
    });
    if (!category) throw new BadRequestException('Invalid primary category');

    if (user.pmAuthorized && category.name !== 'PM') {
      throw new ForbiddenException('PM mechanics can only create PM Work Orders');
    }
    const isPm = category.name === 'PM';
    if (isPm) {
      this.assertPmMutationAccess(user);
      if (input.jobs.length) {
        throw new BadRequestException('PM Work Orders do not use jobs');
      }
      if (input.mechanicIds.some((id) => id !== user.id)) {
        throw new BadRequestException('PM Work Orders can only be assigned to Daniel');
      }
    } else if (!input.jobs.length) {
      throw new BadRequestException('At least one job is required for this Work Order');
    }

    const mechanicIds = Array.from(
      new Set([user.id, ...input.mechanicIds]),
    );

    const count = await this.prisma.workOrder.count();
    const displayId = nextDisplayId(count + 1);

    const wo = await this.prisma.$transaction(async (tx) => {
      const startedAt = isPm ? new Date() : null;
      const created = await tx.workOrder.create({
        data: {
          displayId,
          truckId: input.truckId,
          primaryCategoryId: input.primaryCategoryId,
          // A new PM service is work that Daniel starts immediately. Existing
          // created PM orders remain startable through the legacy endpoint.
          status: isPm ? 'in_progress' : 'created',
          priority: isPm ? 'normal' : input.priority,
          notes: isPm ? undefined : input.notes,
          createdById: user.id,
          startedAt,
          idempotencyKey: input.idempotencyKey,
          sessions: isPm && startedAt ? { create: { startedAt } } : undefined,
          jobs: {
            create: input.jobs.map((job) => ({
              catalogJobId: job.catalogJobId,
              categoryId: job.categoryId,
              displayName: job.displayName,
              customDescription: job.customDescription,
              isCustom: !job.catalogJobId,
              reviewStatus: job.catalogJobId ? null : 'pending_review',
              addedById: user.id,
              status: 'to_do',
            })),
          },
          mechanics: {
            create: mechanicIds.map((mechanicId) => ({
              mechanicId,
              addedById: user.id,
            })),
          },
        },
        include: workOrderDetailInclude,
      });

      await this.activity.log(tx, {
        workOrderId: created.id,
        eventType: ActivityEventType.WORK_ORDER_CREATED,
        entityType: 'work_order',
        entityId: created.id,
        userId: user.id,
        newValue: { displayId, status: 'created' },
      });
      if (isPm) {
        await this.activity.log(tx, {
          workOrderId: created.id,
          eventType: ActivityEventType.WORK_STARTED,
          entityType: 'work_order',
          entityId: created.id,
          userId: user.id,
          previousValue: { status: 'created' },
          newValue: { status: 'in_progress' },
        });
      }

      return created;
    });

    return toWorkOrderDetail(wo);
  }

  async start(user: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      await this.assertPmMutationForWorkOrder(tx, user, wo.primaryCategoryId);
      if (wo.status !== 'created') {
        throw new BadRequestException('Work Order can only be started from created status');
      }
      const now = new Date();
      await tx.workSession.create({
        data: { workOrderId: id, startedAt: now },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: {
          status: 'in_progress',
          startedAt: now,
          version: { increment: 1 },
        },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.WORK_STARTED,
        entityType: 'work_order',
        entityId: id,
        userId: user.id,
        previousValue: { status: 'created' },
        newValue: { status: 'in_progress' },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async pause(user: AuthUser, id: string, raw: unknown) {
    const parsed = pauseWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.reason === PauseReason.OTHER && !parsed.data.notes?.trim()) {
      throw new BadRequestException('Notes are required when reason is Other');
    }

    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      await this.assertPmMutationForWorkOrder(tx, user, wo.primaryCategoryId);
      if (wo.status !== 'in_progress') {
        throw new BadRequestException('Only in-progress Work Orders can be paused');
      }
      const now = new Date();
      await this.closeOpenSession(tx, id, now);
      await tx.pauseEvent.create({
        data: {
          workOrderId: id,
          reason: parsed.data.reason,
          notes: parsed.data.notes,
          startedAt: now,
          createdById: user.id,
        },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: { status: 'waiting_paused', version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.WORK_PAUSED,
        entityType: 'work_order',
        entityId: id,
        userId: user.id,
        newValue: { reason: parsed.data.reason },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async changePauseReason(user: AuthUser, id: string, raw: unknown) {
    const parsed = changePauseReasonSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.reason === PauseReason.OTHER && !parsed.data.notes?.trim()) {
      throw new BadRequestException('Notes are required when reason is Other');
    }

    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      await this.assertPmMutationForWorkOrder(tx, user, wo.primaryCategoryId);
      if (wo.status !== 'waiting_paused') {
        throw new BadRequestException('Work Order is not paused');
      }
      const openPause = await tx.pauseEvent.findFirst({
        where: { workOrderId: id, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (!openPause) throw new BadRequestException('No open pause event');

      const now = new Date();
      const durationMs = BigInt(now.getTime() - openPause.startedAt.getTime());
      await tx.pauseEvent.update({
        where: { id: openPause.id },
        data: { endedAt: now, durationMs },
      });
      await tx.pauseEvent.create({
        data: {
          workOrderId: id,
          reason: parsed.data.reason,
          notes: parsed.data.notes,
          startedAt: now,
          createdById: user.id,
        },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.PAUSE_REASON_CHANGED,
        entityType: 'pause_event',
        entityId: openPause.id,
        userId: user.id,
        previousValue: { reason: openPause.reason },
        newValue: { reason: parsed.data.reason },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async resume(user: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      await this.assertPmMutationForWorkOrder(tx, user, wo.primaryCategoryId);
      if (wo.status !== 'waiting_paused') {
        throw new BadRequestException('Only paused Work Orders can be resumed');
      }
      const now = new Date();
      const openPause = await tx.pauseEvent.findFirst({
        where: { workOrderId: id, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (openPause) {
        const durationMs = BigInt(now.getTime() - openPause.startedAt.getTime());
        await tx.pauseEvent.update({
          where: { id: openPause.id },
          data: { endedAt: now, durationMs },
        });
      }
      await tx.workSession.create({
        data: { workOrderId: id, startedAt: now },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: { status: 'in_progress', version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.WORK_RESUMED,
        entityType: 'work_order',
        entityId: id,
        userId: user.id,
        newValue: { status: 'in_progress' },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async addJob(user: AuthUser, id: string, raw: unknown) {
    const parsed = addJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      await this.assertPmMutationForWorkOrder(tx, user, wo.primaryCategoryId);
      const category = await tx.jobCategory.findUnique({
        where: { id: wo.primaryCategoryId },
        select: { name: true },
      });
      if (category?.name === 'PM') {
        throw new BadRequestException('PM Work Orders do not use jobs');
      }
      if (wo.status === 'completed' || wo.status === 'cancelled') {
        throw new BadRequestException('Cannot add jobs to a closed Work Order');
      }
      const duplicate = await tx.workOrderJob.findFirst({
        where: {
          workOrderId: id,
          status: { not: 'cancelled' },
          OR: [
            ...(parsed.data.catalogJobId
              ? [{ catalogJobId: parsed.data.catalogJobId }]
              : []),
            {
              displayName: {
                equals: parsed.data.displayName.trim(),
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException('This job is already on the Work Order');
      }
      await tx.workOrderJob.create({
        data: {
          workOrderId: id,
          catalogJobId: parsed.data.catalogJobId,
          categoryId: parsed.data.categoryId,
          displayName: parsed.data.displayName,
          customDescription: parsed.data.customDescription,
          isCustom: !parsed.data.catalogJobId,
          reviewStatus: parsed.data.catalogJobId ? null : 'pending_review',
          addedById: user.id,
          status: 'to_do',
        },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.JOB_ADDED,
        entityType: 'work_order_job',
        userId: user.id,
        newValue: { displayName: parsed.data.displayName },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async updateNotes(user: AuthUser, id: string, raw: unknown) {
    const parsed = updateWorkOrderNotesSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      await this.assertPmMutationForWorkOrder(tx, user, wo.primaryCategoryId);
      const notes = parsed.data.notes?.trim() || null;
      const updated = await tx.workOrder.update({
        where: { id },
        data: { notes, version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.NOTES_UPDATED,
        entityType: 'work_order',
        entityId: id,
        userId: user.id,
        previousValue: { notes: wo.notes },
        newValue: { notes },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async completeJob(user: AuthUser, workOrderId: string, jobId: string) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, workOrderId);
      await this.assertPmMutationForWorkOrder(tx, user, wo.primaryCategoryId);
      const category = await tx.jobCategory.findUnique({
        where: { id: wo.primaryCategoryId },
        select: { name: true },
      });
      if (category?.name === 'PM') {
        throw new BadRequestException('PM Work Orders do not use jobs');
      }
      const gate = canCompleteJob(wo.status);
      if (!gate.ok) {
        throw new BadRequestException({ code: gate.code, message: gate.message });
      }
      const job = await tx.workOrderJob.findFirst({
        where: { id: jobId, workOrderId },
      });
      if (!job) throw new NotFoundException('Job not found');
      if (job.status !== 'to_do') {
        throw new BadRequestException('Job is not in To Do status');
      }
      await tx.workOrderJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          completedById: user.id,
        },
      });
      const updated = await tx.workOrder.update({
        where: { id: workOrderId },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId,
        eventType: ActivityEventType.JOB_COMPLETED,
        entityType: 'work_order_job',
        entityId: jobId,
        userId: user.id,
        newValue: { displayName: job.displayName, status: 'completed' },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async complete(user: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUnique({
        where: { id },
        include: {
          truck: true,
          primaryCategory: true,
          pmService: { include: { parts: true } },
        },
      });
      if (!wo) throw new NotFoundException('Work Order not found');
      await this.assertPmMutationForWorkOrder(tx, user, wo.primaryCategoryId);
      if (wo.status !== 'in_progress') {
        throw new BadRequestException('Work Order must be in progress to finish');
      }
      const isPm = wo.primaryCategory.name === 'PM';
      const pmObservedMileage = wo.pmService?.observedMileage;
      if (isPm) {
        if (pmObservedMileage == null) {
          throw new BadRequestException('Observed mileage is required to finish a PM service');
        }
        if (!wo.pmService?.parts.length) {
          throw new BadRequestException('Select at least one part before finishing a PM service');
        }
      } else {
        const jobs = await tx.workOrderJob.findMany({ where: { workOrderId: id } });
        const gate = canFinishWorkOrder(jobs);
        if (!gate.ok) throw new BadRequestException(gate.message);
      }

      const now = new Date();
      await this.closeOpenSession(tx, id, now);

      const sessions = await tx.workSession.findMany({ where: { workOrderId: id } });
      const pauses = await tx.pauseEvent.findMany({ where: { workOrderId: id } });
      const totals = computeTotals({ sessions, pauses, now });

      if (isPm && pmObservedMileage !== wo.truck.mileage) {
        await tx.truck.update({
          where: { id: wo.truckId },
          data: { mileage: pmObservedMileage },
        });
        await tx.truckMileageAdjustment.create({
          data: {
            truckId: wo.truckId,
            workOrderId: wo.id,
            previousMileage: wo.truck.mileage,
            observedMileage: pmObservedMileage!,
            createdById: user.id,
          },
        });
        await this.activity.log(tx, {
          workOrderId: wo.id,
          eventType: ActivityEventType.TRUCK_MILEAGE_CORRECTED,
          entityType: 'truck',
          entityId: wo.truckId,
          userId: user.id,
          previousValue: { mileage: wo.truck.mileage },
          newValue: { mileage: pmObservedMileage },
        });
      }

      const updated = await tx.workOrder.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: now,
          completedById: user.id,
          totalActiveLaborMs: BigInt(totals.totalActiveLaborMs),
          totalWaitingMs: BigInt(totals.totalWaitingMs),
          version: { increment: 1 },
        },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.WORK_ORDER_COMPLETED,
        entityType: 'work_order',
        entityId: id,
        userId: user.id,
        newValue: {
          status: 'completed',
          totalActiveLaborMs: totals.totalActiveLaborMs,
          totalWaitingMs: totals.totalWaitingMs,
        },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async getPmService(user: AuthUser, id: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { truck: true, primaryCategory: true, pmService: { include: { parts: true } } },
    });
    if (!wo) throw new NotFoundException('Work Order not found');
    if (wo.primaryCategory.name !== 'PM') throw new BadRequestException('Work Order is not a PM service');
    this.assertPmReadAccess(user, wo.primaryCategory.name);

    const [categories, lastCompletedPm] = await Promise.all([
      this.prisma.partCategory.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          parts: {
            where: { active: true },
            orderBy: [{ partNumber: 'asc' }, { displayName: 'asc' }],
            include: { fitments: true },
          },
        },
      }),
      this.prisma.pmService.findFirst({
        where: {
          workOrder: {
            truckId: wo.truckId,
            primaryCategory: { name: 'PM' },
            status: 'completed',
            id: { not: wo.id },
          },
        },
        orderBy: { workOrder: { completedAt: 'desc' } },
        include: { workOrder: true },
      }),
    ]);

    return {
      workOrderId: wo.id,
      canEdit:
        user.pmAuthorized &&
        ['in_progress', 'waiting_paused'].includes(wo.status),
      currentTruckMileage: wo.truck.mileage,
      observedMileage: wo.pmService?.observedMileage ?? null,
      lastCompletedPm: lastCompletedPm
        ? {
            workOrderId: lastCompletedPm.workOrderId,
            displayId: lastCompletedPm.workOrder.displayId,
            completedAt: lastCompletedPm.workOrder.completedAt!.toISOString(),
            observedMileage: lastCompletedPm.observedMileage,
          }
        : null,
      categories: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        parts: category.parts
          .filter((part) => this.partFitsTruck(part.fitments, wo.truck))
          .map((part) => ({ id: part.id, partNumber: part.partNumber, displayName: part.displayName })),
      })),
      selections: (wo.pmService?.parts ?? []).map((part) => ({
        partCategoryId: part.partCategoryId,
        partId: part.partId,
      })),
    };
  }

  async updatePmService(user: AuthUser, id: string, raw: unknown) {
    const parsed = updatePmServiceSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    this.assertPmMutationAccess(user);

    await this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUnique({
        where: { id },
        include: { truck: true, primaryCategory: true },
      });
      if (!wo) throw new NotFoundException('Work Order not found');
      if (wo.primaryCategory.name !== 'PM') throw new BadRequestException('Work Order is not a PM service');
      if (!['in_progress', 'waiting_paused'].includes(wo.status)) {
        throw new BadRequestException('Start or resume the PM Work Order before updating service details');
      }

      const selectedParts = await tx.part.findMany({
        where: { id: { in: parsed.data.selections.map((selection) => selection.partId) }, active: true },
        include: { fitments: true },
      });
      if (selectedParts.length !== parsed.data.selections.length || parsed.data.selections.some((selection) =>
        selectedParts.find((part) => part.id === selection.partId)?.categoryId !== selection.partCategoryId,
      )) throw new BadRequestException('Invalid PM part selection');
      if (selectedParts.some((part) => !this.partFitsTruck(part.fitments, wo.truck))) {
        throw new BadRequestException('Selected PM part is not compatible with this truck');
      }

      const service = await tx.pmService.upsert({
        where: { workOrderId: id },
        update: { observedMileage: parsed.data.observedMileage },
        create: { workOrderId: id, observedMileage: parsed.data.observedMileage },
      });
      await tx.pmServicePart.deleteMany({ where: { pmServiceId: service.id } });
      if (parsed.data.selections.length) {
        await tx.pmServicePart.createMany({
          data: parsed.data.selections.map((selection) => ({ ...selection, pmServiceId: service.id })),
        });
      }
      await this.activity.log(tx, {
        workOrderId: wo.id, eventType: ActivityEventType.PM_DETAILS_UPDATED,
        entityType: 'pm_service', entityId: service.id, userId: user.id,
        newValue: { observedMileage: parsed.data.observedMileage, selections: parsed.data.selections },
      });
    });
    return this.getPmService(user, id);
  }

  private assertPmReadAccess(user: AuthUser, categoryName: string) {
    if (categoryName === 'PM' && !user.pmAuthorized && user.role !== 'admin') {
      throw new ForbiddenException('PM Work Orders are available only to Daniel and administrators');
    }
  }

  private assertPmMutationAccess(user: AuthUser) {
    if (!user.pmAuthorized) throw new ForbiddenException('Only Daniel can perform PM work');
  }

  private async assertPmMutationForWorkOrder(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    categoryId: string,
  ) {
    const category = await tx.jobCategory.findUnique({ where: { id: categoryId }, select: { name: true } });
    if (category?.name === 'PM') this.assertPmMutationAccess(user);
  }

  private async requireWo(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const wo = await tx.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('Work Order not found');
    return wo;
  }

  private async closeOpenSession(
    tx: Prisma.TransactionClient,
    workOrderId: string,
    now: Date,
  ) {
    const open = await tx.workSession.findFirst({
      where: { workOrderId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (open) {
      await tx.workSession.update({
        where: { id: open.id },
        data: { endedAt: now },
      });
    }
  }

  private partFitsTruck(
    fitments: Array<{ make: string | null; model: string | null }>,
    truck: { make: string | null; model: string | null },
  ) {
    if (!fitments.length) return true;
    const make = this.normalizeVehicleValue(truck.make);
    const model = this.normalizeVehicleValue(truck.model);
    return fitments.some((fitment) =>
      (!fitment.make || this.normalizeVehicleValue(fitment.make) === make) &&
      (!fitment.model || this.normalizeVehicleValue(fitment.model) === model),
    );
  }

  private normalizeVehicleValue(value: string | null) {
    return value?.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '') ?? '';
  }
}
