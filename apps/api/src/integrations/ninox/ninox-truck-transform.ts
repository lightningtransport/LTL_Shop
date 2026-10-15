import { normalizeMakeModel } from '@ltl-shop/shared';
import { NINOX_TRUCKS_DB } from './ninox.mapping';

export type NinoxRecordLike = {
  id?: string | number;
  fields?: Record<string, unknown>;
};

/** Shop Prisma Truck field names. Ninox is values only. */
export type ShopTruckSeedRow = {
  truckNumber: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  licensePlate: string | null;
  mileage: number | null;
  samsaraTruckLocation: string | null;
  samsaraLastConnectedDate: Date | null;
  company: string | null;
  owner: string | null;
  ninoxExternalId: string | null;
  ninoxMechanicStatus: string | null;
  samsaraId: string | null;
};

export function asDisplayString(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['name', 'caption', 'value', 'label']) {
      if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim();
    }
    if (record.id != null && record.id !== '') return String(record.id);
  }
  return null;
}

export function asTruckNumber(value: unknown): string | null {
  const text = asDisplayString(value);
  if (!text) return null;
  return text.replace(/^#\s*/, '').replace(/\s+/g, ' ').trim() || null;
}

export function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const text = asDisplayString(value);
  if (!text) return null;
  const parsed = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

/** Accept only explicit date-like values. Location labels must not become dates. */
export function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = asDisplayString(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(text) && !/^\d{4}\/\d{2}\/\d{2}/.test(text)) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function fieldValue(fields: Record<string, unknown> | undefined, fieldId: string): unknown {
  if (!fields) return undefined;
  return fields[fieldId];
}

/**
 * Last-reported location + locationUpdatedOn from E.X1 / E.AN.
 * Text → samsaraTruckLocation (DTO `location`). Date-shaped → samsaraLastConnectedDate
 * (DTO `locationUpdatedOn`). Never Presence / IN_YARD.
 */
export function locationFromX1An(fields: Record<string, unknown> | undefined): {
  samsaraTruckLocation: string | null;
  samsaraLastConnectedDate: Date | null;
} {
  const primary = fieldValue(fields, NINOX_TRUCKS_DB.locationFieldId);
  const alt = fieldValue(fields, NINOX_TRUCKS_DB.locationAltFieldId);
  const primaryDate = asDate(primary);
  const altDate = asDate(alt);
  const primaryText = primaryDate ? null : asDisplayString(primary);
  const altText = altDate ? null : asDisplayString(alt);
  return {
    samsaraTruckLocation: primaryText ?? altText,
    samsaraLastConnectedDate: altDate ?? primaryDate,
  };
}

/**
 * Map one TrucksDB record onto Shop Truck columns.
 * Returns null when E.A is missing — that row has no ops key.
 */
export function transformTrucksDbRecord(record: NinoxRecordLike): ShopTruckSeedRow | null {
  const fields = record.fields;
  const truckNumber = asTruckNumber(fieldValue(fields, NINOX_TRUCKS_DB.truckNumberFieldId));
  if (!truckNumber) return null;

  const location = locationFromX1An(fields);
  // LTR-113: TrucksDB has one Make field; some rows hold "Mack Anthem" or a model name.
  const vehicle = normalizeMakeModel(asDisplayString(fieldValue(fields, NINOX_TRUCKS_DB.makeFieldId)), null);
  const ninoxExternalId = record.id == null || record.id === '' ? null : String(record.id);

  return {
    truckNumber,
    vin: asDisplayString(fieldValue(fields, NINOX_TRUCKS_DB.vinFieldId)),
    make: vehicle.make,
    model: vehicle.model,
    year: asInteger(fieldValue(fields, NINOX_TRUCKS_DB.modelYearFieldId)),
    licensePlate: asDisplayString(fieldValue(fields, NINOX_TRUCKS_DB.licensePlateFieldId)),
    mileage: asInteger(fieldValue(fields, NINOX_TRUCKS_DB.odometerMilesFieldId)),
    samsaraTruckLocation: location.samsaraTruckLocation,
    samsaraLastConnectedDate: location.samsaraLastConnectedDate,
    company: null,
    owner: asDisplayString(fieldValue(fields, NINOX_TRUCKS_DB.ownerFieldId)),
    ninoxExternalId,
    ninoxMechanicStatus: asDisplayString(fieldValue(fields, NINOX_TRUCKS_DB.shopStatusFieldId)),
    samsaraId: asDisplayString(fieldValue(fields, NINOX_TRUCKS_DB.samsaraVehicleIdFieldId)),
  };
}

export function presentShopFields(row: ShopTruckSeedRow): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (row.vin) data.vin = row.vin;
  if (row.make) data.make = row.make;
  if (row.model) data.model = row.model;
  if (row.year != null) data.year = row.year;
  if (row.licensePlate) data.licensePlate = row.licensePlate;
  if (row.mileage != null) data.mileage = row.mileage;
  if (row.samsaraTruckLocation) data.samsaraTruckLocation = row.samsaraTruckLocation;
  if (row.samsaraLastConnectedDate) data.samsaraLastConnectedDate = row.samsaraLastConnectedDate;
  if (row.company) data.company = row.company;
  if (row.owner) data.owner = row.owner;
  if (row.ninoxExternalId) data.ninoxExternalId = row.ninoxExternalId;
  if (row.ninoxMechanicStatus) data.ninoxMechanicStatus = row.ninoxMechanicStatus;
  if (row.samsaraId) data.samsaraId = row.samsaraId;
  return data;
}
