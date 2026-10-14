import type { TruckFaultProtocol, TruckFaultSeverity } from '@prisma/client';

/** One fault code Samsara reports on a vehicle, ready to open, update or keep (`truck_faults`). */
export type ParsedFault = {
  faultKey: string;
  protocol: TruckFaultProtocol;
  code: string;
  description: string;
  severity: TruckFaultSeverity;
  spnId: number | null;
  fmiId: number | null;
  dtcShortCode: string | null;
  sourceName: string | null;
  occurrenceCount: number | null;
};

/** When two readings of one code disagree, the worse one wins. */
export const SEVERITY_RANK: Record<TruckFaultSeverity, number> = { stop: 0, warning: 1, check_engine: 2, pending: 3, info: 4 };

/** S3-4: the truck's dash lights. J1939 gives STOP and warning only per truck, never per code. */
export type DashLamps = { stop: boolean; warning: boolean; protect: boolean; emissions: boolean };

export type ParsedFaultReading = { faults: ParsedFault[]; lamps: DashLamps };

/**
 * D35 / S-3, S3-4: read Samsara's `faultCodes` stat (the latest reading of a vehicle).
 *
 * Dash lights (per truck): J1939 `checkEngineLights` (stop = red, warning = amber, protect, emissions = MIL) and the
 * OBD-II check engine light. These are the only place STOP and warning exist: a J1939 code carries just `milStatus`.
 *
 * Codes: J1939 is SPN + FMI from one engine module; it is "check engine" only when its `milStatus` is 1 (J1939 lamp
 * status: 0 off, 1 on, 3 not available), otherwise "info". OBD-II confirmed and permanent codes are "check engine";
 * pending codes are "pending".
 *
 * An empty code list means "no active faults"; the sync closes what was open (only for a vehicle that sent a reading).
 */
export function parseFaultReading(faultCodes: Record<string, unknown>): ParsedFaultReading {
  const faults = new Map<string, ParsedFault>();
  const keep = (fault: ParsedFault) => {
    const current = faults.get(fault.faultKey);
    if (!current || SEVERITY_RANK[fault.severity] < SEVERITY_RANK[current.severity]) faults.set(fault.faultKey, fault);
  };
  const lamps: DashLamps = { stop: false, warning: false, protect: false, emissions: false };

  const j1939 = record(faultCodes.j1939);
  if (j1939) {
    const lights = record(j1939.checkEngineLights) ?? {};
    lamps.stop = lights.stopIsOn === true;
    lamps.warning = lights.warningIsOn === true;
    lamps.protect = lights.protectIsOn === true;
    lamps.emissions = lights.emissionsIsOn === true;
    for (const dtc of list(j1939.diagnosticTroubleCodes)) {
      const spnId = int(dtc.spnId);
      const fmiId = int(dtc.fmiId);
      if (spnId === null || fmiId === null) continue;
      const source = text(dtc.sourceAddressName) ?? (int(dtc.txId) !== null ? `module ${int(dtc.txId)}` : null);
      const vendor = record(dtc.vendorSpecificFields);
      const spnDescription = text(dtc.spnDescription);
      const fmiDescription = text(dtc.fmiDescription);
      keep({
        faultKey: `j1939:${int(dtc.txId) ?? source ?? 'x'}:${spnId}:${fmiId}`,
        protocol: 'j1939',
        code: `SPN ${spnId} · FMI ${fmiId}`,
        // The engine maker's own words when Samsara has them ("Manufacturer Assignable SPN" says nothing).
        description: (vendor && text(vendor.dtcDescription)) || [spnDescription, fmiDescription].filter(Boolean).join(' — ') || `SPN ${spnId} · FMI ${fmiId}`,
        severity: dtc.milStatus === 1 ? 'check_engine' : 'info',
        spnId,
        fmiId,
        dtcShortCode: null,
        sourceName: source,
        occurrenceCount: int(dtc.occurrenceCount),
      });
    }
  }

  const obdii = record(faultCodes.obdii);
  if (obdii) {
    if (obdii.checkEngineLightIsOn === true) lamps.emissions = true;
    for (const module of list(obdii.diagnosticTroubleCodes)) {
      const txId = int(module.txId);
      const groups: Array<[unknown, TruckFaultSeverity]> = [
        [module.confirmedDtcs, 'check_engine'],
        [module.permanentDtcs, 'check_engine'],
        [module.pendingDtcs, 'pending'],
      ];
      for (const [codes, severity] of groups) {
        for (const dtc of list(codes)) {
          const short = text(dtc.dtcShortCode);
          if (!short) continue;
          keep({
            faultKey: `obdii:${txId ?? 'x'}:${short.toUpperCase()}`,
            protocol: 'obdii',
            code: short.toUpperCase(),
            description: text(dtc.dtcDescription) ?? short.toUpperCase(),
            severity,
            spnId: null,
            fmiId: null,
            dtcShortCode: short.toUpperCase(),
            sourceName: txId !== null ? `module ${txId}` : null,
            occurrenceCount: null,
          });
        }
      }
    }
  }

  return { faults: [...faults.values()], lamps };
}

/** The codes only (tests and callers that do not need the lights). */
export function parseFaultCodes(faultCodes: Record<string, unknown>): ParsedFault[] {
  return parseFaultReading(faultCodes).faults;
}

/** S3-4: one rule for the API and the web (Trucks list, banner). */
export { truckAttention } from '@ltl-shop/shared';

/** The worst severity in a list, or null when it is empty. */
export function worstSeverity(severities: TruckFaultSeverity[]): TruckFaultSeverity | null {
  return severities.reduce<TruckFaultSeverity | null>((worst, severity) => (worst === null || SEVERITY_RANK[severity] < SEVERITY_RANK[worst] ? severity : worst), null);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(record(item))) : [];
}

function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
