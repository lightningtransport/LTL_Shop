import { describe, expect, it } from 'vitest';
import { isPmCategory, isPmJob } from './pm';

describe('PM category helpers (LTR-141)', () => {
  it('matches only the PM Category', () => {
    expect(isPmCategory('PM')).toBe(true);
    expect(isPmCategory(' pm ')).toBe(true);
    expect(isPmCategory('PM Service')).toBe(false);
    expect(isPmCategory(null)).toBe(false);
    expect(isPmJob({ category: { name: 'PM' } })).toBe(true);
    expect(isPmJob({ category: { name: 'Engine' } })).toBe(false);
  });
});
