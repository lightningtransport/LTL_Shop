import { randomUUID } from 'node:crypto';
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
  addWorkOrderNoteSchema,
  changePmServiceSchema,
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
import { assertPmObservedMileage } from './pm-mileage.guard';
import { applyPmObservedMileage, assertPmServiceReadyToFinish } from './pm-finish';
import { isPmJobCategory, resolveMandatoryJobs, type MandatoryJob } from './mandatory-jobs';
import { hasCapability } from '../auth/capabilities';
import { idempotencyFingerprint } from '../common/idempotency';
import { lockTruckMutation } from '../common/truck-mutation-lock';

/** Minimal Job shape used for PM job access checks (LTR-146). */
type PmJobLike = {
  id?: string;
  status?: string;
  assignedMechanicId?: string | null;
  category?: { name: string } | null;
};

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
    const pmMode = categoryFilter?.name === 'PM';
    const rows = await this.prisma.workOrder.findMany({
      where: {
        status: { in: ['created', 'in_progress', 'waiting_paused', 'completed'] },
        // LTR-146: the PM workspace also lists truck Work Orders whose PM job is mine.
        ...(pmMode
          ? {
              AND: [{
                OR: [
                  { primaryCategory: categoryFilter },
                  { jobs: { some: { assignedMechanicId: user.id, status: { not: 'cancelled' }, category: { name: 'PM' } } } },
                ],
              }],
            }
          : categoryFilter ? { primaryCategory: categoryFilter } : {}),
        OR: [
          { createdById: user.id },
          { mechanics: { some: { mechanicId: user.id, removedAt: null } } },
          { jobs: { some: { assignedMechanicId: user.id } } },
        ],
      },
      include: workOrderDetailInclude,
      orderBy: { updatedAt: 'desc' },
    });

    // LTR-146: in the PM workspace a truck Work Order is bucketed by its PM job, not the WO status.
    const mapped = rows.map((row) => {
      const summary = toWorkOrderSummary(row);
      const pmJob = pmMode ? this.activePmJob(row) : null;
      if (!pmJob) return summary;
      const status = pmJob.status === 'completed'
        ? 'completed'
        : row.status === 'waiting_paused'
          ? 'waiting_paused'
          : pmJob.startedAt ? 'in_progress' : 'created';
      return { ...summary, status: status as typeof summary.status };
    });
    return {
      // LTR-129: "Ready to start" puts Critical first (then High, Normal, Low; oldest first).
      created: mapped.filter((w) => w.status === 'created').sort(byPriorityThenOldest),
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
      // LTR-147: "Create PM service" joins (or creates) the truck's Work Order.
      return this.createOrJoinPm(user, input);
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

    // LTR-145: PM, Alignment, Detailing and QC are added to every new truck Work Order.
    const categoryNames = new Map(
      (await this.prisma.jobCategory.findMany({
        where: { id: { in: input.jobs.map((job) => job.categoryId) } },
        select: { id: true, name: true },
      })).map((item) => [item.id, item.name]),
    );
    const mandatoryJobs: MandatoryJob[] = await resolveMandatoryJobs(
      this.prisma,
      input.jobs.map((job) => ({ categoryName: categoryNames.get(job.categoryId) ?? '', displayName: job.displayName })),
    );

    const preflightOpen = await this.prisma.workOrder.findFirst({
      where: {
        truckId: input.truckId,
        status: { in: OPEN_WORK_ORDER_STATUSES },
      },
      include: workOrderDetailInclude,
    });

    // Only a Manager reaches here (PM joins via createOrJoinPm). A Manager is not a
    // mechanic and is never auto-assigned; the team already includes per-job assignees.
    const mechanicIds = Array.from(new Set(teamMechanicIds));

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
            status: 'created',
            priority: input.priority,
            notes: input.notes,
            // LTR-126: the creation note is also the first append-only entry.
            noteEntries: input.notes?.trim()
              ? { create: { body: input.notes.trim(), authorId: user.id } }
              : undefined,
            createdById: user.id,
            readinessAssessmentId: activeAssessment?.id,
            idempotencyKey: input.idempotencyKey,
            idempotencyPayloadHash,
            idempotencyActorId: input.idempotencyKey ? user.id : undefined,
            jobs: {
              create: ([] as Prisma.WorkOrderJobUncheckedCreateWithoutWorkOrderInput[]).concat(input.jobs.map((job) => ({
                catalogJobId: job.catalogJobId,
                categoryId: job.categoryId,
                displayName: job.displayName,
                customDescription: job.customDescription,
                isCustom: !job.catalogJobId,
                reviewStatus: job.catalogJobId ? null : 'pending_review',
                addedById: user.id,
                assignedMechanicId: job.assignedMechanicId,
                status: 'to_do' as const,
              })), mandatoryJobs.map((job) => ({
                catalogJobId: job.catalogJobId,
                categoryId: job.categoryId,
                displayName: job.displayName,
                customDescription: undefined,
                isCustom: false,
                reviewStatus: null,
                addedById: user.id,
                assignedMechanicId: undefined,
                status: 'to_do' as const,
              }))),
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
        && !(wo.sessions ?? []).some((session) => session.endedAt === null)
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

  /**
   * LTR-98 / D3: a reported blocker stays active until the assigned mechanic or
   * the Manager resolves it. Does not change Work Order status or timers.
   */
  async resolveBlocker(user: AuthUser, id: string, blockerId: string, options: { managerActor?: boolean } = {}) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      if (!options.managerActor) this.assertMechanicAccess(user, wo);
      const blocker = await tx.pauseEvent.findFirst({
        where: { id: blockerId, workOrderId: id, isOfficialPause: false },
      });
      if (!blocker) throw new NotFoundException('Blocker not found');
      if (blocker.resolvedAt) {
        throw new BadRequestException({ code: 'BLOCKER_ALREADY_RESOLVED', message: 'This blocker is already resolved.' });
      }
      await tx.pauseEvent.update({
        where: { id: blockerId },
        data: { resolvedAt: new Date(), resolvedById: user.id },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.BLOCKER_RESOLVED,
        entityType: 'work_order',
        entityId: id,
        userId: user.id,
        previousValue: { reason: blocker.reason, notes: blocker.notes },
        newValue: { resolved: true, actor: options.managerActor ? 'manager' : 'mechanic' },
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
      // LTR-146 / D2: resuming a PM must not leave the mechanic with two running PMs.
      if (!options.managerActor && wo.primaryCategory.name === 'PM') {
        await this.assertNoOtherRunningPm(tx, user.id, { workOrderId: id });
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
        await this.assertCatalogJobsBelongToCategory([input], input.categoryId, tx);
        const currentJobs = await tx.workOrderJob.findMany({
          where: { workOrderId: id, status: { not: 'cancelled' } },
          select: { catalogJobId: true, displayName: true, category: { select: { name: true } } },
        });
        // LTR-145: one PM job per Work Order (switch A↔B instead of adding a second).
        if (isPmJobCategory(category.name) && currentJobs.some((job) => isPmJobCategory(job.category.name))) {
          throw new BadRequestException({ code: 'PM_JOB_EXISTS', message: 'This Work Order already has a PM job. Change it to PM A or PM B instead.' });
        }
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

  /** LTR-145: the PM job is finished from the PM service (mileage + parts), coming in LTR-146. */
  async assertNotPmJob(tx: Pick<Prisma.TransactionClient, 'jobCategory'>, categoryId: string) {
    const category = await tx.jobCategory.findUnique({ where: { id: categoryId }, select: { name: true } });
    if (isPmJobCategory(category?.name)) {
      throw new BadRequestException({
        code: 'PM_JOB_USES_PM_SERVICE',
        message: 'The PM job is completed from the PM service with observed mileage and parts.',
      });
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
    if (categories.length !== categoryIds.length) {
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

  /**
   * LTR-126 / D8: notes are append-only entries with author and time. Nobody edits
   * or overwrites another person's note. A mechanic "work request" asks the Manager
   * for additional work; the Manager marks it handled after adding the Job.
   */
  async addNote(user: AuthUser, id: string, raw: unknown, options: { managerActor?: boolean } = {}) {
    const parsed = addWorkOrderNoteSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      if (!options.managerActor) this.assertMechanicAccess(user, wo);
      if (wo.status === 'completed' || wo.status === 'cancelled') {
        throw new BadRequestException({ code: 'WORK_ORDER_CLOSED', message: 'Notes cannot be added to a closed Work Order.' });
      }
      const note = await tx.workOrderNote.create({
        data: { workOrderId: id, kind: parsed.data.kind, body: parsed.data.body, authorId: user.id },
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.NOTE_ADDED,
        entityType: 'work_order_note',
        entityId: note.id,
        userId: user.id,
        newValue: { kind: note.kind, body: note.body, actor: options.managerActor ? 'manager' : 'mechanic' },
      });
      // Notes do not change Work Order state, so the version is not bumped
      // (a Manager editing priority must not get a conflict from a new note).
      const updated = await tx.workOrder.findUniqueOrThrow({ where: { id }, include: workOrderDetailInclude });
      return toWorkOrderDetail(updated);
    });
  }

  /** LTR-126: the Manager marks a mechanic work request as handled. */
  async handleWorkRequest(user: AuthUser, id: string, noteId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.workOrderNote.findFirst({
        where: { id: noteId, workOrderId: id, kind: 'work_request' },
      });
      if (!request) throw new NotFoundException('Work request not found');
      if (request.handledAt) {
        throw new BadRequestException({ code: 'WORK_REQUEST_ALREADY_HANDLED', message: 'This work request is already handled.' });
      }
      await tx.workOrderNote.update({
        where: { id: noteId },
        data: { handledAt: new Date(), handledById: user.id },
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.WORK_REQUEST_HANDLED,
        entityType: 'work_order_note',
        entityId: noteId,
        userId: user.id,
        previousValue: { body: request.body },
        newValue: { handled: true },
      });
    });
  }


  async completeJob(user: AuthUser, workOrderId: string, jobId: string, raw: unknown = {}) {
    const parsed = completeJobSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const notes = parsed.data.notes?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, workOrderId);
      // LTR-146: the PM job is finished from the PM service by its PM mechanic.
      if (this.activePmJob(wo)?.id === jobId) {
        return this.completePmJobInTx(tx, user, wo, jobId, notes);
      }
      this.assertMechanicAccess(user, wo);
      const category = await tx.jobCategory.findUnique({
        where: { id: wo.primaryCategoryId },
        select: { name: true },
      });
      if (category?.name === 'PM') {
        throw new BadRequestException('PM Work Orders do not use jobs');
      }
      const gate = canCompleteJob(wo.status, (wo.sessions ?? []).some((session) => session.endedAt === null));
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
      await this.assertNotPmJob(tx, job.categoryId);
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

  /**
   * LTR-147: "Create PM service" never makes a separate PM Work Order.
   * - Truck with an open Work Order: add PM A if it has no PM job, then claim and start it.
   * - Truck without one: create the truck Work Order (Inspection + mandatory jobs) and start its PM job.
   * A legacy PM Work Order still open on the truck keeps the old conflict.
   */
  private async createOrJoinPm(user: AuthUser, input: CreateWorkOrderInput): Promise<ReturnType<typeof toWorkOrderDetail>> {
    const open = await this.prisma.workOrder.findFirst({
      where: { truckId: input.truckId, status: { in: OPEN_WORK_ORDER_STATUSES } },
      include: workOrderDetailInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (open && isPmJobCategory(open.primaryCategory.name)) {
      throw new ConflictException({ code: 'OPEN_WORK_ORDER_EXISTS', message: 'Truck already has an open Work Order.' });
    }
    const openPmJob = open ? this.activePmJob(open) : null;
    if (open && openPmJob?.status === 'completed') {
      throw new ConflictException({ code: 'PM_JOB_DONE', message: `The PM of ${open.displayId} is already done.`, displayId: open.displayId });
    }
    if (open && openPmJob?.assignedMechanicId === user.id && openPmJob.startedAt) {
      return toWorkOrderDetail(open);
    }
    // D2 before anything is created or added, so a refused PM leaves no half-made Work Order.
    await this.prisma.$transaction((tx) => this.assertNoOtherRunningPm(tx, user.id));
    const pmCatalogJob = await this.prisma.catalogJob.findFirst({
      where: { displayName: 'PM A Service', status: 'active', category: { name: 'PM', status: 'active' } },
      select: { id: true, categoryId: true, displayName: true },
    });

    let workOrderId: string;
    let pmJobId: string | undefined;
    if (!open) {
      const inspection = await this.prisma.jobCategory.findFirst({ where: { name: 'Inspection', status: 'active' }, select: { id: true } });
      if (!inspection || !pmCatalogJob) throw new BadRequestException('The Inspection and PM catalog must be seeded before creating a PM service');
      // Created as a truck Work Order: PM A now, Alignment / Detailing / QC via the mandatory jobs.
      const created = (await this.create(user, {
        truckId: input.truckId,
        primaryCategoryId: inspection.id,
        priority: input.priority,
        mechanicIds: [],
        jobs: [{ categoryId: pmCatalogJob.categoryId, catalogJobId: pmCatalogJob.id, displayName: pmCatalogJob.displayName }],
        idempotencyKey: input.idempotencyKey,
      }, { actorKind: 'manager' })) as ReturnType<typeof toWorkOrderDetail>;
      workOrderId = created.id;
      pmJobId = created.jobs.find((job) => isPmJobCategory(job.category.name))?.id;
    } else {
      workOrderId = open.id;
      const existing = openPmJob;
      if (existing) {
        pmJobId = existing.id;
      } else {
        if (!pmCatalogJob) throw new BadRequestException('The PM catalog must be seeded before creating a PM service');
        const updated = await this.addJobByManager(user, open.id, {
          categoryId: pmCatalogJob.categoryId,
          catalogJobId: pmCatalogJob.id,
          displayName: pmCatalogJob.displayName,
          expectedVersion: open.version,
          idempotencyKey: randomUUID(),
        });
        pmJobId = updated.jobs.find((job) => isPmJobCategory(job.category.name) && job.status !== 'cancelled')?.id;
      }
    }
    if (!pmJobId) throw new BadRequestException('The PM job could not be prepared');
    return this.startPmJob(user, workOrderId, pmJobId);
  }

  /** LTR-148: the assigned PM mechanic switches the PM job between PM A and PM B before finishing it. */
  async changePmService(user: AuthUser, id: string, jobId: string, raw: unknown) {
    const parsed = changePmServiceSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      const job = this.pmJobForUser(user, wo);
      if (!job || job.id !== jobId) throw new ForbiddenException('This PM job is not assigned to you.');
      if (job.status !== 'to_do') throw new BadRequestException('Job is not in To Do status');
      const target = await tx.catalogJob.findFirst({
        where: { id: parsed.data.catalogJobId, status: 'active', categoryId: job.categoryId },
        select: { id: true, displayName: true },
      });
      if (!target) throw new BadRequestException('Choose an active PM service from the catalog');
      if (target.id === job.catalogJobId) return toWorkOrderDetail(wo);
      await tx.workOrderJob.update({ where: { id: jobId }, data: { catalogJobId: target.id, displayName: target.displayName } });
      const updated = await tx.workOrder.update({
        where: { id },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.PM_DETAILS_UPDATED,
        entityType: 'work_order_job',
        entityId: jobId,
        userId: user.id,
        previousValue: { catalogJobId: job.catalogJobId, displayName: job.displayName },
        newValue: { action: 'pm_service_changed', catalogJobId: target.id, displayName: target.displayName },
      });
      return toWorkOrderDetail(updated);
    });
  }

  /** LTR-146: the PM mechanic starts (or claims and starts) the PM job of a truck Work Order. */
  async startPmJob(user: AuthUser, id: string, jobId: string) {
    this.assertCapability(user, AppCapability.MECHANIC_PM, 'PM mechanic');
    return this.prisma.$transaction(async (tx) => {
      const initial = await this.requireWo(tx, id);
      await lockTruckMutation(tx, initial.truckId);
      const wo = await this.requireWo(tx, id);
      const job = wo.jobs.find((item) => item.id === jobId);
      if (!job) throw new NotFoundException('Job not found');
      if (this.activePmJob(wo)?.id !== jobId) throw new BadRequestException('This is not the PM job of this Work Order');
      if (job.status !== 'to_do') throw new BadRequestException('The PM job is not to do');
      if (job.startedAt) throw new BadRequestException({ code: 'PM_JOB_ALREADY_STARTED', message: 'The PM service is already started.' });
      if (job.assignedMechanicId && job.assignedMechanicId !== user.id) {
        throw new ForbiddenException({
          code: 'PM_JOB_ASSIGNED_TO_OTHER',
          message: `This PM job is assigned to ${job.assignedMechanic?.name ?? 'another PM mechanic'}.`,
        });
      }
      if (!['created', 'in_progress'].includes(wo.status)) {
        throw new BadRequestException({ code: 'WORK_ORDER_NOT_WORKABLE', message: 'The Work Order is paused or closed.' });
      }
      await this.assertNoOtherRunningPm(tx, user.id, { jobId });
      const now = new Date();
      await tx.workOrderJob.update({ where: { id: jobId }, data: { startedAt: now, assignedMechanicId: user.id } });
      await tx.pmService.upsert({
        where: { workOrderId: id },
        update: { workOrderJobId: jobId },
        create: { workOrderId: id, workOrderJobId: jobId },
      });
      const updated = await tx.workOrder.update({
        where: { id },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.WORK_STARTED,
        entityType: 'work_order_job',
        entityId: jobId,
        userId: user.id,
        newValue: { pmJob: true, displayName: job.displayName, startedAt: now.toISOString() },
      });
      return toWorkOrderDetail(updated);
    });
  }

  /** LTR-146: finishing the PM job records the PM service (mileage + parts); it does not complete the Work Order. */
  private async completePmJobInTx(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    wo: Awaited<ReturnType<WorkOrdersService['requireWo']>>,
    jobId: string,
    notes: string | null,
  ) {
    const job = this.pmJobForUser(user, wo);
    if (!job || job.id !== jobId) throw new ForbiddenException('This PM job is not assigned to you.');
    if (job.status !== 'to_do') throw new BadRequestException('Job is not in To Do status');
    if (!job.startedAt) throw new BadRequestException({ code: 'PM_JOB_NOT_STARTED', message: 'Start the PM service first.' });
    if (!['created', 'in_progress'].includes(wo.status)) {
      throw new BadRequestException({ code: 'WORK_ORDER_NOT_WORKABLE', message: 'The Work Order is paused or closed.' });
    }
    const pmService = await tx.pmService.findUnique({ where: { workOrderId: wo.id }, include: { parts: true } });
    const observedMileage = assertPmServiceReadyToFinish(pmService, wo.truck.mileage);
    await applyPmObservedMileage(tx, this.activity, {
      truckId: wo.truckId, workOrderId: wo.id, currentMileage: wo.truck.mileage, observedMileage, userId: user.id,
    });
    await tx.workOrderJob.update({
      where: { id: jobId },
      data: { status: 'completed', completedAt: new Date(), completedById: user.id },
    });
    await stopLaborWhenNoPendingJobs(tx, wo.id);
    const updated = await tx.workOrder.update({
      where: { id: wo.id },
      data: { version: { increment: 1 } },
      include: workOrderDetailInclude,
    });
    await this.activity.log(tx, {
      workOrderId: wo.id,
      eventType: ActivityEventType.JOB_COMPLETED,
      entityType: 'work_order_job',
      entityId: jobId,
      userId: user.id,
      newValue: {
        displayName: job.displayName, status: 'completed', notes,
        pmService: { observedMileage, parts: pmService?.parts.length ?? 0 },
      },
    });
    const detail = toWorkOrderDetail(updated);
    return { ...detail, jobs: detail.jobs.map((item) => (item.id === jobId ? { ...item, completionNotes: notes } : item)) };
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
      let pmObservedMileage: number | null = null;
      if (isPm) {
        pmObservedMileage = assertPmServiceReadyToFinish(wo.pmService, wo.truck.mileage);
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

      if (isPm && pmObservedMileage != null) {
        await applyPmObservedMileage(tx, this.activity, {
          truckId: wo.truckId, workOrderId: wo.id, currentMileage: wo.truck.mileage,
          observedMileage: pmObservedMileage, userId: user.id,
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
        jobs: { include: { category: { select: { name: true } } } },
      },
    });
    if (!wo) throw new NotFoundException('Work Order not found');
    // LTR-146: a truck Work Order with a PM job uses the same PM service screen.
    const pmJob = this.activePmJob(wo);
    if (wo.primaryCategory.name !== 'PM' && !pmJob) throw new BadRequestException('Work Order is not a PM service');
    this.assertCanViewWorkOrder(user, wo);
    const serviceCompletedAt = pmJob
      ? pmJob.completedAt
      : wo.status === 'completed' ? wo.completedAt : null;

    const [categories, lastCompletedPmCandidates] = await Promise.all([
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
      this.prisma.pmService.findMany({
        where: {
          workOrderId: { not: wo.id },
          workOrder: { truckId: wo.truckId },
          OR: [
            { workOrder: { primaryCategory: { name: 'PM' }, status: 'completed' } },
            { workOrderJob: { status: 'completed' } },
          ],
        },
        include: { workOrder: true, workOrderJob: true },
      }),
    ]);
    // LTR-137 / LTR-146: the previous PM is the latest one finished before this service.
    const previous = lastCompletedPmCandidates
      .map((service) => ({
        service,
        completedAt: service.workOrderJob?.completedAt ?? service.workOrder.completedAt ?? service.workOrder.createdAt,
      }))
      .filter((item) => !serviceCompletedAt || item.completedAt < serviceCompletedAt)
      .sort((left, right) => right.completedAt.getTime() - left.completedAt.getTime())[0] ?? null;

    return {
      workOrderId: wo.id,
      canEdit: pmJob
        ? Boolean(this.pmJobForUser(user, wo)) && Boolean(pmJob.startedAt) && pmJob.status === 'to_do'
          && ['created', 'in_progress'].includes(wo.status)
        : hasCapability(user, AppCapability.MECHANIC_PM) &&
          this.isAssigned(user, wo) &&
          ['in_progress', 'waiting_paused'].includes(wo.status),
      currentTruckMileage: wo.truck.mileage,
      observedMileage: wo.pmService?.observedMileage ?? null,
      serviceCompletedAt: serviceCompletedAt ? serviceCompletedAt.toISOString() : null,
      lastCompletedPm: previous
        ? {
            workOrderId: previous.service.workOrderId,
            displayId: previous.service.workOrder.displayId,
            completedAt: previous.completedAt.toISOString(),
            observedMileage: previous.service.observedMileage,
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
        include: {
          truck: true, primaryCategory: true, mechanics: true,
          jobs: { include: { category: { select: { name: true } } } },
        },
      });
      if (!wo) throw new NotFoundException('Work Order not found');
      const pmJob = this.activePmJob(wo);
      if (wo.primaryCategory.name !== 'PM' && !pmJob) throw new BadRequestException('Work Order is not a PM service');
      if (pmJob) {
        // LTR-146: only the assigned PM mechanic edits a started, unfinished PM job.
        if (!this.pmJobForUser(user, wo)) throw new ForbiddenException('This PM job is not assigned to you.');
        if (!pmJob.startedAt || pmJob.status !== 'to_do' || !['created', 'in_progress'].includes(wo.status)) {
          throw new BadRequestException('Start the PM service before updating service details');
        }
      } else {
        this.assertMechanicAccess(user, wo);
        if (!['in_progress', 'waiting_paused'].includes(wo.status)) {
          throw new BadRequestException('Start or resume the PM Work Order before updating service details');
        }
      }
      assertPmObservedMileage(parsed.data.observedMileage, wo.truck.mileage, {
        confirmLargeJump: parsed.data.confirmLargeMileageJump === true,
      });

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
        create: { workOrderId: id, observedMileage: parsed.data.observedMileage, workOrderJobId: pmJob?.id ?? null },
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
      jobs?: PmJobLike[];
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
      jobs?: PmJobLike[];
    },
  ) {
    if (hasCapability(user, AppCapability.ADMIN_ACCESS)) return;
    // LTR-146: the PM mechanic assigned to the PM job can open the truck Work Order.
    if (this.pmJobForUser(user, wo)) return;
    this.assertMechanicAccess(user, wo);
  }

  /** LTR-146: the one active PM job of a truck Work Order (never a legacy PM Work Order). */
  private activePmJob<J extends PmJobLike>(wo: { primaryCategory: { name: string }; jobs?: J[] }): J | null {
    if (isPmJobCategory(wo.primaryCategory.name)) return null;
    return wo.jobs?.find((job) => job.status !== 'cancelled' && isPmJobCategory(job.category?.name)) ?? null;
  }

  /** LTR-146: the PM job when this user is the PM mechanic assigned to it. */
  private pmJobForUser<J extends PmJobLike>(user: AuthUser, wo: { primaryCategory: { name: string }; jobs?: J[] }): J | null {
    const job = this.activePmJob(wo);
    if (!job || !hasCapability(user, AppCapability.MECHANIC_PM)) return null;
    return job.assignedMechanicId === user.id ? job : null;
  }

  /**
   * LTR-95 / D2: a PM mechanic runs one PM at a time — a legacy PM Work Order in
   * progress or a started PM job. A paused PM (official pause) does not count.
   */
  private async assertNoOtherRunningPm(
    tx: Pick<Prisma.TransactionClient, 'workOrder' | 'workOrderJob'>,
    userId: string,
    except: { workOrderId?: string; jobId?: string } = {},
  ) {
    const legacy = typeof tx.workOrder?.findFirst === 'function'
      ? await tx.workOrder.findFirst({
          where: {
            status: 'in_progress',
            primaryCategory: { name: 'PM' },
            mechanics: { some: { mechanicId: userId, removedAt: null } },
            ...(except.workOrderId ? { id: { not: except.workOrderId } } : {}),
          },
          select: { id: true, displayId: true },
        })
      : null;
    const job = !legacy && typeof tx.workOrderJob?.findFirst === 'function'
      ? await tx.workOrderJob.findFirst({
          where: {
            assignedMechanicId: userId,
            status: 'to_do',
            startedAt: { not: null },
            category: { name: 'PM' },
            workOrder: { status: { in: ['created', 'in_progress'] } },
            ...(except.jobId ? { id: { not: except.jobId } } : {}),
          },
          select: { workOrder: { select: { id: true, displayId: true } } },
        })
      : null;
    const running = legacy ?? job?.workOrder ?? null;
    if (running) {
      throw new ConflictException({
        code: 'PM_ALREADY_IN_PROGRESS',
        message: `Finish or pause ${running.displayId} before starting another PM service.`,
        runningWorkOrderId: running.id,
        runningDisplayId: running.displayId,
      });
    }
  }

  private assertMechanicAccess(
    user: AuthUser,
    wo: {
      createdById: string;
      primaryCategory: { name: string };
      mechanics?: { mechanicId: string; removedAt: Date | null }[];
      jobs?: PmJobLike[];
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

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export function byPriorityThenOldest(
  left: { priority: string; createdAt: string },
  right: { priority: string; createdAt: string },
) {
  const byPriority = (PRIORITY_RANK[left.priority] ?? 9) - (PRIORITY_RANK[right.priority] ?? 9);
  return byPriority || left.createdAt.localeCompare(right.createdAt);
}
