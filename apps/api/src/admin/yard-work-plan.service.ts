import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import {
  AppCapability,
  OPEN_WORK_ORDER_STATUSES,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  addWorkPlanJobsSchema,
  recordWorkPlanInspectionSchema,
  type AddWorkPlanJobsInput,
  type RecordWorkPlanInspectionInput,
  type TruckWorkPlanDto,
} from '@ltl-shop/shared';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { LaborClockService } from '../work-orders/labor-clock.service';
import type { AuthUser } from '../auth/auth.guard';
import { hasCapability } from '../auth/capabilities';
import { idempotencyFingerprint } from '../common/idempotency';
import { YardOperationsService } from './yard-operations.service';
import { deriveWorkPlan } from './yard-work-plan-derivation';
import { returnedToServiceAfter, yardReadyToGoSince } from './yard-ready-window';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const openWorkOrderInclude = {
  primaryCategory: { select: { id: true, name: true } },
  jobs: {
    include: {
      category: { select: { id: true, name: true } },
      assignedMechanic: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  sessions: { select: { endedAt: true, userId: true } },
  pauseEvents: {
    where: { isOfficialPause: false, resolvedAt: null, jobId: { not: null } },
    select: { jobId: true },
  },
} as const;

type OpenWorkOrderRow = {
  id: string;
  displayId: string;
  status: string;
  version: number;
  idempotencyKey: string | null;
  primaryCategory: { id: string; name: string };
  jobs: Array<{
    id: string;
    catalogJobId: string | null;
    displayName: string;
    customDescription: string | null;
    status: string;
    category: { id: string; name: string };
    assignedMechanic: { id: string; name: string } | null;
    startedAt: Date | null;
  }>;
  sessions: Array<{ endedAt: Date | null; userId: string | null }>;
  pauseEvents: Array<{ jobId: string | null }>;
};

@Injectable()
export class YardWorkPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workOrders: WorkOrdersService,
    private readonly yardOperations: YardOperationsService,
    private readonly clock?: LaborClockService,
  ) {}

  async get(user: AuthUser, truckId: string): Promise<TruckWorkPlanDto> {
    this.assertUuid(truckId, 'Invalid Truck id');
    const truck = await this.prisma.truck.findUnique({
      where: { id: truckId },
      select: { id: true },
    });
    if (!truck) throw new NotFoundException('Truck not found');
    // LTR-186 / D20: a Job reads In Progress only while its mechanic's clock runs.
    await this.clock?.closeDue();

    const [openWorkOrder, assessment] = await Promise.all([
      this.findOpenWorkOrder(truckId),
      this.findActiveAssessment(truckId),
    ]);
    // LTR-90 / D1: after completion the plan stays on that Work Order until RTS.
    const workOrder = openWorkOrder ?? await this.findReadyToGoWorkOrder(truckId);

    const inspectionRequirement = assessment?.requirements.find(
      (requirement) => requirement.type === ReadinessRequirementType.INSPECTION,
    );
    const derived = deriveWorkPlan({
      workOrder: workOrder
        ? {
            id: workOrder.id,
            displayId: workOrder.displayId,
            status: workOrder.status as WorkOrderStatus,
            version: workOrder.version,
            primaryCategoryName: workOrder.primaryCategory.name,
          }
        : null,
      jobs: workOrder?.primaryCategory.name === 'PM'
        ? []
        : (workOrder?.jobs ?? []).map((job) => ({
            id: job.id,
            catalogJobId: job.catalogJobId,
            displayName: job.displayName,
            customDescription: job.customDescription,
            category: job.category,
            status: job.status as never,
            assignedMechanic: job.assignedMechanic,
            startedAt: job.startedAt,
            blocked: (workOrder?.pauseEvents ?? []).some((pause) => pause.jobId === job.id),
          })),
      sessions: workOrder?.sessions ?? [],
      inspectionRequirementOutcome: inspectionRequirement?.outcome ?? null,
    });

    return {
      // Deprecated (LTR-150): Work Plan and PM phase are the only mode; kept for web/API deploy skew.
      sliceEnabled: true,
      pmPhaseEnabled: true,
      ...derived,
      workOrder: workOrder
        ? {
            id: workOrder.id,
            displayId: workOrder.displayId,
            status: workOrder.status as never,
            version: workOrder.version,
            primaryCategoryName: workOrder.primaryCategory.name,
          }
        : null,
      capabilities: {
        canRead: hasCapability(user, AppCapability.ADMIN_ACCESS),
        canAddWork: hasCapability(user, AppCapability.WORK_ORDERS_MANAGE),
        canRecordInspection: hasCapability(user, AppCapability.YARD_OPERATIONS_MANAGE),
      },
      phase1: {
        assessmentId: assessment?.id ?? null,
        gatesRemainDefault: true,
      },
    };
  }

  async addJobs(user: AuthUser, truckId: string, raw: unknown): Promise<TruckWorkPlanDto> {
    this.assertUuid(truckId, 'Invalid Truck id');
    const parsed = addWorkPlanJobsSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input: AddWorkPlanJobsInput = parsed.data;
    const truck = await this.prisma.truck.findUnique({ where: { id: truckId }, select: { id: true } });
    if (!truck) throw new NotFoundException('Truck not found');

    let open = await this.findOpenWorkOrder(truckId);
    if (open?.idempotencyKey === input.idempotencyKey) {
      return this.get(user, truckId);
    }
    if (open) {
      await this.addJobsToOpenWorkOrder(user, open, input);
      return this.get(user, truckId);
    }

    try {
      await this.workOrders.createByManager(user, {
        truckId,
        primaryCategoryId: input.jobs[0].categoryId,
        jobs: input.jobs,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      if (conflictCode(error) !== 'OPEN_WORK_ORDER_EXISTS') throw error;
      open = await this.findOpenWorkOrder(truckId);
      if (!open) throw error;
      await this.addJobsToOpenWorkOrder(user, open, input);
    }
    return this.get(user, truckId);
  }

  /** LTR-158: add the mandatory steps an older open Work Order lacks. */
  async backfillMandatory(user: AuthUser, truckId: string, raw: unknown): Promise<TruckWorkPlanDto> {
    this.assertUuid(truckId, 'Invalid Truck id');
    const expectedVersion = (raw as { expectedVersion?: unknown } | null)?.expectedVersion;
    if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion)) {
      throw new BadRequestException('expectedVersion is required');
    }
    const open = await this.findOpenWorkOrder(truckId);
    if (!open) throw new NotFoundException('This Truck has no open Work Order');
    await this.workOrders.backfillMandatoryJobs(user, open.id, expectedVersion);
    return this.get(user, truckId);
  }

  async recordInspection(user: AuthUser, truckId: string, raw: unknown): Promise<TruckWorkPlanDto> {
    this.assertUuid(truckId, 'Invalid Truck id');
    const parsed = recordWorkPlanInspectionSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input: RecordWorkPlanInspectionInput = parsed.data;
    const current = await this.get(user, truckId);
    const hasShopWork = current.jobs.some(
      (job) => job.lane === 'shop_work' && job.status !== 'cancelled',
    );
    if (input.outcome === 'no_issues_found' && hasShopWork) {
      throw new BadRequestException(
        'Cannot record No issues found while Shop Work jobs are on the Work Plan.',
      );
    }

    let assessmentId = current.phase1.assessmentId;
    if (!assessmentId) {
      try {
        const started = await this.yardOperations.startAssessment(user, truckId, {
          idempotencyKey: childIdempotencyKey(input.idempotencyKey, 0),
        }) as { assessment: { id: string } };
        assessmentId = started.assessment.id;
      } catch (error) {
        if (conflictCode(error) !== 'ACTIVE_READINESS_ASSESSMENT_EXISTS') throw error;
        const existing = await this.findActiveAssessment(truckId);
        assessmentId = existing?.id ?? null;
      }
    }
    if (!assessmentId) throw new ConflictException('Could not link a Phase 1 readiness assessment.');

    const assessment = await this.prisma.truckReadinessAssessment.findUnique({
      where: { id: assessmentId },
      include: { requirements: true },
    });
    const requirement = assessment?.requirements.find(
      (item) => item.type === ReadinessRequirementType.INSPECTION,
    );
    if (!assessment || !requirement) throw new NotFoundException('Readiness assessment not found');

    const desiredOutcome = input.outcome === 'no_issues_found'
      ? ReadinessRequirementOutcome.COMPLETED
      : ReadinessRequirementOutcome.REQUIRED;
    if (requirement.outcome !== desiredOutcome) {
      await this.yardOperations.updateRequirement(user, assessmentId, ReadinessRequirementType.INSPECTION, {
        outcome: desiredOutcome,
        expectedVersion: requirement.version,
        idempotencyKey: childIdempotencyKey(input.idempotencyKey, 1),
      });
    }
    return this.get(user, truckId);
  }

  private async addJobsToOpenWorkOrder(
    user: AuthUser,
    open: OpenWorkOrderRow,
    input: AddWorkPlanJobsInput,
  ) {
    if (open.primaryCategory.name === 'PM') {
      throw new BadRequestException(
        'An open PM Work Order blocks a Standard Work Plan. Complete or cancel it first.',
      );
    }
    // A retry of a request that already landed replays before the version check:
    // its own write bumped the version the client sent.
    const payloadHash = idempotencyFingerprint({
      workOrderId: open.id,
      jobs: input.jobs,
    });
    const replay = await this.prisma.workOrderMutation.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (replay) {
      if (
        replay.workOrderId !== open.id
        || replay.operation !== 'work_plan_add_jobs'
        || replay.payloadHash !== payloadHash
        || replay.actorId !== user.id
      ) {
        throw new ConflictException('Idempotency key was already used for a different Work Plan mutation.');
      }
      return;
    }

    // LTR-179 (U10): a retry of a request that landed only partly (some child Jobs were added, then the
    // process died before the parent record) must not hit VERSION_CONFLICT: its own children bumped the
    // version. When the first child already replays, skip the version gate and let each child replay.
    const partial = await this.prisma.workOrderMutation.findUnique({
      where: { idempotencyKey: childIdempotencyKey(input.idempotencyKey, 0) },
      select: { workOrderId: true, actorId: true },
    });
    const resumingPartial = Boolean(partial && partial.workOrderId === open.id && partial.actorId === user.id);

    if (input.expectedVersion === undefined && !resumingPartial) {
      throw new ConflictException({
        code: 'WORK_ORDER_VERSION_REQUIRED',
        message: 'expectedVersion is required when the Truck already has an open Work Order.',
        workOrderId: open.id,
        version: open.version,
      });
    }
    if (!resumingPartial && open.version !== input.expectedVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'Work Order was updated. Refresh and try again.',
        workOrderId: open.id,
        version: open.version,
      });
    }

    await this.assertStandardAssignees(input);

    let expectedVersion = resumingPartial ? open.version : input.expectedVersion;
    for (const [index, job] of input.jobs.entries()) {
      // D14: each Job keeps the owner the Manager chose in Hallazgos.
      const result = await this.workOrders.addJobByManager(user, open.id, {
        catalogJobId: job.catalogJobId,
        categoryId: job.categoryId,
        displayName: job.displayName,
        customDescription: job.customDescription,
        expectedVersion,
        idempotencyKey: childIdempotencyKey(input.idempotencyKey, index),
      }, { assignedMechanicId: job.assignedMechanicId });
      expectedVersion = result.version;
    }

    try {
      await this.prisma.workOrderMutation.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          workOrderId: open.id,
          operation: 'work_plan_add_jobs',
          payloadHash,
          actorId: user.id,
          result: { added: input.jobs.length, version: expectedVersion },
        },
      });
    } catch (error) {
      // LTR-179 (U10): two simultaneous retries with the same key — the other one already recorded it.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }

  /** Checked before the first Job is added, so a bad assignee adds nothing. */
  private async assertStandardAssignees(input: AddWorkPlanJobsInput) {
    const ids = Array.from(new Set(
      input.jobs.map((job) => job.assignedMechanicId).filter((id): id is string => Boolean(id)),
    ));
    if (!ids.length) return;
    const mechanics = await this.prisma.user.findMany({
      where: { id: { in: ids }, active: true, capabilities: { some: { capability: 'MECHANIC_STANDARD' } } },
      select: { id: true },
    });
    if (mechanics.length !== ids.length) {
      throw new BadRequestException('One or more selected mechanics cannot perform standard work');
    }
  }

  private async findOpenWorkOrder(truckId: string) {
    return this.prisma.workOrder.findFirst({
      where: { truckId, status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
      include: openWorkOrderInclude,
      orderBy: { createdAt: 'asc' },
    }) as Promise<OpenWorkOrderRow | null>;
  }

  private async findReadyToGoWorkOrder(truckId: string) {
    const since = yardReadyToGoSince();
    if (!since) return null;
    const [completed, latestServiceEvent] = await Promise.all([
      this.prisma.workOrder.findFirst({
        where: { truckId, status: WorkOrderStatus.completed, completedAt: { gte: since } },
        include: openWorkOrderInclude,
        orderBy: { completedAt: 'desc' },
      }) as Promise<(OpenWorkOrderRow & { completedAt: Date | null }) | null>,
      this.prisma.truckServiceStatusEvent.findFirst({
        where: { truckId },
        orderBy: { occurredAt: 'desc' },
        select: { status: true, occurredAt: true },
      }),
    ]);
    if (!completed || returnedToServiceAfter(latestServiceEvent, completed.completedAt)) return null;
    return completed;
  }

  private async findActiveAssessment(truckId: string) {
    return this.prisma.truckReadinessAssessment.findFirst({
      where: { truckId, status: { in: ['under_review', 'ready'] } },
      orderBy: { updatedAt: 'desc' },
      include: { requirements: true },
    });
  }

  private assertUuid(value: string, message: string) {
    if (!UUID_PATTERN.test(value)) throw new BadRequestException(message);
  }
}

export function childIdempotencyKey(parent: string, index: number) {
  const hex = createHash('sha256').update(`work-plan:${parent}:${index}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function conflictCode(error: unknown): string | null {
  if (!(error instanceof ConflictException)) return null;
  const response = error.getResponse();
  if (typeof response === 'object' && response && 'code' in response) {
    return String((response as { code: unknown }).code);
  }
  return null;
}
