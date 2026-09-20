/**
 * Verified Ninox IDs from MappingTool declared-catalog + live scan of
 * lightningtransport.ninoxdb.com.
 *
 * Do not invent table or field IDs. Add a value here only from
 * MappingTool `config/declared-catalog.json` or an equivalent live scan.
 *
 * Declared TrucksDB (E) fields:
 * A truck_number, YF dispatcher, Y4 insurance, CG vin, DG make,
 * OF odometer_miles, VF owner, PF last_known_address, IJ model_year,
 * HJ license_plate, X1 yard_location, SF samsara_last_connected_at,
 * BM samsara_vehicle_id, TA mechanic_status.
 *
 * Monday-launch brief also documents location fallback E.AN and
 * mechanic_status fallback E.Y1. UC trailer remains unresolved.
 */

export const NINOX_SCAN = {
  workspaceHost: 'lightningtransport.ninoxdb.com',
  tableCount: 163,
  trucksDbFieldCount: 117,
} as const;

/** Only table IDs confirmed by MappingTool. */
export const NINOX_VERIFIED_TABLE_IDS = ['E'] as const;

/** Declared-catalog TrucksDB field IDs (MappingTool trucks table). */
export const NINOX_DECLARED_FIELD_IDS = [
  'A',
  'YF',
  'Y4',
  'CG',
  'DG',
  'OF',
  'VF',
  'PF',
  'IJ',
  'HJ',
  'X1',
  'SF',
  'BM',
  'TA',
] as const;

/**
 * Extra live IDs from the Monday-launch brief. Not in declared-catalog.json.
 * Used only as empty-primary fallbacks. Do not treat as a second source of truth.
 */
export const NINOX_LAUNCH_FALLBACK_FIELD_IDS = ['AN', 'Y1'] as const;

export const NINOX_VERIFIED_FIELD_IDS = [
  ...NINOX_DECLARED_FIELD_IDS,
  ...NINOX_LAUNCH_FALLBACK_FIELD_IDS,
] as const;

export const NINOX_TRUCKS_DB = {
  tableId: 'E',
  tableName: 'TrucksDB',
  fieldCount: 117,
  truckNumberFieldId: 'A',
  odometerMilesFieldId: 'OF',
  yardLocationFieldId: 'X1',
  yardLocationFallbackFieldId: 'AN',
  mechanicStatusFieldId: 'TA',
  mechanicStatusFallbackFieldId: 'Y1',
  dispatcherFieldId: 'YF',
  insuranceFieldId: 'Y4',
  vinFieldId: 'CG',
  makeFieldId: 'DG',
  ownerFieldId: 'VF',
  lastKnownAddressFieldId: 'PF',
  modelYearFieldId: 'IJ',
  licensePlateFieldId: 'HJ',
  samsaraLastConnectedFieldId: 'SF',
  samsaraVehicleIdFieldId: 'BM',
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
 * They are not Ninox `E.TA` / `E.Y1` (mechanic_status).
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
  shopModel: {
    tableId: 'E',
    fieldId: null,
    ninoxPath: null,
    status: 'unresolved',
    note: 'Shop `model` has no declared Ninox field. E.DG is make/model display and is stored on make.',
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
    shopModel: typeof NINOX_UNRESOLVED.shopModel;
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
      shopModel: NINOX_UNRESOLVED.shopModel,
    },
  };
}
