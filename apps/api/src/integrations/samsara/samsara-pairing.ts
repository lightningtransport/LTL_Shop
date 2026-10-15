import type {
  SamsaraOdometerDto,
  SamsaraPairedTruckDto,
  SamsaraPairingMethod,
  SamsaraPairingSummaryDto,
  SamsaraPairingWarning,
  SamsaraProposedTruckDto,
  SamsaraTruckRefDto,
  SamsaraUnpairedTruckDto,
  SamsaraVehicleRefDto,
} from '@ltl-shop/shared';
import type { SamsaraVehicle } from './samsara.client';

/** A Samsara vehicle with its odometer already in miles (null when Samsara gave none). */
export type PairingVehicle = SamsaraVehicle & { odometer?: SamsaraOdometerDto | null };

export type PairingTruck = SamsaraTruckRefDto & {
  /** `trucks.samsara_id` (filled once from Ninox), as a digit string. */
  samsaraId: string | null;
  /** D44: `trucks.samsara_vehicle_id`, the stored connection. Set means connected. */
  samsaraVehicleId?: string | null;
  /** D44: a deactivated truck keeps its vehicle (nobody else gets it) but is left out of every list. */
  active?: boolean;
};

export type PairingResult = {
  summary: SamsaraPairingSummaryDto;
  paired: SamsaraPairedTruckDto[];
  proposed: SamsaraProposedTruckDto[];
  unpairedTrucks: SamsaraUnpairedTruckDto[];
  unpairedVehicles: SamsaraVehicleRefDto[];
};

/** D44: what the pairing reads of every truck (the sync and Connect Samsara read the same). */
export const PAIRING_TRUCK_SELECT = {
  id: true, truckNumber: true, vin: true, samsaraId: true, samsaraVehicleId: true, deactivatedAt: true, owner: true, company: true, mileage: true,
} as const;

export function toPairingTruck(truck: {
  id: string; truckNumber: string; vin: string | null; samsaraId: { toFixed(digits: number): string } | null; samsaraVehicleId: string | null;
  deactivatedAt: Date | null; owner: string | null; company: string | null; mileage: number | null;
}): PairingTruck {
  return {
    id: truck.id,
    truckNumber: truck.truckNumber,
    vin: truck.vin,
    owner: truck.owner,
    company: truck.company,
    mileage: truck.mileage,
    samsaraId: truck.samsaraId == null ? null : truck.samsaraId.toFixed(0),
    samsaraVehicleId: truck.samsaraVehicleId,
    active: !truck.deactivatedAt,
  };
}

/** VINs are 17 characters; anything shorter than 11 is a placeholder, not a VIN to match on. */
export function normalizeVin(vin: string | null | undefined): string | null {
  const value = (vin ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return value.length >= 11 ? value : null;
}

/** "601", "Truck 601", "#0601" and "unit-601" are the same number; "601 B" is not. */
export function normalizeTruckNumber(value: string | null | undefined): string | null {
  const cleaned = (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/^(truck|unit|tractor)\b/, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/^0+(?=.)/, '');
  return cleaned || null;
}

/**
 * D35 / S-1, D44: which trucks are connected to which Samsara vehicle. Pure: nothing is read or written here.
 * 1. A stored `samsaraVehicleId` is the decision: connected, even when Samsara stopped listing the vehicle.
 * 2. Without one, the Samsara id that came from Ninox connects it (an id in our own data, not a guess).
 * 3. Otherwise a vehicle with exactly the truck's VIN is only **proposed**; the Manager connects it from the truck.
 *    A number match is never proposed (Connect Samsara only marks it "Suggested").
 * Never guesses: a VIN that fits several vehicles, or a vehicle wanted by several trucks, stays unpaired with the reason.
 */
export function pairTrucks(trucks: PairingTruck[], vehicles: PairingVehicle[]): PairingResult {
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const byVin = groupBy(vehicles, (vehicle) => normalizeVin(vehicle.vin));
  const active = trucks.filter((truck) => truck.active !== false);

  // Vehicles already taken: stored on any truck (a deactivated one too), then by the Ninox id.
  const claimed = new Set(trucks.map((truck) => truck.samsaraVehicleId).filter((id): id is string => Boolean(id)));
  const paired: SamsaraPairedTruckDto[] = [];
  const unpaired: SamsaraUnpairedTruckDto[] = [];

  for (const truck of active) {
    if (!truck.samsaraVehicleId) continue;
    const vehicle = byId.get(truck.samsaraVehicleId);
    const ref = vehicle ? vehicleRef(vehicle) : { id: truck.samsaraVehicleId, name: '', vin: null, odometer: null };
    paired.push({ truck: truckRef(truck), vehicle: ref, method: 'connected', warnings: warningsOf(truck, vehicle) });
  }

  const legacy = new Map<string, PairingTruck[]>();
  const rest: PairingTruck[] = [];
  for (const truck of active) {
    if (truck.samsaraVehicleId) continue;
    const vehicle = truck.samsaraId ? byId.get(truck.samsaraId) : undefined;
    if (!vehicle) rest.push(truck);
    else if (claimed.has(vehicle.id)) unpaired.push({ truck: truckRef(truck), reason: 'shared' });
    else legacy.set(vehicle.id, [...(legacy.get(vehicle.id) ?? []), truck]);
  }
  for (const [vehicleId, claims] of legacy) {
    if (claims.length === 1) {
      const vehicle = byId.get(vehicleId)!;
      paired.push({ truck: truckRef(claims[0]), vehicle: vehicleRef(vehicle), method: 'samsara_id', warnings: warningsOf(claims[0], vehicle) });
      claimed.add(vehicleId);
    } else {
      for (const truck of claims) unpaired.push({ truck: truckRef(truck), reason: 'shared' });
    }
  }

  const proposals = new Map<string, PairingTruck[]>();
  for (const truck of rest) {
    const vin = normalizeVin(truck.vin);
    const matches = vin ? byVin.get(vin) ?? [] : [];
    if (matches.length > 1) unpaired.push({ truck: truckRef(truck), reason: 'ambiguous' });
    else if (matches.length === 0) unpaired.push({ truck: truckRef(truck), reason: 'no_match' });
    else if (claimed.has(matches[0].id)) unpaired.push({ truck: truckRef(truck), reason: 'shared' });
    else proposals.set(matches[0].id, [...(proposals.get(matches[0].id) ?? []), truck]);
  }
  const proposed: SamsaraProposedTruckDto[] = [];
  for (const [vehicleId, claims] of proposals) {
    if (claims.length === 1) proposed.push({ truck: truckRef(claims[0]), vehicle: vehicleRef(byId.get(vehicleId)!) });
    else for (const truck of claims) unpaired.push({ truck: truckRef(truck), reason: 'shared' });
  }

  const unpairedVehicles = vehicles.filter((vehicle) => !claimed.has(vehicle.id)).map(vehicleRef);

  paired.sort((a, b) => compareNumbers(a.truck.truckNumber, b.truck.truckNumber));
  proposed.sort((a, b) => compareNumbers(a.truck.truckNumber, b.truck.truckNumber));
  unpaired.sort((a, b) => compareNumbers(a.truck.truckNumber, b.truck.truckNumber));
  unpairedVehicles.sort((a, b) => compareNumbers(a.name, b.name));

  const pairedBy: Record<SamsaraPairingMethod, number> = { connected: 0, samsara_id: 0 };
  for (const row of paired) pairedBy[row.method] += 1;

  return {
    summary: {
      samsaraVehicles: vehicles.length,
      trucks: active.length,
      paired: paired.length,
      pairedBy,
      proposed: proposed.length,
      unpairedTrucks: unpaired.length,
      unpairedVehicles: unpairedVehicles.length,
      warnings: paired.filter((row) => row.warnings.length > 0).length,
    },
    paired,
    proposed,
    unpairedTrucks: unpaired,
    unpairedVehicles,
  };
}

function warningsOf(truck: PairingTruck, vehicle: PairingVehicle | undefined): SamsaraPairingWarning[] {
  if (!vehicle) return ['vehicle_missing'];
  const ours = normalizeVin(truck.vin);
  const theirs = normalizeVin(vehicle.vin);
  return ours && theirs && ours !== theirs ? ['vin_mismatch'] : [];
}

function truckRef(truck: PairingTruck): SamsaraTruckRefDto {
  return { id: truck.id, truckNumber: truck.truckNumber, vin: truck.vin, owner: truck.owner, company: truck.company, mileage: truck.mileage };
}

function vehicleRef(vehicle: PairingVehicle): SamsaraVehicleRefDto {
  return { id: vehicle.id, name: vehicle.name, vin: vehicle.vin, odometer: vehicle.odometer ?? null };
}

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    const group = groups.get(value);
    if (group) group.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}

function compareNumbers(a: string, b: string) {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}
