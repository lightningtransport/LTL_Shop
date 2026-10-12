import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import {
  ActivityEventType,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  OPEN_WORK_ORDER_STATUSES,
  ReadinessAssessmentStatus,
  YardPresenceState,
  YardReadinessFilter,
  TruckOperationalStatus,
  WorkPlanNotReadyReason,
  WorkPlanPhase,
  WorkPlanReadiness,
  type AdminTruckDetailDto,
  type AdminWorkOrderSummaryDto,
  type ReadinessBlockerDto,
  type YardOperationsPageDto,
  type YardOperationsTruckDto,
  type YardOperationsUnavailableDto,
  type AdminYardOperationsCursor,
  type AdminYardOperationsQuery,
  startReadinessAssessmentSchema,
  updateReadinessRequirementSchema,
  type StartReadinessAssessmentInput,
  type UpdateReadinessRequirementInput,
  adminYardOperationsCursorSchema,
  adminYardOperationsQuerySchema,
  isWorkOrderBlocked,
  deriveTruckNextStep,
  JobExternalKind,
} from '@ltl-shop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TrucksService } from '../trucks/trucks.service';
import { toTruckDto } from '../trucks/trucks.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { idempotencyFingerprint } from '../common/idempotency';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import {
  isResidualReady,
  READINESS_REQUIREMENT_TYPES,
  toReadinessAssessmentDto,
} from './yard-operations-derivation';
import {
  deriveWorkPlan,
  type WorkPlanDerivationInput,
} from './yard-work-plan-derivation';
import { returnedToServiceAfter, yardReadyToGoSince } from './yard-ready-window';
import { workOrderTeam } from '../work-orders/work-order-team';
import { blockerActivityLogsInclude, blockerLogDetails } from '../work-orders/work-order.mapper';
import { workOrderNextStep } from './work-order-next-step';
import { unavailableYardMovementFeeds } from './yard-movement-feeds';

const ACTIVE_OR_RESIDUAL_READY: Prisma.TruckReadinessAssessmentWhereInput = {
  OR: [
    { status: { in: [ReadinessAssessmentStatus.UNDER_REVIEW, ReadinessAssessmentStatus.READY] } },
    { status: ReadinessAssessmentStatus.CLOSED, readyAt: { not: null } },
  ],
};

/**
 * LTR-75 opción A — Readiness board membership.
 *
 * `GET /api/admin/yard-operations` and `getWorkPlanBoardCounts` include a truck
 * only while it has an active yard engagement:
 * - an open Work Order (`OPEN_WORK_ORDER_STATUSES`), which is the Work Plan, or
 * - a readiness assessment still in the yard workflow (`under_review`, `ready`,
 *   or closed with residual `readyAt`).
 *
 * Residual Ready stays on the board because Phase 1 has no Presence signal that
 * would clear a closed approval. Idle trucks (no open work and no active or
 * residual assessment) are omitted, so a WO/job/assessment wipe returns an empty
 * board. Phase is still derived from that same open work and assessment; this
 * predicate does not change six-gate or Work Plan derivation and does not read
 * presence, Samsara location, or truck identity. `presenceUnknown` stays a
 * fleet-wide presence fact (every truck is still UNKNOWN), not a board total.
 * PO: update CURRENT vs TARGET on LTR-32 from this predicate.
 */
const ACTIVE_YARD_ENGAGEMENT: Prisma.TruckWhereInput = {
  OR: [
    {
      workOrders: {
        some: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
      },
    },
    { readinessAssessments: { some: ACTIVE_OR_RESIDUAL_READY } },
  ],
};

/**
 * LTR-90 / D1: with the Work Plan board, a truck whose Work Order was completed
 * since `YARD_READY_TO_GO_SINCE` stays engaged (Ready to Go) until it is
 * Returned to Service. The RTS comparison happens in memory (attachReadyWorkOrders).
 */
function activeYardEngagement(): Prisma.TruckWhereInput {
  const since = yardReadyToGoSince();
  if (!since) return ACTIVE_YARD_ENGAGEMENT;
  return {
    OR: [
      ...(ACTIVE_YARD_ENGAGEMENT.OR as Prisma.TruckWhereInput[]),
      { workOrders: { some: { status: WorkOrderStatus.completed, completedAt: { gte: since } } } },
    ],
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const summaryWorkOrderInclude = {
  truck: true,
  primaryCategory: true,
  // Work Plan derivation needs category/name.
  jobs: {
    include: {
      category: { select: { id: true, name: true } },
      // LTR-159: the Next step needs each Job's owner.
      assignedMechanic: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  mechanics: {
    where: { removedAt: null },
    include: { mechanic: { select: { id: true, name: true } } },
    orderBy: { addedAt: 'asc' as const },
  },
  // Open official pause + active (unresolved) mechanic blockers (LTR-98).
  pauseEvents: {
    where: { OR: [{ endedAt: null }, { isOfficialPause: false, resolvedAt: null }] } as Prisma.PauseEventWhereInput,
    include: {
      job: { select: { id: true, displayName: true } },
      reportedBy: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: 'desc' as const },
    take: 5,
  },
  // LTR-164 (#8): the active blocker's notes on the Truck and the Yard card.
  activityLogs: blockerActivityLogsInclude,
} as const;

const yardTruckInclude = {
  workOrders: {
    where: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
    include: summaryWorkOrderInclude,
    orderBy: { createdAt: 'desc' as const },
  },
  readinessAssessments: {
    where: ACTIVE_OR_RESIDUAL_READY,
    orderBy: { updatedAt: 'desc' as const },
    take: 1,
    include: {
      requirements: { orderBy: { type: 'asc' as const } },
      workOrders: {
        where: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
        include: summaryWorkOrderInclude,
        orderBy: { createdAt: 'desc' as const },
      },
    },
  },
  serviceStatusEvents: {
    orderBy: { occurredAt: 'desc' as const },
    take: 1,
  },
} as const;

type SummaryWorkOrderRow = Prisma.WorkOrderGetPayload<{ include: typeof summaryWorkOrderInclude }>;
type YardAssessmentRow = {
  id: string;
  truckId: string;
  status: string;
  version: number;
  startedAt: Date;
  startedById: string;
  readyAt: Date | null;
  approvedById: string | null;
  closedAt: Date | null;
  closedById: string | null;
  closedReason: string | null;
  requirements: Array<{
    id: string;
    type: string;
    outcome: string;
    waiverReason: string | null;
    evidenceWorkOrderId: string | null;
    evaluatedById: string | null;
    evaluatedAt: Date | null;
    version: number;
  }>;
  workOrders: SummaryWorkOrderRow[];
};
type YardTruckRow = {
  id: string;
  truckNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  company: string | null;
  owner: string | null;
  vin?: string | null;
  samsaraTruckLocation?: string | null;
  samsaraLastConnectedDate?: Date | null;
  workOrders: SummaryWorkOrderRow[];
  readinessAssessments: YardAssessmentRow[];
  serviceStatusEvents: Array<{ status: string; occurredAt: Date }>;
  /** LTR-90: last completed Work Order still awaiting Return to Service. */
  readyWorkOrder?: SummaryWorkOrderRow | null;
};

/** PF9 (c): the engaged Trucks in page order, with the count of every Truck. */
type Board = { presenceUnknown: number; rows: YardTruckRow[] };

type YardOperationsCountRow = {
  workOrders: Array<{
    id: string;
    displayId?: string;
    status: string;
    version?: number;
    primaryCategory?: { id: string; name: string };
    jobs?: Array<{
      id: string;
      catalogJobId: string | null;
      displayName: string;
      customDescription: string | null;
      status: string;
      category: { id: string; name: string };
    }>;
  }>;
  readinessAssessments: Array<{
    status: string;
    readyAt: Date | string | null;
    requirements: Array<{ type: string; outcome: string }>;
    workOrders: Array<{ id: string; status: string }>;
  }>;
};

@Injectable()
export class YardOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trucks: TrucksService,
    private readonly activity: ActivityLogService,
  ) {}

  async startAssessment(user: AuthUser, truckId: string, raw: unknown) {
    const parsed = startReadinessAssessmentSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    this.assertUuid(truckId, 'Invalid Truck id');
    const operation = 'start_assessment';
    const targetKey = `truck:${truckId}`;
    const payloadHash = idempotencyFingerprint({ truckId });
    return this.withIdempotencyRecovery(parsed.data.idempotencyKey, operation, targetKey, payloadHash, user.id, async () => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await lockTruckMutation(tx, truckId);
          const stored = await this.findIdempotentInTransaction(
            tx,
            parsed.data.idempotencyKey,
            operation,
            targetKey,
            payloadHash,
            user.id,
          );
          if (stored) return stored;
          const truck = await tx.truck.findUnique({ where: { id: truckId } });
          if (!truck) throw new NotFoundException('Truck not found');

          const active = await tx.truckReadinessAssessment.findFirst({
            where: { truckId, status: { in: ['under_review', 'ready'] } },
            orderBy: { updatedAt: 'desc' },
          });
          if (active) {
            throw new ConflictException({
              code: 'ACTIVE_READINESS_ASSESSMENT_EXISTS',
              message: 'Truck already has an active readiness assessment.',
              assessmentId: active.id,
            });
          }

          const assessment = await tx.truckReadinessAssessment.create({
            data: {
              truckId,
              startedById: user.id,
              requirements: {
                create: READINESS_REQUIREMENT_TYPES.map((type) => ({ type })),
              },
            },
            include: { requirements: { orderBy: { type: 'asc' } } },
          });

          const openWorkOrder = await tx.workOrder.findFirst({
            where: { truckId, status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
            orderBy: { createdAt: 'asc' },
            select: { id: true, displayId: true, status: true },
          });
          if (openWorkOrder) {
            await tx.workOrder.update({
              where: { id: openWorkOrder.id },
              data: { readinessAssessmentId: assessment.id },
            });
          }

          await this.activity.log(tx, {
            eventType: ActivityEventType.READINESS_ASSESSMENT_STARTED,
            entityType: 'readiness_assessment',
            entityId: assessment.id,
            userId: user.id,
            previousValue: null,
            newValue: { status: assessment.status, version: assessment.version },
            relevantValue: { truckId, linkedWorkOrderId: openWorkOrder?.id ?? null },
          });

          const result = {
            assessment: toReadinessAssessmentDto(assessment as never),
            linkedWorkOrderId: openWorkOrder?.id ?? null,
          };
          await tx.readinessMutation.create({
            data: {
              idempotencyKey: parsed.data.idempotencyKey,
              assessmentId: assessment.id,
              targetKey,
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
          const existing = await this.findIdempotent(parsed.data.idempotencyKey, operation, targetKey, payloadHash, user.id);
          if (existing) return existing;
          throw new ConflictException('Truck already has an active readiness assessment.');
        }
        throw error;
      }
    });
  }

  async updateRequirement(user: AuthUser, assessmentId: string, routeType: string, raw: unknown) {
    this.assertUuid(assessmentId, 'Invalid readiness assessment id');
    const parsed = updateReadinessRequirementSchema.safeParse({ ...(raw as Record<string, unknown>), type: routeType });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input: UpdateReadinessRequirementInput = parsed.data;
    const operation = `update_requirement:${input.type}`;
    const targetKey = `assessment:${assessmentId}:requirement:${input.type}`;
    const payloadHash = idempotencyFingerprint({
      assessmentId,
      type: input.type,
      outcome: input.outcome,
      expectedVersion: input.expectedVersion,
      waiverReason: input.waiverReason ?? null,
      evidenceWorkOrderId: input.evidenceWorkOrderId ?? null,
    });
    return this.withIdempotencyRecovery(input.idempotencyKey, operation, targetKey, payloadHash, user.id, async () => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const assessmentForLock = await tx.truckReadinessAssessment.findUnique({
            where: { id: assessmentId },
            select: { truckId: true },
          });
          if (!assessmentForLock) throw new NotFoundException('Readiness assessment not found');
          await lockTruckMutation(tx, assessmentForLock.truckId);
          const stored = await this.findIdempotentInTransaction(
            tx,
            input.idempotencyKey,
            operation,
            targetKey,
            payloadHash,
            user.id,
          );
          if (stored) return stored;
          const assessment = await tx.truckReadinessAssessment.findUnique({
            where: { id: assessmentId },
            include: { requirements: true },
          });
          if (!assessment) throw new NotFoundException('Readiness assessment not found');
          if (assessment.status === ReadinessAssessmentStatus.CLOSED) {
            throw new BadRequestException('Closed readiness assessments cannot be changed');
          }
          const requirement = assessment.requirements.find((item) => item.type === input.type);
          if (!requirement) throw new NotFoundException('Readiness requirement not found');

          const evidence = input.evidenceWorkOrderId
            ? await tx.workOrder.findUnique({
                where: { id: input.evidenceWorkOrderId },
                select: {
                  id: true,
                  truckId: true,
                  status: true,
                  displayId: true,
                  readinessAssessmentId: true,
                  primaryCategory: { select: { name: true } },
                  jobs: { select: { category: { select: { name: true } } } },
                },
              })
            : null;
          if (input.evidenceWorkOrderId && !evidence) {
            throw new BadRequestException('Evidence Work Order not found');
          }
          if (evidence && evidence.truckId !== assessment.truckId) {
            throw new BadRequestException('Evidence Work Order must belong to the same Truck');
          }
          if (evidence && evidence.status !== WorkOrderStatus.completed) {
            throw new BadRequestException('Evidence Work Order must be completed');
          }
          if (evidence && evidence.readinessAssessmentId !== assessmentId) {
            throw new BadRequestException('Evidence Work Order must be linked to this readiness assessment');
          }
          if (evidence && !this.isRelevantEvidence(input.type, evidence)) {
            throw new BadRequestException('Evidence Work Order category does not satisfy this requirement');
          }
          if (input.outcome === ReadinessRequirementOutcome.COMPLETED &&
              [ReadinessRequirementType.PM, ReadinessRequirementType.ALIGNMENT, ReadinessRequirementType.REQUIRED_REPAIRS].includes(input.type) &&
              !evidence) {
            throw new BadRequestException('Completed maintenance requirements need a completed evidence Work Order');
          }
          if (input.outcome !== ReadinessRequirementOutcome.COMPLETED && input.evidenceWorkOrderId) {
            throw new BadRequestException('Evidence Work Order is only valid for a completed requirement');
          }

          const updatedRequirement = await tx.readinessRequirement.updateMany({
            where: { id: requirement.id, assessmentId, version: input.expectedVersion },
            data: {
              outcome: input.outcome,
              waiverReason: input.outcome === ReadinessRequirementOutcome.WAIVED ? input.waiverReason : null,
              evidenceWorkOrderId: input.evidenceWorkOrderId ?? null,
              evaluatedById: user.id,
              evaluatedAt: new Date(),
              version: { increment: 1 },
            },
          });
          if (!updatedRequirement.count) throw this.versionConflict('Requirement version changed');

          const outcomeBecameUnresolved = [
            ReadinessRequirementOutcome.REQUIRED,
            ReadinessRequirementOutcome.NOT_EVALUATED,
          ].includes(input.outcome);
          const invalidated = assessment.status === ReadinessAssessmentStatus.READY && outcomeBecameUnresolved;
          const updatedAssessment = await tx.truckReadinessAssessment.update({
            where: { id: assessmentId },
            data: {
              version: { increment: 1 },
              ...(invalidated ? { status: ReadinessAssessmentStatus.UNDER_REVIEW, readyAt: null, approvedById: null } : {}),
            },
            include: { requirements: { orderBy: { type: 'asc' } } },
          });

          await this.activity.log(tx, {
            eventType: ActivityEventType.READINESS_REQUIREMENT_UPDATED,
            entityType: 'readiness_requirement',
            entityId: requirement.id,
            userId: user.id,
            previousValue: {
              outcome: requirement.outcome,
              waiverReason: requirement.waiverReason,
              evidenceWorkOrderId: requirement.evidenceWorkOrderId,
              version: requirement.version,
            },
            newValue: {
              outcome: input.outcome,
              waiverReason: input.waiverReason ?? null,
              evidenceWorkOrderId: input.evidenceWorkOrderId ?? null,
              version: requirement.version + 1,
            },
            relevantValue: { assessmentId, truckId: assessment.truckId, type: input.type },
          });
          if (invalidated) {
            await this.activity.log(tx, {
              eventType: ActivityEventType.READINESS_APPROVAL_INVALIDATED,
              entityType: 'readiness_assessment',
              entityId: assessment.id,
              userId: user.id,
              previousValue: { status: ReadinessAssessmentStatus.READY, approvedById: assessment.approvedById },
              newValue: { status: ReadinessAssessmentStatus.UNDER_REVIEW, approvedById: null },
              relevantValue: { reason: 'requirement_changed', requirementType: input.type },
            });
          }

          const result = {
            assessment: toReadinessAssessmentDto(updatedAssessment as never),
            requirement: toReadinessAssessmentDto(updatedAssessment as never).requirements.find((item) => item.type === input.type),
          };
          await tx.readinessMutation.create({
            data: {
              idempotencyKey: input.idempotencyKey,
              assessmentId,
              targetKey,
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
          const existing = await this.findIdempotent(input.idempotencyKey, operation, targetKey, payloadHash, user.id);
          if (existing) return existing;
        }
        throw error;
      }
    });
  }

  private assertUuid(value: string, message: string) {
    if (!UUID_PATTERN.test(value)) throw new BadRequestException(message);
  }

  private isRelevantEvidence(
    type: ReadinessRequirementType,
    evidence: {
      primaryCategory: { name: string };
      jobs: Array<{ category: { name: string } }>;
    },
  ) {
    const names = [evidence.primaryCategory.name, ...evidence.jobs.map((job) => job.category.name)]
      .map((name) => name.trim().toLowerCase());
    if (type === ReadinessRequirementType.PM) return names.includes('pm');
    if (type === ReadinessRequirementType.ALIGNMENT) return names.includes('alignment');
    // Required repairs are represented by a completed standard Work Order;
    // PM is a separate maintenance category and cannot satisfy this one.
    if (type === ReadinessRequirementType.REQUIRED_REPAIRS) return !names.includes('pm');
    return true;
  }

  private versionConflict(message: string) {
    return new ConflictException({ code: 'VERSION_CONFLICT', message });
  }

  private isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async findIdempotent(
    key: string,
    operation: string,
    targetKey: string,
    payloadHash: string,
    actorId: string,
  ) {
    const existing = await this.prisma.readinessMutation.findUnique({ where: { idempotencyKey: key } });
    if (!existing) return null;
    if (
      existing.operation !== operation ||
      existing.targetKey !== targetKey ||
      existing.payloadHash !== payloadHash ||
      existing.actorId !== actorId
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSE',
        message: 'Idempotency key was already used for a different readiness mutation.',
      });
    }
    return existing.result as { assessment: unknown };
  }

  private async findIdempotentInTransaction(
    tx: Prisma.TransactionClient,
    key: string,
    operation: string,
    targetKey: string,
    payloadHash: string,
    actorId: string,
  ) {
    const existing = await tx.readinessMutation.findUnique({ where: { idempotencyKey: key } });
    if (!existing) return null;
    if (
      existing.operation !== operation ||
      existing.targetKey !== targetKey ||
      existing.payloadHash !== payloadHash ||
      existing.actorId !== actorId
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSE',
        message: 'Idempotency key was already used for a different readiness mutation.',
      });
    }
    return existing.result as { assessment: unknown };
  }

  private async withIdempotencyRecovery<T>(
    key: string,
    operation: string,
    targetKey: string,
    payloadHash: string,
    actorId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const existing = await this.findIdempotent(key, operation, targetKey, payloadHash, actorId);
    return existing ? existing as T : action();
  }

  async list(rawQuery: unknown): Promise<YardOperationsPageDto> {
    const parsed = adminYardOperationsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    const decodedCursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const items: YardOperationsTruckDto[] = [];
    let rawCursor = decodedCursor;
    let hasMore = false;

    // PF9 (c): without a search or a mechanic filter the page and the counts read the very same board, so it is
    // read once (in the page's order) and paged here from the cursor. If the cursor's Truck left the board, the
    // database path below takes over, so the page is the same one it always was.
    const board = query.search || query.mechanicId ? null : await this.loadBoard();
    const cursorIndex = board && decodedCursor
      ? board.rows.findIndex((row) => row.truckNumber === decodedCursor.truckNumber && row.id === decodedCursor.id)
      : -1;
    if (board && (!decodedCursor || cursorIndex >= 0)) {
      for (let index = cursorIndex + 1; index < board.rows.length; index += 1) {
        const row = board.rows[index];
        if (isCompletedOnlyWithoutReadyWork(row)) continue;
        const item = this.toTruckItem(row);
        if (!this.matchesDerivedFilters(item, query)) continue;
        items.push(item);
        if (items.length === query.limit) {
          hasMore = index < board.rows.length - 1;
          break;
        }
      }
      const counts = await this.getCounts(query, board);
      return this.pageDto(items, hasMore, counts);
    }

    while (items.length < query.limit) {
      const rows = await this.prisma.truck.findMany({
        where: this.buildWhere(query, rawCursor),
        include: yardTruckInclude as never,
        orderBy: [{ truckNumber: 'asc' }, { id: 'asc' }],
        take: query.limit + 1,
      }) as unknown as YardTruckRow[];
      await this.attachReadyWorkOrders(rows);
      const pageRows = rows.length > query.limit ? rows.slice(0, query.limit) : rows;
      const rawHasMore = rows.length > query.limit;
      if (!pageRows.length) break;

      for (let index = 0; index < pageRows.length; index += 1) {
        if (isCompletedOnlyWithoutReadyWork(pageRows[index])) continue;
        const item = this.toTruckItem(pageRows[index]);
        if (!this.matchesDerivedFilters(item, query)) continue;
        items.push(item);
        if (items.length === query.limit) {
          hasMore = rawHasMore || index < pageRows.length - 1;
          break;
        }
      }

      if (items.length === query.limit) break;
      if (!rawHasMore) break;
      rawCursor = {
        truckNumber: pageRows[pageRows.length - 1].truckNumber,
        id: pageRows[pageRows.length - 1].id,
      };
    }

    const counts = await this.getCounts(query, board);
    return this.pageDto(items, hasMore, counts);
  }

  private pageDto(items: YardOperationsTruckDto[], hasMore: boolean, counts: YardOperationsPageDto['counts']): YardOperationsPageDto {
    const feeds = this.movementFeeds();
    return {
      items,
      nextCursor: hasMore && items.length ? this.encodeCursorFromItem(items[items.length - 1]) : null,
      counts,
      workLocation: feeds.workLocation,
      incomingTrucks: feeds.incomingTrucks,
      upcomingDepartures: feeds.upcomingDepartures,
      // Deprecated (LTR-150): Work Plan board and PM phase are the only mode; kept for web/API deploy skew.
      workPlanBoardCutover: true,
      pmPhaseEnabled: true,
    };
  }

  /** Truck Detail without `workPlan`; the controller attaches it (needs the requesting user). */
  async detail(id: string): Promise<Omit<AdminTruckDetailDto, 'workPlan'>> {
    if (!UUID_PATTERN.test(id)) throw new BadRequestException('Invalid Truck id');
    const row = await this.prisma.truck.findUnique({ where: { id }, include: yardTruckInclude as never }) as unknown as YardTruckRow | null;
    if (!row) throw new NotFoundException('Truck not found');
    await this.attachReadyWorkOrders([row]);
    const item = this.toTruckItem(row);
    const history = await this.trucks.getRepairHistory(id, undefined, { limit: 5 });
    return {
      ...item,
      repairHistory: { items: history.items, nextCursor: history.nextCursor },
      repairHistoryUrl: `/api/admin/trucks/${id}/repair-history`,
      incomingTrucks: this.unavailable(),
      upcomingDepartures: this.unavailable(),
    };
  }

  private toTruckItem(row: YardTruckRow): YardOperationsTruckDto {
    const assessment = row.readinessAssessments[0] ?? null;
    const mappedAssessment = assessment ? toReadinessAssessmentDto({
      ...assessment,
      status: assessment.status as never,
      requirements: assessment.requirements.map((requirement) => ({
        ...requirement,
        type: requirement.type as never,
        outcome: requirement.outcome as never,
      })),
    }) : null;
    const linkedWorkOrders = (assessment?.workOrders.length ? assessment.workOrders : row.workOrders)
      .map(toAdminWorkOrderSummary);
    const openOnTruck = row.workOrders.map(toAdminWorkOrderSummary);
    const linkedForDerivation = openOnTruck.length ? openOnTruck : linkedWorkOrders;
    const currentWorkOrder = row.workOrders[0] ?? row.readyWorkOrder ?? null;
    const activeWorkOrder = currentWorkOrder ? toAdminWorkOrderSummary(currentWorkOrder) : null;
    const latestService = row.serviceStatusEvents[0];
    const operationalStatus = latestService?.status === 'in_service'
      ? TruckOperationalStatus.IN_SERVICE
      : latestService?.status === 'off_duty'
        ? TruckOperationalStatus.OFF_DUTY
        : TruckOperationalStatus.UNKNOWN;

    const workPlan = deriveWorkPlan(workPlanInputFromYardRow(row));
    const inspectionRequirement = row.readinessAssessments[0]?.requirements.find(
      (requirement) => requirement.type === ReadinessRequirementType.INSPECTION,
    );
    // LTR-159: the same Next step as Truck Detail, Dashboard and the Work Order.
    const nextStep = currentWorkOrder
      ? workOrderNextStep(currentWorkOrder, { inspectionRequirementOutcome: inspectionRequirement?.outcome ?? null })
      : deriveTruckNextStep({ workOrder: null, inspectionOutcome: workPlan.inspection.outcome, jobs: [] });
    return {
      truck: toTruckDto(row),
      presence: { state: YardPresenceState.UNKNOWN, provenance: 'phase_1_unavailable' },
      operationalStatus,
      operationalStatusAt: latestService?.occurredAt.toISOString() ?? null,
      assessment: mappedAssessment,
      phase: workPlan.phase,
      blockers: workPlanBoardBlockers(workPlan, linkedForDerivation),
      activeWorkOrder,
      readyReason: workPlan.readyReason,
      shopWorkRemainingCount: workPlan.shopWorkRemainingCount,
      nextStep,
      // LTR-188 / D24: a pending Job sent the whole truck to an external shop. Phase and counters stay as they are.
      outOfShop: workPlan.jobs.some((job) => job.external?.kind === JobExternalKind.TRUCK),
      outOfShopJobName: workPlan.jobs.find((job) => job.external?.kind === JobExternalKind.TRUCK)?.displayName ?? null,
    };
  }

  /**
   * Stage 8 (D8): the shop's side for the Dispatch tab — Work Plan step, Ready to Go and Jobs left — for the
   * Truck numbers Dispatch names. One query; Trucks with no shop engagement come back without a step.
   */
  async shopStatusByTruckNumber(numbers: string[]): Promise<Map<string, { phase: string; readyToGo: boolean; jobsLeft: number; truckId: string; openWorkOrder: { id: string; displayId: string } | null; outOfShop: boolean }>> {
    const result = new Map<string, { phase: string; readyToGo: boolean; jobsLeft: number; truckId: string; openWorkOrder: { id: string; displayId: string } | null; outOfShop: boolean }>();
    if (!numbers.length) return result;
    const rows = await this.prisma.truck.findMany({
      where: { AND: [activeYardEngagement(), { truckNumber: { in: numbers } }] },
      include: yardTruckInclude as never,
    }) as unknown as YardTruckRow[];
    await this.attachReadyWorkOrders(rows);
    for (const row of rows) {
      if (isCompletedOnlyWithoutReadyWork(row)) continue;
      const item = this.toTruckItem(row);
      const workOrder = item.activeWorkOrder;
      const open = workOrder && workOrder.status !== 'completed' && workOrder.status !== 'cancelled' ? workOrder : null;
      result.set(row.truckNumber, {
        phase: item.phase,
        readyToGo: item.phase === 'ready_to_go',
        jobsLeft: workOrder ? Math.max(0, workOrder.jobsTotal - workOrder.jobsCompleted) : 0,
        truckId: row.id,
        openWorkOrder: open ? { id: open.id, displayId: open.displayId } : null,
        outOfShop: Boolean(item.outOfShop),
      });
    }
    return result;
  }

  /**
   * Filters that read the Truck's current Work Order (open, or completed and still Ready to Go).
   * D11: priority and Work Order status look at that Work Order only, never at older closed ones.
   * `skipQuick` leaves out the quick filters (blocked, priority, out of shop) to count them.
   */
  private matchesDerivedFilters(item: YardOperationsTruckDto, query: AdminYardOperationsQuery, skipQuick = false) {
    const readiness = workPlanBoardReadinessFilter(item.phase);
    const blocked = isWorkPlanBoardBlocked(item.activeWorkOrder ? [item.activeWorkOrder] : []);
    const workOrder = item.activeWorkOrder;
    return (!query.readiness || query.readiness.includes(readiness as YardReadinessFilter))
      && (!query.phase || (query.phase as string[]).includes(item.phase))
      && (!query.workOrderStatus || Boolean(workOrder && (query.workOrderStatus as string[]).includes(workOrder.status)))
      && (skipQuick || query.blocked === undefined || query.blocked === blocked)
      && (skipQuick || !query.priority || Boolean(workOrder && (query.priority as string[]).includes(workOrder.priority)))
      && (skipQuick || query.outOfShop === undefined || query.outOfShop === Boolean(item.outOfShop))
      && (skipQuick || !query.soon || this.leavingSoon(item, query));
  }

  /** Stage 8: an open Truck that Dispatch expects to leave soon (the web sends those numbers). */
  private leavingSoon(item: YardOperationsTruckDto, query: AdminYardOperationsQuery) {
    const workOrder = item.activeWorkOrder;
    const open = Boolean(workOrder && workOrder.status !== 'completed' && workOrder.status !== 'cancelled');
    return open && Boolean(query.soonTrucks?.includes(item.truck.truckNumber));
  }

  private buildWhere(query: AdminYardOperationsQuery, cursor: AdminYardOperationsCursor | null): Prisma.TruckWhereInput {
    const filters: Prisma.TruckWhereInput[] = [activeYardEngagement()];
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filters.push({ OR: [
        { truckNumber: contains },
        { make: contains },
        { model: contains },
        { workOrders: { some: { displayId: contains } } },
        { workOrders: { some: { primaryCategory: { name: contains } } } },
        { workOrders: { some: { mechanics: { some: { removedAt: null, mechanic: { name: contains } } } } } },
      ] });
    }
    // D11: Work Order status and priority are matched in memory against the current Work Order.
    if (query.mechanicId) {
      filters.push({ workOrders: { some: { mechanics: { some: { mechanicId: query.mechanicId, removedAt: null } } } } });
    }
    // Ready is Work Plan derived — assessment Prisma filters would miss auto-Ready trucks.
    // `query.readiness` is applied in memory by matchesDerivedFilters.
    if (cursor) {
      filters.push({ OR: [
        { truckNumber: { gt: cursor.truckNumber } },
        { truckNumber: cursor.truckNumber, id: { gt: cursor.id } },
      ] });
    }
    return filters.length ? { AND: filters } : {};
  }

  private decodeCursor(encoded: string): AdminYardOperationsCursor {
    try {
      return adminYardOperationsCursorSchema.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
    } catch {
      throw new BadRequestException('Invalid or incompatible Yard Operations cursor');
    }
  }

  private encodeCursorFromItem(item: YardOperationsTruckDto) {
    return Buffer.from(JSON.stringify({ truckNumber: item.truck.truckNumber, id: item.truck.id })).toString('base64url');
  }

  /**
   * Stage 6 (D6, UX-6-002): the board's counts follow the filters — the buckets count the Trucks that
   * match every filter (all pages, not only the loaded one), `total` is the board without filters and
   * `quick` counts each quick filter with the other filters applied.
   */
  private async getCounts(query: AdminYardOperationsQuery, board: Board | null = null) {
    const { presenceUnknown, rows: allRows } = board ?? (await this.loadBoard());
    const toItems = (rows: YardTruckRow[]) => rows.filter((row) => !isCompletedOnlyWithoutReadyWork(row)).map((row) => this.toTruckItem(row));
    const allItems = toItems(allRows);
    // Search and mechanic narrow in the database (same as the list); the rest is matched in memory.
    const items = query.search || query.mechanicId ? toItems(await this.boardRows(query)) : allItems;
    const matching = items.filter((item) => this.matchesDerivedFilters(item, query));
    const quickScope = items.filter((item) => this.matchesDerivedFilters(item, query, true));
    let notStarted = 0;
    let underReview = 0;
    let readyToGo = 0;
    let blocked = 0;
    for (const item of matching) {
      const readiness = workPlanBoardReadinessFilter(item.phase);
      if (readiness === YardReadinessFilter.NOT_STARTED) notStarted += 1;
      if (readiness === YardReadinessFilter.UNDER_REVIEW) underReview += 1;
      if (readiness === YardReadinessFilter.READY) readyToGo += 1;
      if (isWorkPlanBoardBlocked(item.activeWorkOrder ? [item.activeWorkOrder] : [])) blocked += 1;
    }
    return {
      notStarted,
      underReview,
      readyToGo,
      blocked,
      presenceUnknown,
      matching: matching.length,
      total: allItems.length,
      quick: {
        all: quickScope.length,
        blocked: quickScope.filter((item) => isWorkPlanBoardBlocked(item.activeWorkOrder ? [item.activeWorkOrder] : [])).length,
        highPriority: quickScope.filter((item) => item.activeWorkOrder && ['high', 'critical'].includes(item.activeWorkOrder.priority)).length,
        outOfShop: quickScope.filter((item) => item.outOfShop).length,
        leavingSoon: quickScope.filter((item) => this.leavingSoon(item, query)).length,
      },
      byPhase: matching.reduce<Record<string, number>>((counts, item) => {
        counts[item.phase] = (counts[item.phase] ?? 0) + 1;
        return counts;
      }, {}),
    };
  }

  /** Board rows (with their Ready to Go Work Order); `query` narrows by search / mechanic, no cursor. */
  private async boardRows(query: AdminYardOperationsQuery | null) {
    const rows = await this.prisma.truck.findMany({
      where: query ? this.buildWhere(query, null) : activeYardEngagement(),
      include: yardTruckInclude as never,
      // Same order as the page query, so the board can be paged in memory (PF9 c).
      orderBy: [{ truckNumber: 'asc' }, { id: 'asc' }],
    }) as unknown as YardTruckRow[];
    await this.attachReadyWorkOrders(rows);
    return rows;
  }

  /** The whole board plus the Truck count, read together; shared by the page and the counts (PF9 c). */
  private async loadBoard(): Promise<Board> {
    const [presenceUnknown, rows] = await Promise.all([this.prisma.truck.count(), this.boardRows(null)]);
    return { presenceUnknown, rows };
  }

  /** LTR-164 (#12): the Dashboard's Ready to Go metric is the Yard's Work Plan count. */
  async countReadyToGoTrucks(): Promise<number> {
    return (await this.getWorkPlanBoardCounts()).readyToGo;
  }

  private async getWorkPlanBoardCounts() {
    const [presenceUnknown, rows] = await Promise.all([
      this.prisma.truck.count(),
      this.prisma.truck.findMany({
        where: activeYardEngagement(),
        include: yardTruckInclude as never,
      }) as unknown as Promise<YardTruckRow[]>,
    ]);
    await this.attachReadyWorkOrders(rows);

    let notStarted = 0;
    let underReview = 0;
    let readyToGo = 0;
    let blocked = 0;
    for (const row of rows) {
      if (isCompletedOnlyWithoutReadyWork(row)) continue;
      const workPlan = deriveWorkPlan(workPlanInputFromYardRow(row));
      const readiness = workPlanBoardReadinessFilter(workPlan.phase);
      // LTR-100: mutually exclusive buckets that add up to the board.
      if (readiness === YardReadinessFilter.NOT_STARTED) notStarted += 1;
      if (readiness === YardReadinessFilter.UNDER_REVIEW) underReview += 1;
      if (readiness === YardReadinessFilter.READY) readyToGo += 1;
      if (isWorkPlanBoardBlocked(row.workOrders.map(toAdminWorkOrderSummary))) blocked += 1;
    }
    return { notStarted, underReview, readyToGo, blocked, presenceUnknown };
  }

  /**
   * LTR-90 / D1: for trucks without an open Work Order, attach the last Work Order
   * completed since `YARD_READY_TO_GO_SINCE` unless the truck was Returned to
   * Service afterwards. One batched query per page.
   */
  private async attachReadyWorkOrders(rows: YardTruckRow[]): Promise<void> {
    const since = yardReadyToGoSince();
    const candidates = since ? rows.filter((row) => row.workOrders.length === 0) : [];
    if (!since || !candidates.length) return;
    const completed = await this.prisma.workOrder.findMany({
      where: {
        truckId: { in: candidates.map((row) => row.id) },
        status: WorkOrderStatus.completed,
        completedAt: { gte: since },
      },
      include: summaryWorkOrderInclude,
      orderBy: { completedAt: 'desc' },
    }) as unknown as Array<SummaryWorkOrderRow & { truckId: string; completedAt: Date | null }>;
    const latestByTruck = new Map<string, (typeof completed)[number]>();
    for (const workOrder of completed) {
      if (!latestByTruck.has(workOrder.truckId)) latestByTruck.set(workOrder.truckId, workOrder);
    }
    for (const row of candidates) {
      const latest = latestByTruck.get(row.id) ?? null;
      row.readyWorkOrder = latest && !returnedToServiceAfter(row.serviceStatusEvents[0], latest.completedAt)
        ? latest
        : null;
    }
  }

  private unavailable(): YardOperationsUnavailableDto {
    return { status: 'unavailable', reason: 'integration_not_connected' };
  }

  /**
   * Movement cards stay on `YardFeedDto` and unavailable until FE cutover
   * (LTR-74) to `GET /api/admin/yard/data-boundary`. Kit reads live only there.
   */
  private movementFeeds() {
    return unavailableYardMovementFeeds();
  }
}

/** Matched only by a completed Work Order that was already Returned to Service. */
function isCompletedOnlyWithoutReadyWork(row: YardTruckRow): boolean {
  if (!yardReadyToGoSince()) return false;
  return row.workOrders.length === 0 && row.readinessAssessments.length === 0 && !row.readyWorkOrder;
}

function workPlanInputFromYardRow(row: YardTruckRow): WorkPlanDerivationInput {
  const workOrder = row.workOrders[0] ?? row.readyWorkOrder ?? null;
  const assessment = row.readinessAssessments[0] ?? null;
  const inspectionRequirement = assessment?.requirements.find(
    (requirement) => requirement.type === ReadinessRequirementType.INSPECTION,
  );
  return {
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
          helperOfJobId: job.helperOfJobId,
          externalSince: job.externalSince,
          externalKind: job.externalKind,
          externalNote: job.externalNote,
          workflowStepKey: job.workflowStepKey,
          systemKey: job.systemKey,
        })),
    inspectionRequirementOutcome: (inspectionRequirement?.outcome as ReadinessRequirementOutcome | undefined) ?? null,
  };
}

/**
 * LTR-92 / D5: on the Work Plan board "Blocked" means work is actually stopped —
 * an official pause. Open work alone is not a blocker. Mechanic-reported blockers
 * join once they have an active/resolved state (LTR-98).
 */
function isWorkPlanBoardBlocked(openWorkOrders: Pick<AdminWorkOrderSummaryDto, 'status' | 'latestReportedBlocker'>[]): boolean {
  // LTR-98: an unresolved mechanic blocker also stops the truck.
  // LTR-121: same Blocked definition as the Dashboard attention (shared).
  return openWorkOrders.some((workOrder) => isWorkOrderBlocked({
    status: workOrder.status,
    hasActiveBlocker: Boolean(workOrder.latestReportedBlocker),
  }));
}

function workPlanBoardReadinessFilter(phase: string): YardReadinessFilter {
  if (phase === WorkPlanPhase.READY_TO_GO) return YardReadinessFilter.READY;
  if (phase === WorkPlanPhase.INSPECTION) return YardReadinessFilter.NOT_STARTED;
  return YardReadinessFilter.UNDER_REVIEW;
}

function workPlanBoardBlockers(
  workPlan: ReturnType<typeof deriveWorkPlan>,
  openWorkOrders: AdminWorkOrderSummaryDto[],
): ReadinessBlockerDto[] {
  if (workPlan.readiness === WorkPlanReadiness.READY) return [];

  const blockers: ReadinessBlockerDto[] = openWorkOrders.map((workOrder) => ({
    kind: 'open_work_order',
    workOrderId: workOrder.id,
    status: workOrder.status,
    priority: workOrder.priority,
    categoryName: workOrder.category.name,
    pauseReason: workOrder.currentPause?.reason ?? null,
  }));

  const reasonType: Partial<Record<WorkPlanNotReadyReason, ReadinessRequirementType>> = {
    [WorkPlanNotReadyReason.INSPECTION_PENDING]: ReadinessRequirementType.INSPECTION,
    [WorkPlanNotReadyReason.JOBS_REMAINING]: ReadinessRequirementType.REQUIRED_REPAIRS,
    [WorkPlanNotReadyReason.PM_PENDING]: ReadinessRequirementType.PM,
    [WorkPlanNotReadyReason.ALIGNMENT_PENDING]: ReadinessRequirementType.ALIGNMENT,
    [WorkPlanNotReadyReason.DETAILING_PENDING]: ReadinessRequirementType.DETAILING,
    [WorkPlanNotReadyReason.QC_PENDING]: ReadinessRequirementType.QUALITY_CHECK,
  };
  const requirementType = reasonType[workPlan.readyReason];
  if (requirementType) {
    blockers.push({ kind: 'required_requirement', requirementType });
  }
  return blockers;
}

function toAdminWorkOrderSummary(row: SummaryWorkOrderRow): AdminWorkOrderSummaryDto {
  const jobs = row.primaryCategory.name === 'PM' ? [] : row.jobs;
  const currentPause = row.pauseEvents.find((pause) => !pause.endedAt && pause.isOfficialPause !== false) ?? null;
  const activeBlocker = row.pauseEvents.find((pause) => pause.isOfficialPause === false && !pause.resolvedAt) ?? null;
  return {
    id: row.id,
    displayId: row.displayId,
    truck: {
      id: row.truck.id,
      truckNumber: row.truck.truckNumber,
      make: row.truck.make,
      model: row.truck.model,
      year: row.truck.year,
    },
    category: { id: row.primaryCategory.id, name: row.primaryCategory.name },
    status: row.status as never,
    priority: row.priority as never,
    jobsCompleted: jobs.filter((job) => job.status === 'completed').length,
    jobsTotal: jobs.length,
    // LTR-164 (#11) / D11: the team includes every Job owner, the PM mechanic too.
    mechanics: workOrderTeam(row.mechanics, row.jobs, row.createdAt).map((member) => ({
      mechanicId: member.mechanicId,
      mechanicName: member.mechanicName,
      addedAt: member.addedAt.toISOString(),
      removedAt: null,
    })),
    currentPause: currentPause ? {
      id: currentPause.id,
      workOrderId: currentPause.workOrderId,
      reason: currentPause.reason as never,
      notes: currentPause.notes,
      startedAt: currentPause.startedAt.toISOString(),
      endedAt: currentPause.endedAt?.toISOString() ?? null,
      durationMs: currentPause.durationMs === null ? null : Number(currentPause.durationMs),
      isOfficialPause: true,
      reportedBy: null,
    } : null,
    latestReportedBlocker: activeBlocker ? {
      id: activeBlocker.id,
      workOrderId: activeBlocker.workOrderId,
      reason: activeBlocker.reason as never,
      notes: activeBlocker.notes,
      startedAt: activeBlocker.startedAt.toISOString(),
      endedAt: activeBlocker.endedAt?.toISOString() ?? null,
      durationMs: activeBlocker.durationMs === null ? null : Number(activeBlocker.durationMs),
      isOfficialPause: false,
      reportedBy: activeBlocker.reportedBy ?? null,
      resolvedAt: null,
      // LTR-155 / D17: the blocked Job and mechanic reason for "Blocked · reason".
      job: activeBlocker.job ?? null,
      blockerReason: (activeBlocker.blockerReason ?? null) as never,
      ...blockerLogDetails(activeBlocker.id, row.activityLogs),
    } : null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
