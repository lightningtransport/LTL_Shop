/**
 * Product-owner seed contract (2026-09-20).
 * Shop Prisma `Truck` names are authority. Ninox only supplies values.
 * Do not invent table/field IDs or yard/readiness rules.
 *
 * Must-have value sources:
 *   truckNumber ← E.A
 *   vin ← E.CG
 *   make ← E.DG (kit: make/model display; no separate model ID)
 *   year ← E.IJ
 *   licensePlate ← E.HJ
 *   mileage ← E.OF
 *   location / locationUpdatedOn ← E.X1 / E.AN
 *     (shop columns samsaraTruckLocation / samsaraLastConnectedDate)
 *   owner ← E.VF
 *
 * Optional metadata only (never Presence, Ready, or Work Plan):
 *   E.Y1 Shop Status, E.TA OutWork, E.T5, E.BM
 *
 * Unresolved (do not invent): company Ninox ID, model Ninox ID, UC trailer.
 */

export const NINOX_SCAN = {
  workspaceHost: 'lightningtransport.ninoxdb.com',
  tableCount: 163,
  trucksDbFieldCount: 117,
} as const;

export const NINOX_VERIFIED_TABLE_IDS = ['E'] as const;

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

/** Live/product-owner IDs not in declared-catalog.json. */
export const NINOX_CONTRACT_FIELD_IDS = ['AN', 'Y1', 'T5'] as const;

export const NINOX_VERIFIED_FIELD_IDS = [
  ...NINOX_DECLARED_FIELD_IDS,
  ...NINOX_CONTRACT_FIELD_IDS,
] as const;

export const NINOX_TRUCKS_DB = {
  tableId: 'E',
  tableName: 'TrucksDB',
  fieldCount: 117,
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
} as const;

/**
 * Upsert identity (product owner): prefer VIN + truckNumber.
 * Shop unique write key remains `truckNumber`. VIN is the preferred match
 * when exactly one Shop row has that VIN.
 */
export const SHOP_TRUCK_SEED_IDENTITY = {
  uniqueWriteKey: 'truckNumber',
  preferredMatch: ['vin', 'truckNumber'],
  note: 'Match one Shop row by VIN when VIN is present and unique; otherwise match truckNumber. Insert when neither hits. Do not import Work Orders.',
} as const;

export const SHOP_NINOX_TRUCK_JOIN = {
  shopField: 'truckNumber',
  shopColumn: 'trucks.truck_number',
  ninoxTableId: NINOX_TRUCKS_DB.tableId,
  ninoxFieldId: NINOX_TRUCKS_DB.truckNumberFieldId,
  ninoxPath: 'E.A',
} as const;

export const YARD_PHASES_ARE_NOT_NINOX_MECHANIC_STATUS = true;
export const NINOX_LOCATION_IS_NOT_YARD_PRESENCE = true;

export const NINOX_UNRESOLVED = {
  ucTrailer: {
    tableId: null,
    fieldId: null,
    status: 'unresolved',
    note: 'UC trailer target is unresolved in Ninox. Do not invent IDs. This seed does not import trailers or WO history.',
  },
  shopModel: {
    shopField: 'model',
    fieldId: null,
    status: 'unresolved',
    note: 'No declared Ninox model field. E.DG is make/model display and maps to shop make only.',
  },
  shopCompany: {
    shopField: 'company',
    fieldId: null,
    status: 'unresolved',
    note: 'No declared Ninox company field. E.Y4 is insurance and is not mapped to company.',
  },
} as const;

export type NinoxMappingSummary = {
  liveClient: false;
  scan: typeof NINOX_SCAN;
  trucksDb: typeof NINOX_TRUCKS_DB;
  identity: typeof SHOP_TRUCK_SEED_IDENTITY;
  truckJoin: typeof SHOP_NINOX_TRUCK_JOIN;
  yardPhasesAreNinoxMechanicStatus: false;
  locationIsYardPresence: false;
  unresolved: typeof NINOX_UNRESOLVED;
};

export function getNinoxMappingSummary(): NinoxMappingSummary {
  return {
    liveClient: false,
    scan: NINOX_SCAN,
    trucksDb: NINOX_TRUCKS_DB,
    identity: SHOP_TRUCK_SEED_IDENTITY,
    truckJoin: SHOP_NINOX_TRUCK_JOIN,
    yardPhasesAreNinoxMechanicStatus: false,
    locationIsYardPresence: false,
    unresolved: NINOX_UNRESOLVED,
  };
}
