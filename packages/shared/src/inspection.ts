/**
 * D41: the inspection sheet — sections, results, the 10 tire positions and the tire rule.
 * The API and the web both read the tire status from `tireReadingStatus`, so a tire is never
 * "watch" on the screen and "fix" on the saved report.
 */

export enum InspectionSection {
  INTERIOR = 'interior',
  ENGINE = 'engine',
  EXTERIOR = 'exterior',
}

export const INSPECTION_SECTIONS = [InspectionSection.INTERIOR, InspectionSection.ENGINE, InspectionSection.EXTERIOR] as const;

export enum InspectionItemResult {
  OK = 'ok',
  DEFECT = 'defect',
  NA = 'na',
}

/** Steer (LF, RF) and two drive axles with duals — the trucks the shop has today (trailers later). */
export enum TirePosition {
  LF = 'LF',
  RF = 'RF',
  LFO = 'LFO',
  LFI = 'LFI',
  RFI = 'RFI',
  RFO = 'RFO',
  LRO = 'LRO',
  LRI = 'LRI',
  RRI = 'RRI',
  RRO = 'RRO',
}

/** The order "Next tire" walks around the truck. */
export const TIRE_POSITIONS = [
  TirePosition.LF,
  TirePosition.RF,
  TirePosition.LFO,
  TirePosition.LFI,
  TirePosition.RFI,
  TirePosition.RFO,
  TirePosition.LRO,
  TirePosition.LRI,
  TirePosition.RRI,
  TirePosition.RRO,
] as const;

export type TireAxle = 'steer' | 'drive';

export function tireAxle(position: TirePosition): TireAxle {
  return position === TirePosition.LF || position === TirePosition.RF ? 'steer' : 'drive';
}

export enum TireReadingStatus {
  OK = 'ok',
  /** Near the limit: shown on the Truck, no Job. */
  WATCH = 'watch',
  /** Creates Flat Repair (pressure) or Tires (tread). */
  FIX = 'fix',
}

export enum WorkOrderJobSourceKind {
  INSPECTION_ITEM = 'inspection_item',
  TIRE_READING = 'tire_reading',
  /** D42 / Samsara S-6. */
  SAMSARA_FAULT = 'samsara_fault',
}

export type InspectionTireLimits = {
  steerTargetPsi: number;
  driveTargetPsi: number;
  steerMinTread: number;
  driveMinTread: number;
  watchPct: number;
  fixPct: number;
};

/** D41 defaults: 110 / 95 PSI, 4/32 and 2/32 tread (DOT), watch at ±10 %, fix at ±20 %. */
export const DEFAULT_INSPECTION_TIRE_LIMITS: InspectionTireLimits = {
  steerTargetPsi: 110,
  driveTargetPsi: 95,
  steerMinTread: 4,
  driveMinTread: 2,
  watchPct: 10,
  fixPct: 20,
};

/** Tread this many 32nds above the minimum still counts as "watch". */
export const TIRE_TREAD_WATCH_MARGIN = 2;

export function tireTargets(position: TirePosition, limits: InspectionTireLimits) {
  return tireAxle(position) === 'steer'
    ? { targetPsi: limits.steerTargetPsi, minTread: limits.steerMinTread }
    : { targetPsi: limits.driveTargetPsi, minTread: limits.driveMinTread };
}

export type TireStatusResult = {
  status: TireReadingStatus;
  /** What makes it fix/watch; a Job is only created for `fix`. */
  reason: 'pressure' | 'tread' | null;
};

/**
 * D41 tire rule. Pressure: beyond ±fixPct of target → fix, beyond ±watchPct → watch.
 * Tread: under the minimum → fix, less than 2/32 above it → watch. The worse of the two wins;
 * on a tie, tread wins (a worn tire is replaced, a low one is repaired).
 */
export function tireReadingStatus(
  reading: { psi: number; tread: number },
  target: { targetPsi: number; minTread: number },
  limits: Pick<InspectionTireLimits, 'watchPct' | 'fixPct'>,
): TireStatusResult {
  const off = (Math.abs(reading.psi - target.targetPsi) / target.targetPsi) * 100;
  const pressure = off > limits.fixPct ? 2 : off > limits.watchPct ? 1 : 0;
  const tread = reading.tread < target.minTread ? 2 : reading.tread < target.minTread + TIRE_TREAD_WATCH_MARGIN ? 1 : 0;
  const level = Math.max(pressure, tread);
  const status = level === 2 ? TireReadingStatus.FIX : level === 1 ? TireReadingStatus.WATCH : TireReadingStatus.OK;
  const reason = level === 0 ? null : tread >= pressure ? 'tread' : 'pressure';
  return { status, reason };
}
