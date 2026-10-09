import { describe, expect, it } from 'vitest';
import { customJobNameNorm, preferredName } from './custom-jobs-review.service';

describe('Custom Jobs inbox grouping (LTR-57)', () => {
  it('groups names ignoring capitals, accents and spaces', () => {
    expect(customJobNameNorm('  fix DASH  líght ')).toBe(customJobNameNorm('Fix dash light'));
    expect(customJobNameNorm('***')).toBe('***');
  });

  it('names the group with the most used spelling, the tidiest on a tie', () => {
    expect(preferredName(new Map([['fix  DASH light', 1], ['Fix dash light', 1]]))).toBe('Fix dash light');
    expect(preferredName(new Map([['fix dash light', 3], ['Fix dash light', 1]]))).toBe('fix dash light');
  });
});
