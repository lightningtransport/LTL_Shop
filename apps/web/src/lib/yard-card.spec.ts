import { describe, expect, it } from 'vitest';
import { compactAge, dispatchShopConflicts, dispatchSignalsByTruck, fillYardText, groupWorkLocations, matchesTruckSearch, yardCardAlert } from './yard-card';

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

describe('Yard card alert (stage 6 / UX-4-005)', () => {
  const workOrder = (extra: Record<string, unknown> = {}) => ({ status: 'in_progress', jobsCompleted: 2, jobsTotal: 5, currentPause: null, latestReportedBlocker: null, ...extra });

  it('the most urgent wins: blocked, paused, out of shop, leaving soon, nobody on a Job', () => {
    const blocker = { reason: 'waiting_for_parts', blockerReason: 'waiting_for_parts' };
    expect(yardCardAlert({ outOfShop: true, activeWorkOrder: workOrder({ latestReportedBlocker: blocker }) }, undefined, null)).toEqual({ kind: 'blocked', reason: 'waiting_for_parts' });
    expect(yardCardAlert({ activeWorkOrder: workOrder({ status: 'waiting_paused', currentPause: { reason: 'waiting_for_approval' } }) }, undefined, null)).toEqual({ kind: 'paused', reason: 'waiting_for_approval' });
    expect(yardCardAlert({ outOfShop: true, activeWorkOrder: workOrder() }, { departs: '2026-10-06' }, '2026-10-07')).toEqual({ kind: 'out_of_shop' });
    expect(yardCardAlert({ activeWorkOrder: workOrder() }, { departs: '2026-10-06' }, '2026-10-07')).toEqual({ kind: 'leaves', date: '2026-10-06', jobsLeft: 3 });
    expect(yardCardAlert({ nextStep: { kind: 'assign', jobName: 'Alignment' }, activeWorkOrder: workOrder() }, undefined, null)).toEqual({ kind: 'nobody', job: 'Alignment' });
  });

  it('a departure after the window, or a Truck already Ready to Go, is not an alert', () => {
    expect(yardCardAlert({ activeWorkOrder: workOrder() }, { departs: '2026-10-09' }, '2026-10-07')).toBeNull();
    expect(yardCardAlert({ activeWorkOrder: workOrder({ status: 'completed' }) }, { departs: '2026-10-06' }, '2026-10-07')).toBeNull();
  });
});

describe('Dispatch vs the shop (stage 6 / D8)', () => {
  it('flags Trucks Dispatch reports outside while the shop has an open Work Order (not sent out)', () => {
    const conflicts = dispatchShopConflicts(
      { status: 'ok', items: [{ truckNumber: '277', location: 'Outside' }, { truckNumber: '905', location: 'Outside' }, { truckNumber: '601', location: '301 Yard' }, { truckNumber: '944', location: 'outside lot' }] },
      [
        { truckNumber: '277', truckId: 't-277', openWorkOrder: { id: 'w1', displayId: 'WO-001' }, outOfShop: false },
        { truckNumber: '905', truckId: 't-905', openWorkOrder: null, outOfShop: false },
        { truckNumber: '601', truckId: 't-601', openWorkOrder: { id: 'w2', displayId: 'WO-002' }, outOfShop: false },
        { truckNumber: '944', truckId: 't-944', openWorkOrder: { id: 'w3', displayId: 'WO-003' }, outOfShop: true },
      ],
    );
    expect(conflicts.map((item) => item.truckNumber)).toEqual(['277']);
  });
});
