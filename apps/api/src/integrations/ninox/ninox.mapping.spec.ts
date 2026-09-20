import { describe, expect, it } from 'vitest';
import {
  NINOX_SCAN,
  NINOX_TRUCKS_DB,
  NINOX_UNRESOLVED,
  NINOX_VERIFIED_FIELD_IDS,
  NINOX_VERIFIED_TABLE_IDS,
  SHOP_NINOX_TRUCK_JOIN,
  YARD_PHASES_ARE_NOT_NINOX_MECHANIC_STATUS,
  getNinoxMappingSummary,
} from './ninox.mapping';

describe('verified Ninox mapping constants', () => {
  it('records only the MappingTool-confirmed TrucksDB ids', () => {
    expect(NINOX_SCAN).toEqual({
      workspaceHost: 'lightningtransport.ninoxdb.com',
      tableCount: 163,
      trucksDbFieldCount: 117,
    });
    expect(NINOX_VERIFIED_TABLE_IDS).toEqual(['E']);
    expect(NINOX_VERIFIED_FIELD_IDS).toEqual(['A', 'TA']);
    expect(NINOX_TRUCKS_DB).toEqual({
      tableId: 'E',
      tableName: 'TrucksDB',
      fieldCount: 117,
      truckNumberFieldId: 'A',
      mechanicStatusFieldId: 'TA',
    });
  });

  it('joins Shop trucks by truckNumber to Ninox E.A', () => {
    expect(SHOP_NINOX_TRUCK_JOIN).toEqual({
      shopField: 'truckNumber',
      shopColumn: 'trucks.truck_number',
      ninoxTableId: 'E',
      ninoxFieldId: 'A',
      ninoxPath: 'E.A',
    });
  });

  it('does not treat Yard phases as Ninox mechanic_status', () => {
    expect(YARD_PHASES_ARE_NOT_NINOX_MECHANIC_STATUS).toBe(true);
    expect(getNinoxMappingSummary().yardPhasesAreNinoxMechanicStatus).toBe(false);
  });

  it('leaves the UC trailer target unresolved instead of inventing ids', () => {
    expect(NINOX_UNRESOLVED.ucTrailer).toEqual({
      tableId: null,
      fieldId: null,
      ninoxPath: null,
      status: 'unresolved',
      note: 'UC trailer target is unresolved in Ninox. Do not invent IDs.',
    });
  });

  it('does not expose invented table or field ids on the operator summary', () => {
    const summary = getNinoxMappingSummary();
    expect(summary.liveClient).toBe(false);
    expect(summary.trucksDb.tableId).toBe('E');
    expect(summary.unresolved.ucTrailer.tableId).toBeNull();
    expect(summary.unresolved.ucTrailer.fieldId).toBeNull();
  });
});
