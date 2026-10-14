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

export type SamsaraPairingDto = {
  status: SamsaraPairingStatus;
  checkedAt: string;
  summary: SamsaraPairingSummaryDto | null;
  paired: SamsaraPairedTruckDto[];
  unpairedTrucks: SamsaraUnpairedTruckDto[];
  unpairedVehicles: SamsaraVehicleRefDto[];
  /** False when Samsara gave vehicles but not their odometers; the lists still show. */
  odometersAvailable: boolean;
};
