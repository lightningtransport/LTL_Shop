import { describe, expect, it } from 'vitest';
import { playActions, readTimeMs, stamped } from './autoplay';
import type { DemoStep } from './scripts';

const step: DemoStep = {
  user: 'MS',
  target: { kind: 'path', path: '/admin' },
  title: 'A step',
  do: 'Tap Resolve, then Confirm resolve.',
  spotlight: { text: 'Resolve', hint: 'Tap Resolve', then: { text: 'Confirm resolve', hint: 'Confirm' } },
};

describe('demo Play (D40, DA3)', () => {
  it('taps each light of a step, or only points at it when the step is to look at', () => {
    expect(playActions(step)).toEqual([
      { do: 'tap', at: step.spotlight },
      { do: 'tap', at: step.spotlight!.then },
    ]);
    expect(playActions({ ...step, look: true }).map((action) => action.do)).toEqual(['point', 'point']);
    const own = [{ do: 'wait' as const, ms: 100 }];
    expect(playActions({ ...step, play: own })).toBe(own);
    expect(playActions({ ...step, spotlight: undefined })).toEqual([]);
  });

  it('stays on a step the time it takes to read its Why, within bounds, faster at 2x', () => {
    const short = readTimeMs({ do: 'Look.', say: 'Short.' }, 1);
    const long = readTimeMs({ do: 'Look.', say: 'word '.repeat(200) }, 1);
    expect(short).toBe(3500);
    expect(long).toBe(12_000);
    expect(readTimeMs({ do: 'Look.', say: 'word '.repeat(20) }, 2)).toBe(readTimeMs({ do: 'Look.', say: 'word '.repeat(20) }, 1) / 2);
    // No Why: the Do is read instead.
    expect(readTimeMs({ do: 'word '.repeat(20) }, 1)).toBe(1500 + 20 * 260);
  });

  it('makes an invoice number new on every run', () => {
    expect(stamped('FP-{stamp}', new Date(2026, 9, 12, 9, 5, 7))).toBe('FP-D090507');
    expect(stamped('no stamp')).toBe('no stamp');
  });
});
