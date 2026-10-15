import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppCapability,
  ActivityEventType,
  partFitsTruck,
  MechanicMode,
  WorkPlanJobLane,
  OPEN_WORK_ORDER_STATUSES,
  BlockerReason,
  PauseReason,
  addJobSchema,
  completeJobSchema,
  createWorkOrderSchema,
  pauseWorkOrderSchema,
  reportBlockerSchema,
  addBlockerNoteSchema,
  resolveBlockerSchema,
  addWorkOrderNoteSchema,
  changePmServiceSchema,
  updatePmServiceSchema,
  mechanicModeSchema,
  type CreateWorkOrderInput,
} from '@ltl-shop/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { closeActiveAssessments } from '../admin/readiness-visit';
import {
  toWorkOrderDetail,
  toWorkOrderSummary,
  workOrderDetailInclude,
} from './work-order.mapper';
import {
  canCompleteJob,
  nextDisplayId,
} from './work-order.timing';
import type { AuthUser } from '../auth/auth.guard';
import { openSessionFor, stopLaborForMechanic } from './labor-session';
import { LaborClockService } from './labor-clock.service';
import { assertPmObservedMileage } from './pm-mileage.guard';
import { applyPmObservedMileage, assertPmServiceReadyToFinish } from './pm-finish';
import { isPmJobCategory, resolveMandatoryJobs, type MandatoryJob } from './mandatory-jobs';
import { joinWorkOrderTeam } from './work-order-team';
import { classifyWorkPlanLane } from '../admin/yard-work-plan-derivation';
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

/**
 * P21 / D38: the mechanic's lists bring closed Work Orders from this many days back. Before, every closed Work
 * Order the mechanic could see came back with its full detail on every load and every poll, forever.
 */
export const MECHANIC_COMPLETED_WINDOW_DAYS = 30;

export function mechanicCompletedSince(now: Date = new Date()): Date {
  return new Date(now.getTime() - MECHANIC_COMPLETED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    // LTR-186 / D20, D21: day close and one clock per mechanic. Optional so unit specs that build
    // the service by hand keep working; Nest always injects it.
    private readonly clock?: LaborClockService,
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
    // LTR-186 / D20: close yesterday's clocks before showing them.
    await this.clock?.closeDue();
    // PF9: my clock and the rows do not depend on each other; one round trip instead of two.
    const [clockElsewhere, rows] = await Promise.all([
      this.clock?.clockOf(user.id),
      this.prisma.workOrder.findMany({
      where: {
        status: { in: ['created', 'in_progress', 'waiting_paused', 'completed'] },
        // P21 / D38: closed Work Orders only from the last MECHANIC_COMPLETED_WINDOW_DAYS days; open ones always.
        NOT: { status: 'completed', completedAt: { lt: mechanicCompletedSince() } },
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
        // LTR-154 / D11: a mechanic sees a truck Work Order only through a Job assigned to them.
        // Legacy PM Work Orders (no jobs) keep creator/team membership.
        OR: [
          { jobs: { some: { assignedMechanicId: user.id, status: { not: 'cancelled' } } } },
          {
            primaryCategory: { name: 'PM' },
            OR: [
              { createdById: user.id },
              { mechanics: { some: { mechanicId: user.id, removedAt: null } } },
            ],
          },
        ],
      },
      include: workOrderDetailInclude,
      orderBy: { updatedAt: 'desc' },
      }),
    ]);

    // LTR-146: in the PM workspace a truck Work Order is bucketed by its PM job, not the WO status.
    const mapped = rows.map((row) => {
      const summary = toWorkOrderSummary(row, user.id, { clockElsewhere });
      const pmJob = pmMode ? this.activePmJob(row) : null;
      if (!pmJob) return summary;
      const status = pmJob.status === 'completed'
        ? 'completed'
        : row.status === 'waiting_paused'
          ? 'waiting_paused'
          : pmJob.startedAt ? 'in_progress' : 'created';
      // LTR-164 (#10): the bucket follows the PM job; the card still shows the real Work Order status.
      return { ...summary, status: status as typeof summary.status, workOrderStatus: row.status };
    });
    if (pmMode && mapped.length) await this.addPmListDetails(mapped);
    return {
      // Stage MG-1 (MG1): where my clock runs now, and since when — the clock strip on every mechanic screen.
      myClock: clockElsewhere
        ? { workOrderId: clockElsewhere.id, displayId: clockElsewhere.displayId, truckNumber: clockElsewhere.truckNumber, since: clockElsewhere.since }
        : null,
      // LTR-129: "Ready to start" puts Critical first (then High, Normal, Low; oldest first).
      created: mapped.filter((w) => w.status === 'created').sort(byPriorityThenOldest),
      active: mapped.filter((w) => w.status === 'in_progress'),
      paused: mapped.filter((w) => w.status === 'waiting_paused'),
      completed: mapped.filter((w) => w.status === 'completed'),
    };
  }

  async getById(user: AuthUser, id: string) {
    await this.clock?.closeDue();
    // PF9: the Work Order and my clock elsewhere load together.
    const [wo, clockElsewhere] = await Promise.all([
      this.prisma.workOrder.findUnique({
        where: { id },
        include: workOrderDetailInclude,
      }),
      this.clock?.clockOf(user.id),
    ]);
    if (!wo) throw new NotFoundException('Work Order not found');
    this.assertCanViewWorkOrder(user, wo);
    return toWorkOrderDetail(wo, user.id, { clockElsewhere });
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
        return toWorkOrderDetail(existing, user.id);
      }
    }

    this.assertNoDuplicateJobs(input.jobs);

    const truck = await this.prisma.truck.findUnique({
      where: { id: input.truckId },
    });
    if (!truck) throw new BadRequestException('Invalid truck');
    assertTruckActive(truck);

    const category = input.primaryCategoryId
      ? await this.prisma.jobCategory.findUnique({ where: { id: input.primaryCategoryId } })
      : actorKind === 'manager'
        ? await this.derivePrimaryCategory(input.jobs)
        : null;
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
    } else {
      // LTR-157 / D13: a Work Order can start with only the truck; the mandatory steps are added below.
      const jobAssigneeIds = input.jobs
        .map((job) => job.assignedMechanicId)
        .filter((id): id is string => Boolean(id));
      // LTR-154 / D11: the team is derived from Job assignees; mechanicIds is deprecated and ignored.
      if (input.mechanicIds.length) {
        this.logger.warn('createWorkOrder: mechanicIds is deprecated and ignored (LTR-154); assign mechanics per Job.');
      }
      teamMechanicIds = Array.from(new Set(jobAssigneeIds));
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
      if (input.jobs.length) await this.assertStandardJobsUseActiveCategories(input.jobs);
    }

    // LTR-145: PM, Alignment, Detailing and QC are added to every new truck Work Order.
    const categoryNames = new Map(
      (await this.prisma.jobCategory.findMany({
        where: { id: { in: input.jobs.map((job) => job.categoryId) } },
        select: { id: true, name: true },
      })).map((item) => [item.id, item.name]),
    );
    // LTR-198 / SW5: a picked System Job (e.g. a renamed Alignment) covers its step by key, not by name.
    const pickedCatalogIds = input.jobs.map((job) => job.catalogJobId).filter((id): id is string => Boolean(id));
    const systemKeys = new Map(
      (pickedCatalogIds.length
        ? await this.prisma.catalogJob.findMany({ where: { id: { in: pickedCatalogIds } }, select: { id: true, systemKey: true } })
        : []).map((item) => [item.id, item.systemKey]),
    );
    const mandatoryJobs: MandatoryJob[] = await resolveMandatoryJobs(
      this.prisma,
      input.jobs.map((job) => ({
        categoryName: categoryNames.get(job.categoryId) ?? '',
        displayName: job.displayName,
        systemKey: job.catalogJobId ? systemKeys.get(job.catalogJobId) ?? null : null,
      })),
    );

    const preflightOpen = await this.prisma.workOrder.findFirst({
      where: {
        truckId: input.truckId,
        status: { in: OPEN_WORK_ORDER_STATUSES },
      },
      include: workOrderDetailInclude,
    });

    // Only a Manager reaches here (PM joins via createOrJoinPm). A Manager is not a
    // mechanic and is never auto-assigned; the team is every Job owner except the
    // PM job's (a PM mechanic reaches the Work Order through that Job, LTR-146).
    const pmCategoryIds = new Set(
      (await this.prisma.jobCategory.findMany({ where: { name: 'PM' }, select: { id: true } })).map((item) => item.id),
    );
    const mandatoryOwners = mandatoryJobs
      .filter((job) => job.assignedMechanicId && !pmCategoryIds.has(job.categoryId))
      .map((job) => job.assignedMechanicId as string);
    const mechanicIds = Array.from(new Set([...teamMechanicIds, ...mandatoryOwners]));

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
        assertTruckActive(truckAfterLock);

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
        // LTR-177: a new Work Order is a new visit. The previous visit's
        // inspection (its readiness assessment) is closed, so this Work Order
        // starts with the inspection pending. Older unit-test transaction
        // doubles do not expose the readiness model.
        if (tx.truckReadinessAssessment) {
          await closeActiveAssessments(tx, this.activity, { truckId: input.truckId, userId: user.id, reason: 'new_work_order' });
        }
        const created = await tx.workOrder.create({
          data: {
            displayId,
            truckId: input.truckId,
            primaryCategoryId: category.id,
            status: 'created',
            priority: input.priority,
            notes: input.notes,
            // LTR-126: the creation note is also the first append-only entry.
            noteEntries: input.notes?.trim()
              ? { create: { body: input.notes.trim(), authorId: user.id } }
              : undefined,
            createdById: user.id,
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
                // LTR-197 / D28: the only eligible team member; otherwise the step's team queue.
                assignedMechanicId: job.assignedMechanicId ?? undefined,
                workflowStepKey: job.workflowStepKey ?? undefined,
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
          return toWorkOrderDetail(existing, user.id);
        }
      }
      throw error;
    }

    return toWorkOrderDetail(wo, user.id);
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
      const now = new Date();
      // LTR-186 / D20: yesterday's open clock closes at the day close, not now.
      await this.clock?.closeDue(tx, now);
      const wo = await this.requireWo(tx, id);
      this.assertMechanicAccess(user, wo);
      const isPm = wo.primaryCategory.name === 'PM';
      // LTR-154 / D18: labor is per mechanic. Start (or "Continue") opens the
      // actor's own session while they have a pending Job; other mechanics'
      // sessions are untouched. A legacy PM Work Order keeps create → start.
      // LTR-155: a blocked Job is not workable until the Manager resolves it.
      const hasPendingJob = wo.jobs.some((job) => (
        job.status === 'to_do' && job.assignedMechanicId === user.id && !this.activeBlockerForJob(wo, job.id)
      ));
      const alreadyRunning = !!openSessionFor(wo.sessions, user.id);
      const canStart = isPm
        ? wo.status === 'created'
        : ['created', 'in_progress'].includes(wo.status) && hasPendingJob && !alreadyRunning;
      if (!canStart) {
        if (!isPm && wo.status === 'waiting_paused') {
          throw new BadRequestException({ code: 'WORK_ORDER_PAUSED', message: 'The Manager paused this Work Order.' });
        }
        if (!isPm && ['created', 'in_progress'].includes(wo.status) && !hasPendingJob) {
          throw new BadRequestException({ code: 'NO_PENDING_JOBS', message: 'You have no pending Jobs on this Work Order.' });
        }
        if (!isPm && alreadyRunning) {
          throw new BadRequestException({ code: 'LABOR_ALREADY_RUNNING', message: 'Your work is already running on this Work Order.' });
        }
        throw new BadRequestException('Work Order can only be started from created status');
      }
      // LTR-186 / D21: one clock per mechanic — starting here stops it on any other Truck.
      const movedFromIds = (await this.clock?.closeOtherClocks(tx, user.id, id, now)) ?? [];
      // Block A (MG2): the reply says which Truck the clock left, so the app can tell the mechanic.
      const movedFrom = movedFromIds.length
        ? await tx.workOrder.findUnique({ where: { id: movedFromIds[0] }, select: { id: true, displayId: true, truck: { select: { truckNumber: true } } } })
        : null;
      const clockMovedFrom = movedFrom ? { id: movedFrom.id, displayId: movedFrom.displayId, truckNumber: movedFrom.truck.truckNumber } : null;
      await tx.workSession.create({
        data: { workOrderId: id, startedAt: now, userId: user.id },
      });
      if (wo.status === 'in_progress') {
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
        return { ...toWorkOrderDetail(restarted, user.id), clockMovedFrom };
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
      return { ...toWorkOrderDetail(updated, user.id), clockMovedFrom };
    });
  }

  // A mechanic-reported blocker records reason/notes without changing Work Order
  // status. Stored as a closed, zero-duration PauseEvent flagged
  // isOfficialPause=false so it never affects waiting totals or the open-pause
  // lookup used by resumeByManager.
  /**
   * LTR-155 / D17: a mechanic blocks one of their own pending Jobs. The Work Order
   * status and waiting totals do not change (not an official pause). D18: when
   * the mechanic has no workable Job left here, their own labor stops.
   */
  async reportBlocker(user: AuthUser, id: string, raw: unknown) {
    const parsed = reportBlockerSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    // LTR-185: "Returned by Safety" is written only by the Quality Check workspace.
    if (parsed.data.reason === BlockerReason.QUALITY_CHECK_FAILED) {
      throw new BadRequestException({ code: 'BLOCKER_REASON_NOT_ALLOWED', message: 'That reason is reserved for Safety.' });
    }
    if (parsed.data.reason === BlockerReason.OTHER && !parsed.data.notes?.trim()) {
      throw new BadRequestException('Notes are required when reason is Other');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.clock?.closeDue(tx);
      const wo = await this.requireWo(tx, id);
      // LTR-158: the PM mechanic blocks their PM job on the truck Work Order too (D17).
      if (this.pmJobForUser(user, wo)?.id !== parsed.data.jobId) this.assertMechanicAccess(user, wo);
      if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
        throw new BadRequestException('Cannot report a blocker on a closed Work Order');
      }
      const job = wo.jobs.find((item) => item.id === parsed.data.jobId);
      if (!job) throw new NotFoundException('Job not found');
      if (job.assignedMechanicId !== user.id) {
        throw new ForbiddenException({ code: 'JOB_NOT_ASSIGNED_TO_YOU', message: 'This Job is assigned to another mechanic.' });
      }
      if (job.status !== 'to_do') {
        throw new BadRequestException({ code: 'JOB_NOT_PENDING', message: 'Only a pending Job can be blocked.' });
      }
      if (this.activeBlockerForJob(wo, job.id)) {
        throw new ConflictException({ code: 'BLOCKER_ALREADY_ACTIVE', message: 'This Job is already blocked.' });
      }
      const now = new Date();
      const blocker = await tx.pauseEvent.create({
        data: {
          workOrderId: id,
          jobId: job.id,
          // BlockerReason values are a subset of PauseReason; `reason` stays filled for older readers.
          reason: parsed.data.reason as unknown as PauseReason,
          blockerReason: parsed.data.reason,
          notes: parsed.data.notes,
          startedAt: now,
          endedAt: now,
          durationMs: 0n,
          isOfficialPause: false,
          reportedById: user.id,
          createdById: user.id,
        },
      });
      const laborStopped = await stopLaborForMechanic(tx, id, user.id, now);
      const updated = await tx.workOrder.update({
        where: { id },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.BLOCKER_REPORTED,
        entityType: 'pause_event',
        entityId: blocker.id,
        userId: user.id,
        newValue: {
          jobId: job.id, jobName: job.displayName, reason: parsed.data.reason,
          notes: parsed.data.notes ?? null, laborStopped,
        },
      });
      return toWorkOrderDetail(updated, user.id);
    });
  }

  /**
   * LTR-155 / D17: the mechanic cannot resolve; they append notes ("the part
   * arrived") that the Manager sees next to the blocker.
   */
  async addBlockerNote(user: AuthUser, id: string, blockerId: string, raw: unknown) {
    const parsed = addBlockerNoteSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.requireWo(tx, id);
      const blocker = await tx.pauseEvent.findFirst({
        where: { id: blockerId, workOrderId: id, isOfficialPause: false },
      });
      if (!blocker || this.pmJobForUser(user, wo)?.id !== blocker.jobId) this.assertMechanicAccess(user, wo);
      if (!blocker) throw new NotFoundException('Blocker not found');
      if (blocker.resolvedAt) {
        throw new BadRequestException({ code: 'BLOCKER_ALREADY_RESOLVED', message: 'This blocker is already resolved.' });
      }
      const job = blocker.jobId ? wo.jobs.find((item) => item.id === blocker.jobId) : null;
      if (blocker.reportedById !== user.id && job?.assignedMechanicId !== user.id) {
        throw new ForbiddenException({ code: 'BLOCKER_NOT_YOURS', message: 'This blocker belongs to another mechanic.' });
      }
      const updated = await tx.workOrder.update({
        where: { id },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.NOTE_ADDED,
        entityType: 'pause_event',
        entityId: blockerId,
        userId: user.id,
        newValue: { body: parsed.data.body },
      });
      // The note was logged after the read; reload so the response carries it.
      const withNote = await tx.workOrder.findUnique({ where: { id }, include: workOrderDetailInclude });
      return toWorkOrderDetail(withNote ?? updated, user.id);
    });
  }

  /**
   * LTR-155 / D17 (replaces D3): only the Manager resolves a blocker, with an
   * optional note. The Job goes back to its owner as Pending; labor does not
   * restart until the mechanic taps Continue (D18).
   */
  async resolveBlocker(user: AuthUser, id: string, blockerId: string, raw: unknown = {}) {
    const parsed = resolveBlockerSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const notes = parsed.data.notes?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      await this.clock?.closeDue(tx);
      const blocker = await tx.pauseEvent.findFirst({
        where: { id: blockerId, workOrderId: id, isOfficialPause: false },
      });
      if (!blocker) throw new NotFoundException('Blocker not found');
      if (blocker.resolvedAt) {
        throw new BadRequestException({ code: 'BLOCKER_ALREADY_RESOLVED', message: 'This blocker is already resolved.' });
      }
      // LTR-217: a Safety return is answered with work (adding it resolves the return); resolving it without new
      // work tells Safety why, because the same truck goes straight back to their list.
      if (blocker.blockerReason === BlockerReason.QUALITY_CHECK_FAILED && !notes) {
        throw new BadRequestException({ code: 'QC_RESOLVE_NOTE_REQUIRED', message: 'Tell Safety why the truck goes back without new work.' });
      }
      await tx.pauseEvent.update({
        where: { id: blockerId },
        data: { resolvedAt: new Date(), resolvedById: user.id },
      });
      await tx.workOrder.update({ where: { id }, data: { version: { increment: 1 } } });
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.BLOCKER_RESOLVED,
        entityType: 'pause_event',
        entityId: blockerId,
        userId: user.id,
        previousValue: { reason: blocker.blockerReason ?? blocker.reason, notes: blocker.notes, jobId: blocker.jobId },
        newValue: { resolved: true, actor: 'manager', notes },
      });
      const updated = await tx.workOrder.findUnique({ where: { id }, include: workOrderDetailInclude });
      if (!updated) throw new NotFoundException('Work Order not found');
      return toWorkOrderDetail(updated, user.id);
    });
  }

  // Manager-first ownership: only the Manager pauses/resumes officially (session
  // close, PauseEvent, totals). LTR-180: the mechanic pause/resume endpoints of
  // legacy PM Work Orders are gone. The HTTP guard already checked
  // work_orders.manage; nothing is re-checked here.
  async pauseByManager(user: AuthUser, id: string, raw: unknown) {
    const parsed = pauseWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.reason === PauseReason.OTHER && !parsed.data.notes?.trim()) {
      throw new BadRequestException('Notes are required when reason is Other');
    }

    return this.prisma.$transaction(async (tx) => {
      // LTR-186 / D20: a clock left open overnight counts to the day close, not to the pause.
      await this.clock?.closeDue(tx);
      const wo = await this.requireWo(tx, id);
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
      return toWorkOrderDetail(updated, user.id);
    });
  }

  async resumeByManager(user: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.clock?.closeDue(tx);
      const wo = await this.requireWo(tx, id);
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
      await this.reopenSessionsClosedByPause(tx, id, openPause?.startedAt ?? null, now);
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
      return toWorkOrderDetail(updated, user.id);
    });
  }

  /**
   * D14: the Manager may name who does the Job as it is added (Hallazgos on the
   * Truck). The assignee is an internal option, not part of the public body.
   */
  async addJobByManager(user: AuthUser, id: string, raw: unknown, options: { assignedMechanicId?: string } = {}) {
    const parsed = addJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const assignedMechanicId = options.assignedMechanicId;
    const operation = 'add_job';
    // Only hashed when set, so unassigned adds keep their existing fingerprint.
    const payloadHash = idempotencyFingerprint({
      workOrderId: id,
      ...input,
      ...(assignedMechanicId ? { assignedMechanicId } : {}),
    });
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
        await lockTruckMutation(tx, await this.requireTruckId(tx, id));
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
          // LTR-188 / D23: a helper Job is a deliberate duplicate of its parent; it never blocks adding work.
          where: { workOrderId: id, status: { not: 'cancelled' }, helperOfJobId: null },
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
        const assignee = assignedMechanicId
          ? await this.requireStandardAssignee(tx, assignedMechanicId, category.name)
          : null;
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
            assignedMechanicId: assignee?.id,
            status: 'to_do',
          },
        });
        if (assignee) await joinWorkOrderTeam(tx, id, assignee.id, user.id);
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
        if (assignee) {
          // Same Activity Log entry as a later assignment (AdminService.assignJob).
          await this.activity.log(tx, {
            workOrderId: id,
            eventType: ActivityEventType.MECHANIC_ADDED,
            entityType: 'work_order_job',
            entityId: createdJob.id,
            userId: user.id,
            previousValue: { jobId: createdJob.id, assignedMechanicId: null },
            newValue: { jobId: createdJob.id, action: 'job_assigned', assignedMechanicId: assignee.id, mechanicName: assignee.name },
          });
        }
        const result = toWorkOrderDetail(updated, user.id);
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

  /** D14: a Job added with its owner goes to an active Standard mechanic; the PM job is assigned on the Work Order. */
  private async requireStandardAssignee(tx: Prisma.TransactionClient, mechanicId: string, categoryName: string) {
    if (isPmJobCategory(categoryName)) {
      throw new BadRequestException('Assign the PM job from the Work Order');
    }
    const mechanic = await tx.user.findFirst({
      where: { id: mechanicId, active: true, capabilities: { some: { capability: 'MECHANIC_STANDARD' } } },
      select: { id: true, name: true },
    });
    if (!mechanic) throw new BadRequestException('This mechanic cannot perform standard work');
    return mechanic;
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
  /**
   * LTR-158: "Add missing steps" for an open Work Order created before the
   * mandatory steps existed. Adds only the steps not already on it (a cancelled
   * step counts as decided "not applicable"), each with its default owner.
   */
  async backfillMandatoryJobs(user: AuthUser, workOrderId: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      await lockTruckMutation(tx, await this.requireTruckId(tx, workOrderId));
      const wo = await this.requireWo(tx, workOrderId);
      if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
        throw new BadRequestException('Only an open Work Order can get its missing steps');
      }
      if (wo.primaryCategory.name === 'PM') {
        throw new BadRequestException('A legacy PM Work Order has no Work Plan steps');
      }
      if (wo.version !== expectedVersion) {
        throw this.versionConflict('Work Order was updated. Refresh and try again.');
      }
      const missing = await resolveMandatoryJobs(
        tx,
        wo.jobs.map((job) => ({ categoryName: job.category.name, displayName: job.displayName, systemKey: job.systemKey })),
      );
      if (!missing.length) return toWorkOrderDetail(wo, user.id);
      for (const job of missing) {
        const created = await tx.workOrderJob.create({
          data: {
            workOrderId,
            catalogJobId: job.catalogJobId,
            categoryId: job.categoryId,
            displayName: job.displayName,
            isCustom: false,
            addedById: user.id,
            assignedMechanicId: job.assignedMechanicId,
            workflowStepKey: job.workflowStepKey,
            status: 'to_do',
          },
        });
        const category = await tx.jobCategory.findUnique({ where: { id: job.categoryId }, select: { name: true } });
        // LTR-154 / D11: a Standard owner joins the derived team; a PM owner reaches it through the PM job.
        if (job.assignedMechanicId && category?.name !== 'PM') {
          await tx.mechanicAssignment.upsert({
            where: { workOrderId_mechanicId: { workOrderId, mechanicId: job.assignedMechanicId } },
            create: { workOrderId, mechanicId: job.assignedMechanicId, addedById: user.id },
            update: { removedAt: null },
          });
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: ActivityEventType.JOB_ADDED,
          entityType: 'work_order_job',
          entityId: created.id,
          userId: user.id,
          newValue: { jobId: created.id, displayName: job.displayName, assignedMechanicId: job.assignedMechanicId, action: 'mandatory_backfill' },
        });
      }
      const updated = await tx.workOrder.update({
        where: { id: workOrderId },
        data: { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      return toWorkOrderDetail(updated, user.id);
    });
  }

  async assertNotPmJob(tx: Pick<Prisma.TransactionClient, 'jobCategory'>, categoryId: string) {
    const category = await tx.jobCategory.findUnique({ where: { id: categoryId }, select: { name: true } });
    if (isPmJobCategory(category?.name)) {
      throw new BadRequestException({
        code: 'PM_JOB_USES_PM_SERVICE',
        message: 'The PM job is completed from the PM service with observed mileage and parts.',
      });
    }
  }

  /**
   * LTR-157 / D13: the Manager no longer picks a Category. Keep `primaryCategoryId`
   * (PRD §9) from the first Shop Work Job, else Inspection, else the first
   * non-PM active Category. Never PM: a PM primary Category means a legacy PM
   * Work Order without Jobs.
   */
  private async derivePrimaryCategory(jobs: Array<{ categoryId: string; displayName: string }>) {
    if (jobs.length) {
      const categories = await this.prisma.jobCategory.findMany({
        where: { id: { in: jobs.map((job) => job.categoryId) }, status: 'active' },
      });
      const byId = new Map(categories.map((item) => [item.id, item]));
      const shopWork = jobs
        .map((job) => ({ job, category: byId.get(job.categoryId) }))
        .find(({ job, category }) => category && classifyWorkPlanLane(category.name, job.displayName) === WorkPlanJobLane.SHOP_WORK);
      if (shopWork?.category) return shopWork.category;
    }
    return await this.prisma.jobCategory.findFirst({ where: { name: 'Inspection', status: 'active' } })
      ?? await this.prisma.jobCategory.findFirst({ where: { name: { not: 'PM' }, status: 'active' }, orderBy: { sortOrder: 'asc' } });
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
      return toWorkOrderDetail(updated, user.id);
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
      await this.clock?.closeDue(tx);
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
      const job = await tx.workOrderJob.findFirst({
        where: { id: jobId, workOrderId },
      });
      if (!job) throw new NotFoundException('Job not found');
      // LTR-154 / D11: only the Job's assignee completes it (the Manager uses Admin).
      if (job.assignedMechanicId !== user.id) {
        throw new ForbiddenException({ code: 'JOB_NOT_ASSIGNED_TO_YOU', message: 'This Job is assigned to another mechanic.' });
      }
      if (this.activeBlockerForJob(wo, job.id)) {
        throw new BadRequestException({ code: 'JOB_BLOCKED', message: 'The Manager resolves this blocker before the Job can be completed.' });
      }
      const gate = canCompleteJob(wo.status, !!openSessionFor(wo.sessions, user.id));
      if (!gate.ok) {
        throw new BadRequestException({ code: gate.code, message: gate.message });
      }
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
      await stopLaborForMechanic(tx, workOrderId, user.id);
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
      const detail = toWorkOrderDetail(updated, user.id);
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
      return toWorkOrderDetail(open, user.id);
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
      if (target.id === job.catalogJobId) return toWorkOrderDetail(wo, user.id);
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
      return toWorkOrderDetail(updated, user.id);
    });
  }

  /** LTR-146: the PM mechanic starts (or claims and starts) the PM job of a truck Work Order. */
  async startPmJob(user: AuthUser, id: string, jobId: string) {
    this.assertCapability(user, AppCapability.MECHANIC_PM, 'PM mechanic');
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await this.clock?.closeDue(tx, now);
      await lockTruckMutation(tx, await this.requireTruckId(tx, id));
      const wo = await this.requireWo(tx, id);
      const job = wo.jobs.find((item) => item.id === jobId);
      if (!job) throw new NotFoundException('Job not found');
      if (this.activePmJob(wo)?.id !== jobId) throw new BadRequestException('This is not the PM job of this Work Order');
      if (job.status !== 'to_do') throw new BadRequestException('The PM job is not to do');
      // LTR-188 / D24: a Job at an external shop waits for the Manager's "Returned".
      if (job.externalSince) {
        throw new BadRequestException({ code: 'JOB_AT_EXTERNAL_SHOP', message: 'This Job is at an external shop.' });
      }
      if (job.startedAt && job.assignedMechanicId === user.id && !openSessionFor(wo.sessions, user.id)) {
        // LTR-186 / D20, D21: the PM was started and my clock stopped (day close, switched Truck,
        // resolved blocker). Continue reopens my clock here; the PM itself is unchanged.
        return this.continuePmJob(tx, user, wo, job, now);
      }
      if (job.startedAt) throw new BadRequestException({ code: 'PM_JOB_ALREADY_STARTED', message: 'The PM service is already started.' });
      // LTR-157 / D15: the PM mechanic who starts the PM takes it, even when the
      // default owner was someone else (who may be out today). D2 still applies below.
      const previousAssigneeId = job.assignedMechanicId;
      if (!['created', 'in_progress'].includes(wo.status)) {
        throw new BadRequestException({ code: 'WORK_ORDER_NOT_WORKABLE', message: 'The Work Order is paused or closed.' });
      }
      await this.assertNoOtherRunningPm(tx, user.id, { jobId });
      await tx.workOrderJob.update({ where: { id: jobId }, data: { startedAt: now, assignedMechanicId: user.id } });
      await tx.pmService.upsert({
        where: { workOrderId: id },
        update: { workOrderJobId: jobId },
        create: { workOrderId: id, workOrderJobId: jobId },
      });
      // LTR-175 / D18: starting the PM is starting work. The PM mechanic's own
      // labor clock runs from here (finishing the PM stops it), and a Work Order
      // that nobody had started yet is now in progress, like a Standard Start.
      if (!openSessionFor(wo.sessions, user.id)) {
        // LTR-186 / D21: one clock per mechanic.
        await this.clock?.closeOtherClocks(tx, user.id, id, now);
        await tx.workSession.create({ data: { workOrderId: id, startedAt: now, userId: user.id } });
      }
      const startsWorkOrder = wo.status === 'created';
      const updated = await tx.workOrder.update({
        where: { id },
        data: startsWorkOrder
          ? { status: 'in_progress', startedAt: now, version: { increment: 1 } }
          : { version: { increment: 1 } },
        include: workOrderDetailInclude,
      });
      if (startsWorkOrder) {
        await this.activity.log(tx, {
          workOrderId: id,
          eventType: ActivityEventType.WORK_STARTED,
          entityType: 'work_order',
          entityId: id,
          userId: user.id,
          previousValue: { status: 'created' },
          newValue: { status: 'in_progress', startedAt: now.toISOString() },
        });
      }
      await this.activity.log(tx, {
        workOrderId: id,
        eventType: ActivityEventType.WORK_STARTED,
        entityType: 'work_order_job',
        entityId: jobId,
        userId: user.id,
        previousValue: previousAssigneeId && previousAssigneeId !== user.id ? { assignedMechanicId: previousAssigneeId } : undefined,
        newValue: { pmJob: true, displayName: job.displayName, startedAt: now.toISOString(), assignedMechanicId: user.id },
      });
      return toWorkOrderDetail(updated, user.id);
    });
  }

  /** LTR-186: Continue on a started PM job — reopen the PM mechanic's clock (and stop it anywhere else, D21). */
  private async continuePmJob(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    wo: Awaited<ReturnType<WorkOrdersService['requireWo']>>,
    job: { id: string; displayName: string },
    now: Date,
  ) {
    if (wo.status !== 'in_progress') {
      throw new BadRequestException({ code: 'WORK_ORDER_NOT_WORKABLE', message: 'The Work Order is paused or closed.' });
    }
    if (this.activeBlockerForJob(wo, job.id)) {
      throw new BadRequestException({ code: 'JOB_BLOCKED', message: 'The Manager resolves this blocker before the PM can continue.' });
    }
    await this.clock?.closeOtherClocks(tx, user.id, wo.id, now);
    await tx.workSession.create({ data: { workOrderId: wo.id, startedAt: now, userId: user.id } });
    const updated = await tx.workOrder.update({
      where: { id: wo.id },
      data: { version: { increment: 1 } },
      include: workOrderDetailInclude,
    });
    await this.activity.log(tx, {
      workOrderId: wo.id,
      eventType: ActivityEventType.WORK_STARTED,
      entityType: 'work_order_job',
      entityId: job.id,
      userId: user.id,
      previousValue: { laborRunning: false },
      newValue: { pmJob: true, displayName: job.displayName, laborRunning: true },
    });
    return toWorkOrderDetail(updated, user.id);
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
    if (this.activeBlockerForJob(wo, job.id)) {
      throw new BadRequestException({ code: 'JOB_BLOCKED', message: 'The Manager resolves this blocker before the PM can be finished.' });
    }
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
    await stopLaborForMechanic(tx, wo.id, user.id);
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
    const detail = toWorkOrderDetail(updated, user.id);
    return { ...detail, jobs: detail.jobs.map((item) => (item.id === jobId ? { ...item, completionNotes: notes } : item)) };
  }

  /**
   * Stage PM-1: for the PM workspace cards — the PM's mileage and parts count, and the truck's previous
   * finished PM. Two queries for the whole list.
   */
  private async addPmListDetails(items: Array<{ id: string; truckId: string; pmJob?: Record<string, unknown> | null; lastPm?: unknown }>) {
    // Unit-test doubles may not model the PM tables; the cards then go without these extras.
    if (typeof this.prisma.pmService?.findMany !== 'function') return;
    const services = await this.prisma.pmService.findMany({
      where: { workOrderId: { in: items.map((item) => item.id) } },
      select: { workOrderId: true, observedMileage: true, _count: { select: { parts: true } } },
    });
    const byWorkOrder = new Map(services.map((service) => [service.workOrderId, service]));
    const finished = await this.prisma.pmService.findMany({
      where: {
        workOrder: { truckId: { in: [...new Set(items.map((item) => item.truckId))] } },
        OR: [
          { workOrder: { primaryCategory: { name: 'PM' }, status: 'completed' } },
          { workOrderJob: { status: 'completed' } },
        ],
      },
      select: { workOrderId: true, observedMileage: true, workOrder: { select: { truckId: true, completedAt: true, createdAt: true } }, workOrderJob: { select: { completedAt: true } } },
    });
    for (const item of items) {
      const own = byWorkOrder.get(item.id);
      if (item.pmJob) item.pmJob = { ...item.pmJob, observedMileage: own?.observedMileage ?? null, partsCount: own?._count.parts ?? 0 };
      const previous = finished
        .filter((service) => service.workOrder.truckId === item.truckId && service.workOrderId !== item.id)
        .map((service) => ({ observedMileage: service.observedMileage, completedAt: service.workOrderJob?.completedAt ?? service.workOrder.completedAt ?? service.workOrder.createdAt }))
        .sort((left, right) => right.completedAt.getTime() - left.completedAt.getTime())[0];
      item.lastPm = previous ? { observedMileage: previous.observedMileage, completedAt: previous.completedAt.toISOString() } : null;
    }
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

    const [categories, lastCompletedPmCandidates, modelParts] = await Promise.all([
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
      // Stage PM-1 (D-PM1): parts used on finished PMs of trucks with the same make and model.
      wo.truck.make && wo.truck.model && typeof this.prisma.pmServicePart?.findMany === 'function'
        ? this.prisma.pmServicePart.findMany({
            where: {
              pmService: {
                workOrderId: { not: wo.id },
                workOrder: { truck: { make: wo.truck.make, model: wo.truck.model } },
                OR: [
                  { workOrder: { primaryCategory: { name: 'PM' }, status: 'completed' } },
                  { workOrderJob: { status: 'completed' } },
                ],
              },
            },
            select: { pmServiceId: true, partCategoryId: true, partId: true },
          })
        : Promise.resolve([] as Array<{ pmServiceId: string; partCategoryId: string; partId: string }>),
    ]);
    const pmCountForModel = new Set(modelParts.map((row) => row.pmServiceId)).size;
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
      // D35 / S4-1: Samsara's odometer next to the field, as a reference.
      samsaraOdometer: wo.truck.samsaraOdometerMiles == null
        ? null
        : {
            miles: wo.truck.samsaraOdometerMiles,
            at: wo.truck.samsaraOdometerAt?.toISOString() ?? null,
            source: wo.truck.samsaraOdometerSource === 'obd' || wo.truck.samsaraOdometerSource === 'gps' ? wo.truck.samsaraOdometerSource : null,
          },
      serviceCompletedAt: serviceCompletedAt ? serviceCompletedAt.toISOString() : null,
      lastCompletedPm: previous
        ? {
            workOrderId: previous.service.workOrderId,
            displayId: previous.service.workOrder.displayId,
            completedAt: previous.completedAt.toISOString(),
            observedMileage: previous.service.observedMileage,
          }
        : null,
      categories: categories.map((category) => {
        const parts = category.parts
          .filter((part) => this.partFitsTruck(part.fitments, wo.truck))
          .map((part) => ({ id: part.id, partNumber: part.partNumber, displayName: part.displayName }));
        const counts = new Map<string, number>();
        for (const row of modelParts) {
          if (row.partCategoryId === category.id && parts.some((part) => part.id === row.partId)) counts.set(row.partId, (counts.get(row.partId) ?? 0) + 1);
        }
        const [mostUsedPartId, mostUsedCount] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [null, 0];
        return { id: category.id, slug: category.slug, name: category.name, parts, mostUsedPartId, mostUsedCount, pmCountForModel };
      }),
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

  private isAssigned(
    user: AuthUser,
    wo: {
      createdById: string;
      primaryCategory?: { name: string };
      mechanics?: { mechanicId: string; removedAt: Date | null }[];
      jobs?: PmJobLike[];
    },
  ) {
    // LTR-154 / D11: the team is derived from Job assignments (Q10/Q17 retired).
    if (wo.jobs?.some((job) => job.assignedMechanicId === user.id)) return true;
    if (!wo.primaryCategory || wo.primaryCategory.name !== 'PM') return false;
    return wo.createdById === user.id
      || !!wo.mechanics?.some((assignment) => assignment.mechanicId === user.id && !assignment.removedAt);
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

  /** LTR-155 / D17: the unresolved mechanic blocker on a Job, if any. */
  private activeBlockerForJob(
    wo: { pauseEvents?: { id: string; jobId?: string | null; isOfficialPause?: boolean; resolvedAt?: Date | null }[] },
    jobId: string,
  ) {
    return wo.pauseEvents?.find((pause) => pause.isOfficialPause === false && !pause.resolvedAt && pause.jobId === jobId) ?? null;
  }

  /**
   * PF9 (d): the read that happens before the Truck lock only needs the Truck id; the full Work Order is read
   * once more under the lock (that second read stays: it is what makes the mutation see the latest state).
   */
  private async requireTruckId(tx: Prisma.TransactionClient, id: string): Promise<string> {
    const wo = await tx.workOrder.findUnique({ where: { id }, select: { truckId: true } });
    if (!wo) throw new NotFoundException('Work Order not found');
    return wo.truckId;
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
    // LTR-154 / D18: an official pause or completion stops every mechanic's labor.
    await tx.workSession.updateMany({
      where: { workOrderId, endedAt: null },
      data: { endedAt: now },
    });
  }

  /**
   * LTR-154 / D18: resuming an official pause restarts labor for exactly the
   * mechanics the pause stopped (their sessions ended at the pause start).
   */
  private async reopenSessionsClosedByPause(
    tx: Prisma.TransactionClient,
    workOrderId: string,
    pausedAt: Date | null,
    now: Date,
  ) {
    // No open pause row to read from: keep the previous single-session behavior.
    if (!pausedAt) {
      await tx.workSession.create({ data: { workOrderId, startedAt: now } });
      return;
    }
    const stopped = await tx.workSession.findMany({ where: { workOrderId, endedAt: pausedAt }, select: { userId: true } });
    for (const userId of new Set(stopped.map((session) => session.userId ?? null))) {
      // LTR-186 / D21: a mechanic whose clock now runs on another Truck is not pulled back; they tap Continue here.
      if (userId && await tx.workSession.findFirst({ where: { userId, endedAt: null }, select: { id: true } })) continue;
      await tx.workSession.create({ data: { workOrderId, startedAt: now, userId } });
    }
  }

  private partFitsTruck(
    fitments: Array<{ make: string | null; model: string | null }>,
    truck: { make: string | null; model: string | null },
  ) {
    // LTR-200: the same rule the Parts catalog uses to protect a PM in progress.
    return partFitsTruck(fitments, truck);
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

/** D44: a deactivated truck left the fleet; reactivate it before opening a Work Order. */
function assertTruckActive(truck: { deactivatedAt?: Date | null }) {
  if (truck.deactivatedAt) {
    throw new ConflictException({ code: 'TRUCK_INACTIVE', message: 'This truck is deactivated. Reactivate it in Trucks before opening a Work Order.' });
  }
}
