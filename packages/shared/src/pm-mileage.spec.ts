import { describe, expect, it } from 'vitest';
import { checkPmObservedMileage, PM_MILEAGE_JUMP_CONFIRM_THRESHOLD } from './pm-mileage';

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
