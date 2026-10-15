import { describe, expect, it } from 'vitest';
import { locationFromX1An, transformTrucksDbRecord } from './ninox-truck-transform';

describe('transformTrucksDbRecord', () => {
  it('maps must-have Shop columns from the product-owner contract', () => {
    expect(transformTrucksDbRecord({
      id: 18420,
      fields: {
        A: '  # 905 ',
        CG: '1XKYD49X0LJ123456',
        DG: 'Freightliner Cascadia',
        IJ: 2022,
        HJ: 'ABC1234',
        OF: '142,500',
        X1: { name: '301 Yard' },
        AN: '2026-09-11',
        VF: 'Carlos',
        Y1: 'Work in Progress',
        TA: 'Out',
        T5: 'ignored-not-readiness',
        BM: '998877',
        Y4: 'CTC',
      },
    })).toEqual({
      truckNumber: '905',
      vin: '1XKYD49X0LJ123456',
      // LTR-113: TrucksDB's single Make field is split into Make and Model.
      make: 'Freightliner',
      model: 'Cascadia',
      year: 2022,
      licensePlate: 'ABC1234',
      mileage: 142500,
      samsaraTruckLocation: '301 Yard',
      samsaraLastConnectedDate: new Date('2026-09-11'),
      company: null,
      owner: 'Carlos',
      ninoxExternalId: '18420',
      ninoxMechanicStatus: 'Work in Progress',
      samsaraId: '998877',
    });
  });

  it('uses E.AN as last-reported location when E.X1 is empty', () => {
    expect(transformTrucksDbRecord({
      id: 2,
      fields: { A: '922', AN: 'Service vendor' },
    })).toMatchObject({
      truckNumber: '922',
      samsaraTruckLocation: 'Service vendor',
      samsaraLastConnectedDate: null,
    });
  });

  it('does not treat location labels as Presence or as dates', () => {
    expect(locationFromX1An({ X1: '301 Yard', AN: 'Vendor Lot' })).toEqual({
      samsaraTruckLocation: '301 Yard',
      samsaraLastConnectedDate: null,
    });
  });

  it('does not map E.TA OutWork or E.Y4 insurance onto company or model', () => {
    const row = transformTrucksDbRecord({
      id: 3,
      fields: { A: '777', TA: 'OutWork', Y4: 'CTC', Y1: 'Shop Status' },
    });
    expect(row).toMatchObject({
      company: null,
      model: null,
      ninoxMechanicStatus: 'Shop Status',
    });
  });

  it('skips records without E.A', () => {
    expect(transformTrucksDbRecord({ id: 3, fields: { OF: 10, CG: 'VIN' } })).toBeNull();
  });
});
