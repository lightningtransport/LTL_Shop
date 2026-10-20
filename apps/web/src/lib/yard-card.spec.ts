import { describe, expect, it } from 'vitest';
import type { TruckSamsaraDto } from '@ltl-shop/shared';
import { compactAge, dispatchRowPlace, dispatchSignalsByTruck, groupDispatchDays, orderDispatchRows, fillYardText, groupWorkLocations, matchesTruckSearch, yardCardAlert } from './yard-card';

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

describe('D50: Dispatch rows with the Samsara place', () => {
  const at = '2026-10-19T15:00:00.000Z';
  const samsara = (geofenceId: string | null): TruckSamsaraDto => ({
    odometerMiles: null, odometerSource: null, odometerAt: null, address: 'Ocala, FL', latitude: null, longitude: null, speedMph: null,
    locationAt: at, geofenceId, geofenceName: null, inYardSince: geofenceId ? at : null, syncedAt: at, lamps: null,
  });
  const wo = { id: 'wo-1', displayId: 'WO-001' };

  it('says the D49 place: In shop needs the yard and an open WO; outside with a WO is outside', () => {
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: wo, samsara: samsara('12839282') }, 'incoming', null, null).place).toBe('in_shop');
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara('32418339') }, 'incoming', null, null).place).toBe('in_yard');
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: wo, samsara: samsara(null) }, 'incoming', null, null).place).toBe('outside');
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: null }, 'incoming', null, null).place).toBe('no_gps');
    expect(dispatchRowPlace(undefined, 'incoming', null, null).place).toBe('missing');
  });

  it('Arrived when Samsara sees an incoming truck in the yard; Left when a departure day came and it is outside', () => {
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara('12839282') }, 'incoming', '2026-10-20', '2026-10-19').done).toBe(true);
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara(null) }, 'incoming', '2026-10-19', '2026-10-19').done).toBe(false);
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara(null) }, 'departures', '2026-10-19', '2026-10-19').done).toBe(true);
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara(null) }, 'departures', '2026-10-21', '2026-10-19').done).toBe(false);
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara('12839282') }, 'departures', '2026-10-19', '2026-10-19').done).toBe(false);
  });

  it('D51: a day starts with what asks for action — arrived without a WO, leaving not ready', () => {
    const arrivedNoWo = dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara('12839282') }, 'incoming', '2026-10-19', '2026-10-19');
    expect([arrivedNoWo.rank, arrivedNoWo.needsWorkOrder]).toEqual([0, true]);
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara(null) }, 'incoming', '2026-10-19', '2026-10-19').rank).toBe(1);
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: wo, samsara: samsara('12839282') }, 'incoming', '2026-10-19', '2026-10-19').rank).toBe(2);
    const notReady = dispatchRowPlace({ readyToGo: false, openWorkOrder: wo, samsara: samsara(null) }, 'departures', '2026-10-19', '2026-10-19');
    expect([notReady.rank, notReady.notReady, notReady.done]).toEqual([0, true, false]);
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara('12839282') }, 'departures', '2026-10-19', '2026-10-19').rank).toBe(1);
    expect(dispatchRowPlace({ readyToGo: false, openWorkOrder: null, samsara: samsara(null) }, 'departures', '2026-10-19', '2026-10-19').rank).toBe(3);
    expect(dispatchRowPlace(undefined, 'departures', '2026-10-19', '2026-10-19').rank).toBe(2);
  });

  it('orders by rank, keeping the API order inside a rank, and groups by day with undated last', () => {
    expect(orderDispatchRows([{ n: 1, rank: 2 }, { n: 2, rank: 0 }, { n: 3, rank: 1 }, { n: 4, rank: 0 }]).map((row) => row.n)).toEqual([2, 4, 3, 1]);
    expect(groupDispatchDays([{ day: '2026-10-26' }, { day: null }, { day: '2026-10-19' }, { day: '2026-10-26' }]).map((group) => [group.day, group.rows.length])).toEqual([['2026-10-19', 1], ['2026-10-26', 2], [null, 1]]);
  });
});
