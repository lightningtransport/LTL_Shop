import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppCapability,
  Prisma,
  Priority,
  JobStatus,
  WorkOrderStatus,
  type PauseReason,
} from '@prisma/client';
import {
  ActivityEventType as SharedActivityEventType,
  JobStatus as SharedJobStatus,
  OPEN_WORK_ORDER_STATUSES,
  PauseReason as SharedPauseReason,
  Priority as SharedPriority,
  WorkOrderStatus as SharedWorkOrderStatus,
  adminAddWorkOrderMechanicSchema,
  adminAssignJobSchema,
  adminUnassignJobSchema,
  adminCancelWorkOrderSchema,
  adminCompleteWorkOrderSchema,
  adminReopenWorkOrderSchema,
  adminPatchWorkOrderSchema,
  adminTimeCorrectionSchema,
  adminCancelJobSchema,
  adminReopenJobSchema,
  adminReturnToServiceSchema,
  adminHistoryQuerySchema,
  adminMechanicCursorSchema,
  adminMechanicsQuerySchema,
  adminRemoveWorkOrderMechanicSchema,
  adminTruckCursorSchema,
  adminTrucksQuerySchema,
  adminWorkOrderCursorSchema,
  adminWorkOrdersQuerySchema,
  type AdminDashboardDto,
  type AdminCatalogCategoryDetailDto,
  type AdminCatalogCategorySummaryDto,
  type AdminMechanicCursor,
  type AdminMechanicDetailDto,
  type AdminMechanicSummaryDto,
  type AdminMechanicsQuery,
  type AdminPage,
  type AdminTruckCursor,
  type AdminTruckSummaryDto,
  type AdminTrucksQuery,
  type AdminWorkOrderCursor,
  type AdminWorkOrderDetailDto,
  type AdminWorkOrderSummaryDto,
  type AdminWorkOrdersQuery,
  CatalogStatus,
  TruckOperationalStatus,
} from '@ltl-shop/shared';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { idempotencyFingerprint } from '../common/idempotency';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import { PrismaService } from '../prisma/prisma.service';
import { toSharedCapability } from '../auth/capabilities';
import { toTruckDto } from '../trucks/trucks.service';
import { computeTotals, canFinishWorkOrder, sessionDurationMs } from '../work-orders/work-order.timing';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { getShopDashboardWindows } from './admin-time';

const ATTENTION_LIMIT = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(id: string) {
  return UUID_RE.test(id);
}

const mechanicCapabilityWhere: Prisma.UserWhereInput = {
  capabilities: {
    some: { capability: { in: [AppCapability.MECHANIC_STANDARD, AppCapability.MECHANIC_PM] } },
  },
};

const mechanicAssignmentInclude = {
  workOrder: {
    select: {
      id: true,
      displayId: true,
      status: true,
      completedAt: true,
      truck: { select: { truckNumber: true } },
      primaryCategory: { select: { name: true } },
    },
  },
} as const;

const mechanicListInclude = {
  capabilities: { select: { capability: true } },
  mechanicAssignments: {
    where: { removedAt: null, workOrder: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } } },
    include: mechanicAssignmentInclude,
    orderBy: { addedAt: 'asc' as const },
  },
};

const mechanicDetailInclude = {
  capabilities: { select: { capability: true } },
  mechanicAssignments: {
    where: { removedAt: null },
    include: mechanicAssignmentInclude,
    orderBy: { addedAt: 'desc' as const },
  },
};

const summaryInclude = {
  truck: true,
  primaryCategory: true,
  jobs: { select: { status: true } },
  mechanics: {
    where: { removedAt: null },
    include: { mechanic: { select: { id: true, name: true } } },
    orderBy: { addedAt: 'asc' as const },
  },
  pauseEvents: {
    where: {
      OR: [
        { endedAt: null },
        { isOfficialPause: false },
      ],
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: 'desc' as const },
  },
};

const detailInclude = {
  ...summaryInclude,
  createdBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
  jobs: {
    include: {
      category: { select: { name: true } },
      assignedMechanic: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  sessions: {
    orderBy: { startedAt: 'asc' as const },
  },
  pauseEvents: {
    include: {
      createdBy: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: 'desc' as const },
  },
  activityLogs: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  serviceStatusEvents: {
    where: { status: 'in_service' as const },
    orderBy: { occurredAt: 'desc' as const },
    take: 1,
  },
};

type SummaryRow = Prisma.WorkOrderGetPayload<{ include: typeof summaryInclude }>;
type DetailRow = Prisma.WorkOrderGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly workOrders: WorkOrdersService,
  ) {}

  // Manager-first ownership: a Manager (work_orders.manage) plans the
  // intervention. Reuses the shared create path (truck advisory lock,
  // idempotency, one-open-WO-per-Truck, multi-category Jobs) with a Manager
  // actor so no mechanic capability is required and PM is rejected.
  async createWorkOrder(user: AuthUser, body: unknown) {
    return this.workOrders.createByManager(user, body);
  }

  // Manager-first ownership: the Manager pauses/resumes the Work Order. Reuses
  // the mechanic pause/resume mechanics, then returns the admin detail DTO.
  async pauseWorkOrder(user: AuthUser, workOrderId: string, body: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    await this.workOrders.pauseByManager(user, workOrderId, body);
    return this.detail(workOrderId);
  }

  async resumeWorkOrder(user: AuthUser, workOrderId: string): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    await this.workOrders.resumeByManager(user, workOrderId);
    return this.detail(workOrderId);
  }

  async addJob(user: AuthUser, workOrderId: string, body: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    await this.workOrders.addJobByManager(user, workOrderId, body);
    return this.detail(workOrderId);
  }

  async dashboard(): Promise<AdminDashboardDto> {
    const openWhere: Prisma.WorkOrderWhereInput = {
      status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] },
    };
    const now = new Date();
    const windows = getShopDashboardWindows(now);
    const olderThan24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [open, waitingPaused, highCriticalOpen, openOlderThan24h, completedToday, completedLast7Days, attention] =
      await Promise.all([
        this.prisma.workOrder.count({ where: openWhere }),
        this.prisma.workOrder.count({ where: { status: WorkOrderStatus.waiting_paused } }),
        this.prisma.workOrder.count({
          where: { ...openWhere, priority: { in: [Priority.high, Priority.critical] } },
        }),
        this.prisma.workOrder.count({
          where: { ...openWhere, createdAt: { lt: olderThan24h } },
        }),
        this.prisma.workOrder.count({
          where: {
            status: WorkOrderStatus.completed,
            completedAt: { gte: new Date(windows.today.from), lt: new Date(windows.today.to) },
          },
        }),
        this.prisma.workOrder.count({
          where: {
            status: WorkOrderStatus.completed,
            completedAt: { gte: new Date(windows.last7Days.from), lt: new Date(windows.last7Days.to) },
          },
        }),
        this.getAttention(openWhere),
      ]);

    return {
      generatedAt: now.toISOString(),
      source: 'supabase_postgres',
      timeZone: windows.timeZone,
      windows: {
        openOlderThan24h: { before: olderThan24h.toISOString() },
        today: windows.today,
        last7Days: windows.last7Days,
      },
      counts: { open, waitingPaused, highCriticalOpen, openOlderThan24h, completedToday, completedLast7Days },
      attention,
    };
  }

  async list(rawQuery: unknown): Promise<AdminPage<AdminWorkOrderSummaryDto>> {
    const parsed = adminWorkOrdersQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    const cursor = query.cursor ? this.decodeCursor(query.cursor, query) : null;
    const where = this.buildWhere(query, cursor);
    const rows = await this.prisma.workOrder.findMany({
      where,
      include: summaryInclude,
      orderBy: [
        { [query.sort]: query.direction },
        { id: query.direction },
      ] as Prisma.WorkOrderOrderByWithRelationInput[],
      take: query.limit + 1,
    });
    const hasNext = rows.length > query.limit;
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows;

    return {
      items: pageRows.map(toAdminSummary),
      nextCursor: hasNext
        ? this.encodeCursor(pageRows[pageRows.length - 1], query)
        : null,
    };
  }

  async detail(id: string): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Work Order id');
    const row = await this.prisma.workOrder.findUnique({ where: { id }, include: detailInclude });
    if (!row) throw new NotFoundException('Work Order not found');
    return toAdminDetail(row);
  }

  async listMechanics(rawQuery: unknown): Promise<AdminPage<AdminMechanicSummaryDto>> {
    const parsed = adminMechanicsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    const cursor = query.cursor ? this.decodeMechanicCursor(query.cursor, query) : null;
    const rows = await this.prisma.user.findMany({
      where: this.buildMechanicWhere(query, cursor),
      include: mechanicListInclude,
      orderBy: [{ name: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    const hasNext = rows.length > query.limit;
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows;
    return {
      items: pageRows.map(toMechanicSummary),
      nextCursor: hasNext ? this.encodeMechanicCursor(pageRows[pageRows.length - 1], query) : null,
    };
  }

  async listTrucks(rawQuery: unknown): Promise<AdminPage<AdminTruckSummaryDto>> {
    const parsed = adminTrucksQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    const cursor = query.cursor ? this.decodeTruckCursor(query.cursor, query) : null;
    const rows = await this.prisma.truck.findMany({
      where: this.buildTruckWhere(query, cursor),
      include: {
        workOrders: {
          where: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
          include: { primaryCategory: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        serviceStatusEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ truckNumber: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    const hasNext = rows.length > query.limit;
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows;
    return {
      items: pageRows.map(toTruckSummary),
      nextCursor: hasNext ? this.encodeTruckCursor(pageRows[pageRows.length - 1], query) : null,
    };
  }

  async listCatalogCategories(): Promise<AdminCatalogCategorySummaryDto[]> {
    const rows = await this.prisma.jobCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        catalogJobs: {
          select: {
            status: true,
            _count: { select: { aliases: true } },
          },
        },
      },
    });
    return rows.map(toCatalogCategorySummary);
  }

  async catalogCategoryDetail(id: string): Promise<AdminCatalogCategoryDetailDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Category id');
    const row = await this.prisma.jobCategory.findUnique({
      where: { id },
      include: {
        catalogJobs: {
          include: { aliases: { select: { aliasText: true }, orderBy: { aliasText: 'asc' } } },
          orderBy: [{ status: 'asc' }, { displayName: 'asc' }],
        },
      },
    });
    if (!row) throw new NotFoundException('Category not found');
    const summary = toCatalogCategorySummary({
      ...row,
      catalogJobs: row.catalogJobs.map((job) => ({
        status: job.status,
        _count: { aliases: job.aliases.length },
      })),
    });
    return {
      ...summary,
      jobs: row.catalogJobs.map((job) => ({
        id: job.id,
        displayName: job.displayName,
        status: job.status as CatalogStatus,
        aliases: job.aliases.map((alias) => alias.aliasText),
      })),
    };
  }

  async mechanicDetail(id: string): Promise<AdminMechanicDetailDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Mechanic id');
    const row = await this.prisma.user.findFirst({
      where: { id, ...mechanicCapabilityWhere },
      include: mechanicDetailInclude,
    });
    if (!row) throw new NotFoundException('Mechanic not found');
    const completedJobCount = await this.prisma.workOrderJob.count({
      where: { completedById: id, status: 'completed' },
    });
    return {
      ...toMechanicSummary(row),
      completedJobCount,
      recentClosedWorkOrders: row.mechanicAssignments
        .filter((assignment) => assignment.workOrder.status === 'completed' || assignment.workOrder.status === 'cancelled')
        .slice(0, 10)
        .map(toMechanicAssignment),
    };
  }

  async listHistory(rawQuery: unknown): Promise<AdminPage<AdminWorkOrderSummaryDto>> {
    const parsed = adminHistoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    return this.list({
      ...query,
      status: query.status ?? ['completed', 'cancelled'],
      priority: undefined,
      createdBefore: undefined,
    });
  }

  async addMechanic(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminAddWorkOrderMechanicSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_add_mechanic';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      mechanicId: input.mechanicId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertAssignableOpenWorkOrder(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const mechanic = await tx.user.findFirst({
          where: {
            id: input.mechanicId,
            active: true,
            capabilities: { some: { capability: AppCapability.MECHANIC_STANDARD } },
          },
          select: { id: true, name: true },
        });
        if (!mechanic) throw new BadRequestException('One or more selected mechanics cannot perform standard work');
        const assignment = await tx.mechanicAssignment.findUnique({
          where: { workOrderId_mechanicId: { workOrderId, mechanicId: input.mechanicId } },
        });
        if (assignment && !assignment.removedAt) {
          throw new ConflictException({
            code: 'ALREADY_ASSIGNED',
            message: 'This mechanic is already assigned to the Work Order.',
          });
        }
        if (assignment) {
          await tx.mechanicAssignment.update({
            where: { id: assignment.id },
            data: { removedAt: null, addedAt: new Date(), addedById: user.id },
          });
        } else {
          await tx.mechanicAssignment.create({
            data: { workOrderId, mechanicId: input.mechanicId, addedById: user.id },
          });
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MECHANIC_ADDED,
          entityType: 'mechanic_assignment',
          entityId: input.mechanicId,
          userId: user.id,
          previousValue: assignment ? { mechanicId: input.mechanicId, removedAt: assignment.removedAt?.toISOString() ?? null } : null,
          newValue: { mechanicId: input.mechanicId, mechanicName: mechanic.name },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async removeMechanic(user: AuthUser, workOrderId: string, mechanicId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    if (!isUuid(mechanicId)) throw new BadRequestException('Invalid Mechanic id');
    const parsed = adminRemoveWorkOrderMechanicSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_remove_mechanic';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      mechanicId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertAssignableOpenWorkOrder(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const assignment = await tx.mechanicAssignment.findUnique({
          where: { workOrderId_mechanicId: { workOrderId, mechanicId } },
        });
        if (!assignment || assignment.removedAt) throw new NotFoundException('Mechanic assignment not found');
        if (wo.mechanics.filter((item) => !item.removedAt).length <= 1) {
          throw new BadRequestException('A Work Order must keep at least one assigned mechanic');
        }
        await tx.mechanicAssignment.update({
          where: { id: assignment.id },
          data: { removedAt: new Date() },
        });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MECHANIC_REMOVED,
          entityType: 'mechanic_assignment',
          entityId: mechanicId,
          userId: user.id,
          previousValue: { mechanicId, mechanicName: wo.mechanics.find((item) => item.mechanic.id === mechanicId)?.mechanic.name ?? null },
          newValue: { mechanicId, removed: true },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  // Manager-first ownership: assign a specific Job to a mechanic. Additive and
  // independent of MechanicAssignment (the general team). A Job with no assignee
  // visually inherits the general team.
  async assignJob(user: AuthUser, workOrderId: string, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminAssignJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_assign_job';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      jobId,
      mechanicId: input.mechanicId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        const mechanic = await tx.user.findFirst({
          where: {
            id: input.mechanicId,
            active: true,
            capabilities: { some: { capability: AppCapability.MECHANIC_STANDARD } },
          },
          select: { id: true, name: true },
        });
        if (!mechanic) throw new BadRequestException('This mechanic cannot perform standard work');
        const teamAssignment = await tx.mechanicAssignment.findUnique({
          where: { workOrderId_mechanicId: { workOrderId, mechanicId: input.mechanicId } },
        });
        if (teamAssignment?.removedAt) {
          await tx.mechanicAssignment.update({
            where: { id: teamAssignment.id },
            data: { removedAt: null, addedAt: new Date(), addedById: user.id },
          });
        } else if (!teamAssignment) {
          await tx.mechanicAssignment.create({
            data: { workOrderId, mechanicId: input.mechanicId, addedById: user.id },
          });
        }
        await tx.workOrderJob.update({
          where: { id: jobId },
          data: { assignedMechanicId: input.mechanicId },
        });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MECHANIC_ADDED,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { jobId, assignedMechanicId: job.assignedMechanicId },
          newValue: { jobId, action: 'job_assigned', assignedMechanicId: input.mechanicId, mechanicName: mechanic.name },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async unassignJob(user: AuthUser, workOrderId: string, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminUnassignJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_unassign_job';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      jobId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (!job.assignedMechanicId) throw new NotFoundException('Job is not assigned');
        await tx.workOrderJob.update({
          where: { id: jobId },
          data: { assignedMechanicId: null },
        });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MECHANIC_REMOVED,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { jobId, assignedMechanicId: job.assignedMechanicId },
          newValue: { jobId, action: 'job_unassigned', assignedMechanicId: null },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async cancelWorkOrder(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminCancelWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_cancel_work_order';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot cancel a closed Work Order');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const now = new Date();
        const openSession = await tx.workSession.findFirst({
          where: { workOrderId, endedAt: null },
          orderBy: { startedAt: 'desc' },
        });
        if (openSession) {
          await tx.workSession.update({ where: { id: openSession.id }, data: { endedAt: now } });
        }
        const openPause = await tx.pauseEvent.findFirst({
          where: { workOrderId, endedAt: null, isOfficialPause: true },
          orderBy: { startedAt: 'desc' },
        });
        if (openPause) {
          await tx.pauseEvent.update({
            where: { id: openPause.id },
            data: { endedAt: now, durationMs: BigInt(now.getTime() - openPause.startedAt.getTime()) },
          });
        }
        const sessions = await tx.workSession.findMany({ where: { workOrderId } });
        const pauses = await tx.pauseEvent.findMany({ where: { workOrderId } });
        const totals = computeTotals({ sessions, pauses, now });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            status: WorkOrderStatus.cancelled,
            completedAt: now,
            completedById: user.id,
            totalActiveLaborMs: BigInt(totals.totalActiveLaborMs),
            totalWaitingMs: BigInt(totals.totalWaitingMs),
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: 'work_order',
          entityId: workOrderId,
          userId: user.id,
          previousValue: { status: wo.status },
          newValue: { status: 'cancelled', reason: input.reason },
          relevantValue: { action: 'work_order_cancelled', reason: input.reason },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async completeWorkOrder(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminCompleteWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_complete_work_order';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if (wo.status !== WorkOrderStatus.in_progress) {
          throw new BadRequestException('Work Order must be in progress to finish');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const isPm = wo.primaryCategory.name === 'PM';
        const pmService = isPm
          ? await tx.pmService.findUnique({ where: { workOrderId }, include: { parts: true } })
          : null;
        const observedMileage = pmService?.observedMileage ?? null;
        if (isPm) {
          if (observedMileage == null) {
            throw new BadRequestException('Observed mileage is required to finish a PM service');
          }
          if (!pmService?.parts.length) {
            throw new BadRequestException('Select at least one part before finishing a PM service');
          }
        } else {
          const gate = canFinishWorkOrder(wo.jobs);
          if (!gate.ok) throw new BadRequestException(gate.message);
        }
        const now = new Date();
        const openSession = await tx.workSession.findFirst({
          where: { workOrderId, endedAt: null },
          orderBy: { startedAt: 'desc' },
        });
        if (openSession) {
          await tx.workSession.update({ where: { id: openSession.id }, data: { endedAt: now } });
        }
        const sessions = await tx.workSession.findMany({ where: { workOrderId } });
        const pauses = await tx.pauseEvent.findMany({ where: { workOrderId } });
        const totals = computeTotals({ sessions, pauses, now });
        if (isPm && observedMileage !== null && observedMileage !== wo.truck.mileage) {
          await tx.truck.update({
            where: { id: wo.truckId },
            data: { mileage: observedMileage },
          });
          await tx.truckMileageAdjustment.create({
            data: {
              truckId: wo.truckId,
              workOrderId: wo.id,
              previousMileage: wo.truck.mileage,
              observedMileage,
              createdById: user.id,
            },
          });
          await this.activity.log(tx, {
            workOrderId: wo.id,
            eventType: SharedActivityEventType.TRUCK_MILEAGE_CORRECTED,
            entityType: 'truck',
            entityId: wo.truckId,
            userId: user.id,
            previousValue: { mileage: wo.truck.mileage },
            newValue: { mileage: observedMileage },
          });
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            status: WorkOrderStatus.completed,
            completedAt: now,
            completedById: user.id,
            totalActiveLaborMs: BigInt(totals.totalActiveLaborMs),
            totalWaitingMs: BigInt(totals.totalWaitingMs),
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.WORK_ORDER_COMPLETED,
          entityType: 'work_order',
          entityId: workOrderId,
          userId: user.id,
          previousValue: { status: wo.status },
          newValue: {
            status: 'completed',
            totalActiveLaborMs: totals.totalActiveLaborMs,
            totalWaitingMs: totals.totalWaitingMs,
          },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async reopenWorkOrder(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminReopenWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_reopen_work_order';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if ((OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot reopen an open Work Order');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const otherOpen = await tx.workOrder.findFirst({
          where: {
            truckId: wo.truckId,
            id: { not: workOrderId },
            status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] },
          },
        });
        if (otherOpen) {
          throw new BadRequestException('Truck already has an open Work Order.');
        }
        const nextStatus = wo.startedAt ? WorkOrderStatus.in_progress : WorkOrderStatus.created;
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            status: nextStatus,
            completedAt: null,
            completedById: null,
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: 'work_order',
          entityId: workOrderId,
          userId: user.id,
          previousValue: { status: wo.status },
          newValue: { status: nextStatus, reason: input.reason },
          relevantValue: { action: 'work_order_reopened', reason: input.reason },
        });
        const activeAssessment = tx.truckReadinessAssessment
          ? await tx.truckReadinessAssessment.findFirst({
              where: { truckId: wo.truckId, status: { in: ['under_review', 'ready'] } },
              orderBy: { updatedAt: 'desc' },
              select: { id: true, status: true, version: true, approvedById: true },
            })
          : null;
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
            eventType: SharedActivityEventType.READINESS_APPROVAL_INVALIDATED,
            entityType: 'readiness_assessment',
            entityId: activeAssessment.id,
            userId: user.id,
            previousValue: {
              status: activeAssessment.status,
              version: activeAssessment.version,
              approvedById: activeAssessment.approvedById,
            },
            newValue: { status: 'under_review', approvedById: null },
            relevantValue: { reason: 'work_order_reopened', workOrderId },
          });
        }
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async returnToService(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminReturnToServiceSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_return_to_service';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if ((OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot return a Truck to service from an open Work Order');
        }
        if (wo.status !== WorkOrderStatus.completed) {
          throw new BadRequestException('Only a completed Work Order can return a Truck to service');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const alreadyReturned = await tx.truckServiceStatusEvent.findFirst({
          where: { workOrderId, status: 'in_service' },
        });
        if (alreadyReturned) {
          throw new BadRequestException('This Work Order already returned the Truck to service');
        }
        const latest = await tx.truckServiceStatusEvent.findFirst({
          where: { truckId: wo.truckId },
          orderBy: { occurredAt: 'desc' },
        });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await tx.truckServiceStatusEvent.create({
          data: {
            truckId: wo.truckId,
            status: 'in_service',
            reason: input.reason,
            workOrderId,
            actorId: user.id,
          },
        });
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.TRUCK_RETURNED_TO_SERVICE,
          entityType: 'truck',
          entityId: wo.truckId,
          userId: user.id,
          previousValue: { operationalStatus: latest?.status ?? 'unknown' },
          newValue: { operationalStatus: 'in_service', reason: input.reason },
          relevantValue: { action: 'returned_to_service', reason: input.reason },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async patchWorkOrder(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminPatchWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const nextNotes = input.notes === undefined ? undefined : (input.notes?.trim() || null);
    const operation = 'admin_patch_work_order';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      expectedVersion: input.expectedVersion,
      priority: input.priority ?? null,
      notes: nextNotes ?? null,
      notesProvided: input.notes !== undefined,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot update fields on a closed Work Order');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        if (
          wo.primaryCategory.name === 'PM'
          && input.priority !== undefined
          && input.priority !== (wo.priority as SharedPriority)
        ) {
          throw new BadRequestException('PM Work Order priority cannot be changed');
        }
        const priorityChanged = input.priority !== undefined && input.priority !== (wo.priority as SharedPriority);
        const notesChanged = nextNotes !== undefined && nextNotes !== wo.notes;
        if (!priorityChanged && !notesChanged) {
          throw new BadRequestException('No allowed fields changed');
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            ...(priorityChanged ? { priority: input.priority as Priority } : {}),
            ...(notesChanged ? { notes: nextNotes } : {}),
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        if (priorityChanged) {
          await this.activity.log(tx, {
            workOrderId,
            eventType: SharedActivityEventType.PRIORITY_CHANGED,
            entityType: 'work_order',
            entityId: workOrderId,
            userId: user.id,
            previousValue: { priority: wo.priority },
            newValue: { priority: input.priority },
          });
        }
        if (notesChanged) {
          await this.activity.log(tx, {
            workOrderId,
            eventType: SharedActivityEventType.NOTES_UPDATED,
            entityType: 'work_order',
            entityId: workOrderId,
            userId: user.id,
            previousValue: { notes: wo.notes },
            newValue: { notes: nextNotes },
          });
        }
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async correctTime(user: AuthUser, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    const parsed = adminTimeCorrectionSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const workOrderId = input.workOrderId;
    const operation = 'admin_time_correction';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      targetType: input.targetType,
      targetId: input.targetId,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const segment = input.targetType === 'work_session'
          ? await tx.workSession.findUnique({ where: { id: input.targetId } })
          : await tx.pauseEvent.findUnique({ where: { id: input.targetId } });
        if (!segment || segment.workOrderId !== workOrderId) {
          throw new NotFoundException('Time segment not found');
        }
        if (input.targetType === 'pause_event' && 'isOfficialPause' in segment && segment.isOfficialPause === false) {
          throw new BadRequestException('Cannot correct a reported blocker');
        }
        if (!segment.endedAt) {
          throw new BadRequestException('Cannot correct an open time segment');
        }
        const nextStartedAt = this.parseInstant(input.startedAt, segment.startedAt);
        const nextEndedAt = this.parseInstant(input.endedAt, segment.endedAt);
        if (nextEndedAt.getTime() <= nextStartedAt.getTime()) {
          throw new BadRequestException('endedAt must be after startedAt');
        }
        if (
          nextStartedAt.getTime() === segment.startedAt.getTime()
          && nextEndedAt.getTime() === segment.endedAt.getTime()
        ) {
          throw new BadRequestException('No time values changed');
        }
        if (input.targetType === 'work_session') {
          await tx.workSession.update({
            where: { id: input.targetId },
            data: { startedAt: nextStartedAt, endedAt: nextEndedAt },
          });
        } else {
          await tx.pauseEvent.update({
            where: { id: input.targetId },
            data: {
              startedAt: nextStartedAt,
              endedAt: nextEndedAt,
              durationMs: BigInt(nextEndedAt.getTime() - nextStartedAt.getTime()),
            },
          });
        }
        const sessions = await tx.workSession.findMany({ where: { workOrderId } });
        const pauses = await tx.pauseEvent.findMany({ where: { workOrderId } });
        const totals = computeTotals({ sessions, pauses, now: new Date() });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            totalActiveLaborMs: BigInt(totals.totalActiveLaborMs),
            totalWaitingMs: BigInt(totals.totalWaitingMs),
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: input.targetType,
          entityId: input.targetId,
          userId: user.id,
          previousValue: {
            startedAt: segment.startedAt.toISOString(),
            endedAt: segment.endedAt.toISOString(),
          },
          newValue: {
            startedAt: nextStartedAt.toISOString(),
            endedAt: nextEndedAt.toISOString(),
            reason: input.reason,
          },
          relevantValue: { action: 'time_corrected', targetType: input.targetType, reason: input.reason },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  private parseInstant(value: string | undefined, fallback: Date) {
    if (value === undefined) return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid timestamp');
    return parsed;
  }

  async cancelJob(user: AuthUser, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminCancelJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const preview = await this.prisma.workOrderJob.findUnique({ where: { id: jobId } });
    if (!preview) throw new NotFoundException('Job not found');
    const workOrderId = preview.workOrderId;
    const operation = 'admin_cancel_job';
    const payloadHash = idempotencyFingerprint({
      jobId,
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (job.status !== JobStatus.to_do) {
          throw new BadRequestException('Job is not in To Do status');
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await tx.workOrderJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.cancelled,
            cancelledAt: new Date(),
            cancelledReason: input.reason,
          },
        });
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.JOB_CANCELLED,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { status: job.status, displayName: job.displayName },
          newValue: { status: JobStatus.cancelled, reason: input.reason },
          relevantValue: { action: 'job_cancelled', reason: input.reason, displayName: job.displayName },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async reopenJob(user: AuthUser, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminReopenJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const preview = await this.prisma.workOrderJob.findUnique({ where: { id: jobId } });
    if (!preview) throw new NotFoundException('Job not found');
    const workOrderId = preview.workOrderId;
    const operation = 'admin_reopen_job';
    const payloadHash = idempotencyFingerprint({
      jobId,
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (job.status !== JobStatus.cancelled) {
          throw new BadRequestException('Job is not cancelled');
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await tx.workOrderJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.to_do,
            cancelledAt: null,
            cancelledReason: null,
          },
        });
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { status: job.status, displayName: job.displayName },
          newValue: { status: JobStatus.to_do, reason: input.reason },
          relevantValue: { action: 'job_reopened', reason: input.reason, displayName: job.displayName },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  private assertAssignableOpenWorkOrder(wo: DetailRow) {
    if (wo.primaryCategory.name === 'PM') {
      throw new BadRequestException('PM Work Orders can only be assigned to their creator');
    }
    if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
      throw new BadRequestException('Cannot change assignments on a closed Work Order');
    }
  }

  private assertMutableJobs(wo: DetailRow) {
    if (wo.primaryCategory.name === 'PM') {
      throw new BadRequestException('PM Work Orders do not use jobs');
    }
    if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
      throw new BadRequestException('Cannot change Jobs on a closed Work Order');
    }
  }

  private versionConflict(message: string) {
    return new ConflictException({ code: 'VERSION_CONFLICT', message });
  }

  private isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async findWorkOrderMutation(
    key: string,
    workOrderId: string,
    operation: string,
    payloadHash: string,
    actorId: string,
  ) {
    const existing = await this.prisma.workOrderMutation.findUnique({ where: { idempotencyKey: key } });
    return this.assertWorkOrderMutation(existing, workOrderId, operation, payloadHash, actorId);
  }

  private async findWorkOrderMutationInTx(
    tx: Prisma.TransactionClient,
    key: string,
    workOrderId: string,
    operation: string,
    payloadHash: string,
    actorId: string,
  ) {
    const existing = await tx.workOrderMutation.findUnique({ where: { idempotencyKey: key } });
    return this.assertWorkOrderMutation(existing, workOrderId, operation, payloadHash, actorId);
  }

  private assertWorkOrderMutation(
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
    return existing.result as AdminWorkOrderDetailDto;
  }

  private async persistWorkOrderMutation(
    tx: Prisma.TransactionClient,
    input: { idempotencyKey: string; workOrderId: string; operation: string; payloadHash: string; actorId: string },
  ) {
    const row = await tx.workOrder.findUnique({ where: { id: input.workOrderId }, include: detailInclude });
    if (!row) throw new NotFoundException('Work Order not found');
    const result = toAdminDetail(row);
    await tx.workOrderMutation.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        workOrderId: input.workOrderId,
        operation: input.operation,
        payloadHash: input.payloadHash,
        actorId: input.actorId,
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
    return result;
  }

  private async getAttention(openWhere: Prisma.WorkOrderWhereInput) {
    const base = { include: summaryInclude, take: ATTENTION_LIMIT } as const;
    const [critical, high, paused, stale] = await Promise.all([
      this.prisma.workOrder.findMany({
        ...base,
        where: { ...openWhere, priority: Priority.critical },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workOrder.findMany({
        ...base,
        where: { ...openWhere, priority: Priority.high },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workOrder.findMany({
        ...base,
        where: {
          ...openWhere,
          status: WorkOrderStatus.waiting_paused,
          priority: { notIn: [Priority.critical, Priority.high] },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workOrder.findMany({
        ...base,
        where: {
          ...openWhere,
          status: { in: [WorkOrderStatus.created, WorkOrderStatus.in_progress] },
          priority: { notIn: [Priority.critical, Priority.high] },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return [...critical, ...high, ...paused, ...stale]
      .slice(0, ATTENTION_LIMIT)
      .map(toAdminSummary);
  }

  private buildWhere(query: AdminWorkOrdersQuery, cursor: AdminWorkOrderCursor | null) {
    const filters: Prisma.WorkOrderWhereInput[] = [];
    if (query.status) filters.push({ status: { in: query.status as WorkOrderStatus[] } });
    if (query.priority) filters.push({ priority: { in: query.priority as Priority[] } });
    if (query.createdBefore) filters.push({ createdAt: { lt: new Date(query.createdBefore) } });
    if (query.completedFrom) filters.push({ completedAt: { gte: new Date(query.completedFrom) } });
    if (query.completedBefore) filters.push({ completedAt: { lt: new Date(query.completedBefore) } });
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filters.push({ OR: [
        { displayId: contains },
        { truck: { truckNumber: contains } },
        { primaryCategory: { name: contains } },
        { mechanics: { some: { removedAt: null, mechanic: { name: contains } } } },
      ] });
    }
    if (cursor) {
      const comparison = query.direction === 'asc' ? 'gt' : 'lt';
      const value = query.sort === 'displayId' ? cursor.value : new Date(cursor.value);
      filters.push({ OR: [
        { [query.sort]: { [comparison]: value } },
        { [query.sort]: value, id: { [comparison]: cursor.id } },
      ] });
    }
    return filters.length ? { AND: filters } satisfies Prisma.WorkOrderWhereInput : {};
  }

  private buildMechanicWhere(query: AdminMechanicsQuery, cursor: AdminMechanicCursor | null): Prisma.UserWhereInput {
    const filters: Prisma.UserWhereInput[] = [mechanicCapabilityWhere];
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filters.push({ OR: [{ name: contains }, { email: contains }] });
    }
    if (cursor) {
      const comparison = query.direction === 'asc' ? 'gt' : 'lt';
      filters.push({
        OR: [
          { name: { [comparison]: cursor.name } },
          { name: cursor.name, id: { [comparison]: cursor.id } },
        ],
      });
    }
    return { AND: filters };
  }

  private decodeMechanicCursor(encoded: string, query: AdminMechanicsQuery) {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      const cursor = adminMechanicCursorSchema.parse(decoded);
      if (cursor.direction !== query.direction) throw new Error('mismatch');
      return cursor;
    } catch {
      throw new BadRequestException('Invalid or incompatible cursor');
    }
  }

  private encodeMechanicCursor(row: { id: string; name: string }, query: AdminMechanicsQuery) {
    return Buffer.from(JSON.stringify({ direction: query.direction, name: row.name, id: row.id })).toString('base64url');
  }

  private buildTruckWhere(query: AdminTrucksQuery, cursor: AdminTruckCursor | null): Prisma.TruckWhereInput {
    const filters: Prisma.TruckWhereInput[] = [];
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filters.push({
        OR: [
          { truckNumber: contains },
          { make: contains },
          { model: contains },
          { company: contains },
        ],
      });
    }
    if (cursor) {
      const comparison = query.direction === 'asc' ? 'gt' : 'lt';
      filters.push({
        OR: [
          { truckNumber: { [comparison]: cursor.truckNumber } },
          { truckNumber: cursor.truckNumber, id: { [comparison]: cursor.id } },
        ],
      });
    }
    return filters.length ? { AND: filters } : {};
  }

  private decodeTruckCursor(encoded: string, query: AdminTrucksQuery) {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      const cursor = adminTruckCursorSchema.parse(decoded);
      if (cursor.direction !== query.direction) throw new Error('mismatch');
      return cursor;
    } catch {
      throw new BadRequestException('Invalid or incompatible cursor');
    }
  }

  private encodeTruckCursor(row: { id: string; truckNumber: string }, query: AdminTrucksQuery) {
    return Buffer.from(JSON.stringify({ direction: query.direction, truckNumber: row.truckNumber, id: row.id })).toString('base64url');
  }

  private decodeCursor(encoded: string, query: AdminWorkOrdersQuery) {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      const cursor = adminWorkOrderCursorSchema.parse(decoded);
      if (cursor.sort !== query.sort || cursor.direction !== query.direction) throw new Error('mismatch');
      if (query.sort !== 'displayId' && Number.isNaN(Date.parse(cursor.value))) throw new Error('date');
      return cursor;
    } catch {
      throw new BadRequestException('Invalid or incompatible cursor');
    }
  }

  private encodeCursor(row: SummaryRow, query: AdminWorkOrdersQuery) {
    const value = query.sort === 'displayId' ? row.displayId : row[query.sort].toISOString();
    return Buffer.from(JSON.stringify({ sort: query.sort, direction: query.direction, value, id: row.id }))
      .toString('base64url');
  }
}

function toAdminSummary(row: SummaryRow): AdminWorkOrderSummaryDto {
  const jobs = row.primaryCategory.name === 'PM' ? [] : row.jobs.filter((job) => job.status !== 'cancelled');
  const currentPause = row.pauseEvents.find((pause) => !pause.endedAt && pause.isOfficialPause !== false) ?? null;
  const latestReportedBlocker = row.pauseEvents.find((pause) => pause.isOfficialPause === false) ?? null;
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
    status: row.status as SharedWorkOrderStatus,
    priority: row.priority as SharedPriority,
    jobsCompleted: jobs.filter((job) => job.status === 'completed').length,
    jobsTotal: jobs.length,
    mechanics: row.mechanics.map((assignment) => ({
      mechanicId: assignment.mechanic.id,
      mechanicName: assignment.mechanic.name,
      addedAt: assignment.addedAt.toISOString(),
      removedAt: null,
    })),
    currentPause: currentPause ? mapPause(currentPause) : null,
    latestReportedBlocker: latestReportedBlocker ? mapPause(latestReportedBlocker) : null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdminDetail(row: DetailRow): AdminWorkOrderDetailDto {
  const summary = toAdminSummary(row);
  const jobs = row.primaryCategory.name === 'PM' ? [] : row.jobs.map((job) => ({
    id: job.id,
    catalogJobId: job.catalogJobId ?? null,
    displayName: job.displayName,
    customDescription: job.customDescription,
    status: job.status as SharedJobStatus,
    category: { id: job.categoryId, name: job.category.name },
    assignedMechanic: job.assignedMechanic
      ? { id: job.assignedMechanic.id, name: job.assignedMechanic.name }
      : null,
  }));
  return {
    ...summary,
    truck: toTruckDto(row.truck),
    version: row.version,
    notes: row.notes,
    createdBy: row.createdBy,
    completedBy: row.completedBy,
    totalActiveLaborMs: Number(row.totalActiveLaborMs),
    totalWaitingMs: Number(row.totalWaitingMs),
    jobs,
    laborSessions: row.sessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      durationMs: sessionDurationMs(session.startedAt, session.endedAt),
    })),
    pauseHistory: row.pauseEvents
      .filter((pause) => pause.isOfficialPause !== false)
      .map((pause) => ({ ...mapPause(pause), createdBy: pause.createdBy })),
    reportedBlockers: row.pauseEvents
      .filter((pause) => pause.isOfficialPause === false)
      .map((pause) => ({ ...mapPause(pause), createdBy: pause.createdBy })),
    activityLog: row.activityLogs.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType as SharedActivityEventType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      user: entry.user,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      relevantValue: entry.relevantValue,
      createdAt: entry.createdAt.toISOString(),
    })),
    returnedToServiceAt: row.serviceStatusEvents[0]?.occurredAt.toISOString() ?? null,
  };
}

function toMechanicAssignment(assignment: {
  workOrder: {
    id: string;
    displayId: string;
    status: WorkOrderStatus;
    truck: { truckNumber: string };
    primaryCategory: { name: string };
  };
}): import('@ltl-shop/shared').AdminMechanicAssignmentDto {
  return {
    workOrderId: assignment.workOrder.id,
    displayId: assignment.workOrder.displayId,
    truckNumber: assignment.workOrder.truck.truckNumber,
    status: assignment.workOrder.status as SharedWorkOrderStatus,
    primaryCategoryName: assignment.workOrder.primaryCategory.name,
  };
}

function toMechanicSummary(row: {
  id: string;
  name: string;
  email: string;
  role: import('@prisma/client').UserRole;
  active: boolean;
  capabilities: { capability: AppCapability }[];
  mechanicAssignments: Parameters<typeof toMechanicAssignment>[0][];
}): import('@ltl-shop/shared').AdminMechanicSummaryDto {
  const currentAssignments = row.mechanicAssignments
    .filter((assignment) => (OPEN_WORK_ORDER_STATUSES as string[]).includes(assignment.workOrder.status))
    .map(toMechanicAssignment);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as import('@ltl-shop/shared').UserRole,
    active: row.active,
    capabilities: row.capabilities.map((item) => toSharedCapability(item.capability)),
    openWorkOrderCount: currentAssignments.length,
    currentAssignments,
  };
}

function toTruckSummary(row: {
  id: string;
  truckNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  company: string | null;
  owner: string | null;
  workOrders: {
    id: string;
    displayId: string;
    status: WorkOrderStatus;
    primaryCategory: { name: string };
  }[];
  serviceStatusEvents: { status: string; occurredAt: Date }[];
}): AdminTruckSummaryDto {
  const open = row.workOrders[0] ?? null;
  const operational = derivedOperationalStatus(row.serviceStatusEvents);
  return {
    truck: toTruckDto(row),
    operationalStatus: operational.status,
    operationalStatusAt: operational.at,
    openWorkOrder: open
      ? {
          id: open.id,
          displayId: open.displayId,
          status: open.status as SharedWorkOrderStatus,
          primaryCategoryName: open.primaryCategory.name,
        }
      : null,
  };
}

function derivedOperationalStatus(events: { status: string; occurredAt: Date }[]): {
  status: TruckOperationalStatus;
  at: string | null;
} {
  const latest = events[0];
  if (!latest) return { status: TruckOperationalStatus.UNKNOWN, at: null };
  if (latest.status === 'in_service') {
    return { status: TruckOperationalStatus.IN_SERVICE, at: latest.occurredAt.toISOString() };
  }
  if (latest.status === 'off_duty') {
    return { status: TruckOperationalStatus.OFF_DUTY, at: latest.occurredAt.toISOString() };
  }
  return { status: TruckOperationalStatus.UNKNOWN, at: null };
}

function toCatalogCategorySummary(row: {
  id: string;
  name: string;
  status: string;
  sortOrder: number;
  catalogJobs: { status: string; _count: { aliases: number } }[];
}): AdminCatalogCategorySummaryDto {
  return {
    id: row.id,
    name: row.name,
    status: row.status as CatalogStatus,
    sortOrder: row.sortOrder,
    activeJobCount: row.catalogJobs.filter((job) => job.status === 'active').length,
    inactiveJobCount: row.catalogJobs.filter((job) => job.status === 'inactive').length,
    aliasCount: row.catalogJobs.reduce((total, job) => total + job._count.aliases, 0),
  };
}

function mapPause(pause: {
  id: string; workOrderId: string; reason: PauseReason; notes: string | null;
  startedAt: Date; endedAt: Date | null; durationMs: bigint | null;
  isOfficialPause?: boolean;
  reportedBy?: { id: string; name: string } | null;
}) {
  return {
    id: pause.id,
    workOrderId: pause.workOrderId,
    reason: pause.reason as SharedPauseReason,
    notes: pause.notes,
    startedAt: pause.startedAt.toISOString(),
    endedAt: pause.endedAt?.toISOString() ?? null,
    durationMs: pause.durationMs === null ? null : Number(pause.durationMs),
    isOfficialPause: pause.isOfficialPause !== false,
    reportedBy: pause.reportedBy ?? null,
  };
}
