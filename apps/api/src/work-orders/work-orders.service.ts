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
  completeJobSchema,
  createWorkOrderSchema,
  pauseWorkOrderSchema,
  reportBlockerSchema,
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
import { stopLaborWhenNoPendingJobs } from './labor-session';
import { hasCapability } from '../auth/capabilities';
import { idempotencyFingerprint } from '../common/idempotency';
import { lockTruckMutation } from '../common/truck-mutation-lock';

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
          { jobs: { some: { assignedMechanicId: user.id } } },
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
    this.assertCanViewWorkOrder(user, wo);
    return toWorkOrderDetail(wo);
  }

  // Managers plan the intervention; mechanics execute it. The core create logic
  // is shared, but a Manager actor skips mechanic-capability requirements, is not
  // auto-assigned as a mechanic, and cannot open a PM service (PM stays in the
  // mechanic flow). This is additive: the mechanic path is unchanged.
  async createByManager(user: AuthUser, raw: unknown) {
    return this.create(user, raw, { actorKind: 'manager' });
  }

  async create(
    user: AuthUser,
    raw: unknown,
    options: { actorKind?: 'mechanic' | 'manager' } = {},
  ) {
    const actorKind = options.actorKind ?? 'mechanic';
    const parsed = createWorkOrderSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input: CreateWorkOrderInput = parsed.data;
    const idempotencyPayloadHash = input.idempotencyKey
      ? idempotencyFingerprint({
          truckId: input.truckId,
          primaryCategoryId: input.primaryCategoryId,
          priority: input.priority,
          notes: input.notes ?? null,
          mechanicIds: [...input.mechanicIds].sort(),
          jobs: input.jobs,
        })
      : null;

    if (input.idempotencyKey) {
      const existing = await this.prisma.workOrder.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: workOrderDetailInclude,
      });
      if (existing) {
        this.assertWorkOrderIdempotency(existing, input.truckId, idempotencyPayloadHash, user.id);
        if (actorKind === 'mechanic') this.assertMechanicAccess(user, existing);
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
    let teamMechanicIds = [...input.mechanicIds];
    if (isPm) {
      if (actorKind === 'manager') {
        throw new BadRequestException(
          'Managers create standard Work Orders; PM stays in the mechanic flow.',
        );
      }
      this.assertCapability(user, AppCapability.MECHANIC_PM, 'PM mechanic');
      if (input.jobs.length) {
        throw new BadRequestException('PM Work Orders do not use jobs');
      }
      if (input.mechanicIds.some((id) => id !== user.id)) {
        throw new BadRequestException('PM Work Orders can only be assigned to their creator');
      }
    } else if (actorKind === 'mechanic') {
      throw new ForbiddenException('Standard Work Orders are created by a Shop Manager.');
    } else if (!input.jobs.length) {
      throw new BadRequestException('At least one job is required for this Work Order');
    } else {
      const jobAssigneeIds = input.jobs
        .map((job) => job.assignedMechanicId)
        .filter((id): id is string => Boolean(id));
      // Team = explicit mechanicIds union per-job assignees so WO membership
      // stays consistent with Job ownership.
      teamMechanicIds = Array.from(new Set([...input.mechanicIds, ...jobAssigneeIds]));
      if (teamMechanicIds.length) {
        const selectedMechanics = await this.prisma.user.findMany({
          where: {
            id: { in: teamMechanicIds },
            active: true,
            capabilities: { some: { capability: 'MECHANIC_STANDARD' } },
          },
          select: { id: true },
        });
        if (selectedMechanics.length !== teamMechanicIds.length) {
          throw new BadRequestException('One or more selected mechanics cannot perform standard work');
        }
      }
      await this.assertStandardJobsUseActiveCategories(input.jobs);
    }

    const preflightOpen = await this.prisma.workOrder.findFirst({
      where: {
        truckId: input.truckId,
        status: { in: OPEN_WORK_ORDER_STATUSES },
      },
      include: workOrderDetailInclude,
    });

    // A Manager is not a mechanic and is never auto-assigned to the Work Order.
    // Mechanics remain auto-assigned as the creator/executor. Team already
    // includes any per-job assignees (unioned above for standard WOs).
    const mechanicIds = actorKind === 'manager'
      ? Array.from(new Set(teamMechanicIds))
      : Array.from(new Set([user.id, ...teamMechanicIds]));

    let wo: Prisma.WorkOrderGetPayload<{ include: typeof workOrderDetailInclude }>;
    try {
      wo = await this.prisma.$transaction(async (tx) => {
        await lockTruckMutation(tx, input.truckId);
        if (input.idempotencyKey && typeof tx.workOrder.findUnique === 'function') {
          const stored = await tx.workOrder.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: workOrderDetailInclude,
          });
          if (stored) {
            this.assertWorkOrderIdempotency(stored, input.truckId, idempotencyPayloadHash, user.id);
            if (actorKind === 'mechanic') this.assertMechanicAccess(user, stored);
            return stored;
          }
        }
        const truckAfterLock = typeof tx.truck?.findUnique === 'function'
          ? await tx.truck.findUnique({ where: { id: input.truckId } })
          : truck;
        if (!truckAfterLock) throw new BadRequestException('Invalid truck');

        const open = typeof tx.workOrder.findFirst === 'function'
          ? await tx.workOrder.findFirst({
              where: {
                truckId: input.truckId,
                status: { in: OPEN_WORK_ORDER_STATUSES },
              },
              include: workOrderDetailInclude,
            })
          : preflightOpen;
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

        const count = typeof tx.workOrder.count === 'function'
          ? await tx.workOrder.count()
          : await this.prisma.workOrder.count();
        const displayId = nextDisplayId(count + 1);
        const startedAt = isPm ? new Date() : null;
        // Keep older unit-test transaction doubles compatible while the real
        // Prisma client always exposes the additive readiness model.
        const activeAssessment = tx.truckReadinessAssessment
          ? await tx.truckReadinessAssessment.findFirst({
              where: { truckId: input.truckId, status: { in: ['under_review', 'ready'] } },
              orderBy: { updatedAt: 'desc' },
              select: { id: true, status: true, version: true, approvedById: true },
            })
          : null;
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
            readinessAssessmentId: activeAssessment?.id,
            idempotencyKey: input.idempotencyKey,
            idempotencyPayloadHash,
            idempotencyActorId: input.idempotencyKey ? user.id : undefined,
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
                assignedMechanicId: actorKind === 'manager' ? job.assignedMechanicId : undefined,
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

        if (activeAssessment?.status === 'ready') {
          await tx.truckReadinessAssessment.update({
            where: { id: activeAssessment.id },
            data: {
              status: 'under_review',
              readyAt: null,
              approvedById: null,
              version: { increment: 1 },
            },
          });
          await this.activity.log(tx, {
            eventType: ActivityEventType.READINESS_APPROVAL_INVALIDATED,
            entityType: 'readiness_assessment',
            entityId: activeAssessment.id,
            userId: user.id,
            previousValue: {
              status: activeAssessment.status,
              version: activeAssessment.version,
              approvedById: activeAssessment.approvedById,
            },
            newValue: { status: 'under_review', approvedById: null },
            relevantValue: { reason: 'work_order_created', workOrderId: created.id },
          });
        }

        return created;
      });
    } catch (error) {
      if (input.idempotencyKey && this.isUniqueViolation(error)) {
        const existing = await this.prisma.workOrder.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: workOrderDetailInclude,
        });
        if (existing) {
          this.assertWorkOrderIdempotency(existing, input.truckId, idempotencyPayloadHash, user.id);
          if (actorKind === 'mechanic') this.assertMechanicAccess(user, existing);
          return toWorkOrderDetail(existing);
        }
      }
      throw error;
    }

    return toWorkOrderDetail(wo);
  }

  private isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private assertWorkOrderIdempotency(
    existing: {
      truckId: string;
      idempotencyPayloadHash: string | null;
      idempotencyActorId: string | null;
    },
    truckId: string,
    payloadHash: string | null,
    actorId: string,
  ) {
    const isLegacy = existing.idempotencyPayloadHash === null && existing.idempotencyActorId === null;
    if (
      existing.truckId !== truckId ||
      (!isLegacy && (
        existing.idempotencyPayloadHash !== payloadHash ||
        existing.idempotencyActorId !== actorId
      ))
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSE',
        message: 'Idempotency key was already used for a different Work Order mutation.',
      });
    }
  }

  async start(user: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      this.assertMechanicAccess(user, wo);
      // LTR-124: labor stops when no Job is pending; a Job added afterwards
      // needs Start Work again on the same In Progress Work Order.
      const restartingLabor = wo.status === 'in_progress'
        && wo.primaryCategory.name !== 'PM'
        && (wo.sessions ?? []).length === 0
        && wo.jobs.some((job) => job.status === 'to_do');
      if (wo.status !== 'created' && !restartingLabor) {
        throw new BadRequestException('Work Order can only be started from created status');
      }
      const now = new Date();
      await tx.workSession.create({
        data: { workOrderId: id, startedAt: now },
      });
      if (restartingLabor) {
        const restarted = await tx.workOrder.update({
          where: { id },
          data: { version: { increment: 1 } },
          include: workOrderDetailInclude,
        });
        await this.activity.log(tx, {
          workOrderId: id,
          eventType: ActivityEventType.WORK_STARTED,
          entityType: 'work_order',
          entityId: id,
          userId: user.id,
          previousValue: { status: 'in_progress', laborRunning: false },
          newValue: { status: 'in_progress', laborRunning: true },
        });
        return toWorkOrderDetail(restarted);
      }
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

  // Manager-first ownership: the Manager pauses/resumes officially. These
  // wrappers reuse the exact mechanic pause/resume mechanics (session close,
  // PauseEvent, totals) but skip the mechanic-assignment check.
  async pauseByManager(user: AuthUser, id: string, raw: unknown) {
    return this.pause(user, id, raw, { managerActor: true });
  }

  async resumeByManager(user: AuthUser, id: string) {
    return this.resume(user, id, { managerActor: true });
  }

  // A mechanic-reported blocker records reason/notes without changing Work Order
  // status. Stored as a closed, zero-duration PauseEvent flagged
  // isOfficialPause=false so it never affects waiting totals or the open-pause
  // lookup used by resume/changePauseReason.
  async reportBlocker(user: AuthUser, id: string, raw: unknown) {
    const parsed = reportBlockerSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.reason === PauseReason.OTHER && !parsed.data.notes?.trim()) {
      throw new BadRequestException('Notes are required when reason is Other');
    }
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      this.assertMechanicAccess(user, wo);
      if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
        throw new BadRequestException('Cannot report a blocker on a closed Work Order');
      }
      const now = new Date();
      await tx.pauseEvent.create({
        data: {
          workOrderId: id,
          reason: parsed.data.reason,
          notes: parsed.data.notes,
          startedAt: now,
          endedAt: now,
          durationMs: 0n,
          isOfficialPause: false,
          reportedById: user.id,
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
        eventType: ActivityEventType.BLOCKER_REPORTED,
        entityType: 'work_order',
        entityId: id,
        userId: user.id,
        newValue: { reason: parsed.data.reason, notes: parsed.data.notes ?? null },
      });
      return toWorkOrderDetail(updated);
    });
  }

  async pause(user: AuthUser, id: string, raw: unknown, options: { managerActor?: boolean } = {}) {
    const parsed = pauseWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.reason === PauseReason.OTHER && !parsed.data.notes?.trim()) {
      throw new BadRequestException('Notes are required when reason is Other');
    }

    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      if (!options.managerActor) {
        this.assertMechanicAccess(user, wo);
        this.assertStandardPlanningDenied(wo, 'Standard pause and resume are Manager-owned.');
      }
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
          isOfficialPause: true,
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
      this.assertStandardPlanningDenied(wo, 'Standard pause and resume are Manager-owned.');
      if (wo.status !== 'waiting_paused') {
        throw new BadRequestException('Work Order is not paused');
      }
      const openPause = await tx.pauseEvent.findFirst({
        where: { workOrderId: id, endedAt: null, isOfficialPause: true },
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
          isOfficialPause: true,
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

  async resume(user: AuthUser, id: string, options: { managerActor?: boolean } = {}) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      if (!options.managerActor) {
        this.assertMechanicAccess(user, wo);
        this.assertStandardPlanningDenied(wo, 'Standard pause and resume are Manager-owned.');
      }
      if (wo.status !== 'waiting_paused') {
        throw new BadRequestException('Only paused Work Orders can be resumed');
      }
      const now = new Date();
      const openPause = await tx.pauseEvent.findFirst({
        where: { workOrderId: id, endedAt: null, isOfficialPause: true },
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

  async addJobByManager(user: AuthUser, id: string, raw: unknown) {
    return this.addJob(user, id, raw, { managerActor: true });
  }

  async addJob(
    user: AuthUser,
    id: string,
    raw: unknown,
    options: { managerActor?: boolean } = {},
  ) {
    const parsed = addJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    if (!options.managerActor) {
      const existingWo = await this.prisma.workOrder.findUnique({
        where: { id },
        include: { primaryCategory: true, mechanics: true, jobs: { select: { assignedMechanicId: true } } },
      });
      if (!existingWo) throw new NotFoundException('Work Order not found');
      this.assertMechanicAccess(user, existingWo);
      this.assertStandardPlanningDenied(existingWo, 'Standard Jobs are added by a Shop Manager.');
    }
    const operation = 'add_job';
    const payloadHash = idempotencyFingerprint({ workOrderId: id, ...input });
    const existing = await this.findAddJobIdempotent(
      input.idempotencyKey,
      id,
      operation,
      payloadHash,
      user.id,
    );
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await this.requireWo(tx, id);
        await lockTruckMutation(tx, initial.truckId);
        const wo = await this.requireWo(tx, id);
        const replay = await this.findAddJobIdempotentInTransaction(
          tx,
          input.idempotencyKey,
          id,
          operation,
          payloadHash,
          user.id,
        );
        if (replay) return replay;
        if (!options.managerActor) this.assertMechanicAccess(user, wo);
        if (wo.primaryCategory.name === 'PM') {
          throw new BadRequestException('PM Work Orders do not use jobs');
        }
        if (wo.status === 'completed' || wo.status === 'cancelled') {
          throw new BadRequestException('Cannot add jobs to a closed Work Order');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const category = await tx.jobCategory.findFirst({
          where: { id: input.categoryId, status: 'active' },
          select: { id: true, name: true },
        });
        if (!category) throw new BadRequestException('Invalid or inactive job category');
        if (category.name === 'PM') {
          throw new BadRequestException('PM jobs must use the PM workflow');
        }
        await this.assertCatalogJobsBelongToCategory([input], input.categoryId, tx);
        const currentJobs = await tx.workOrderJob.findMany({
          where: { workOrderId: id, status: { not: 'cancelled' } },
          select: { catalogJobId: true, displayName: true },
        });
        const duplicate = input.catalogJobId
          ? currentJobs.some((job) => job.catalogJobId === input.catalogJobId)
          : currentJobs.some((job) =>
              !job.catalogJobId &&
              this.normalizeJobName(job.displayName) === this.normalizeJobName(input.displayName),
            );
        if (duplicate) throw new BadRequestException('This job is already on the Work Order');
        const createdJob = await tx.workOrderJob.create({
          data: {
            workOrderId: id,
            catalogJobId: input.catalogJobId,
            categoryId: input.categoryId,
            displayName: input.displayName,
            customDescription: input.customDescription,
            isCustom: !input.catalogJobId,
            reviewStatus: input.catalogJobId ? null : 'pending_review',
            addedById: user.id,
            status: 'to_do',
          },
        });
        const incremented = await tx.workOrder.updateMany({
          where: { id, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const updated = await this.requireWo(tx, id);
        await this.activity.log(tx, {
          workOrderId: id,
          eventType: ActivityEventType.JOB_ADDED,
          entityType: 'work_order_job',
          entityId: createdJob.id,
          userId: user.id,
          newValue: {
            jobId: createdJob.id,
            categoryId: category.id,
            categoryName: category.name,
            catalogJobId: createdJob.catalogJobId,
            displayName: createdJob.displayName,
            isCustom: createdJob.isCustom,
          },
        });
        const result = toWorkOrderDetail(updated);
        await tx.workOrderMutation.create({
          data: {
            idempotencyKey: input.idempotencyKey,
            workOrderId: id,
            operation,
            payloadHash,
            actorId: user.id,
            result: result as unknown as Prisma.InputJsonValue,
          },
        });
        return result;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findAddJobIdempotent(
          input.idempotencyKey,
          id,
          operation,
          payloadHash,
          user.id,
        );
        if (replay) return replay;
      }
      throw error;
    }
  }

  private normalizeJobName(name: string) {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  }

  private assertNoDuplicateJobs(jobs: CreateWorkOrderInput['jobs']) {
    const catalogIds = new Set<string>();
    const names = new Set<string>();
    for (const job of jobs) {
      const normalizedName = this.normalizeJobName(job.displayName);
      const duplicate = job.catalogJobId
        ? catalogIds.has(job.catalogJobId)
        : names.has(normalizedName);
      if (duplicate) {
        throw new BadRequestException('A Work Order cannot contain duplicate jobs');
      }
      if (!job.catalogJobId) names.add(normalizedName);
      if (job.catalogJobId) catalogIds.add(job.catalogJobId);
    }
  }

  private async assertStandardJobsUseActiveCategories(
    jobs: CreateWorkOrderInput['jobs'],
  ) {
    const categoryIds = [...new Set(jobs.map((job) => job.categoryId))];
    const categories = await this.prisma.jobCategory.findMany({
      where: { id: { in: categoryIds }, status: 'active' },
      select: { id: true, name: true },
    });
    if (categories.length !== categoryIds.length || categories.some((item) => item.name === 'PM')) {
      throw new BadRequestException('One or more job categories are invalid or inactive');
    }
    const catalogIds = [...new Set(jobs.flatMap((job) => job.catalogJobId ? [job.catalogJobId] : []))];
    if (!catalogIds.length) return;
    const catalogJobs = await this.prisma.catalogJob.findMany({
      where: { id: { in: catalogIds }, status: 'active' },
      select: { id: true, categoryId: true },
    });
    const categoryByCatalogId = new Map(catalogJobs.map((item) => [item.id, item.categoryId]));
    if (jobs.some((job) => job.catalogJobId && categoryByCatalogId.get(job.catalogJobId) !== job.categoryId)) {
      throw new BadRequestException('One or more catalog jobs do not belong to their declared category');
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

  private versionConflict(message: string) {
    return new ConflictException({ code: 'VERSION_CONFLICT', message });
  }

  private async findAddJobIdempotent(
    key: string,
    workOrderId: string,
    operation: string,
    payloadHash: string,
    actorId: string,
  ) {
    const existing = await this.prisma.workOrderMutation.findUnique({ where: { idempotencyKey: key } });
    return this.assertAddJobIdempotency(existing, workOrderId, operation, payloadHash, actorId);
  }

  private async findAddJobIdempotentInTransaction(
    tx: Prisma.TransactionClient,
    key: string,
    workOrderId: string,
    operation: string,
    payloadHash: string,
    actorId: string,
  ) {
    const existing = await tx.workOrderMutation.findUnique({ where: { idempotencyKey: key } });
    return this.assertAddJobIdempotency(existing, workOrderId, operation, payloadHash, actorId);
  }

  private assertAddJobIdempotency(
    existing: { workOrderId: string; operation: string; payloadHash: string; actorId: string; result: unknown } | null,
    workOrderId: string,
    operation: string,
    payloadHash: string,
    actorId: string,
  ) {
    if (!existing) return null;
    if (
      existing.workOrderId !== workOrderId ||
      existing.operation !== operation ||
      existing.payloadHash !== payloadHash ||
      existing.actorId !== actorId
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSE',
        message: 'Idempotency key was already used for a different Work Order mutation.',
      });
    }
    return existing.result as ReturnType<typeof toWorkOrderDetail>;
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

  async completeJob(user: AuthUser, workOrderId: string, jobId: string, raw: unknown = {}) {
    const parsed = completeJobSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const notes = parsed.data.notes?.trim() || null;

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
      const gate = canCompleteJob(wo.status, (wo.sessions ?? []).length > 0);
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
      await stopLaborWhenNoPendingJobs(tx, workOrderId);
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
        newValue: { displayName: job.displayName, status: 'completed', notes },
      });
      const detail = toWorkOrderDetail(updated);
      return {
        ...detail,
        jobs: detail.jobs.map((item) =>
          item.id === jobId ? { ...item, completionNotes: notes } : item,
        ),
      };
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
      this.assertStandardPlanningDenied(wo, 'Standard Work Orders are completed by a Shop Manager.');
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
    this.assertCanViewWorkOrder(user, wo);

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
            completedAt: { not: null },
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
            completedAt: (lastCompletedPm.workOrder.completedAt ?? lastCompletedPm.workOrder.createdAt).toISOString(),
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

  private assertStandardPlanningDenied(
    wo: { primaryCategory: { name: string } },
    message: string,
  ) {
    if (wo.primaryCategory.name === 'PM') return;
    throw new ForbiddenException(message);
  }

  private isAssigned(
    user: AuthUser,
    wo: {
      createdById: string;
      mechanics?: { mechanicId: string; removedAt: Date | null }[];
      jobs?: { assignedMechanicId?: string | null }[];
    },
  ) {
    return wo.createdById === user.id
      || !!wo.mechanics?.some((assignment) => assignment.mechanicId === user.id && !assignment.removedAt)
      || !!wo.jobs?.some((job) => job.assignedMechanicId === user.id);
  }

  private assertCanViewWorkOrder(
    user: AuthUser,
    wo: {
      createdById: string;
      primaryCategory: { name: string };
      mechanics?: { mechanicId: string; removedAt: Date | null }[];
      jobs?: { assignedMechanicId?: string | null }[];
    },
  ) {
    if (hasCapability(user, AppCapability.ADMIN_ACCESS)) return;
    this.assertMechanicAccess(user, wo);
  }

  private assertMechanicAccess(
    user: AuthUser,
    wo: {
      createdById: string;
      primaryCategory: { name: string };
      mechanics?: { mechanicId: string; removedAt: Date | null }[];
      jobs?: { assignedMechanicId?: string | null }[];
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
