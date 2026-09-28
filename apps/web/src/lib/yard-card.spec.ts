import { describe, expect, it } from 'vitest';
import { compactAge, dispatchSignalsByTruck, fillYardText, groupWorkLocations, matchesTruckSearch } from './yard-card';

describe('Yard card helpers (LTR-101, LTR-103)', () => {
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

describe('dispatchSignalsByTruck (LTR-120)', () => {
  it('keeps the earliest dated arrival and departure per Truck', () => {
    const signals = dispatchSignalsByTruck({
      incomingTrucks: { status: 'ok', items: [
        { truckNumber: '905', returnDate: '2026-09-30' },
        { truckNumber: '905', returnDate: '2026-09-28' },
        { truckNumber: '277', returnDate: null },
      ] },
      upcomingDepartures: { status: 'ok', items: [{ truckNumber: '905', outDate: '2026-10-02' }] },
    });
    expect(signals.get('905')).toEqual({ expectedIn: '2026-09-28', departs: '2026-10-02' });
    expect(signals.has('277')).toBe(false);
  });

  it('ignores sections Dispatch could not provide', () => {
    const signals = dispatchSignalsByTruck({
      incomingTrucks: { status: 'unavailable', items: [{ truckNumber: '905', returnDate: '2026-09-28' }] },
      upcomingDepartures: { status: 'ok', items: [] },
    });
    expect(signals.size).toBe(0);
    expect(dispatchSignalsByTruck(undefined).size).toBe(0);
  });
});
