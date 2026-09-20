import { describe, expect, it } from 'vitest';
import { transformTrucksDbRecord } from './ninox-truck-transform';

const fields = {
  A: '  # 905 ',
  OF: '142,500',
  X1: { name: '301 Yard' },
  AN: 'Vendor Lot',
  TA: { id: 'Y1', name: 'Ready To Go' },
  Y1: 'ignored-when-TA-present',
  YF: 'Group 1',
  Y4: 'CTC',
  CG: '1XKYD49X0LJ123456',
  DG: 'Freightliner Cascadia',
  VF: 'Carlos',
  PF: 'West Main Street, Woodville, OH',
  IJ: 2022,
  HJ: 'ABC1234',
  SF: '2026-09-11',
  BM: '998877',
};

describe('transformTrucksDbRecord', () => {
  it('maps declared catalog fields and launch location/status fallbacks', () => {
    expect(transformTrucksDbRecord({ id: 18420, fields })).toMatchObject({
      truckNumber: '905',
      make: 'Freightliner Cascadia',
      model: null,
      year: 2022,
      mileage: 142500,
      company: 'CTC',
      owner: 'Carlos',
      vin: '1XKYD49X0LJ123456',
      samsaraTruckLocation: 'West Main Street, Woodville, OH',
      samsaraId: '998877',
      ninoxExternalId: '18420',
      yardLocation: '301 Yard',
      ninoxMechanicStatus: 'Ready To Go',
      dispatcher: 'Group 1',
      insurance: 'CTC',
      licensePlate: 'ABC1234',
    });
  });

  it('uses E.AN and E.Y1 only when the declared primaries are empty', () => {
    expect(transformTrucksDbRecord({
      id: 2,
      fields: { A: '922', AN: 'Service vendor', Y1: 'Work in Progress' },
    })).toMatchObject({
      truckNumber: '922',
      yardLocation: 'Service vendor',
      ninoxMechanicStatus: 'Work in Progress',
    });
  });

  it('skips records without E.A', () => {
    expect(transformTrucksDbRecord({ id: 3, fields: { OF: 10 } })).toBeNull();
  });
});
