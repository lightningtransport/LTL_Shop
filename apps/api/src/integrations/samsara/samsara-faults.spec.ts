import { describe, expect, it } from 'vitest';
import { parseFaultCodes, worstSeverity } from './samsara-faults';

describe('parseFaultCodes', () => {
  it('reads J1939 codes with per-code lamps', () => {
    const faults = parseFaultCodes({
      j1939: {
        checkEngineLights: { stopIsOn: true, warningIsOn: true, emissionsIsOn: false, protectIsOn: false },
        diagnosticTroubleCodes: [
          { spnId: 3251, spnDescription: 'Aftertreatment DPF differential pressure', fmiId: 0, fmiDescription: 'Too high', occurrenceCount: 14, txId: 0, sourceAddressName: 'Engine #1', redLampStatus: 1, amberLampStatus: 0, milStatus: 0, protectLampStatus: 0 },
          { spnId: 111, spnDescription: 'Engine coolant level', fmiId: 1, fmiDescription: 'Low', occurrenceCount: 2, txId: 0, sourceAddressName: 'Engine #1', redLampStatus: 0, amberLampStatus: 1, milStatus: 0, protectLampStatus: 0 },
          { spnId: 1569, fmiId: 31, txId: 0, redLampStatus: 0, amberLampStatus: 0, milStatus: 0, protectLampStatus: 0 },
        ],
      },
    });

    expect(faults.map((fault) => [fault.faultKey, fault.code, fault.severity, fault.occurrenceCount])).toEqual([
      ['j1939:0:3251:0', 'SPN 3251 · FMI 0', 'stop', 14],
      ['j1939:0:111:1', 'SPN 111 · FMI 1', 'warning', 2],
      ['j1939:0:1569:31', 'SPN 1569 · FMI 31', 'info', null],
    ]);
    expect(faults[0]).toMatchObject({ description: 'Aftertreatment DPF differential pressure — Too high', sourceName: 'Engine #1', protocol: 'j1939' });
  });

  it('falls back to the dash lights when a J1939 code has no lamp fields', () => {
    const [fault] = parseFaultCodes({
      j1939: { checkEngineLights: { warningIsOn: true }, diagnosticTroubleCodes: [{ spnId: 100, fmiId: 1, txId: 3 }] },
    });
    expect(fault).toMatchObject({ severity: 'warning', faultKey: 'j1939:3:100:1', sourceName: 'module 3' });
  });

  it('reads OBD-II confirmed, permanent and pending codes', () => {
    const faults = parseFaultCodes({
      obdii: {
        checkEngineLightIsOn: true,
        diagnosticTroubleCodes: [{
          txId: 2024,
          confirmedDtcs: [{ dtcShortCode: 'p0087', dtcDescription: 'Fuel Rail/System Pressure - Too Low Bank 1' }],
          permanentDtcs: [{ dtcShortCode: 'P0420' }],
          pendingDtcs: [{ dtcShortCode: 'P0456', dtcDescription: 'Evap system small leak' }, { dtcShortCode: 'P0087' }],
        }],
      },
    });

    expect(faults.map((fault) => [fault.code, fault.severity, fault.description])).toEqual([
      ['P0087', 'check_engine', 'Fuel Rail/System Pressure - Too Low Bank 1'],
      ['P0420', 'check_engine', 'P0420'],
      ['P0456', 'pending', 'Evap system small leak'],
    ]);
  });

  it('returns nothing for an empty or unknown reading', () => {
    expect(parseFaultCodes({ j1939: { diagnosticTroubleCodes: [] } })).toEqual([]);
    expect(parseFaultCodes({ canBusType: 'x' })).toEqual([]);
    expect(parseFaultCodes({ j1939: { diagnosticTroubleCodes: [{ spnId: 'bad' }] } })).toEqual([]);
  });
});

describe('worstSeverity', () => {
  it('orders STOP, warning, check engine, pending, info', () => {
    expect(worstSeverity(['info', 'check_engine', 'warning'])).toBe('warning');
    expect(worstSeverity(['pending', 'stop'])).toBe('stop');
    expect(worstSeverity([])).toBeNull();
  });
});
