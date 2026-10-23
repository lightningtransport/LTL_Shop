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
  treadBand,
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

  it('is ok within ±10 % and with tread more than 2/32 above the minimum', () => {
    expect(status(95, 8)).toEqual({ status: TireReadingStatus.OK, reason: null });
    expect(status(86, 5)).toEqual({ status: TireReadingStatus.OK, reason: null });
  });

  it('watches pressure past ±10 % and fixes it past ±20 %', () => {
    expect(status(84, 8)).toEqual({ status: TireReadingStatus.WATCH, reason: 'pressure' });
    expect(status(106, 8)).toEqual({ status: TireReadingStatus.WATCH, reason: 'pressure' });
    expect(status(72, 8)).toEqual({ status: TireReadingStatus.FIX, reason: 'pressure' });
  });

  it('D57: fixes tread at the minimum or under it and watches the 2/32 above it', () => {
    expect(status(110, 4, steer)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
    expect(status(110, 3, steer)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
    expect(status(110, 5, steer)).toEqual({ status: TireReadingStatus.WATCH, reason: 'tread' });
    expect(status(110, 6, steer)).toEqual({ status: TireReadingStatus.WATCH, reason: 'tread' });
    expect(status(110, 7, steer)).toEqual({ status: TireReadingStatus.OK, reason: null });
    expect(status(95, 2)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
    expect(status(95, 1)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
    expect(status(95, 3)).toEqual({ status: TireReadingStatus.WATCH, reason: 'tread' });
    expect(status(95, 4)).toEqual({ status: TireReadingStatus.WATCH, reason: 'tread' });
    expect(status(95, 5)).toEqual({ status: TireReadingStatus.OK, reason: null });
  });

  it('D57: the watch margin comes from Setup', () => {
    const wide = { ...DEFAULT_INSPECTION_TIRE_LIMITS, treadWatchMargin: 4 };
    expect(tireReadingStatus({ psi: 110, tread: 8 }, steer, wide)).toEqual({ status: TireReadingStatus.WATCH, reason: 'tread' });
    expect(tireReadingStatus({ psi: 110, tread: 9 }, steer, wide)).toEqual({ status: TireReadingStatus.OK, reason: null });
    const none = { ...DEFAULT_INSPECTION_TIRE_LIMITS, treadWatchMargin: 0 };
    expect(tireReadingStatus({ psi: 110, tread: 4 }, steer, none)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
    expect(tireReadingStatus({ psi: 110, tread: 5 }, steer, none)).toEqual({ status: TireReadingStatus.OK, reason: null });
  });

  it('D57: the numbers the sheet and Setup show', () => {
    expect(treadBand(4, 2)).toEqual({ jobAtOrBelow: 4, watchFrom: 5, watchTo: 6, okFrom: 7 });
    expect(treadBand(2, 2)).toEqual({ jobAtOrBelow: 2, watchFrom: 3, watchTo: 4, okFrom: 5 });
    expect(treadBand(4, 0)).toEqual({ jobAtOrBelow: 4, watchFrom: 5, watchTo: 4, okFrom: 5 });
  });

  it('keeps the worse of the two, tread first on a tie', () => {
    expect(status(72, 3)).toEqual({ status: TireReadingStatus.FIX, reason: 'pressure' });
    expect(status(72, 1)).toEqual({ status: TireReadingStatus.FIX, reason: 'tread' });
  });
});

describe('tireFindingReason (D54)', () => {
  const reading = (psi: number, tread: number) => ({ psi, tread, targetPsi: 110, minTread: 4 });
  it('says worn when the tread is at or under the minimum, even if the pressure is off too', () => {
    expect(tireFindingReason(reading(110, 4))).toBe('worn');
    expect(tireFindingReason(reading(110, 3))).toBe('worn');
    expect(tireFindingReason(reading(70, 2))).toBe('worn');
  });
  it('says low or high pressure otherwise', () => {
    expect(tireFindingReason(reading(72, 8))).toBe('low_pressure');
    expect(tireFindingReason(reading(140, 8))).toBe('high_pressure');
  });
});
