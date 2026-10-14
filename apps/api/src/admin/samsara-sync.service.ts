import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type SamsaraSyncState } from '@prisma/client';
import type { SamsaraSyncResultDto, SamsaraSyncStateDto } from '@ltl-shop/shared';
import { parseFaultCodes, type ParsedFault } from '../integrations/samsara/samsara-faults';
import { pairTrucks } from '../integrations/samsara/samsara-pairing';
import {
  METERS_PER_MILE,
  SamsaraClient,
  SamsaraConfigError,
  SamsaraUpstreamError,
  getSamsaraConfig,
  type SamsaraLocation,
  type SamsaraOdometer,
} from '../integrations/samsara/samsara.client';
import { PrismaService } from '../prisma/prisma.service';

/** Same key for every API instance: only one sync writes at a time. */
const SYNC_LOCK_KEY = 820_350_042;

export type SamsaraSyncTrigger = 'cron' | 'manual';

type Snapshot = {
  vehicleId: string;
  odometer: SamsaraOdometer | null;
  location: SamsaraLocation | null;
  /** Undefined: Samsara sent no fault reading for this vehicle, so its open faults stay as they are. */
  faults: ParsedFault[] | undefined;
};

/**
 * D35 / S-2 + S-3 (OPEN_ISSUES §1x): one Samsara sync. Reads the vehicles, pairs them with our trucks (§1w), and stores
 * on each paired truck Samsara's odometer and last GPS point, and its faults (open new ones, keep the ones still
 * reported, close the ones Samsara stopped reporting).
 *
 * Never writes `trucks.mileage` (the PM's, D10) nor the Ninox columns. Idempotent: running it twice changes nothing new.
 * Only one sync writes at a time (advisory lock); a second one at the same moment answers "skipped".
 */
@Injectable()
export class SamsaraSyncService {
  private readonly logger = new Logger(SamsaraSyncService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async state(): Promise<SamsaraSyncStateDto | null> {
    const row = await this.prisma.samsaraSyncState.findUnique({ where: { id: 1 } });
    return row?.lastRunAt ? toStateDto(row) : null;
  }

  async run(trigger: SamsaraSyncTrigger, now = new Date(), fetchImpl: typeof fetch = fetch): Promise<SamsaraSyncResultDto> {
    const started = Date.now();

    let samsaraConfig;
    try {
      samsaraConfig = getSamsaraConfig(this.envSnapshot());
    } catch (error) {
      if (!(error instanceof SamsaraConfigError)) throw error;
      samsaraConfig = null;
    }
    if (!samsaraConfig) return { status: 'not_configured', state: await this.recordFailure(trigger, now, 'not_configured', started) };

    const client = new SamsaraClient(samsaraConfig, fetchImpl);
    let vehicles;
    let stats;
    let faultCodes: Map<string, Record<string, unknown>> | null;
    try {
      [vehicles, stats, faultCodes] = await Promise.all([
        client.listVehicles(),
        client.listOdometersAndLocations(),
        // A failed fault read must not close every open fault: null means "leave faults alone this time".
        client.listFaultCodes().catch((error: unknown) => {
          this.logger.warn(`Samsara faultCodes read failed: ${error instanceof Error ? error.message : 'unknown error'}`);
          return null;
        }),
      ]);
    } catch (error) {
      if (!(error instanceof SamsaraUpstreamError)) throw error;
      const code = error.unauthorized ? 'unauthorized' : 'unavailable';
      return { status: code, state: await this.recordFailure(trigger, now, code, started) };
    }

    const trucks = await this.prisma.truck.findMany({
      select: { id: true, truckNumber: true, vin: true, samsaraId: true, owner: true, company: true, mileage: true },
    });
    const pairing = pairTrucks(
      trucks.map((truck) => ({ ...truck, samsaraId: truck.samsaraId == null ? null : truck.samsaraId.toFixed(0) })),
      vehicles,
    );

    const snapshots = new Map<string, Snapshot>();
    for (const row of pairing.paired) {
      const stat = stats.get(row.vehicle.id);
      const reading = faultCodes?.get(row.vehicle.id);
      snapshots.set(row.truck.id, {
        vehicleId: row.vehicle.id,
        odometer: stat?.odometer ?? null,
        location: stat?.location ?? null,
        faults: reading ? parseFaultCodes(reading) : undefined,
      });
    }

    const written = await this.prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(${SYNC_LOCK_KEY}) AS locked`;
        if (!locked) return null;
        return this.write(tx, snapshots, now);
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
    if (!written) return { status: 'skipped', state: await this.state() };

    const activeFaults = await this.prisma.truckFault.count({ where: { clearedAt: null } });
    const state = await this.prisma.samsaraSyncState.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {
        lastRunAt: now,
        lastSuccessAt: now,
        lastError: faultCodes ? null : 'faults_unavailable',
        lastTrigger: trigger,
        vehicles: vehicles.length,
        trucksUpdated: written.trucksUpdated,
        faultsOpened: written.faultsOpened,
        faultsCleared: written.faultsCleared,
        activeFaults,
        durationMs: Date.now() - started,
      },
    });
    return { status: 'ok', state: toStateDto(state) };
  }

  private async write(tx: Prisma.TransactionClient, snapshots: Map<string, Snapshot>, now: Date) {
    // One statement for every paired truck (not one round trip each). `updated_at` stays: a sync is not an edit.
    // A null odometer or location keeps the last good reading.
    const rows = [...snapshots].map(([truckId, { vehicleId, odometer, location }]) => Prisma.sql`(
      ${truckId}::uuid, ${vehicleId}::text,
      ${odometer ? Math.round(odometer.meters / METERS_PER_MILE) : null}::int, ${odometer?.source ?? null}::text,
      ${odometer ? (odometer.at || now.toISOString()) : null}::timestamptz,
      ${location?.address ?? null}::text, ${location?.latitude ?? null}::float8, ${location?.longitude ?? null}::float8,
      ${location?.speedMph ?? null}::float8, ${location?.at ?? null}::timestamptz)`);
    let trucksUpdated = 0;
    for (let index = 0; index < rows.length; index += 200) {
      trucksUpdated += await tx.$executeRaw`
        UPDATE "trucks" AS t SET
          "samsara_vehicle_id" = v.vehicle_id,
          "samsara_synced_at" = ${now.toISOString()}::timestamptz AT TIME ZONE 'UTC',
          "samsara_odometer_miles" = COALESCE(v.odometer_miles, t."samsara_odometer_miles"),
          "samsara_odometer_source" = COALESCE(v.odometer_source, t."samsara_odometer_source"),
          "samsara_odometer_at" = COALESCE(v.odometer_at AT TIME ZONE 'UTC', t."samsara_odometer_at"),
          "samsara_address" = CASE WHEN v.location_at IS NULL THEN t."samsara_address" ELSE v.address END,
          "samsara_latitude" = CASE WHEN v.location_at IS NULL THEN t."samsara_latitude" ELSE v.latitude END,
          "samsara_longitude" = CASE WHEN v.location_at IS NULL THEN t."samsara_longitude" ELSE v.longitude END,
          "samsara_speed_mph" = CASE WHEN v.location_at IS NULL THEN t."samsara_speed_mph" ELSE v.speed_mph END,
          "samsara_location_at" = COALESCE(v.location_at AT TIME ZONE 'UTC', t."samsara_location_at")
        FROM (VALUES ${Prisma.join(rows.slice(index, index + 200))})
          AS v(id, vehicle_id, odometer_miles, odometer_source, odometer_at, address, latitude, longitude, speed_mph, location_at)
        WHERE t."id" = v.id`;
    }
    // A truck that is no longer paired keeps its last reading, but no longer points at a Samsara vehicle.
    await tx.truck.updateMany({ where: { samsaraVehicleId: { not: null }, id: { notIn: [...snapshots.keys()] } }, data: { samsaraVehicleId: null } });

    const reported = [...snapshots].filter(([, snapshot]) => snapshot.faults !== undefined);
    const open = await tx.truckFault.findMany({
      where: { clearedAt: null, truckId: { in: reported.map(([truckId]) => truckId) } },
      select: { id: true, truckId: true, faultKey: true },
    });
    const openByKey = new Map(open.map((fault) => [`${fault.truckId}|${fault.faultKey}`, fault.id]));

    let faultsOpened = 0;
    const stillReported = new Set<string>();
    for (const [truckId, snapshot] of reported) {
      for (const fault of snapshot.faults ?? []) {
        const key = `${truckId}|${fault.faultKey}`;
        stillReported.add(key);
        const data = {
          protocol: fault.protocol,
          code: fault.code,
          description: fault.description,
          severity: fault.severity,
          spnId: fault.spnId,
          fmiId: fault.fmiId,
          dtcShortCode: fault.dtcShortCode,
          sourceName: fault.sourceName,
          occurrenceCount: fault.occurrenceCount,
          lastSeenAt: now,
        };
        const id = openByKey.get(key);
        if (id) {
          await tx.truckFault.update({ where: { id }, data });
        } else {
          await tx.truckFault.create({ data: { ...data, truckId, faultKey: fault.faultKey, firstSeenAt: now } });
          faultsOpened += 1;
        }
      }
    }

    const toClear = open.filter((fault) => !stillReported.has(`${fault.truckId}|${fault.faultKey}`)).map((fault) => fault.id);
    const cleared = toClear.length ? await tx.truckFault.updateMany({ where: { id: { in: toClear }, clearedAt: null }, data: { clearedAt: now } }) : { count: 0 };

    return { trucksUpdated, faultsOpened, faultsCleared: cleared.count };
  }

  private async recordFailure(trigger: SamsaraSyncTrigger, now: Date, code: string, started: number) {
    const state = await this.prisma.samsaraSyncState.upsert({
      where: { id: 1 },
      create: { id: 1, lastRunAt: now, lastError: code, lastTrigger: trigger, durationMs: Date.now() - started },
      update: { lastRunAt: now, lastError: code, lastTrigger: trigger, durationMs: Date.now() - started },
    });
    return toStateDto(state);
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

export function toStateDto(row: SamsaraSyncState): SamsaraSyncStateDto {
  return {
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastError: row.lastError,
    lastTrigger: row.lastTrigger,
    vehicles: row.vehicles,
    trucksUpdated: row.trucksUpdated,
    faultsOpened: row.faultsOpened,
    faultsCleared: row.faultsCleared,
    activeFaults: row.activeFaults,
    durationMs: row.durationMs,
  };
}
