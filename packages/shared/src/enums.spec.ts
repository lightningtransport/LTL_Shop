import { describe, expect, it } from 'vitest';
import {
  BLOCKER_REASON_LABELS,
  BLOCKER_REASON_LABELS_ES,
  BlockerReason,
  PauseReason,
} from './enums';

describe('BlockerReason (LTR-153 / D17)', () => {
  it('is the waiting subset of PauseReason plus Other (and the Safety return, LTR-185)', () => {
    const pauseValues = new Set<string>(Object.values(PauseReason));
    for (const reason of Object.values(BlockerReason)) {
      // LTR-185 / D19: "Returned by Safety" is a blocker reason only; it is never an official pause.
      if (reason === BlockerReason.QUALITY_CHECK_FAILED) continue;
      expect(pauseValues.has(reason)).toBe(true);
    }
    expect(Object.values(BlockerReason)).not.toContain(PauseReason.BREAK);
    expect(Object.values(BlockerReason)).not.toContain(PauseReason.END_OF_SHIFT);
    expect(Object.values(BlockerReason)).not.toContain(PauseReason.WORKING_ON_ANOTHER_WO);
    expect(Object.values(BlockerReason)).not.toContain(PauseReason.TRUCK_UNAVAILABLE);
  });

  it('has an EN and ES label for every reason', () => {
    for (const reason of Object.values(BlockerReason)) {
      expect(BLOCKER_REASON_LABELS[reason]).toBeTruthy();
      expect(BLOCKER_REASON_LABELS_ES[reason]).toBeTruthy();
    }
  });
});
