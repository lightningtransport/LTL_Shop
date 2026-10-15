import { describe, expect, it } from 'vitest';
import { normalizeTruckNumber, normalizeVin, pairTrucks, type PairingTruck } from './samsara-pairing';
import type { SamsaraVehicle } from './samsara.client';

const VIN_A = '3AKJHHDR5MSMN1234';
const VIN_B = '1XKYD49X3MJ445566';

function truck(id: string, truckNumber: string, vin: string | null = null, samsaraId: string | null = null): PairingTruck {
  return { id, truckNumber, vin, owner: null, company: null, mileage: null, samsaraId };
}

/** D44: the Manager connected it (stored `samsaraVehicleId`). */
function connected(id: string, truckNumber: string, samsaraVehicleId: string): PairingTruck {
  return { ...truck(id, truckNumber), samsaraVehicleId };
}

function truckRef(id: string, truckNumber: string, vin: string | null = null) {
  return { id, truckNumber, vin, owner: null, company: null, mileage: null };
}

function vehicle(id: string, name: string, vin: string | null = null): SamsaraVehicle {
  return { id, name, vin };
}

describe('normalizers', () => {
  it('treats spelling variants of a truck number as one number', () => {
    expect(normalizeTruckNumber('601')).toBe('601');
    expect(normalizeTruckNumber('Truck 601')).toBe('601');
    expect(normalizeTruckNumber('#0601')).toBe('601');
    expect(normalizeTruckNumber('unit-601')).toBe('601');
    expect(normalizeTruckNumber('601 B')).toBe('601b');
    expect(normalizeTruckNumber('  ')).toBeNull();
  });

  it('ignores placeholders that are too short to be a VIN', () => {
    expect(normalizeVin(' 3akjhhdr5msmn1234 ')).toBe(VIN_A);
    expect(normalizeVin('N/A')).toBeNull();
    expect(normalizeVin(null)).toBeNull();
  });
});

describe('pairTrucks', () => {
  it('connects by the stored vehicle, then by the Ninox Samsara id; a VIN match is only proposed; a number match is neither', () => {
    const result = pairTrucks(
      [
        connected('t0', '590', 'v-50'),
        truck('t1', '601', null, '100'),
        truck('t2', '614', VIN_B),
        truck('t3', '622'),
        truck('t4', '630'),
      ],
      [vehicle('v-50', 'Truck 590'), vehicle('100', 'Old name 601'), vehicle('200', 'Some name', VIN_B), vehicle('300', 'Truck 622'), vehicle('400', 'Trailer 9')],
    );

    expect(result.paired.map((row) => [row.truck.truckNumber, row.vehicle.id, row.method])).toEqual([
      ['590', 'v-50', 'connected'],
      ['601', '100', 'samsara_id'],
    ]);
    expect(result.proposed.map((row) => [row.truck.truckNumber, row.vehicle.id])).toEqual([['614', '200']]);
    // D44: "Truck 622" is not connected nor proposed; Connect Samsara marks it Suggested on the truck.
    expect(result.unpairedTrucks).toEqual([
      { truck: truckRef('t3', '622', null), reason: 'no_match' },
      { truck: truckRef('t4', '630', null), reason: 'no_match' },
    ]);
    expect(result.unpairedVehicles.map((row) => row.id)).toEqual(['200', '400', '300']);
    expect(result.summary).toEqual({
      samsaraVehicles: 5,
      trucks: 5,
      paired: 2,
      pairedBy: { connected: 1, samsara_id: 1 },
      proposed: 1,
      unpairedTrucks: 2,
      unpairedVehicles: 3,
      warnings: 0,
    });
  });

  it('keeps a stored connection when Samsara stops listing the vehicle, and says so', () => {
    const result = pairTrucks([connected('t1', '601', 'gone')], [vehicle('100', 'Other')]);

    expect(result.paired).toEqual([
      { truck: truckRef('t1', '601', null), vehicle: { id: 'gone', name: '', vin: null, odometer: null }, method: 'connected', warnings: ['vehicle_missing'] },
    ]);
    expect(result.summary.warnings).toBe(1);
    expect(result.unpairedVehicles.map((row) => row.id)).toEqual(['100']);
  });

  it('proposes by VIN when the Ninox Samsara id is gone', () => {
    const result = pairTrucks([truck('t1', '601', VIN_A, '999')], [vehicle('100', '601', VIN_A)]);

    expect(result.paired).toEqual([]);
    expect(result.proposed.map((row) => [row.truck.truckNumber, row.vehicle.id])).toEqual([['601', '100']]);
  });

  it('warns when a connected truck has a different VIN in Samsara', () => {
    const result = pairTrucks([truck('t1', '601', VIN_A, '100')], [vehicle('100', '601', VIN_B)]);

    expect(result.paired[0]).toMatchObject({ method: 'samsara_id', warnings: ['vin_mismatch'] });
  });

  it('does not propose when a VIN fits two Samsara vehicles', () => {
    const result = pairTrucks([truck('t1', '601', VIN_A)], [vehicle('100', 'A', VIN_A), vehicle('200', 'B', VIN_A)]);

    expect(result.proposed).toEqual([]);
    expect(result.unpairedTrucks[0].reason).toBe('ambiguous');
    expect(result.unpairedVehicles).toHaveLength(2);
  });

  it('proposes to nobody when two trucks have the same VIN', () => {
    const result = pairTrucks([truck('t1', '601', VIN_A), truck('t2', '602', VIN_A)], [vehicle('100', 'X', VIN_A)]);

    expect(result.proposed).toEqual([]);
    expect(result.unpairedTrucks.map((row) => [row.truck.truckNumber, row.reason])).toEqual([
      ['601', 'shared'],
      ['602', 'shared'],
    ]);
    expect(result.unpairedVehicles.map((row) => row.id)).toEqual(['100']);
  });

  it('never proposes or re-pairs a vehicle another truck already has', () => {
    const result = pairTrucks(
      [connected('t1', '601', '100'), truck('t2', '700', VIN_A), truck('t3', '701', null, '100')],
      [vehicle('100', 'X', VIN_A)],
    );

    expect(result.paired.map((row) => [row.truck.truckNumber, row.method])).toEqual([['601', 'connected']]);
    expect(result.unpairedTrucks.map((row) => [row.truck.truckNumber, row.reason])).toEqual([['700', 'shared'], ['701', 'shared']]);
  });

  it('leaves both trucks out when they carry the same Ninox Samsara id', () => {
    const result = pairTrucks([truck('t1', '601', null, '100'), truck('t2', '602', null, '100')], [vehicle('100', 'X')]);

    expect(result.paired).toEqual([]);
    expect(result.unpairedTrucks.map((row) => row.reason)).toEqual(['shared', 'shared']);
  });

  it('leaves deactivated trucks out of every list but keeps their vehicle taken', () => {
    const result = pairTrucks(
      [{ ...connected('t1', '601', '100'), active: false }, { ...truck('t2', '602', VIN_A), active: false }, truck('t3', '603', VIN_A)],
      [vehicle('100', 'X', VIN_A)],
    );

    expect(result.paired).toEqual([]);
    expect(result.proposed).toEqual([]);
    expect(result.unpairedTrucks).toEqual([{ truck: truckRef('t3', '603', VIN_A), reason: 'shared' }]);
    expect(result.unpairedVehicles).toEqual([]);
    expect(result.summary.trucks).toBe(1);
  });

  it('carries owner, mileage and the Samsara odometer through to the lists', () => {
    const result = pairTrucks(
      [{ ...truck('t1', '601', null, '100'), owner: 'Jose Diaz', company: 'LTL Logistics', mileage: 412_040 }],
      [{ ...vehicle('100', '601'), odometer: { miles: 418_612, source: 'obd', at: '2026-10-14T15:00:00Z' } }, vehicle('200', 'Trailer 9')],
    );

    expect(result.paired[0].truck).toMatchObject({ owner: 'Jose Diaz', company: 'LTL Logistics', mileage: 412_040 });
    expect(result.paired[0].vehicle.odometer).toEqual({ miles: 418_612, source: 'obd', at: '2026-10-14T15:00:00Z' });
    expect(result.unpairedVehicles[0].odometer).toBeNull();
  });

  it('handles an empty fleet on either side', () => {
    expect(pairTrucks([], []).summary.paired).toBe(0);
    expect(pairTrucks([truck('t1', '601')], []).unpairedTrucks[0].reason).toBe('no_match');
  });
});
