/**
 * D35 / S-1: which Samsara vehicles are our trucks. Read-only: the pairing is computed on every request and nothing
 * is saved; S-2 stores it when the sync starts writing.
 */

/** How a truck was matched, in the order the API tries them. */
export type SamsaraPairingMethod = 'samsara_id' | 'vin' | 'number';

/** Why a truck could not be matched without guessing. */
export type SamsaraUnpairedReason =
  /** No Samsara vehicle has its Samsara id, VIN or number. */
  | 'no_match'
  /** Its VIN or number matches more than one Samsara vehicle. */
  | 'ambiguous'
  /** Another truck matches the same Samsara vehicle. */
  | 'shared';

/** Something worth checking on a matched truck. */
export type SamsaraPairingWarning =
  /** The Samsara id that came from Ninox is not in Samsara any more; matched by VIN or number instead. */
  | 'stale_samsara_id'
  /** Both sides have a VIN and they differ. */
  | 'vin_mismatch';

export type SamsaraTruckRefDto = {
  id: string;
  truckNumber: string;
  vin: string | null;
  owner: string | null;
  company: string | null;
  /** Official mileage, confirmed by the PM mechanic from the dashboard (D10, D35). */
  mileage: number | null;
};

/** S1-6: Samsara's current odometer, read live and never stored (S-2 stores it). */
export type SamsaraOdometerDto = {
  miles: number;
  /** `obd`: the engine computer; `gps`: Samsara's estimate when the ECU gives none. */
  source: 'obd' | 'gps';
  at: string;
};

export type SamsaraVehicleRefDto = {
  id: string;
  name: string;
  vin: string | null;
  odometer: SamsaraOdometerDto | null;
};

export type SamsaraPairedTruckDto = {
  truck: SamsaraTruckRefDto;
  vehicle: SamsaraVehicleRefDto;
  method: SamsaraPairingMethod;
  warnings: SamsaraPairingWarning[];
};

export type SamsaraUnpairedTruckDto = {
  truck: SamsaraTruckRefDto;
  reason: SamsaraUnpairedReason;
};

export type SamsaraPairingSummaryDto = {
  samsaraVehicles: number;
  trucks: number;
  paired: number;
  pairedBy: Record<SamsaraPairingMethod, number>;
  unpairedTrucks: number;
  unpairedVehicles: number;
  warnings: number;
};

/**
 * `not_configured`: the API has no `SAMSARA_API_TOKEN`. `unauthorized`: Samsara rejected the token.
 * `unavailable`: Samsara did not answer or answered with an error.
 */
export type SamsaraPairingStatus = 'ok' | 'not_configured' | 'unauthorized' | 'unavailable';

/** D35 / S-2: how the last sync went (the one `samsara_sync_state` row). */
export type SamsaraSyncStateDto = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  /**
   * Null when the last run went well. `not_configured`, `unauthorized` or `unavailable`: nothing was written.
   * `faults_unavailable`: miles and location were saved, faults were left as they were.
   */
  lastError: 'not_configured' | 'unauthorized' | 'unavailable' | 'faults_unavailable' | (string & {}) | null;
  /** `cron` (GitHub Actions) or `manual` (Sync now). */
  lastTrigger: string | null;
  vehicles: number;
  trucksUpdated: number;
  faultsOpened: number;
  faultsCleared: number;
  activeFaults: number;
  durationMs: number;
};

export type SamsaraSyncResultDto = {
  /** `skipped`: another sync was running. */
  status: 'ok' | 'skipped' | 'not_configured' | 'unauthorized' | 'unavailable';
  state: SamsaraSyncStateDto | null;
};

export type SamsaraPairingDto = {
  /** S-2: the last sync, or null before the first one. */
  sync: SamsaraSyncStateDto | null;
  status: SamsaraPairingStatus;
  checkedAt: string;
  summary: SamsaraPairingSummaryDto | null;
  paired: SamsaraPairedTruckDto[];
  unpairedTrucks: SamsaraUnpairedTruckDto[];
  unpairedVehicles: SamsaraVehicleRefDto[];
  /** False when Samsara gave vehicles but not their odometers; the lists still show. */
  odometersAvailable: boolean;
};

/** D42: STOP, warning and check engine are recommended as Jobs (S-6); pending and info are shown only. */
export type TruckFaultSeverity = 'stop' | 'warning' | 'check_engine' | 'pending' | 'info';

export const TRUCK_FAULT_SEVERITY_ORDER: readonly TruckFaultSeverity[] = ['stop', 'warning', 'check_engine', 'pending', 'info'];

/** D42 / S-6: a Job tied to a fault, with its Work Order. */
export type TruckFaultJobRefDto = {
  workOrderId: string;
  workOrderDisplayId: string;
  jobId: string;
  jobName: string;
  status: 'to_do' | 'completed' | 'cancelled';
};

export type TruckFaultDto = {
  id: string;
  protocol: 'j1939' | 'obdii';
  /** `SPN 3251 · FMI 0` or `P0087`. */
  code: string;
  description: string;
  severity: TruckFaultSeverity;
  sourceName: string | null;
  occurrenceCount: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  clearedAt: string | null;
  /** D42 / S-6: Jobs that take care of it ("In WO-x", "Fixed in WO-x"). */
  jobs?: TruckFaultJobRefDto[];
  /** D42 / S-6: "not now", with who and why. */
  dismissed?: { at: string; by: string | null; reason: string } | null;
  /** D42: reported again within 48 h after a Job for it was completed in this Work Order. */
  cameBackAfter?: { workOrderId: string; displayId: string } | null;
};

/** D42 / S-6: the code without the engine module, the key the learned Job is kept under. */
export function faultCodeKey(fault: { protocol: 'j1939' | 'obdii'; code: string }): string {
  return `${fault.protocol}:${fault.code.replace(/[^A-Za-z0-9]+/g, ':').replace(/^:|:$/g, '').toUpperCase()}`;
}

/** D42 / S-6: why a fault is recommended as a Job. */
export type TruckFaultRecommendationReason = 'check_engine' | 'stop_light' | 'warning_light';

export type TruckFaultRecommendationDto = {
  fault: TruckFaultDto;
  reason: TruckFaultRecommendationReason;
  /** The Job learned for this code, or null for a new code (the Manager picks one). */
  suggestedJob: { catalogJobId: string; displayName: string; categoryId: string; categoryName: string } | null;
  /** When the suggested Job is already on the open Work Order: tie the fault to it instead of adding another. */
  existingJob: { id: string; displayName: string } | null;
  /** A Job for it was completed but Samsara still reports it. */
  stillAfter: { workOrderId: string; displayId: string } | null;
};

export type TruckFaultRecommendationsDto = {
  items: TruckFaultRecommendationDto[];
};

/** S3-4: the truck's dash lights as Samsara last reported them. J1939 gives STOP and warning only per truck. */
export type TruckDashLampsDto = {
  stop: boolean;
  warning: boolean;
  protect: boolean;
  emissions: boolean;
  at: string | null;
};

/**
 * S3-4: what the Trucks list and the Truck banner show. The dash lights first (STOP, then warning or protect), then the
 * codes that lit the check engine light. Codes that light nothing ("info", "pending") stay on the Faults tab only.
 */
export function truckAttention(
  lamps: Partial<Pick<TruckDashLampsDto, 'stop' | 'warning' | 'protect' | 'emissions'>> | null | undefined,
  severities: readonly TruckFaultSeverity[],
): TruckFaultSeverity | null {
  if (lamps?.stop) return 'stop';
  if (lamps?.warning || lamps?.protect) return 'warning';
  if (severities.includes('stop')) return 'stop';
  if (severities.includes('warning')) return 'warning';
  if (lamps?.emissions || severities.includes('check_engine')) return 'check_engine';
  return null;
}

/** S-3: Truck → Faults. Active first (worst first), then the latest cleared ones. */
export type TruckFaultsDto = {
  /** S3-4: the dash lights now; null before the first fault reading. */
  lamps: TruckDashLampsDto | null;
  active: TruckFaultDto[];
  history: TruckFaultDto[];
  /** When Samsara last updated this truck; null when it is not paired or never synced. */
  syncedAt: string | null;
  paired: boolean;
};

/** S-2/S-3 on the Trucks list: how many codes are active and what to show (`truckAttention`: lights, then codes). */
export type TruckFaultSummaryDto = {
  active: number;
  worst: TruckFaultSeverity | null;
};

/** S-2: what the last Samsara sync stored on a truck. Display only: the official mileage stays `TruckDto.mileage`. */
export type TruckSamsaraDto = {
  odometerMiles: number | null;
  odometerSource: 'obd' | 'gps' | null;
  odometerAt: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  speedMph: number | null;
  locationAt: string | null;
  syncedAt: string | null;
  /** S3-4: the dash lights, or null before the first fault reading. */
  lamps: TruckDashLampsDto | null;
};
