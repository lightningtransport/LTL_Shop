import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSPECTION_TIRE_LIMITS,
  TIRE_POSITIONS,
  TirePosition,
  TireReadingStatus,
  tireAxle,
  tireFindingReason,
  tireReadingStatus,
  tireTargets,
} from './inspection';

const steer = tireTargets(TirePosition.LF, DEFAULT_INSPECTION_TIRE_LIMITS);
const drive = tireTargets(TirePosition.LFO, DEFAULT_INSPECTION_TIRE_LIMITS);
const status = (psi: number, tread: number, target = drive) => tireReadingStatus({ psi, tread }, target, DEFAULT_INSPECTION_TIRE_LIMITS);

describe('D41 tire rule', () => {
  it('walks the 10 positions of a steer + 2 drive truck', () => {
    expect(TIRE_POSITIONS).toHaveLength(10);
    expect(TIRE_POSITIONS.filter((position) => tireAxle(position) === 'steer')).toEqual([TirePosition.LF, TirePosition.RF]);
    expect(steer).toEqual({ targetPsi: 110, minTread: 4 });
    expect(drive).toEqual({ targetPsi: 95, minTread: 2 });
  });

  it('is ok within ±10 % and with tread 2/32 above the minimum', () => {
    expect(status(95, 8)).toEqual({ status: TireReadingStatus.OK, reason: null });
    expect(status(86, 4)).toEqual({ status: TireReadingStatus.OK, reason: null });
  });

  it('watches pressure past ±10 % and fixes it past ±20 %', () => {
    expect(status(84, 8)).toEqual({ status: TireReadingStatus.WATCH, reason: 'pressure' });
    expect(status(106, 8)).toEqual({ status: TireReadingStatus.WATCH, reason: 'pressure' });
    expect(status(72, 8)).toEqual({ status: TireReadingStatus.FIX, reason: 'pressure' });
  });

  it('watches tread near the minimum and fixes it under the minimum', () => {
    expect(status(95, 3)).toEqual({ status: TireReadingStatus.WATCH, reason: 'tread' });
    expect(status(95, 1)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
    expect(status(110, 3, steer)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
  });

  it('keeps the worse of the two, tread first on a tie', () => {
    expect(status(72, 3)).toEqual({ status: TireReadingStatus.FIX, reason: 'pressure' });
    expect(status(72, 1)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
  });
});

describe('tireFindingReason (D53)', () => {
  const reading = (psi: number, tread: number) => ({ psi, tread, targetPsi: 110, minTread: 4 });
  it('says worn when the tread is under the minimum, even if the pressure is off too', () => {
    expect(tireFindingReason(reading(110, 3))).toBe('worn');
    expect(tireFindingReason(reading(70, 2))).toBe('worn');
  });
  it('says low or high pressure otherwise', () => {
    expect(tireFindingReason(reading(72, 8))).toBe('low_pressure');
    expect(tireFindingReason(reading(140, 8))).toBe('high_pressure');
  });
});
