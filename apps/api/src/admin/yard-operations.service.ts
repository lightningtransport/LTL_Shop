import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Priority, WorkOrderStatus } from '@prisma/client';
import {
  ActivityEventType,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  OPEN_WORK_ORDER_STATUSES,
  ReadinessAssessmentStatus,
  YardPresenceState,
  YardReadinessFilter,
  TruckOperationalStatus,
  type AdminTruckDetailDto,
  type AdminWorkOrderSummaryDto,
  type YardOperationsPageDto,
  type YardOperationsTruckDto,
  type YardOperationsUnavailableDto,
  type AdminYardOperationsCursor,
  type AdminYardOperationsQuery,
  startReadinessAssessmentSchema,
  updateReadinessRequirementSchema,
  markReadinessReadySchema,
  closeReadinessAssessmentSchema,
  type StartReadinessAssessmentInput,
  type UpdateReadinessRequirementInput,
  type MarkReadinessReadyInput,
  type CloseReadinessAssessmentInput,
  adminYardOperationsCursorSchema,
  adminYardOperationsQuerySchema,
} from '@ltl-shop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TrucksService } from '../trucks/trucks.service';
import { toTruckDto } from '../trucks/trucks.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { idempotencyFingerprint } from '../common/idempotency';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import {
  deriveReadiness,
  READINESS_REQUIREMENT_TYPES,
  toReadinessAssessmentDto,
} from './yard-operations-derivation';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const summaryWorkOrderInclude = {
  truck: true,
  primaryCategory: true,
  jobs: { select: { status: true } },
  mechanics: {
    where: { removedAt: null },
    include: { mechanic: { select: { id: true, name: true } } },
    orderBy: { addedAt: 'asc' as const },
  },
  pauseEvents: {
    where: { endedAt: null },
    orderBy: { startedAt: 'desc' as const },
    take: 1,
  },
} as const;

const yardTruckInclude = {
  workOrders: {
    where: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
    include: summaryWorkOrderInclude,
    orderBy: { createdAt: 'desc' as const },
  },
  readinessAssessments: {
    where: {
      status: { in: ['under_review', 'ready'] },
    },
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
  workOrders: SummaryWorkOrderRow[];
  readinessAssessments: YardAssessmentRow[];
  serviceStatusEvents: Array<{ status: string; occurredAt: Date }>;
};

type YardOperationsCountRow = {
  readinessAssessments: Array<{
    status: string;
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

          const invalidated = assessment.status === ReadinessAssessmentStatus.READY;
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

  async markReady(user: AuthUser, assessmentId: string, raw: unknown) {
    this.assertUuid(assessmentId, 'Invalid readiness assessment id');
    const parsed = markReadinessReadySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input: MarkReadinessReadyInput = parsed.data;
    const operation = 'mark_ready';
    const targetKey = `assessment:${assessmentId}`;
    const payloadHash = idempotencyFingerprint({ assessmentId, expectedVersion: input.expectedVersion });
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
            include: { requirements: true, workOrders: { select: { id: true, status: true } } },
          });
          if (!assessment) throw new NotFoundException('Readiness assessment not found');
          if (assessment.status === ReadinessAssessmentStatus.CLOSED) throw new BadRequestException('Closed readiness assessments cannot be approved');
          const missing = READINESS_REQUIREMENT_TYPES.filter((type) => {
            const requirement = assessment.requirements.find((item) => item.type === type);
            return !requirement || [ReadinessRequirementOutcome.NOT_EVALUATED, ReadinessRequirementOutcome.REQUIRED].includes(String(requirement.outcome) as ReadinessRequirementOutcome);
          });
          if (missing.length) throw new ConflictException({ code: 'READINESS_NOT_READY', message: 'All readiness requirements must be resolved before approval.', requirements: missing });
          const invalidWaivers = assessment.requirements.filter((requirement) =>
            String(requirement.outcome) === ReadinessRequirementOutcome.WAIVED && !requirement.waiverReason,
          );
          if (invalidWaivers.length) {
            throw new ConflictException({
              code: 'INVALID_WAIVER',
              message: 'Every waived requirement must have a reason before approval.',
              requirements: invalidWaivers.map((requirement) => requirement.type),
            });
          }
          const openWorkOrders = assessment.workOrders.filter((workOrder) => (OPEN_WORK_ORDER_STATUSES as string[]).includes(workOrder.status));
          if (openWorkOrders.length) throw new ConflictException({ code: 'OPEN_WORK_ORDER_EXISTS', message: 'An open linked Work Order blocks readiness approval.', workOrderIds: openWorkOrders.map((item) => item.id) });

          const updated = await tx.truckReadinessAssessment.updateMany({
            where: { id: assessmentId, version: input.expectedVersion, status: ReadinessAssessmentStatus.UNDER_REVIEW },
            data: { status: ReadinessAssessmentStatus.READY, readyAt: new Date(), approvedById: user.id, version: { increment: 1 } },
          });
          if (!updated.count) throw this.versionConflict('Readiness assessment version changed');
          const resultRow = await tx.truckReadinessAssessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { requirements: { orderBy: { type: 'asc' } } } });
          await this.activity.log(tx, {
            eventType: ActivityEventType.READINESS_APPROVED,
            entityType: 'readiness_assessment', entityId: assessmentId, userId: user.id,
            previousValue: { status: assessment.status, version: assessment.version },
            newValue: { status: resultRow.status, version: resultRow.version, approvedById: user.id },
            relevantValue: { truckId: assessment.truckId },
          });
          const result = { assessment: toReadinessAssessmentDto(resultRow as never) };
          await tx.readinessMutation.create({ data: {
            idempotencyKey: input.idempotencyKey,
            assessmentId,
            targetKey,
            operation,
            payloadHash,
            actorId: user.id,
            result: result as unknown as Prisma.InputJsonValue,
          } });
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

  async closeAssessment(user: AuthUser, assessmentId: string, raw: unknown) {
    this.assertUuid(assessmentId, 'Invalid readiness assessment id');
    const parsed = closeReadinessAssessmentSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input: CloseReadinessAssessmentInput = parsed.data;
    const operation = 'close_assessment';
    const targetKey = `assessment:${assessmentId}`;
    const payloadHash = idempotencyFingerprint({ assessmentId, expectedVersion: input.expectedVersion, reason: input.reason });
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
          const assessment = await tx.truckReadinessAssessment.findUnique({ where: { id: assessmentId }, include: { requirements: true } });
          if (!assessment) throw new NotFoundException('Readiness assessment not found');
          if (assessment.status === ReadinessAssessmentStatus.CLOSED) throw new BadRequestException('Readiness assessment is already closed');
          const updated = await tx.truckReadinessAssessment.updateMany({
            where: { id: assessmentId, version: input.expectedVersion, status: { in: [ReadinessAssessmentStatus.UNDER_REVIEW, ReadinessAssessmentStatus.READY] } },
            data: { status: ReadinessAssessmentStatus.CLOSED, closedAt: new Date(), closedById: user.id, closedReason: input.reason, version: { increment: 1 } },
          });
          if (!updated.count) throw this.versionConflict('Readiness assessment version changed');
          const resultRow = await tx.truckReadinessAssessment.findUniqueOrThrow({ where: { id: assessmentId }, include: { requirements: { orderBy: { type: 'asc' } } } });
          await this.activity.log(tx, {
            eventType: ActivityEventType.READINESS_ASSESSMENT_CLOSED,
            entityType: 'readiness_assessment', entityId: assessmentId, userId: user.id,
            previousValue: { status: assessment.status, version: assessment.version },
            newValue: { status: resultRow.status, version: resultRow.version, closedReason: input.reason },
            relevantValue: { truckId: assessment.truckId },
          });
          const result = { assessment: toReadinessAssessmentDto(resultRow as never) };
          await tx.readinessMutation.create({ data: {
            idempotencyKey: input.idempotencyKey,
            assessmentId,
            targetKey,
            operation,
            payloadHash,
            actorId: user.id,
            result: result as unknown as Prisma.InputJsonValue,
          } });
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

    while (items.length < query.limit) {
      const rows = await this.prisma.truck.findMany({
        where: this.buildWhere(query, rawCursor),
        include: yardTruckInclude as never,
        orderBy: [{ truckNumber: 'asc' }, { id: 'asc' }],
        take: query.limit + 1,
      }) as unknown as YardTruckRow[];
      const pageRows = rows.length > query.limit ? rows.slice(0, query.limit) : rows;
      const rawHasMore = rows.length > query.limit;
      if (!pageRows.length) break;

      for (let index = 0; index < pageRows.length; index += 1) {
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

    const counts = await this.getCounts();

    return {
      items,
      nextCursor: hasMore && items.length ? this.encodeCursorFromItem(items[items.length - 1]) : null,
      counts,
      incomingTrucks: this.unavailable(),
      upcomingDepartures: this.unavailable(),
    };
  }

  async detail(id: string): Promise<AdminTruckDetailDto> {
    if (!UUID_PATTERN.test(id)) throw new BadRequestException('Invalid Truck id');
    const row = await this.prisma.truck.findUnique({ where: { id }, include: yardTruckInclude as never }) as unknown as YardTruckRow | null;
    if (!row) throw new NotFoundException('Truck not found');
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
    const linkedWorkOrders = assessment?.workOrders.map(toAdminWorkOrderSummary) ?? [];
    const derivation = deriveReadiness({ assessment: mappedAssessment, linkedWorkOrders });
    const activeWorkOrder = row.workOrders[0] ? toAdminWorkOrderSummary(row.workOrders[0]) : null;
    const latestService = row.serviceStatusEvents[0];
    const operationalStatus = latestService?.status === 'in_service'
      ? TruckOperationalStatus.IN_SERVICE
      : latestService?.status === 'off_duty'
        ? TruckOperationalStatus.OFF_DUTY
        : TruckOperationalStatus.UNKNOWN;
    return {
      truck: toTruckDto(row),
      presence: { state: YardPresenceState.UNKNOWN, provenance: 'phase_1_unavailable' },
      operationalStatus,
      operationalStatusAt: latestService?.occurredAt.toISOString() ?? null,
      assessment: mappedAssessment,
      phase: derivation.phase,
      blockers: derivation.blockers,
      activeWorkOrder,
    };
  }

  private matchesDerivedFilters(item: YardOperationsTruckDto, query: AdminYardOperationsQuery) {
    const readiness = item.assessment?.status ?? YardReadinessFilter.NOT_STARTED;
    const blocked = item.blockers.length > 0;
    return (!query.readiness || query.readiness.includes(readiness as YardReadinessFilter))
      && (!query.phase || query.phase.includes(item.phase))
      && (query.blocked === undefined || query.blocked === blocked);
  }

  private buildWhere(query: AdminYardOperationsQuery, cursor: AdminYardOperationsCursor | null): Prisma.TruckWhereInput {
    const filters: Prisma.TruckWhereInput[] = [];
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
    if (query.workOrderStatus) {
      filters.push({ workOrders: { some: { status: { in: query.workOrderStatus as WorkOrderStatus[] } } } });
    }
    if (query.priority) {
      filters.push({ workOrders: { some: { priority: { in: query.priority as Priority[] } } } });
    }
    if (query.mechanicId) {
      filters.push({ workOrders: { some: { mechanics: { some: { mechanicId: query.mechanicId, removedAt: null } } } } });
    }
    if (query.readiness) {
      const readinessFilters: Prisma.TruckWhereInput[] = [];
      if (query.readiness.includes(YardReadinessFilter.NOT_STARTED)) {
        readinessFilters.push({ readinessAssessments: { none: { status: { in: ['under_review', 'ready'] } } } });
      }
      const activeStatuses = query.readiness
        .filter((value): value is YardReadinessFilter.UNDER_REVIEW | YardReadinessFilter.READY => value !== YardReadinessFilter.NOT_STARTED)
        .map((value) => value as unknown as ReadinessAssessmentStatus);
      if (activeStatuses.length) readinessFilters.push({ readinessAssessments: { some: { status: { in: activeStatuses } } } });
      if (readinessFilters.length) filters.push({ OR: readinessFilters });
    }
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

  private async getCounts() {
    const [presenceUnknown, rows] = await Promise.all([
      this.prisma.truck.count(),
      this.prisma.truck.findMany({
        where: { readinessAssessments: { some: { status: { in: ['under_review', 'ready'] } } } },
        select: {
          readinessAssessments: {
            where: { status: { in: ['under_review', 'ready'] } },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              status: true,
              requirements: { select: { type: true, outcome: true } },
              workOrders: {
                where: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
                select: { id: true, status: true },
              },
            },
          },
        },
      }) as unknown as Promise<YardOperationsCountRow[]>,
    ]);

    let underReview = 0;
    let readyToGo = 0;
    let blocked = 0;
    for (const row of rows) {
      const assessment = row.readinessAssessments[0];
      if (!assessment) continue;
      if (assessment.status === 'under_review') underReview += 1;
      const hasAllRequirements = assessment.requirements.length === READINESS_REQUIREMENT_TYPES.length;
      const hasBlockingRequirement = !hasAllRequirements || assessment.requirements.some((requirement) =>
        requirement.outcome === 'not_evaluated' || requirement.outcome === 'required',
      );
      const hasOpenWorkOrder = assessment.workOrders.length > 0;
      if (hasBlockingRequirement || hasOpenWorkOrder) blocked += 1;
      if (assessment.status === 'ready' && !hasBlockingRequirement && !hasOpenWorkOrder) readyToGo += 1;
    }
    return { underReview, readyToGo, blocked, presenceUnknown };
  }

  private unavailable(): YardOperationsUnavailableDto {
    return { status: 'unavailable', reason: 'integration_not_connected' };
  }
}

function toAdminWorkOrderSummary(row: SummaryWorkOrderRow): AdminWorkOrderSummaryDto {
  const jobs = row.primaryCategory.name === 'PM' ? [] : row.jobs;
  const currentPause = row.pauseEvents[0] ?? null;
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
    mechanics: row.mechanics.map((assignment) => ({
      mechanicId: assignment.mechanic.id,
      mechanicName: assignment.mechanic.name,
      addedAt: assignment.addedAt.toISOString(),
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
    latestReportedBlocker: null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
