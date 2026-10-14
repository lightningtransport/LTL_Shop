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
};

/** S-3: Truck → Faults. Active first (worst first), then the latest cleared ones. */
export type TruckFaultsDto = {
  active: TruckFaultDto[];
  history: TruckFaultDto[];
  /** When Samsara last updated this truck; null when it is not paired or never synced. */
  syncedAt: string | null;
  paired: boolean;
};

/** S-2/S-3 on the Trucks list: how many faults are active and the worst one. */
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
};
