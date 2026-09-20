import { describe, expect, it } from 'vitest';
import declared from './declared-trucks-catalog.json';
import {
  NINOX_DECLARED_FIELD_IDS,
  NINOX_LAUNCH_FALLBACK_FIELD_IDS,
  NINOX_SCAN,
  NINOX_TRUCKS_DB,
  NINOX_UNRESOLVED,
  NINOX_VERIFIED_TABLE_IDS,
  SHOP_NINOX_TRUCK_JOIN,
  YARD_PHASES_ARE_NOT_NINOX_MECHANIC_STATUS,
  getNinoxMappingSummary,
} from './ninox.mapping';

describe('verified Ninox mapping constants', () => {
  it('matches MappingTool declared-catalog truck field ids', () => {
    expect(NINOX_VERIFIED_TABLE_IDS).toEqual(['E']);
    expect(NINOX_DECLARED_FIELD_IDS).toEqual(declared.fields.map((field) => field.fieldId));
    expect(NINOX_LAUNCH_FALLBACK_FIELD_IDS).toEqual(['AN', 'Y1']);
    expect(NINOX_TRUCKS_DB).toMatchObject({
      tableId: 'E',
      truckNumberFieldId: 'A',
      odometerMilesFieldId: 'OF',
      yardLocationFieldId: 'X1',
      yardLocationFallbackFieldId: 'AN',
      mechanicStatusFieldId: 'TA',
      mechanicStatusFallbackFieldId: 'Y1',
    });
  });

  it('records the MappingTool scan host and join key', () => {
    expect(NINOX_SCAN.workspaceHost).toBe('lightningtransport.ninoxdb.com');
    expect(SHOP_NINOX_TRUCK_JOIN.ninoxPath).toBe('E.A');
    expect(YARD_PHASES_ARE_NOT_NINOX_MECHANIC_STATUS).toBe(true);
    expect(getNinoxMappingSummary().yardPhasesAreNinoxMechanicStatus).toBe(false);
  });

  it('leaves UC trailer and Shop model unresolved', () => {
    expect(NINOX_UNRESOLVED.ucTrailer.tableId).toBeNull();
    expect(NINOX_UNRESOLVED.shopModel.fieldId).toBeNull();
  });
});
