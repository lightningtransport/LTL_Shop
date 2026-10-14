import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SamsaraPairingDto, SamsaraPairingStatus } from '@ltl-shop/shared';
import { pairTrucks } from '../integrations/samsara/samsara-pairing';
import {
  SamsaraClient,
  SamsaraConfigError,
  SamsaraUpstreamError,
  getSamsaraConfig,
  type SamsaraVehicle,
} from '../integrations/samsara/samsara.client';
import { PrismaService } from '../prisma/prisma.service';

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

    let samsaraConfig;
    try {
      samsaraConfig = getSamsaraConfig(this.envSnapshot());
    } catch (error) {
      if (error instanceof SamsaraConfigError) return empty(checkedAt, 'not_configured');
      throw error;
    }
    if (!samsaraConfig) return empty(checkedAt, 'not_configured');

    let vehicles: SamsaraVehicle[];
    try {
      vehicles = await new SamsaraClient(samsaraConfig, fetchImpl).listVehicles();
    } catch (error) {
      if (error instanceof SamsaraUpstreamError) return empty(checkedAt, error.unauthorized ? 'unauthorized' : 'unavailable');
      throw error;
    }

    const trucks = await this.prisma.truck.findMany({
      select: { id: true, truckNumber: true, vin: true, samsaraId: true },
      orderBy: { truckNumber: 'asc' },
    });

    const result = pairTrucks(
      trucks.map((truck) => ({
        id: truck.id,
        truckNumber: truck.truckNumber,
        vin: truck.vin,
        samsaraId: truck.samsaraId == null ? null : truck.samsaraId.toFixed(0),
      })),
      vehicles,
    );

    return { status: 'ok', checkedAt, ...result };
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

function empty(checkedAt: string, status: SamsaraPairingStatus): SamsaraPairingDto {
  return { status, checkedAt, summary: null, paired: [], unpairedTrucks: [], unpairedVehicles: [] };
}
