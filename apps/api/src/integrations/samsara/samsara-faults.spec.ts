import { describe, expect, it } from 'vitest';
import { parseFaultCodes, parseFaultReading, truckAttention, worstSeverity } from './samsara-faults';

describe('parseFaultReading', () => {
  it('reads J1939 codes: check engine only with milStatus 1; STOP and warning come from the truck lights', () => {
    const { faults, lamps } = parseFaultReading({
      j1939: {
        checkEngineLights: { stopIsOn: true, warningIsOn: true, emissionsIsOn: true, protectIsOn: false },
        diagnosticTroubleCodes: [
          { spnId: 2659, spnDescription: 'Engine Exhaust Gas Recirculation 1 Mass Flow Rate', fmiId: 17, fmiDescription: 'Low—least severe', occurrenceCount: 126, txId: 0, sourceAddressName: 'Engine #1', milStatus: 1 },
          { spnId: 111, spnDescription: 'Engine coolant level', fmiId: 1, fmiDescription: 'Low', occurrenceCount: 2, txId: 0, sourceAddressName: 'Engine #1', milStatus: 0 },
          { spnId: 520837, spnDescription: 'Manufacturer Assignable SPN', fmiId: 12, txId: 0, milStatus: 3, vendorSpecificFields: { dtcDescription: 'DEF dosing valve fault' } },
        ],
      },
    });

    expect(lamps).toEqual({ stop: true, warning: true, protect: false, emissions: true });
    expect(faults.map((fault) => [fault.faultKey, fault.code, fault.severity, fault.occurrenceCount])).toEqual([
      ['j1939:0:2659:17', 'SPN 2659 · FMI 17', 'check_engine', 126],
      ['j1939:0:111:1', 'SPN 111 · FMI 1', 'info', 2],
      ['j1939:0:520837:12', 'SPN 520837 · FMI 12', 'info', null],
    ]);
    expect(faults[0]).toMatchObject({ description: 'Engine Exhaust Gas Recirculation 1 Mass Flow Rate — Low—least severe', sourceName: 'Engine #1' });
    expect(faults[2].description).toBe('DEF dosing valve fault');
  });

  it('names the module when there is no source address name', () => {
    const [fault] = parseFaultCodes({ j1939: { diagnosticTroubleCodes: [{ spnId: 100, fmiId: 1, txId: 3, milStatus: 1 }] } });
    expect(fault).toMatchObject({ severity: 'check_engine', faultKey: 'j1939:3:100:1', sourceName: 'module 3' });
  });

  it('reads OBD-II confirmed, permanent and pending codes and its check engine light', () => {
    const { faults, lamps } = parseFaultReading({
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

    expect(lamps.emissions).toBe(true);
    expect(faults.map((fault) => [fault.code, fault.severity, fault.description])).toEqual([
      ['P0087', 'check_engine', 'Fuel Rail/System Pressure - Too Low Bank 1'],
      ['P0420', 'check_engine', 'P0420'],
      ['P0456', 'pending', 'Evap system small leak'],
    ]);
  });

  it('returns nothing for an empty or unknown reading', () => {
    expect(parseFaultReading({ j1939: { diagnosticTroubleCodes: [] } })).toEqual({ faults: [], lamps: { stop: false, warning: false, protect: false, emissions: false } });
    expect(parseFaultCodes({ canBusType: 'x' })).toEqual([]);
    expect(parseFaultCodes({ j1939: { diagnosticTroubleCodes: [{ spnId: 'bad' }] } })).toEqual([]);
  });
});

describe('truckAttention', () => {
  it('puts the STOP light first, then warning or protect, then codes that lit check engine', () => {
    expect(truckAttention({ stop: true }, ['info'])).toBe('stop');
    expect(truckAttention({ warning: true }, ['check_engine'])).toBe('warning');
    expect(truckAttention({ protect: true }, [])).toBe('warning');
    expect(truckAttention({ emissions: true }, [])).toBe('check_engine');
    expect(truckAttention(null, ['info', 'check_engine'])).toBe('check_engine');
  });

  it('says nothing when only info or pending codes are active', () => {
    expect(truckAttention({ stop: false, warning: false, protect: false, emissions: false }, ['info', 'pending'])).toBeNull();
    expect(truckAttention(null, [])).toBeNull();
  });
});

describe('worstSeverity', () => {
  it('orders STOP, warning, check engine, pending, info', () => {
    expect(worstSeverity(['info', 'check_engine', 'warning'])).toBe('warning');
    expect(worstSeverity(['pending', 'stop'])).toBe('stop');
    expect(worstSeverity([])).toBeNull();
  });
});
