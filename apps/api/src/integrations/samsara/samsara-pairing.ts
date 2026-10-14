import type {
  SamsaraPairedTruckDto,
  SamsaraPairingMethod,
  SamsaraPairingSummaryDto,
  SamsaraPairingWarning,
  SamsaraTruckRefDto,
  SamsaraUnpairedReason,
  SamsaraUnpairedTruckDto,
  SamsaraVehicleRefDto,
} from '@ltl-shop/shared';
import type { SamsaraVehicle } from './samsara.client';

export type PairingTruck = SamsaraTruckRefDto & {
  /** `trucks.samsara_id` (filled once from Ninox), as a digit string. */
  samsaraId: string | null;
};

export type PairingResult = {
  summary: SamsaraPairingSummaryDto;
  paired: SamsaraPairedTruckDto[];
  unpairedTrucks: SamsaraUnpairedTruckDto[];
  unpairedVehicles: SamsaraVehicleRefDto[];
};

/** Strongest first: a stored Samsara id beats a VIN, a VIN beats the truck number. */
const METHOD_RANK: Record<SamsaraPairingMethod, number> = { samsara_id: 0, vin: 1, number: 2 };

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

type Candidate = { truck: PairingTruck; vehicle: SamsaraVehicle; method: SamsaraPairingMethod; staleId: boolean };

/**
 * D35 / S-1: match our trucks to Samsara vehicles by Samsara id, then VIN, then number. Never guesses: a VIN or number
 * that fits several vehicles, or a vehicle claimed by several trucks, leaves the trucks unpaired with the reason.
 */
export function pairTrucks(trucks: PairingTruck[], vehicles: SamsaraVehicle[]): PairingResult {
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const byVin = groupBy(vehicles, (vehicle) => normalizeVin(vehicle.vin));
  const byNumber = groupBy(vehicles, (vehicle) => normalizeTruckNumber(vehicle.name));

  const candidates: Candidate[] = [];
  const unpaired: SamsaraUnpairedTruckDto[] = [];

  for (const truck of trucks) {
    const stored = truck.samsaraId ? byId.get(truck.samsaraId) : undefined;
    if (stored) {
      candidates.push({ truck, vehicle: stored, method: 'samsara_id', staleId: false });
      continue;
    }
    const staleId = Boolean(truck.samsaraId);

    const vin = normalizeVin(truck.vin);
    const vinMatches = vin ? byVin.get(vin) ?? [] : [];
    if (vinMatches.length === 1) {
      candidates.push({ truck, vehicle: vinMatches[0], method: 'vin', staleId });
      continue;
    }
    if (vinMatches.length > 1) {
      unpaired.push({ truck: ref(truck), reason: 'ambiguous' });
      continue;
    }

    const number = normalizeTruckNumber(truck.truckNumber);
    const numberMatches = number ? byNumber.get(number) ?? [] : [];
    if (numberMatches.length === 1) {
      candidates.push({ truck, vehicle: numberMatches[0], method: 'number', staleId });
    } else {
      unpaired.push({ truck: ref(truck), reason: numberMatches.length > 1 ? 'ambiguous' : 'no_match' });
    }
  }

  const paired: SamsaraPairedTruckDto[] = [];
  for (const claims of groupBy(candidates, (candidate) => candidate.vehicle.id).values()) {
    const best = Math.min(...claims.map((claim) => METHOD_RANK[claim.method]));
    const winners = claims.filter((claim) => METHOD_RANK[claim.method] === best);
    if (winners.length === 1) {
      const [winner] = winners;
      paired.push({ truck: ref(winner.truck), vehicle: vehicleRef(winner.vehicle), method: winner.method, warnings: warningsOf(winner) });
    }
    for (const claim of claims) {
      if (winners.length === 1 && claim === winners[0]) continue;
      unpaired.push({ truck: ref(claim.truck), reason: 'shared' satisfies SamsaraUnpairedReason });
    }
  }

  const claimed = new Set(paired.map((row) => row.vehicle.id));
  const unpairedVehicles = vehicles.filter((vehicle) => !claimed.has(vehicle.id)).map(vehicleRef);

  paired.sort((a, b) => compareNumbers(a.truck.truckNumber, b.truck.truckNumber));
  unpaired.sort((a, b) => compareNumbers(a.truck.truckNumber, b.truck.truckNumber));
  unpairedVehicles.sort((a, b) => compareNumbers(a.name, b.name));

  const pairedBy: Record<SamsaraPairingMethod, number> = { samsara_id: 0, vin: 0, number: 0 };
  for (const row of paired) pairedBy[row.method] += 1;

  return {
    summary: {
      samsaraVehicles: vehicles.length,
      trucks: trucks.length,
      paired: paired.length,
      pairedBy,
      unpairedTrucks: unpaired.length,
      unpairedVehicles: unpairedVehicles.length,
      warnings: paired.filter((row) => row.warnings.length > 0).length,
    },
    paired,
    unpairedTrucks: unpaired,
    unpairedVehicles,
  };
}

function warningsOf(candidate: Candidate): SamsaraPairingWarning[] {
  const warnings: SamsaraPairingWarning[] = [];
  if (candidate.staleId) warnings.push('stale_samsara_id');
  const ours = normalizeVin(candidate.truck.vin);
  const theirs = normalizeVin(candidate.vehicle.vin);
  if (ours && theirs && ours !== theirs) warnings.push('vin_mismatch');
  return warnings;
}

function ref(truck: PairingTruck): SamsaraTruckRefDto {
  return { id: truck.id, truckNumber: truck.truckNumber, vin: truck.vin };
}

function vehicleRef(vehicle: SamsaraVehicle): SamsaraVehicleRefDto {
  return { id: vehicle.id, name: vehicle.name, vin: vehicle.vin };
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
