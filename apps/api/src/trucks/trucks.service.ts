import { Injectable, NotFoundException } from '@nestjs/common';
import { AppCapability, OPEN_WORK_ORDER_STATUSES } from '@ltl-shop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toWorkOrderSummary } from '../work-orders/work-order.mapper';
import type { AuthUser } from '../auth/auth.guard';
import { hasCapability } from '../auth/capabilities';

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
    const isAssigned = wo.createdById === user.id ||
      wo.mechanics.some((assignment) => assignment.mechanicId === user.id && !assignment.removedAt);
    return {
      exists: true as const,
      ...(hasCapability(user, requiredCapability) && isAssigned
        ? { workOrder: toWorkOrderSummary(wo) }
        : {}),
    };
  }

  async getRepairHistory(truckId: string, categoryId?: string) {
    const truck = await this.getById(truckId);
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        truckId,
        status: 'completed',
        ...(categoryId ? { primaryCategoryId: categoryId } : {}),
      },
      include: {
        primaryCategory: true,
        mechanics: { include: { mechanic: true }, where: { removedAt: null } },
        jobs: { where: { status: 'completed' } },
        pmService: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 100,
    });

    return {
      truck,
      items: workOrders.map((wo) => ({
        workOrderId: wo.id,
        displayId: wo.displayId,
        date: (wo.completedAt ?? wo.createdAt).toISOString(),
        primaryCategoryName: wo.primaryCategory.name,
        truckNumber: truck.truckNumber,
        mechanicNames: wo.mechanics.map((m) => m.mechanic.name),
        mileage: wo.pmService?.observedMileage ?? truck.mileage,
        jobs: wo.primaryCategory.name === 'PM' ? [] : wo.jobs.map((j) => j.displayName),
      })),
    };
  }
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
  };
}

const workOrderSummaryInclude = {
  truck: true,
  primaryCategory: true,
  jobs: true,
  mechanics: {
    include: { mechanic: true },
    orderBy: { addedAt: 'asc' as const },
  },
  pauseEvents: { where: { endedAt: null }, take: 1, orderBy: { startedAt: 'desc' as const } },
};
