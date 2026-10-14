import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TruckFault } from '@prisma/client';
import type { TruckFaultDto, TruckFaultsDto } from '@ltl-shop/shared';
import { SEVERITY_RANK } from '../integrations/samsara/samsara-faults';
import { PrismaService } from '../prisma/prisma.service';
import { dashLamps } from '../trucks/trucks.service';

const HISTORY_LIMIT = 50;
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
      this.prisma.truckFault.findMany({ where: { truckId, clearedAt: null }, orderBy: { firstSeenAt: 'desc' } }),
      this.prisma.truckFault.findMany({ where: { truckId, clearedAt: { not: null } }, orderBy: { clearedAt: 'desc' }, take: HISTORY_LIMIT }),
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

function toFaultDto(fault: TruckFault): TruckFaultDto {
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
  };
}
