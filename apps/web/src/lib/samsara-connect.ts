import { SAMSARA_CONNECT_FIELDS, type SamsaraCandidateDto, type SamsaraConnectField, type TruckDto } from '@ltl-shop/shared';

/** D44 §4, per field: the same on both sides, empty on ours (Samsara fills it), different (the Manager picks), or Samsara has nothing. */
export type SamsaraFieldState = 'same' | 'fill' | 'differ' | 'none';

export type SamsaraFieldRow = {
  field: SamsaraConnectField;
  ours: string | null;
  theirs: string | null;
  state: SamsaraFieldState;
};

/** Mirrors the API's `mergeCard`: VINs ignore spaces, dashes and case; text ignores case. */
export function samsaraFieldRows(
  truck: Pick<TruckDto, 'vin' | 'make' | 'model' | 'year' | 'licensePlate'>,
  vehicle: Pick<SamsaraCandidateDto, 'vin' | 'make' | 'model' | 'year' | 'licensePlate'>,
): SamsaraFieldRow[] {
  return SAMSARA_CONNECT_FIELDS.map((field) => {
    const ours = text(truck[field]);
    const theirs = text(vehicle[field]);
    if (!theirs) return { field, ours, theirs, state: 'none' };
    if (!ours) return { field, ours, theirs, state: 'fill' };
    const same = field === 'vin' ? vinKey(ours) === vinKey(theirs) : ours.toLowerCase() === theirs.toLowerCase();
    return { field, ours, theirs, state: same ? 'same' : 'differ' };
  });
}

/** D44 (owner, one-tap connect): the comparison step only shows when at least one field differs. */
export function needsComparison(rows: SamsaraFieldRow[]) {
  return rows.some((row) => row.state === 'differ');
}

function text(value: string | number | null | undefined) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function vinKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
