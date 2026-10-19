import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type SamsaraSyncState } from '@prisma/client';
import { SAMSARA_SHOP_GEOFENCE_IDS, type SamsaraSyncResultDto, type SamsaraSyncStateDto } from '@ltl-shop/shared';
import { parseFaultReading, type DashLamps, type ParsedFault } from '../integrations/samsara/samsara-faults';
import { PAIRING_TRUCK_SELECT, pairTrucks, toPairingTruck } from '../integrations/samsara/samsara-pairing';
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

/** D42: a code reported again this soon after its Job was completed "came back". */
const CAME_BACK_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Same key for every API instance: only one sync writes at a time. */
const SYNC_LOCK_KEY = 820_350_042;

export type SamsaraSyncTrigger = 'cron' | 'manual';

type Snapshot = {
  vehicleId: string;
  vehicleName: string;
  /** D44: the truck's `samsara_vehicle_id` when it was read (null: connected by its Ninox Samsara id, stored now). */
  storedVehicleId: string | null;
  odometer: SamsaraOdometer | null;
  location: SamsaraLocation | null;
  /** Undefined: Samsara sent no fault reading for this vehicle, so its open faults and lights stay as they are. */
  faults: ParsedFault[] | undefined;
  lamps: DashLamps | undefined;
};

/**
 * D35 / S-2 + S-3 (OPEN_ISSUES §1x): one Samsara sync. Reads the vehicles, pairs them with our trucks (§1w), and stores
 * on each paired truck Samsara's odometer and last GPS point, and its faults (open new ones, keep the ones still
 * reported, close the ones Samsara stopped reporting).
 *
 * D44: it never decides a connection. A truck is connected iff `samsara_vehicle_id` is set (or, until this run stores
 * it, by its Ninox Samsara id); a vehicle Samsara stops listing leaves the truck connected with its last readings. An
 * exact VIN match is only written as `samsara_proposed_vehicle_id` for the Manager. Deactivated trucks are skipped.
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

    const trucks = await this.prisma.truck.findMany({ select: PAIRING_TRUCK_SELECT });
    const pairing = pairTrucks(trucks.map(toPairingTruck), vehicles);
    const storedById = new Map(trucks.map((truck) => [truck.id, truck.samsaraVehicleId]));

    const snapshots = new Map<string, Snapshot>();
    for (const row of pairing.paired) {
      // D44: Samsara stopped listing the connected vehicle: the truck stays connected, nothing new to store.
      if (row.warnings.includes('vehicle_missing')) {
        this.logger.warn(`Samsara no longer lists vehicle ${row.vehicle.id} (truck ${row.truck.truckNumber}); it stays connected`);
        continue;
      }
      const stat = stats.get(row.vehicle.id);
      const reading = faultCodes?.get(row.vehicle.id);
      const parsed = reading ? parseFaultReading(reading) : undefined;
      snapshots.set(row.truck.id, {
        vehicleId: row.vehicle.id,
        vehicleName: row.vehicle.name,
        storedVehicleId: storedById.get(row.truck.id) ?? null,
        odometer: stat?.odometer ?? null,
        location: stat?.location ?? null,
        faults: parsed?.faults,
        lamps: parsed?.lamps,
      });
    }

    const written = await this.prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(${SYNC_LOCK_KEY}) AS locked`;
        if (!locked) return null;
        return this.write(tx, snapshots, new Map(pairing.proposed.map((row) => [row.truck.id, row.vehicle.id])), now);
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

  private async write(tx: Prisma.TransactionClient, snapshots: Map<string, Snapshot>, proposals: Map<string, string>, now: Date) {
    // One statement for every paired truck (not one round trip each). `updated_at` stays: a sync is not an edit.
    // A null odometer or location keeps the last good reading.
    const rows = [...snapshots].map(([truckId, { vehicleId, vehicleName, storedVehicleId, odometer, location, lamps }]) => Prisma.sql`(
      ${truckId}::uuid, ${vehicleId}::text, ${vehicleName || null}::text, ${storedVehicleId}::text,
      ${odometer ? Math.round(odometer.meters / METERS_PER_MILE) : null}::int, ${odometer?.source ?? null}::text,
      ${odometer ? (odometer.at || now.toISOString()) : null}::timestamptz,
      ${location?.address ?? null}::text, ${location?.latitude ?? null}::float8, ${location?.longitude ?? null}::float8,
      ${location?.speedMph ?? null}::float8, ${location?.at ?? null}::timestamptz,
      ${location?.geofence?.id ?? null}::text, ${location?.geofence?.name ?? null}::text,
      ${lamps ? lamps.stop : null}::boolean, ${lamps ? lamps.warning : null}::boolean,
      ${lamps ? lamps.protect : null}::boolean, ${lamps ? lamps.emissions : null}::boolean)`);
    // D49: SET reads the old row, so `t.samsara_geofence_id` is where the truck was before this reading.
    const shop = Prisma.sql`${[...SAMSARA_SHOP_GEOFENCE_IDS]}::text[]`;
    const updated = new Set<string>();
    for (let index = 0; index < rows.length; index += 200) {
      const written = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "trucks" AS t SET
          "samsara_vehicle_id" = v.vehicle_id,
          "samsara_vehicle_name" = COALESCE(v.vehicle_name, t."samsara_vehicle_name"),
          "samsara_proposed_vehicle_id" = NULL,
          "samsara_synced_at" = ${now.toISOString()}::timestamptz AT TIME ZONE 'UTC',
          "samsara_odometer_miles" = COALESCE(v.odometer_miles, t."samsara_odometer_miles"),
          "samsara_odometer_source" = COALESCE(v.odometer_source, t."samsara_odometer_source"),
          "samsara_odometer_at" = COALESCE(v.odometer_at AT TIME ZONE 'UTC', t."samsara_odometer_at"),
          "samsara_address" = CASE WHEN v.location_at IS NULL THEN t."samsara_address" ELSE v.address END,
          "samsara_latitude" = CASE WHEN v.location_at IS NULL THEN t."samsara_latitude" ELSE v.latitude END,
          "samsara_longitude" = CASE WHEN v.location_at IS NULL THEN t."samsara_longitude" ELSE v.longitude END,
          "samsara_speed_mph" = CASE WHEN v.location_at IS NULL THEN t."samsara_speed_mph" ELSE v.speed_mph END,
          "samsara_location_at" = COALESCE(v.location_at AT TIME ZONE 'UTC', t."samsara_location_at"),
          -- D49: the geofence moves with the GPS point; arriving at the shop stamps the time, staying keeps it, leaving clears it.
          "samsara_geofence_id" = CASE WHEN v.location_at IS NULL THEN t."samsara_geofence_id" ELSE v.geofence_id END,
          "samsara_geofence_name" = CASE WHEN v.location_at IS NULL THEN t."samsara_geofence_name" ELSE v.geofence_name END,
          "samsara_in_shop_since" = CASE
            WHEN v.location_at IS NULL THEN t."samsara_in_shop_since"
            WHEN v.geofence_id = ANY(${shop}) THEN COALESCE(
              CASE WHEN t."samsara_geofence_id" = ANY(${shop}) THEN t."samsara_in_shop_since" END,
              v.location_at AT TIME ZONE 'UTC')
            ELSE NULL END,
          -- S3-4: the dash lights move together; no fault reading this time keeps the last ones.
          "samsara_stop_lamp" = CASE WHEN v.stop_lamp IS NULL THEN t."samsara_stop_lamp" ELSE v.stop_lamp END,
          "samsara_warning_lamp" = CASE WHEN v.stop_lamp IS NULL THEN t."samsara_warning_lamp" ELSE v.warning_lamp END,
          "samsara_protect_lamp" = CASE WHEN v.stop_lamp IS NULL THEN t."samsara_protect_lamp" ELSE v.protect_lamp END,
          "samsara_emissions_lamp" = CASE WHEN v.stop_lamp IS NULL THEN t."samsara_emissions_lamp" ELSE v.emissions_lamp END,
          "samsara_lamps_at" = CASE WHEN v.stop_lamp IS NULL THEN t."samsara_lamps_at" ELSE ${now.toISOString()}::timestamptz AT TIME ZONE 'UTC' END
        FROM (VALUES ${Prisma.join(rows.slice(index, index + 200))})
          AS v(id, vehicle_id, vehicle_name, stored_vehicle_id, odometer_miles, odometer_source, odometer_at, address, latitude, longitude,
            speed_mph, location_at, geofence_id, geofence_name, stop_lamp, warning_lamp, protect_lamp, emissions_lamp)
        -- D44: only if nobody connected, disconnected or deactivated the truck since it was read.
        WHERE t."id" = v.id
          AND t."samsara_vehicle_id" IS NOT DISTINCT FROM v.stored_vehicle_id
          AND (v.stored_vehicle_id IS NOT NULL OR t."samsara_id" IS NOT NULL)
          AND t."deactivated_at" IS NULL
        RETURNING t."id"::text AS id`;
      for (const row of written) updated.add(row.id);
    }
    // D44: a stored connection is never undone here (no more "no longer paired → null"); the Manager disconnects.

    // D44 §3: an exact VIN match is proposed, never connected; proposals that no longer hold go away.
    const proposalIds = [...proposals.keys()];
    await tx.$executeRaw`
      UPDATE "trucks" SET "samsara_proposed_vehicle_id" = NULL
      WHERE "samsara_proposed_vehicle_id" IS NOT NULL
        ${proposalIds.length ? Prisma.sql`AND "id" NOT IN (${Prisma.join(proposalIds.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.empty}`;
    if (proposalIds.length) {
      await tx.$executeRaw`
        UPDATE "trucks" AS t SET "samsara_proposed_vehicle_id" = v.vehicle_id
        FROM (VALUES ${Prisma.join([...proposals].map(([truckId, vehicleId]) => Prisma.sql`(${truckId}::uuid, ${vehicleId}::text)`))}) AS v(id, vehicle_id)
        WHERE t."id" = v.id AND t."samsara_vehicle_id" IS NULL AND t."deactivated_at" IS NULL
          AND t."samsara_proposed_vehicle_id" IS DISTINCT FROM v.vehicle_id`;
    }

    const reported = [...snapshots].filter(([truckId, snapshot]) => updated.has(truckId) && snapshot.faults !== undefined);
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
          // D42 / S-6: the code is back within 48 h after a Job for it was completed: say where it was "fixed".
          const fixedJob = await tx.workOrderJobSource.findFirst({
            where: {
              truckFault: { truckId, faultKey: fault.faultKey, clearedAt: { not: null } },
              workOrderJob: { status: 'completed', completedAt: { gte: new Date(now.getTime() - CAME_BACK_WINDOW_MS) } },
            },
            select: { workOrderJob: { select: { workOrderId: true } } },
            orderBy: { workOrderJob: { completedAt: 'desc' } },
          });
          await tx.truckFault.create({
            data: { ...data, truckId, faultKey: fault.faultKey, firstSeenAt: now, cameBackWorkOrderId: fixedJob?.workOrderJob.workOrderId ?? null },
          });
          faultsOpened += 1;
        }
      }
    }

    const toClear = open.filter((fault) => !stillReported.has(`${fault.truckId}|${fault.faultKey}`)).map((fault) => fault.id);
    const cleared = toClear.length ? await tx.truckFault.updateMany({ where: { id: { in: toClear }, clearedAt: null }, data: { clearedAt: now } }) : { count: 0 };

    return { trucksUpdated: updated.size, faultsOpened, faultsCleared: cleared.count };
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
