/**
 * Verified Ninox IDs from a MappingTool live scan of
 * lightningtransport.ninoxdb.com.
 *
 * Do not invent table or field IDs. Add a value here only after a new
 * MappingTool scan (or an equivalent live schema read) confirms it.
 *
 * Scan facts used in this module:
 * - 163 tables
 * - TrucksDB table id = E (117 fields)
 * - truck number = E.A
 * - mechanic_status = E.TA
 * - UC trailer table/field target is unresolved
 */

export const NINOX_SCAN = {
  workspaceHost: 'lightningtransport.ninoxdb.com',
  tableCount: 163,
  trucksDbFieldCount: 117,
} as const;

/** Only table IDs confirmed by MappingTool. */
export const NINOX_VERIFIED_TABLE_IDS = ['E'] as const;

/** Only TrucksDB field IDs confirmed by MappingTool. */
export const NINOX_VERIFIED_FIELD_IDS = ['A', 'TA'] as const;

export const NINOX_TRUCKS_DB = {
  tableId: 'E',
  tableName: 'TrucksDB',
  fieldCount: 117,
  truckNumberFieldId: 'A',
  mechanicStatusFieldId: 'TA',
} as const;

/**
 * Shop business-key join. Shop never uses a Ninox record id as truck identity.
 * Shop `truckNumber` ↔ kit `trucks.truck_number` ↔ Ninox `E.A`.
 */
export const SHOP_NINOX_TRUCK_JOIN = {
  shopField: 'truckNumber',
  shopColumn: 'trucks.truck_number',
  ninoxTableId: NINOX_TRUCKS_DB.tableId,
  ninoxFieldId: NINOX_TRUCKS_DB.truckNumberFieldId,
  ninoxPath: 'E.A',
} as const;

/**
 * Yard Work Plan / Phase 1 readiness phases are derived in Shop Postgres.
 * They are not Ninox `E.TA` (mechanic_status).
 */
export const YARD_PHASES_ARE_NOT_NINOX_MECHANIC_STATUS = true;

export const NINOX_UNRESOLVED = {
  ucTrailer: {
    tableId: null,
    fieldId: null,
    ninoxPath: null,
    status: 'unresolved',
    note: 'UC trailer target is unresolved in Ninox. Do not invent IDs.',
  },
} as const;

export type NinoxMappingSummary = {
  liveClient: false;
  scan: typeof NINOX_SCAN;
  trucksDb: typeof NINOX_TRUCKS_DB;
  truckJoin: typeof SHOP_NINOX_TRUCK_JOIN;
  yardPhasesAreNinoxMechanicStatus: false;
  unresolved: {
    ucTrailer: typeof NINOX_UNRESOLVED.ucTrailer;
  };
};

export function getNinoxMappingSummary(): NinoxMappingSummary {
  return {
    liveClient: false,
    scan: NINOX_SCAN,
    trucksDb: NINOX_TRUCKS_DB,
    truckJoin: SHOP_NINOX_TRUCK_JOIN,
    yardPhasesAreNinoxMechanicStatus: false,
    unresolved: {
      ucTrailer: NINOX_UNRESOLVED.ucTrailer,
    },
  };
}
