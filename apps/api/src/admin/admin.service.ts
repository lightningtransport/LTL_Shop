import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  Priority,
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
  adminWorkOrderCursorSchema,
  adminWorkOrdersQuerySchema,
  type AdminDashboardDto,
  type AdminPage,
  type AdminWorkOrderCursor,
  type AdminWorkOrderDetailDto,
  type AdminWorkOrderSummaryDto,
  type AdminWorkOrdersQuery,
} from '@ltl-shop/shared';
import { PrismaService } from '../prisma/prisma.service';

const ATTENTION_LIMIT = 8;

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
    where: { endedAt: null },
    orderBy: { startedAt: 'desc' as const },
    take: 1,
  },
};

const detailInclude = {
  ...summaryInclude,
  createdBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
  jobs: {
    include: {
      category: { select: { name: true } },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  pauseEvents: {
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { startedAt: 'desc' as const },
  },
  activityLogs: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

type SummaryRow = Prisma.WorkOrderGetPayload<{ include: typeof summaryInclude }>;
type DetailRow = Prisma.WorkOrderGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(): Promise<AdminDashboardDto> {
    const openWhere: Prisma.WorkOrderWhereInput = {
      status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] },
    };
    const [open, created, inProgress, waitingPaused, highCriticalOpen, unassignedOpen, attention] =
      await Promise.all([
        this.prisma.workOrder.count({ where: openWhere }),
        this.prisma.workOrder.count({ where: { status: WorkOrderStatus.created } }),
        this.prisma.workOrder.count({ where: { status: WorkOrderStatus.in_progress } }),
        this.prisma.workOrder.count({ where: { status: WorkOrderStatus.waiting_paused } }),
        this.prisma.workOrder.count({
          where: { ...openWhere, priority: { in: [Priority.high, Priority.critical] } },
        }),
        this.prisma.workOrder.count({
          where: { ...openWhere, mechanics: { none: { removedAt: null } } },
        }),
        this.getAttention(openWhere),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      source: 'supabase_postgres',
      counts: { open, created, inProgress, waitingPaused, highCriticalOpen, unassignedOpen },
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
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid Work Order id');
    }
    const row = await this.prisma.workOrder.findUnique({ where: { id }, include: detailInclude });
    if (!row) throw new NotFoundException('Work Order not found');
    return toAdminDetail(row);
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
    const status = (query.status ?? OPEN_WORK_ORDER_STATUSES) as WorkOrderStatus[];
    const filters: Prisma.WorkOrderWhereInput[] = [{ status: { in: status } }];
    if (query.priority) filters.push({ priority: { in: query.priority as Priority[] } });
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
    return { AND: filters } satisfies Prisma.WorkOrderWhereInput;
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
    displayName: job.displayName,
    customDescription: job.customDescription,
    status: job.status as SharedJobStatus,
    category: { id: job.categoryId, name: job.category.name },
  }));
  return {
    ...summary,
    notes: row.notes,
    createdBy: row.createdBy,
    completedBy: row.completedBy,
    totalActiveLaborMs: Number(row.totalActiveLaborMs),
    totalWaitingMs: Number(row.totalWaitingMs),
    jobs,
    pauseHistory: row.pauseEvents.map((pause) => ({ ...mapPause(pause), createdBy: pause.createdBy })),
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
  };
}

function mapPause(pause: {
  id: string; workOrderId: string; reason: PauseReason; notes: string | null;
  startedAt: Date; endedAt: Date | null; durationMs: bigint | null;
}) {
  return {
    id: pause.id,
    workOrderId: pause.workOrderId,
    reason: pause.reason as SharedPauseReason,
    notes: pause.notes,
    startedAt: pause.startedAt.toISOString(),
    endedAt: pause.endedAt?.toISOString() ?? null,
    durationMs: pause.durationMs === null ? null : Number(pause.durationMs),
  };
}
