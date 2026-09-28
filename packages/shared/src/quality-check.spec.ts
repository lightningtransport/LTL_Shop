import { describe, expect, it } from 'vitest';
import { isQualityCheckJob } from './quality-check';

describe('isQualityCheckJob (LTR-164 #2 / D15)', () => {
  it('matches the Quality Check catalog step and its short names', () => {
    expect(isQualityCheckJob('Quality Check', 'Quality Check')).toBe(true);
    expect(isQualityCheckJob('Other', 'QC')).toBe(true);
  });

  it('does not match other Jobs', () => {
    expect(isQualityCheckJob('Air & Brake System', 'Brake Inspection')).toBe(false);
    expect(isQualityCheckJob('Detailing', 'Detailing')).toBe(false);
    expect(isQualityCheckJob(null, undefined)).toBe(false);
  });
});
