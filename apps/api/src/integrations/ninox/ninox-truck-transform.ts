import { NINOX_TRUCKS_DB } from './ninox.mapping';

export type NinoxRecordLike = {
  id?: string | number;
  fields?: Record<string, unknown>;
};

export type ShopTruckSeedRow = {
  truckNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  company: string | null;
  owner: string | null;
  vin: string | null;
  samsaraTruckLocation: string | null;
  samsaraLastConnectedDate: Date | null;
  samsaraId: string | null;
  ninoxExternalId: string | null;
  yardLocation: string | null;
  ninoxMechanicStatus: string | null;
  dispatcher: string | null;
  insurance: string | null;
  licensePlate: string | null;
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

export function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }
  const text = asDisplayString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function fieldValue(fields: Record<string, unknown> | undefined, fieldId: string): unknown {
  if (!fields) return undefined;
  return fields[fieldId];
}

function firstString(fields: Record<string, unknown> | undefined, ...fieldIds: string[]): string | null {
  for (const fieldId of fieldIds) {
    const text = asDisplayString(fieldValue(fields, fieldId));
    if (text) return text;
  }
  return null;
}

/**
 * Map one TrucksDB record to a Shop truck row.
 * Returns null when E.A is missing — that row cannot be upserted.
 */
export function transformTrucksDbRecord(record: NinoxRecordLike): ShopTruckSeedRow | null {
  const fields = record.fields;
  const truckNumber = asTruckNumber(fieldValue(fields, NINOX_TRUCKS_DB.truckNumberFieldId));
  if (!truckNumber) return null;

  const insurance = firstString(fields, NINOX_TRUCKS_DB.insuranceFieldId);
  const ninoxExternalId = record.id == null || record.id === '' ? null : String(record.id);

  return {
    truckNumber,
    make: firstString(fields, NINOX_TRUCKS_DB.makeFieldId),
    model: null,
    year: asInteger(fieldValue(fields, NINOX_TRUCKS_DB.modelYearFieldId)),
    mileage: asInteger(fieldValue(fields, NINOX_TRUCKS_DB.odometerMilesFieldId)),
    company: insurance,
    owner: firstString(fields, NINOX_TRUCKS_DB.ownerFieldId),
    vin: firstString(fields, NINOX_TRUCKS_DB.vinFieldId),
    samsaraTruckLocation: firstString(fields, NINOX_TRUCKS_DB.lastKnownAddressFieldId),
    samsaraLastConnectedDate: asDate(fieldValue(fields, NINOX_TRUCKS_DB.samsaraLastConnectedFieldId)),
    samsaraId: firstString(fields, NINOX_TRUCKS_DB.samsaraVehicleIdFieldId),
    ninoxExternalId,
    yardLocation: firstString(
      fields,
      NINOX_TRUCKS_DB.yardLocationFieldId,
      NINOX_TRUCKS_DB.yardLocationFallbackFieldId,
    ),
    ninoxMechanicStatus: firstString(
      fields,
      NINOX_TRUCKS_DB.mechanicStatusFieldId,
      NINOX_TRUCKS_DB.mechanicStatusFallbackFieldId,
    ),
    dispatcher: firstString(fields, NINOX_TRUCKS_DB.dispatcherFieldId),
    insurance,
    licensePlate: firstString(fields, NINOX_TRUCKS_DB.licensePlateFieldId),
  };
}
