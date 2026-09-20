import { describe, expect, it } from 'vitest';
import {
  NINOX_LOCATION_IS_NOT_YARD_PRESENCE,
  NINOX_TRUCKS_DB,
  NINOX_UNRESOLVED,
  NINOX_VERIFIED_TABLE_IDS,
  SHOP_TRUCK_SEED_IDENTITY,
  YARD_PHASES_ARE_NOT_NINOX_MECHANIC_STATUS,
  getNinoxMappingSummary,
} from './ninox.mapping';

describe('product-owner Ninox seed contract', () => {
  it('keeps Shop column names as authority and documents the upsert key', () => {
    expect(NINOX_VERIFIED_TABLE_IDS).toEqual(['E']);
    expect(SHOP_TRUCK_SEED_IDENTITY).toEqual({
      uniqueWriteKey: 'truckNumber',
      preferredMatch: ['vin', 'truckNumber'],
      note: 'Match one Shop row by VIN when VIN is present and unique; otherwise match truckNumber. Insert when neither hits. Do not import Work Orders.',
    });
    expect(NINOX_TRUCKS_DB).toMatchObject({
      truckNumberFieldId: 'A',
      vinFieldId: 'CG',
      makeFieldId: 'DG',
      modelYearFieldId: 'IJ',
      licensePlateFieldId: 'HJ',
      odometerMilesFieldId: 'OF',
      locationFieldId: 'X1',
      locationAltFieldId: 'AN',
      ownerFieldId: 'VF',
      shopStatusFieldId: 'Y1',
      outWorkFieldId: 'TA',
      optionalT5FieldId: 'T5',
      samsaraVehicleIdFieldId: 'BM',
    });
  });

  it('forbids using Ninox status/location as Presence or Ready', () => {
    expect(YARD_PHASES_ARE_NOT_NINOX_MECHANIC_STATUS).toBe(true);
    expect(NINOX_LOCATION_IS_NOT_YARD_PRESENCE).toBe(true);
    expect(getNinoxMappingSummary()).toMatchObject({
      yardPhasesAreNinoxMechanicStatus: false,
      locationIsYardPresence: false,
    });
  });

  it('leaves company, model, and UC trailer unresolved instead of inventing ids', () => {
    expect(NINOX_UNRESOLVED.shopCompany.fieldId).toBeNull();
    expect(NINOX_UNRESOLVED.shopModel.fieldId).toBeNull();
    expect(NINOX_UNRESOLVED.ucTrailer.tableId).toBeNull();
  });
});
