import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Priority, WorkOrderStatus } from '@prisma/client';
import {
  OPEN_WORK_ORDER_STATUSES,
  ReadinessAssessmentStatus,
  YardPresenceState,
  YardReadinessFilter,
  type AdminTruckDetailDto,
  type AdminWorkOrderSummaryDto,
  type YardOperationsPageDto,
  type YardOperationsTruckDto,
  type YardOperationsUnavailableDto,
  type AdminYardOperationsCursor,
  type AdminYardOperationsQuery,
  adminYardOperationsCursorSchema,
  adminYardOperationsQuerySchema,
} from '@ltl-shop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TrucksService } from '../trucks/trucks.service';
import { toTruckDto } from '../trucks/trucks.service';
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
  ) {}

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
    return {
      truck: toTruckDto(row),
      presence: { state: YardPresenceState.UNKNOWN, provenance: 'phase_1_unavailable' },
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
    } : null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
