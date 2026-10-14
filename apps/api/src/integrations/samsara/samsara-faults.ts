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

/**
 * D35 / S-3: read Samsara's `faultCodes` stat (the latest reading of a vehicle) into one row per code.
 *
 * J1939 (heavy trucks): one code is SPN + FMI from one engine module. Its severity comes from that code's lamps when
 * Samsara sends them (red → STOP, amber or protect → warning, MIL → check engine). Without per-code lamps it falls
 * back to the truck's dash lights (STOP, warning/protect, emissions); no light at all is "info".
 *
 * OBD-II: confirmed and permanent codes are "check engine"; pending codes (not confirmed yet) are "pending".
 *
 * An empty list means "no active faults"; the sync closes what was open (only for a vehicle that sent a reading).
 */
export function parseFaultCodes(faultCodes: Record<string, unknown>): ParsedFault[] {
  const faults = new Map<string, ParsedFault>();
  const keep = (fault: ParsedFault) => {
    const current = faults.get(fault.faultKey);
    if (!current || SEVERITY_RANK[fault.severity] < SEVERITY_RANK[current.severity]) faults.set(fault.faultKey, fault);
  };

  const j1939 = record(faultCodes.j1939);
  if (j1939) {
    const lights = record(j1939.checkEngineLights) ?? {};
    const dashSeverity: TruckFaultSeverity = lights.stopIsOn === true
      ? 'stop'
      : lights.warningIsOn === true || lights.protectIsOn === true
        ? 'warning'
        : lights.emissionsIsOn === true
          ? 'check_engine'
          : 'info';
    for (const dtc of list(j1939.diagnosticTroubleCodes)) {
      const spnId = int(dtc.spnId);
      const fmiId = int(dtc.fmiId);
      if (spnId === null || fmiId === null) continue;
      const source = text(dtc.sourceAddressName) ?? (int(dtc.txId) !== null ? `module ${int(dtc.txId)}` : null);
      const spnDescription = text(dtc.spnDescription);
      const fmiDescription = text(dtc.fmiDescription);
      keep({
        faultKey: `j1939:${int(dtc.txId) ?? source ?? 'x'}:${spnId}:${fmiId}`,
        protocol: 'j1939',
        code: `SPN ${spnId} · FMI ${fmiId}`,
        description: [spnDescription, fmiDescription].filter(Boolean).join(' — ') || `SPN ${spnId} · FMI ${fmiId}`,
        severity: j1939Severity(dtc, dashSeverity),
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

  return [...faults.values()];
}

/** The worst severity in a list, or null when it is empty. */
export function worstSeverity(severities: TruckFaultSeverity[]): TruckFaultSeverity | null {
  return severities.reduce<TruckFaultSeverity | null>((worst, severity) => (worst === null || SEVERITY_RANK[severity] < SEVERITY_RANK[worst] ? severity : worst), null);
}

function j1939Severity(dtc: Record<string, unknown>, dashSeverity: TruckFaultSeverity): TruckFaultSeverity {
  const lamps = ['redLampStatus', 'amberLampStatus', 'protectLampStatus', 'milStatus'].filter((key) => key in dtc);
  if (!lamps.length) return dashSeverity;
  if (lampOn(dtc.redLampStatus)) return 'stop';
  if (lampOn(dtc.amberLampStatus) || lampOn(dtc.protectLampStatus)) return 'warning';
  if (lampOn(dtc.milStatus)) return 'check_engine';
  return 'info';
}

function lampOn(value: unknown) {
  return value === true || (typeof value === 'number' && value > 0);
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
