import { describe, expect, it } from 'vitest';
import { MECHANIC_TONES, mechanicTone } from './mechanic-tone';

describe('Mechanic avatar tone (stage 8 / F5)', () => {
  it('is stable for the same id and always one of the palette', () => {
    expect(mechanicTone('00000000-0000-4000-8000-000000000011')).toBe(mechanicTone('00000000-0000-4000-8000-000000000011'));
    for (const id of ['a', 'b', 'mechanic-1', 'mechanic-2', '00000000-0000-4000-8000-000000000012']) {
      expect(MECHANIC_TONES).toContain(mechanicTone(id));
    }
  });

  it('spreads different mechanics over the palette', () => {
    const tones = new Set(Array.from({ length: 40 }, (_, index) => mechanicTone(`mechanic-${index}`)));
    expect(tones.size).toBeGreaterThanOrEqual(5);
  });
});
