import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, Prisma, WorkOrderJobSourceKind, type TruckFault } from '@prisma/client';
import { OPEN_WORK_ORDER_STATUSES, type TruckFaultDto, type TruckFaultsDto } from '@ltl-shop/shared';
import { SEVERITY_RANK } from '../integrations/samsara/samsara-faults';
import { PrismaService } from '../prisma/prisma.service';
import { dashLamps } from '../trucks/trucks.service';

const HISTORY_LIMIT = 50;

/** D42 / S-6: a fault with the Jobs that take care of it, who dismissed it and where it came back from. */
export const faultWithJobs = {
  jobSources: {
    where: { kind: WorkOrderJobSourceKind.samsara_fault },
    select: {
      workOrderJob: {
        select: { id: true, displayName: true, status: true, completedAt: true, workOrder: { select: { id: true, displayId: true, status: true } } },
      },
    },
  },
  dismissedBy: { select: { name: true } },
  cameBackWorkOrder: { select: { id: true, displayId: true } },
} satisfies Prisma.TruckFaultInclude;

export type FaultWithJobs = Prisma.TruckFaultGetPayload<{ include: typeof faultWithJobs }>;

/** The open Job that takes care of a fault (a completed or cancelled one does not). */
export function openJobFor(fault: FaultWithJobs) {
  return fault.jobSources
    .map((source) => source.workOrderJob)
    .find((job) => job.status === JobStatus.to_do && (OPEN_WORK_ORDER_STATUSES as string[]).includes(job.workOrder.status)) ?? null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** D35 / S-3: Truck → Faults. Active faults (worst first), then the latest cleared ones. Read-only. */
@Injectable()
export class TruckFaultsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(truckId: string): Promise<TruckFaultsDto> {
    if (!UUID.test(truckId)) throw new BadRequestException('Invalid Truck id');
    const truck = await this.prisma.truck.findUnique({
      where: { id: truckId },
      select: {
        samsaraVehicleId: true, samsaraSyncedAt: true,
        samsaraStopLamp: true, samsaraWarningLamp: true, samsaraProtectLamp: true, samsaraEmissionsLamp: true, samsaraLampsAt: true,
      },
    });
    if (!truck) throw new NotFoundException('Truck not found');

    const [active, history] = await Promise.all([
      this.prisma.truckFault.findMany({ where: { truckId, clearedAt: null }, orderBy: { firstSeenAt: 'desc' }, include: faultWithJobs }),
      this.prisma.truckFault.findMany({ where: { truckId, clearedAt: { not: null } }, orderBy: { clearedAt: 'desc' }, take: HISTORY_LIMIT, include: faultWithJobs }),
    ]);
    active.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.firstSeenAt.getTime() - a.firstSeenAt.getTime());

    return {
      lamps: dashLamps(truck),
      active: active.map(toFaultDto),
      history: history.map(toFaultDto),
      syncedAt: truck.samsaraSyncedAt?.toISOString() ?? null,
      paired: Boolean(truck.samsaraVehicleId),
    };
  }
}

export function toFaultDto(fault: TruckFault & Partial<Pick<FaultWithJobs, 'jobSources' | 'dismissedBy' | 'cameBackWorkOrder'>>): TruckFaultDto {
  return {
    id: fault.id,
    protocol: fault.protocol,
    code: fault.code,
    description: fault.description,
    severity: fault.severity,
    sourceName: fault.sourceName,
    occurrenceCount: fault.occurrenceCount,
    firstSeenAt: fault.firstSeenAt.toISOString(),
    lastSeenAt: fault.lastSeenAt.toISOString(),
    clearedAt: fault.clearedAt?.toISOString() ?? null,
    // D42 / S-6: "In WO-x", "Fixed in WO-x", "Dismissed", "Came back after WO-x".
    jobs: (fault.jobSources ?? []).map(({ workOrderJob: job }) => ({
      workOrderId: job.workOrder.id,
      workOrderDisplayId: job.workOrder.displayId,
      jobId: job.id,
      jobName: job.displayName,
      status: job.status,
    })),
    dismissed: fault.dismissedAt && fault.dismissReason
      ? { at: fault.dismissedAt.toISOString(), by: fault.dismissedBy?.name ?? null, reason: fault.dismissReason }
      : null,
    cameBackAfter: fault.cameBackWorkOrder ? { workOrderId: fault.cameBackWorkOrder.id, displayId: fault.cameBackWorkOrder.displayId } : null,
  };
}
