import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SAMSARA_CONNECT_FIELDS,
  adminConnectSamsaraSchema,
  type SamsaraCandidateDto,
  type SamsaraCandidatesDto,
  type SamsaraConnectField,
  type SamsaraConnectResultDto,
} from '@ltl-shop/shared';
import { normalizeTruckNumber, normalizeVin } from '../integrations/samsara/samsara-pairing';
import {
  SamsaraClient,
  SamsaraConfigError,
  SamsaraUpstreamError,
  getSamsaraConfig,
  type SamsaraVehicle,
} from '../integrations/samsara/samsara.client';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import { PrismaService } from '../prisma/prisma.service';
import { SamsaraSyncService } from './samsara-sync.service';
import { TrucksAdminService } from './trucks-admin.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TruckCard = { vin: string | null; make: string | null; model: string | null; year: number | null; licensePlate: string | null };

/**
 * D44 §3–4 (LTR-215): Connect Samsara from the truck. The Manager picks the vehicle (the sync only proposes); what was
 * empty on the card is filled from Samsara, and where both sides differ the Manager chooses which one stays (nothing is
 * overwritten unseen, D43). Disconnecting stops the sync for the truck; its last readings and faults stay as history.
 */
@Injectable()
export class TruckSamsaraService {
  private readonly logger = new Logger(TruckSamsaraService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly trucksAdmin: TrucksAdminService,
    private readonly sync: SamsaraSyncService,
  ) {}

  /** Samsara vehicles no other truck has; the VIN match first, then the number match, then the rest by name. */
  async candidates(truckId: string, fetchImpl: typeof fetch = fetch): Promise<SamsaraCandidatesDto> {
    const truck = await this.truck(truckId);
    const [vehicles, taken] = await Promise.all([this.vehicles(fetchImpl), this.takenVehicleIds(truckId)]);
    const vin = normalizeVin(truck.vin);
    const number = normalizeTruckNumber(truck.truckNumber);
    const items: SamsaraCandidateDto[] = vehicles
      .filter((vehicle) => !taken.has(vehicle.id))
      .map((vehicle) => ({
        id: vehicle.id,
        name: vehicle.name,
        vin: vehicle.vin,
        make: vehicle.make ?? null,
        model: vehicle.model ?? null,
        year: vehicle.year ?? null,
        licensePlate: vehicle.licensePlate ?? null,
        suggested: vin && normalizeVin(vehicle.vin) === vin ? 'vin' : number && normalizeTruckNumber(vehicle.name) === number ? 'number' : null,
      }));
    const rank = { vin: 0, number: 1 } as const;
    items.sort((a, b) =>
      (a.suggested ? rank[a.suggested] : 2) - (b.suggested ? rank[b.suggested] : 2)
      || a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }));
    return { items, proposedVehicleId: truck.samsaraVehicleId ? null : truck.samsaraProposedVehicleId };
  }

  async connect(truckId: string, raw: unknown, fetchImpl: typeof fetch = fetch): Promise<SamsaraConnectResultDto> {
    const parsed = adminConnectSamsaraSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { vehicleId, choose = {} } = parsed.data;
    await this.truck(truckId);
    // Read Samsara again: the list on screen may be minutes old.
    const vehicle = (await this.vehicles(fetchImpl)).find((item) => item.id === vehicleId);
    if (!vehicle) throw new NotFoundException({ code: 'SAMSARA_VEHICLE_NOT_FOUND', message: 'Samsara does not list this vehicle any more.' });

    const updatedFields = await this.prisma.$transaction(async (tx) => {
      await lockTruckMutation(tx, truckId);
      const truck = await tx.truck.findUnique({ where: { id: truckId } });
      if (!truck) throw new NotFoundException('Truck not found');
      if (truck.deactivatedAt) throw new ConflictException({ code: 'TRUCK_INACTIVE', message: 'This truck is deactivated. Reactivate it first.' });
      const other = await tx.truck.findFirst({
        where: {
          id: { not: truckId },
          OR: [{ samsaraVehicleId: vehicleId }, ...(/^\d+$/.test(vehicleId) ? [{ samsaraVehicleId: null, samsaraId: vehicleId }] : [])],
        },
        select: { id: true, truckNumber: true },
      });
      if (other) {
        throw new ConflictException({
          code: 'SAMSARA_VEHICLE_TAKEN',
          message: `Truck ${other.truckNumber} is already connected to this Samsara vehicle.`,
          truck: { id: other.id, truckNumber: other.truckNumber },
        });
      }

      const { data, filled, needChoice } = mergeCard(truck, vehicle, choose);
      if (needChoice.length) {
        throw new BadRequestException({
          code: 'SAMSARA_CHOICE_REQUIRED',
          message: 'Choose which value stays for the fields where the truck and Samsara differ.',
          fields: needChoice,
        });
      }
      if (data.vin !== undefined) await this.trucksAdmin.assertVinFree(tx, data.vin, truckId);
      await tx.truck.update({
        where: { id: truckId },
        data: { ...data, samsaraVehicleId: vehicle.id, samsaraVehicleName: vehicle.name || null, samsaraProposedVehicleId: null },
      });
      return filled;
    });

    // D44 §4: miles, location and faults right away. A failed sync does not undo the connection; the hourly one follows.
    let synced = false;
    try {
      synced = (await this.sync.run('manual', new Date(), fetchImpl)).status === 'ok';
    } catch (error) {
      this.logger.warn(`Sync after connecting truck ${truckId} failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return { connectedVehicleId: vehicle.id, connectedVehicleName: vehicle.name, updatedFields, synced };
  }

  /** The legacy Ninox Samsara id goes too, or the next sync would connect the truck again by it. */
  async disconnect(truckId: string) {
    await this.truck(truckId);
    await this.prisma.truck.update({
      where: { id: truckId },
      data: { samsaraVehicleId: null, samsaraVehicleName: null, samsaraId: null, samsaraProposedVehicleId: null },
    });
    return { disconnected: true as const };
  }

  private async truck(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Invalid Truck id');
    const truck = await this.prisma.truck.findUnique({
      where: { id },
      select: { id: true, truckNumber: true, vin: true, samsaraVehicleId: true, samsaraProposedVehicleId: true },
    });
    if (!truck) throw new NotFoundException('Truck not found');
    return truck;
  }

  /** Vehicles another truck has: stored connections, and Ninox Samsara ids the next sync will store. */
  private async takenVehicleIds(exceptTruckId: string) {
    const rows = await this.prisma.truck.findMany({
      where: { id: { not: exceptTruckId }, OR: [{ samsaraVehicleId: { not: null } }, { samsaraId: { not: null } }] },
      select: { samsaraVehicleId: true, samsaraId: true },
    });
    return new Set(rows.map((row) => row.samsaraVehicleId ?? row.samsaraId?.toFixed(0)).filter((id): id is string => Boolean(id)));
  }

  private async vehicles(fetchImpl: typeof fetch): Promise<SamsaraVehicle[]> {
    let samsaraConfig;
    try {
      samsaraConfig = getSamsaraConfig(this.envSnapshot());
    } catch (error) {
      if (!(error instanceof SamsaraConfigError)) throw error;
      samsaraConfig = null;
    }
    if (!samsaraConfig) {
      throw new ServiceUnavailableException({ code: 'SAMSARA_NOT_CONFIGURED', message: 'Samsara is not connected to the Shop in this environment.' });
    }
    try {
      return await new SamsaraClient(samsaraConfig, fetchImpl).listVehicles();
    } catch (error) {
      if (!(error instanceof SamsaraUpstreamError)) throw error;
      throw new ServiceUnavailableException(error.unauthorized
        ? { code: 'SAMSARA_UNAUTHORIZED', message: 'Samsara rejected the Shop\'s token.' }
        : { code: 'SAMSARA_UNAVAILABLE', message: 'Samsara did not answer. Try again in a minute.' });
    }
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

/**
 * D44 §4, per field: ours empty → Samsara's; the same → nothing; different → the Manager's choice (required).
 * VINs compare without spaces or case; text without case.
 */
export function mergeCard(
  truck: TruckCard,
  vehicle: SamsaraVehicle,
  choose: Partial<Record<SamsaraConnectField, 'ours' | 'samsara'>>,
) {
  const data: Partial<TruckCard> = {};
  const filled: SamsaraConnectField[] = [];
  const needChoice: SamsaraConnectField[] = [];
  for (const field of SAMSARA_CONNECT_FIELDS) {
    const theirs = field === 'vin' ? vehicle.vin?.trim().toUpperCase() || null : vehicle[field] ?? null;
    const ours = truck[field];
    if (theirs == null || theirs === '') continue;
    const empty = ours == null || (typeof ours === 'string' && !ours.trim());
    if (!empty && sameValue(field, ours, theirs)) continue;
    if (!empty) {
      if (!choose[field]) {
        needChoice.push(field);
        continue;
      }
      if (choose[field] === 'ours') continue;
    }
    (data as Record<string, unknown>)[field] = theirs;
    filled.push(field);
  }
  return { data, filled, needChoice };
}

function sameValue(field: SamsaraConnectField, ours: string | number, theirs: string | number) {
  if (field === 'vin') return normalizeVin(String(ours)) === normalizeVin(String(theirs)) || String(ours).toUpperCase() === String(theirs).toUpperCase();
  return String(ours).trim().toLowerCase() === String(theirs).trim().toLowerCase();
}
