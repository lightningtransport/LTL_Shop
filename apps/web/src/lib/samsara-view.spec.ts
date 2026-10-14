import { describe, expect, it } from 'vitest';
import { isStaleLocation, shortLocation } from './samsara-view';

describe('shortLocation (TL-4)', () => {
  it('keeps city and state and drops the street and ZIP', () => {
    expect(shortLocation('Pennsylvania Turnpike, Napier Township, PA, 15550')).toBe('Napier Township, PA');
    expect(shortLocation('11190 Baileyton Road, Greeneville, TN, 37745')).toBe('Greeneville, TN');
    expect(shortLocation('I 40, Van Buren, AR')).toBe('Van Buren, AR');
  });

  it('leaves a single place as it is and empties as null', () => {
    expect(shortLocation('LTL yard')).toBe('LTL yard');
    expect(shortLocation('  ')).toBeNull();
    expect(shortLocation(null)).toBeNull();
  });
});

describe('isStaleLocation (TL-7)', () => {
  const now = Date.parse('2026-10-14T18:00:00Z');
  it('is stale after a day without a new point', () => {
    expect(isStaleLocation('2026-10-09T18:00:00Z', now)).toBe(true);
    expect(isStaleLocation('2026-10-14T17:58:00Z', now)).toBe(false);
    expect(isStaleLocation(null, now)).toBe(false);
  });
});
