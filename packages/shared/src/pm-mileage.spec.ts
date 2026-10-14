import { describe, expect, it } from 'vitest';
import { checkPmObservedMileage, PM_MILEAGE_JUMP_CONFIRM_THRESHOLD, samsaraMileageGap } from './pm-mileage';

describe('checkPmObservedMileage (LTR-135)', () => {
  it('rejects mileage lower than the truck current mileage', () => {
    // Production WO-002: 364,400 recorded vs 365,686 on the truck.
    expect(checkPmObservedMileage(364_400, 365_686)).toEqual({
      ok: false,
      code: 'MILEAGE_BELOW_CURRENT',
      currentMileage: 365_686,
    });
  });

  it('accepts equal or higher mileage without confirmation', () => {
    expect(checkPmObservedMileage(365_686, 365_686)).toEqual({ ok: true, needsConfirmation: false });
    expect(checkPmObservedMileage(370_000, 365_686)).toEqual({ ok: true, needsConfirmation: false });
  });

  it('asks for confirmation above the jump threshold only', () => {
    expect(checkPmObservedMileage(100_000 + PM_MILEAGE_JUMP_CONFIRM_THRESHOLD, 100_000))
      .toEqual({ ok: true, needsConfirmation: false });
    expect(checkPmObservedMileage(100_001 + PM_MILEAGE_JUMP_CONFIRM_THRESHOLD, 100_000))
      .toEqual({ ok: true, needsConfirmation: true });
  });

  it('skips the check when either value is unknown', () => {
    expect(checkPmObservedMileage(null, 365_686)).toEqual({ ok: true, needsConfirmation: false });
    expect(checkPmObservedMileage(12, null)).toEqual({ ok: true, needsConfirmation: false });
  });
});

describe('samsaraMileageGap (D35 / S4-1)', () => {
  it('says nothing within 50 mi or without both readings', () => {
    expect(samsaraMileageGap(412_300, 412_350)).toBeNull();
    expect(samsaraMileageGap(412_300, 412_250)).toBeNull();
    expect(samsaraMileageGap(null, 412_300)).toBeNull();
    expect(samsaraMileageGap(412_300, null)).toBeNull();
    expect(samsaraMileageGap(412_300, undefined)).toBeNull();
  });

  it('gives the gap past 50 mi, positive when the dashboard reads more', () => {
    expect(samsaraMileageGap(418_540, 418_612)).toBe(-72);
    expect(samsaraMileageGap(418_700, 418_612)).toBe(88);
  });
});
