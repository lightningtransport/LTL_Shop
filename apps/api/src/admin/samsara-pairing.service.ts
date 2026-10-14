import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SamsaraPairingDto, SamsaraPairingStatus } from '@ltl-shop/shared';
import { pairTrucks } from '../integrations/samsara/samsara-pairing';
import {
  METERS_PER_MILE,
  SamsaraClient,
  SamsaraConfigError,
  SamsaraUpstreamError,
  getSamsaraConfig,
  type SamsaraOdometer,
  type SamsaraVehicle,
} from '../integrations/samsara/samsara.client';
import { PrismaService } from '../prisma/prisma.service';
import { toStateDto } from './samsara-sync.service';

/**
 * D35 / S-1 (OPEN_ISSUES §1w): Setup → Samsara. Reads Samsara's vehicles and our trucks and says which are the same
 * truck. Read-only: nothing is written, so it can run as often as the Manager opens the screen.
 */
@Injectable()
export class SamsaraPairingService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async get(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<SamsaraPairingDto> {
    const checkedAt = now.toISOString();
    // S-2: how the last sync went, shown on the same screen.
    const syncRow = await this.prisma.samsaraSyncState.findUnique({ where: { id: 1 } });
    const sync = syncRow?.lastRunAt ? toStateDto(syncRow) : null;

    let samsaraConfig;
    try {
      samsaraConfig = getSamsaraConfig(this.envSnapshot());
    } catch (error) {
      if (error instanceof SamsaraConfigError) return empty(checkedAt, 'not_configured', sync);
      throw error;
    }
    if (!samsaraConfig) return empty(checkedAt, 'not_configured', sync);

    const client = new SamsaraClient(samsaraConfig, fetchImpl);
    let vehicles: SamsaraVehicle[];
    let odometers: Map<string, SamsaraOdometer> | null;
    try {
      // S1-6: odometers are a bonus; the pairing still shows when Samsara gives vehicles but no stats.
      [vehicles, odometers] = await Promise.all([client.listVehicles(), client.listOdometers().catch(() => null)]);
    } catch (error) {
      if (error instanceof SamsaraUpstreamError) return empty(checkedAt, error.unauthorized ? 'unauthorized' : 'unavailable', sync);
      throw error;
    }

    const trucks = await this.prisma.truck.findMany({
      select: { id: true, truckNumber: true, vin: true, samsaraId: true, owner: true, company: true, mileage: true },
      orderBy: { truckNumber: 'asc' },
    });

    const result = pairTrucks(
      trucks.map((truck) => ({
        id: truck.id,
        truckNumber: truck.truckNumber,
        vin: truck.vin,
        owner: truck.owner,
        company: truck.company,
        mileage: truck.mileage,
        samsaraId: truck.samsaraId == null ? null : truck.samsaraId.toFixed(0),
      })),
      vehicles.map((vehicle) => {
        const odometer = odometers?.get(vehicle.id);
        return {
          ...vehicle,
          odometer: odometer ? { miles: Math.round(odometer.meters / METERS_PER_MILE), source: odometer.source, at: odometer.at } : null,
        };
      }),
    );

    return { sync, status: 'ok', checkedAt, ...result, odometersAvailable: odometers !== null };
  }

  private envSnapshot(): NodeJS.ProcessEnv {
    const timeout = this.config.get<string | number>('SAMSARA_TIMEOUT_MS');
    return {
      SAMSARA_API_TOKEN: this.config.get<string>('SAMSARA_API_TOKEN'),
      SAMSARA_API_URL: this.config.get<string>('SAMSARA_API_URL'),
      SAMSARA_TIMEOUT_MS: timeout == null ? undefined : String(timeout),
    };
  }
}

function empty(checkedAt: string, status: SamsaraPairingStatus, sync: SamsaraPairingDto['sync']): SamsaraPairingDto {
  return { sync, status, checkedAt, summary: null, paired: [], unpairedTrucks: [], unpairedVehicles: [], odometersAvailable: false };
}
