import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppCapability,
  JobStatus,
  OPEN_WORK_ORDER_STATUSES,
  isPmCategory,
  type AdminRepairHistoryDto,
} from '@ltl-shop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toWorkOrderSummary } from '../work-orders/work-order.mapper';
import type { AuthUser } from '../auth/auth.guard';
import { hasCapability } from '../auth/capabilities';
import { isWorkPlanPmPhaseEnabled } from '../admin/yard-work-plan-flag';

@Injectable()
export class TrucksService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const trucks = await this.prisma.truck.findMany({
      orderBy: { truckNumber: 'asc' },
    });
    return trucks.map(toTruckDto);
  }

  async search(q: string) {
    const term = q.trim().replace(/^#\s*/, '').replace(/\s+/g, '');
    if (!term) return [];
    const primary = await this.prisma.truck.findMany({
      where: {
        OR: [
          { truckNumber: { equals: term, mode: 'insensitive' } },
          { truckNumber: { startsWith: term, mode: 'insensitive' } },
        ],
      },
    });
    if (primary.length) return rankTruckMatches(primary, term).map(toTruckDto);

    const fallback = await this.prisma.truck.findMany({
      where: { truckNumber: { contains: term, mode: 'insensitive' } },
    });
    return rankTruckMatches(fallback, term).map(toTruckDto);
  }

  async getById(id: string) {
    const truck = await this.prisma.truck.findUnique({ where: { id } });
    if (!truck) throw new NotFoundException('Truck not found');
    return toTruckDto(truck);
  }

  async getOpenWorkOrder(user: AuthUser, truckId: string) {
    await this.getById(truckId);
    const wo = await this.prisma.workOrder.findFirst({
      where: {
        truckId,
        status: { in: OPEN_WORK_ORDER_STATUSES },
      },
      include: workOrderSummaryInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (!wo) return { exists: false as const };
    const requiredCapability = wo.primaryCategory.name === 'PM'
      ? AppCapability.MECHANIC_PM
      : AppCapability.MECHANIC_STANDARD;
    const isAssigned = wo.createdById === user.id
      || wo.mechanics.some((assignment) => assignment.mechanicId === user.id && !assignment.removedAt)
      || wo.jobs.some((job) => job.assignedMechanicId === user.id);
    return {
      exists: true as const,
      ...(hasCapability(user, requiredCapability) && isAssigned
        ? { workOrder: toWorkOrderSummary(wo) }
        : {}),
      ...(hasCapability(user, AppCapability.MECHANIC_PM) ? { pmJoin: pmJoinPreview(user, wo) } : {}),
    };
  }

  async getRepairHistory(
    truckId: string,
    categoryId?: string,
    options: { excludeWorkOrderId?: string; limit?: number; cursor?: string } = {},
  ): Promise<AdminRepairHistoryDto> {
    const truck = await this.getById(truckId);
    const limit = options.limit ?? 100;
    const cursor = options.cursor ? decodeRepairHistoryCursor(options.cursor) : null;
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        truckId,
        status: 'completed',
        completedAt: { not: null },
        ...(categoryId ? { jobs: { some: { categoryId } } } : {}),
        ...(options.excludeWorkOrderId ? { id: { not: options.excludeWorkOrderId } } : {}),
        ...(cursor ? {
          OR: [
            { completedAt: { lt: cursor.completedAt } },
            { completedAt: cursor.completedAt, id: { lt: cursor.id } },
          ],
        } : {}),
      },
      include: {
        primaryCategory: true,
        mechanics: { include: { mechanic: true }, where: { removedAt: null } },
        jobs: {
          where: { status: 'completed' },
          include: { category: { select: { id: true, name: true } } },
        },
        pmService: true,
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasNext = workOrders.length > limit;
    const pageRows = hasNext ? workOrders.slice(0, limit) : workOrders;

    return {
      truck,
      items: pageRows.map((wo) => toRepairHistoryItem(wo, truck.truckNumber, truck.mileage)),
      nextCursor: hasNext
        ? encodeRepairHistoryCursor(pageRows[pageRows.length - 1])
        : null,
    };
  }
}

function toRepairHistoryItem(
  wo: {
    id: string;
    displayId: string;
    completedAt: Date | null;
    createdAt: Date;
    primaryCategory: { name: string };
    mechanics: { mechanic: { name: string } }[];
    pmService: { observedMileage: number | null } | null;
    jobs: {
      id: string;
      categoryId: string;
      category: { id: string; name: string };
      displayName: string;
    }[];
  },
  truckNumber: string,
  truckMileage: number | null,
) {
  return {
    workOrderId: wo.id,
    displayId: wo.displayId,
    date: (wo.completedAt ?? wo.createdAt).toISOString(),
    primaryCategoryName: wo.primaryCategory.name,
    truckNumber,
    mechanicNames: wo.mechanics.map((m) => m.mechanic.name),
    mileage: wo.pmService?.observedMileage ?? truckMileage,
    jobs: wo.primaryCategory.name === 'PM' ? [] : wo.jobs.map((j) => j.displayName),
    jobDetails: wo.primaryCategory.name === 'PM' ? [] : wo.jobs.map((j) => ({
      id: j.id,
      categoryId: j.categoryId,
      category: j.category,
      displayName: j.displayName,
      status: JobStatus.COMPLETED,
    })),
  };
}

function decodeRepairHistoryCursor(encoded: string) {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') throw new Error('shape');
    const candidate = parsed as { completedAt?: unknown; id?: unknown };
    if (
      typeof candidate.completedAt !== 'string' ||
      Number.isNaN(Date.parse(candidate.completedAt)) ||
      typeof candidate.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate.id)
    ) throw new Error('value');
    return { completedAt: new Date(candidate.completedAt), id: candidate.id };
  } catch {
    throw new BadRequestException('Invalid repair history cursor');
  }
}

function encodeRepairHistoryCursor(row: { id: string; completedAt: Date | null }) {
  if (!row.completedAt) return null;
  return Buffer.from(JSON.stringify({ completedAt: row.completedAt.toISOString(), id: row.id }))
    .toString('base64url');
}

function rankTruckMatches<T extends { truckNumber: string }>(trucks: T[], term: string) {
  const normalizedTerm = term.toLocaleLowerCase('en-US');
  return [...trucks]
    .sort((left, right) => {
      const leftExact = left.truckNumber.toLocaleLowerCase('en-US') === normalizedTerm;
      const rightExact = right.truckNumber.toLocaleLowerCase('en-US') === normalizedTerm;
      if (leftExact !== rightExact) return leftExact ? -1 : 1;
      return left.truckNumber.localeCompare(right.truckNumber, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    })
    .slice(0, 20);
}

export function toTruckDto(truck: {
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
}) {
  return {
    id: truck.id,
    truckNumber: truck.truckNumber,
    make: truck.make,
    model: truck.model,
    year: truck.year,
    mileage: truck.mileage,
    company: truck.company,
    owner: truck.owner,
    vin: emptyToNull(truck.vin),
    location: emptyToNull(truck.samsaraTruckLocation),
    locationUpdatedOn: toIsoDate(truck.samsaraLastConnectedDate),
  };
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toIsoDate(value: Date | null | undefined) {
  if (!value) return null;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const workOrderSummaryInclude = {
  truck: true,
  primaryCategory: true,
  jobs: {
    include: {
      category: { select: { id: true, name: true } },
      assignedMechanic: { select: { id: true, name: true } },
    },
  },
  mechanics: {
    include: { mechanic: true },
    orderBy: { addedAt: 'asc' as const },
  },
  pauseEvents: { where: { endedAt: null }, take: 1, orderBy: { startedAt: 'desc' as const } },
};

/**
 * LTR-147: what "Create PM service" will do on a truck that already has an open
 * Work Order (only with WORK_PLAN_PM_PHASE; a legacy PM Work Order keeps the old rule).
 */
function pmJoinPreview(
  user: AuthUser,
  wo: {
    displayId: string;
    primaryCategory: { name: string };
    jobs: Array<{ status: string; assignedMechanicId: string | null; startedAt?: Date | null; category: { name: string }; assignedMechanic?: { name: string } | null }>;
  },
) {
  if (!isWorkPlanPmPhaseEnabled() || isPmCategory(wo.primaryCategory.name)) return undefined;
  const pmJob = wo.jobs.find((job) => job.status !== 'cancelled' && isPmCategory(job.category.name));
  const status = !pmJob
    ? 'add'
    : pmJob.status === 'completed'
      ? 'done'
      : pmJob.assignedMechanicId && pmJob.assignedMechanicId !== user.id
        ? 'taken'
        : pmJob.assignedMechanicId === user.id && pmJob.startedAt
          ? 'mine'
          : 'join';
  return {
    displayId: wo.displayId,
    status,
    assignedMechanicName: status === 'taken' ? pmJob?.assignedMechanic?.name ?? null : null,
  };
}
