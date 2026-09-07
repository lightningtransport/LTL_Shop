import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppCapability,
  ActivityEventType,
  MechanicMode,
  OPEN_WORK_ORDER_STATUSES,
  PauseReason,
  addJobSchema,
  changePauseReasonSchema,
  createWorkOrderSchema,
  pauseWorkOrderSchema,
  updateWorkOrderNotesSchema,
  updatePmServiceSchema,
  mechanicModeSchema,
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
import { hasCapability } from '../auth/capabilities';

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async listForMechanic(user: AuthUser, rawMode?: string) {
    const parsedMode = rawMode === undefined ? null : mechanicModeSchema.safeParse(rawMode);
    if (parsedMode && !parsedMode.success) {
      throw new BadRequestException('Invalid mechanic workspace mode');
    }
    const mode = parsedMode?.success ? parsedMode.data : null;
    const canStandard = hasCapability(user, AppCapability.MECHANIC_STANDARD);
    const canPm = hasCapability(user, AppCapability.MECHANIC_PM);
    if ((mode === MechanicMode.STANDARD && !canStandard) || (mode === MechanicMode.PM && !canPm)) {
      throw new ForbiddenException('You do not have access to this mechanic workspace.');
    }
    if (!mode && !canStandard && !canPm) {
      throw new ForbiddenException('You do not have access to a mechanic workspace.');
    }

    const categoryFilter = mode === MechanicMode.STANDARD || (!mode && canStandard && !canPm)
      ? { name: { not: 'PM' } }
      : mode === MechanicMode.PM || (!mode && canPm && !canStandard)
        ? { name: 'PM' }
        : undefined;
    const rows = await this.prisma.workOrder.findMany({
      where: {
        status: { in: ['created', 'in_progress', 'waiting_paused', 'completed'] },
        ...(categoryFilter ? { primaryCategory: categoryFilter } : {}),
        OR: [
          { createdById: user.id },
          { mechanics: { some: { mechanicId: user.id, removedAt: null } } },
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
    this.assertMechanicAccess(user, wo);
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
      if (existing) {
        this.assertMechanicAccess(user, existing);
        return toWorkOrderDetail(existing);
      }
    }

    this.assertNoDuplicateJobs(input.jobs);

    const truck = await this.prisma.truck.findUnique({
      where: { id: input.truckId },
    });
    if (!truck) throw new BadRequestException('Invalid truck');

    const category = await this.prisma.jobCategory.findUnique({
      where: { id: input.primaryCategoryId },
    });
    if (!category) throw new BadRequestException('Invalid primary category');

    const isPm = category.name === 'PM';
    if (isPm) {
      this.assertCapability(user, AppCapability.MECHANIC_PM, 'PM mechanic');
      if (input.jobs.length) {
        throw new BadRequestException('PM Work Orders do not use jobs');
      }
      if (input.mechanicIds.some((id) => id !== user.id)) {
        throw new BadRequestException('PM Work Orders can only be assigned to their creator');
      }
    } else if (!input.jobs.length) {
      throw new BadRequestException('At least one job is required for this Work Order');
    } else {
      this.assertCapability(user, AppCapability.MECHANIC_STANDARD, 'standard mechanic');
      if (!input.mechanicIds.length) {
        // The creator is assigned below.
      } else {
        const selectedMechanics = await this.prisma.user.findMany({
          where: {
            id: { in: input.mechanicIds },
            active: true,
            capabilities: { some: { capability: 'MECHANIC_STANDARD' } },
          },
          select: { id: true },
        });
        if (selectedMechanics.length !== new Set(input.mechanicIds).size) {
          throw new BadRequestException('One or more selected mechanics cannot perform standard work');
        }
      }
      if (input.jobs.some((job) => job.categoryId !== category.id)) {
        throw new BadRequestException('All jobs must belong to the Work Order category');
      }
      await this.assertCatalogJobsBelongToCategory(input.jobs, category.id);
    }

    const open = await this.prisma.workOrder.findFirst({
      where: {
        truckId: input.truckId,
        status: { in: OPEN_WORK_ORDER_STATUSES },
      },
      include: workOrderDetailInclude,
    });
    if (open) {
      const openCapability = open.primaryCategory.name === 'PM'
        ? AppCapability.MECHANIC_PM
        : AppCapability.MECHANIC_STANDARD;
      const canSeeOpenWorkOrder = hasCapability(user, openCapability) && this.isAssigned(user, open);
      throw new ConflictException({
        code: 'OPEN_WORK_ORDER_EXISTS',
        message: 'Truck already has an open Work Order.',
        ...(canSeeOpenWorkOrder ? { workOrder: toWorkOrderSummary(open) } : {}),
      });
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
          // A new PM service starts immediately for its authorized creator. Existing
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
      this.assertMechanicAccess(user, wo);
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
      this.assertMechanicAccess(user, wo);
      if (wo.status !== 'in_progress') {
        throw new BadRequestException('Only in-progress Work Orders can be paused');
      }
      if (wo.primaryCategory.name !== 'PM' && !wo.jobs.some((job) => job.status === 'to_do')) {
        throw new BadRequestException('A Work Order without pending jobs cannot be paused');
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
      this.assertMechanicAccess(user, wo);
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
      this.assertMechanicAccess(user, wo);
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
      this.assertMechanicAccess(user, wo);
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
      const currentJobs = await tx.workOrderJob.findMany({
        where: {
          workOrderId: id,
          status: { not: 'cancelled' },
        },
        select: { catalogJobId: true, displayName: true },
      });
      const duplicate = currentJobs.some((job) =>
        (parsed.data.catalogJobId && job.catalogJobId === parsed.data.catalogJobId) ||
        this.normalizeJobName(job.displayName) === this.normalizeJobName(parsed.data.displayName),
      );
      if (duplicate) {
        throw new BadRequestException('This job is already on the Work Order');
      }
      if (parsed.data.categoryId !== wo.primaryCategoryId) {
        throw new BadRequestException('Jobs must belong to the Work Order category');
      }
      await this.assertCatalogJobsBelongToCategory([parsed.data], wo.primaryCategoryId, tx);
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

  private normalizeJobName(name: string) {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  }

  private assertNoDuplicateJobs(jobs: CreateWorkOrderInput['jobs']) {
    const catalogIds = new Set<string>();
    const names = new Set<string>();
    for (const job of jobs) {
      const normalizedName = this.normalizeJobName(job.displayName);
      if (names.has(normalizedName) || (job.catalogJobId && catalogIds.has(job.catalogJobId))) {
        throw new BadRequestException('A Work Order cannot contain duplicate jobs');
      }
      names.add(normalizedName);
      if (job.catalogJobId) catalogIds.add(job.catalogJobId);
    }
  }

  private async assertCatalogJobsBelongToCategory(
    jobs: Array<{ catalogJobId?: string }>,
    categoryId: string,
    client: Pick<PrismaService, 'catalogJob'> = this.prisma,
  ) {
    const ids = [...new Set(jobs.flatMap((job) => job.catalogJobId ? [job.catalogJobId] : []))];
    if (!ids.length) return;
    const matching = await client.catalogJob.findMany({
      where: { id: { in: ids }, categoryId, status: 'active' },
      select: { id: true },
    });
    if (matching.length !== ids.length) {
      throw new BadRequestException('One or more catalog jobs do not belong to the Work Order category');
    }
  }

  async updateNotes(user: AuthUser, id: string, raw: unknown) {
    const parsed = updateWorkOrderNotesSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      this.assertMechanicAccess(user, wo);
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
      this.assertMechanicAccess(user, wo);
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
          mechanics: true,
        },
      });
      if (!wo) throw new NotFoundException('Work Order not found');
      this.assertMechanicAccess(user, wo);
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
      include: {
        truck: true,
        primaryCategory: true,
        pmService: { include: { parts: true } },
        mechanics: true,
      },
    });
    if (!wo) throw new NotFoundException('Work Order not found');
    if (wo.primaryCategory.name !== 'PM') throw new BadRequestException('Work Order is not a PM service');
    this.assertMechanicAccess(user, wo);

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
        hasCapability(user, AppCapability.MECHANIC_PM) &&
        this.isAssigned(user, wo) &&
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
    await this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUnique({
        where: { id },
        include: { truck: true, primaryCategory: true, mechanics: true },
      });
      if (!wo) throw new NotFoundException('Work Order not found');
      if (wo.primaryCategory.name !== 'PM') throw new BadRequestException('Work Order is not a PM service');
      this.assertMechanicAccess(user, wo);
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

  private assertCapability(user: AuthUser, capability: AppCapability, workspace: string) {
    if (!hasCapability(user, capability)) {
      throw new ForbiddenException(`You do not have access to the ${workspace} workspace.`);
    }
  }

  private isAssigned(
    user: AuthUser,
    wo: { createdById: string; mechanics?: { mechanicId: string; removedAt: Date | null }[] },
  ) {
    return wo.createdById === user.id ||
      !!wo.mechanics?.some((assignment) => assignment.mechanicId === user.id && !assignment.removedAt);
  }

  private assertMechanicAccess(
    user: AuthUser,
    wo: {
      createdById: string;
      primaryCategory: { name: string };
      mechanics?: { mechanicId: string; removedAt: Date | null }[];
    },
  ) {
    const isPm = wo.primaryCategory.name === 'PM';
    this.assertCapability(
      user,
      isPm ? AppCapability.MECHANIC_PM : AppCapability.MECHANIC_STANDARD,
      isPm ? 'PM mechanic' : 'standard mechanic',
    );
    if (!this.isAssigned(user, wo)) {
      throw new ForbiddenException('This Work Order is not assigned to you.');
    }
  }

  private async requireWo(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const wo = await tx.workOrder.findUnique({ where: { id }, include: workOrderDetailInclude });
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
