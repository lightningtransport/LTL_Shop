import { describe, expect, it } from 'vitest';
import { compactAge, groupWorkLocations, matchesTruckSearch, yardCardNextStep } from './yard-card';

describe('Yard card helpers (LTR-101, LTR-103)', () => {
  it('turns the Work Plan reason into the next step', () => {
    expect(yardCardNextStep({ readyReason: 'jobs_remaining', jobsCompleted: 1, jobsTotal: 3 })).toEqual({ key: 'yardCardJobsPending', values: { count: '2' } });
    expect(yardCardNextStep({ readyReason: 'alignment_pending' })?.key).toBe('yardCardNextAlignment');
    expect(yardCardNextStep({ readyReason: 'pm_pending' })?.key).toBe('yardCardNextPm');
    expect(yardCardNextStep({ readyReason: 'work_order_open' })?.key).toBe('yardCardWaitingClose');
    expect(yardCardNextStep({ readyReason: 'plan_complete' })).toBeNull();
    expect(yardCardNextStep({})).toBeNull();
  });

  it('formats a compact age', () => {
    const now = Date.parse('2026-09-25T12:00:00Z');
    expect(compactAge('2026-09-25T07:00:00Z', now)).toBe('5h');
    expect(compactAge('2026-09-22T11:00:00Z', now)).toBe('3d');
  });

  it('groups work locations by value, largest first', () => {
    expect(groupWorkLocations([
      { truckNumber: '606', location: 'Checked In' },
      { truckNumber: '608', location: 'Ready To Go' },
      { truckNumber: '610', location: 'Checked In' },
      { truckNumber: '611', location: null },
    ], 'No location')).toEqual([
      { location: 'Checked In', trucks: ['606', '610'] },
      { location: 'No location', trucks: ['611'] },
      { location: 'Ready To Go', trucks: ['608'] },
    ]);
  });

  it('filters by Truck number', () => {
    expect(matchesTruckSearch('T-608', '608')).toBe(true);
    expect(matchesTruckSearch('T-608', ' ')).toBe(true);
    expect(matchesTruckSearch('T-608', '700')).toBe(false);
  });
});
