import { describe, expect, it } from 'vitest';
import { YardPresenceState } from './enums';
import { SAMSARA_YARD_GEOFENCE_IDS, isYardGeofence, readyToGoYardMove, truckPlace, truckPresence } from './samsara';

const AT = '2026-10-19T15:00:00.000Z';

describe('D49 (LTR-257): In yard from the Samsara geofences, In shop with an open Work Order', () => {
  it('our yard is Home Office and Lightning Transport and Logistics (and its LLC), by id', () => {
    expect(SAMSARA_YARD_GEOFENCE_IDS).toEqual(['12839282', '32418339', '39543599']);
    expect(isYardGeofence('12839282')).toBe(true);
    expect(isYardGeofence('32418339')).toBe(true);
    expect(isYardGeofence('39543599')).toBe(true);
    expect(isYardGeofence('87934134')).toBe(false);
    expect(isYardGeofence(null)).toBe(false);
  });

  it('inside a yard geofence is IN_YARD with its arrival time', () => {
    expect(truckPresence({ locationAt: AT, geofenceId: '32418339', inYardSince: '2026-10-19T13:00:00.000Z' })).toEqual({
      state: YardPresenceState.IN_YARD, provenance: 'samsara_geofence', since: '2026-10-19T13:00:00.000Z', at: AT,
    });
  });

  it('another geofence or none is OUTSIDE_YARD; no GPS point or no Samsara is UNKNOWN', () => {
    expect(truckPresence({ locationAt: AT, geofenceId: '87934134', inYardSince: null }).state).toBe(YardPresenceState.OUTSIDE_YARD);
    expect(truckPresence({ locationAt: AT, geofenceId: null, inYardSince: null }).state).toBe(YardPresenceState.OUTSIDE_YARD);
    expect(truckPresence({ locationAt: null, geofenceId: null, inYardSince: null }).state).toBe(YardPresenceState.UNKNOWN);
    expect(truckPresence(null)).toEqual({ state: YardPresenceState.UNKNOWN, provenance: 'phase_1_unavailable' });
  });

  it('an old reading keeps its answer (a parked truck stops reporting)', () => {
    expect(truckPresence({ locationAt: '2026-10-10T15:00:00.000Z', geofenceId: '12839282', inYardSince: '2026-10-10T13:00:00.000Z' }).state).toBe(YardPresenceState.IN_YARD);
  });

  it('In shop is the yard with an open Work Order; outside the yard an open Work Order is not In shop', () => {
    const inYard = { locationAt: AT, geofenceId: '12839282', inYardSince: AT };
    expect(truckPlace(inYard, true)).toBe('in_shop');
    expect(truckPlace(inYard, false)).toBe('in_yard');
    expect(truckPlace({ locationAt: AT, geofenceId: '87934134', inYardSince: null }, true)).toBeNull();
    expect(truckPlace(null, true)).toBeNull();
  });
});

describe('D52 (LTR-260): a Ready to Go truck that left the yard, or left and came back', () => {
  const CLOSED = '2026-10-21T14:00:00.000Z';
  const HOME = '12839282';

  it('a reading outside the yard after the close is left_yard, with the time of that reading', () => {
    expect(readyToGoYardMove({ locationAt: '2026-10-21T15:10:00.000Z', geofenceId: null, inYardSince: null }, CLOSED))
      .toEqual({ kind: 'left_yard', at: '2026-10-21T15:10:00.000Z' });
    expect(readyToGoYardMove({ locationAt: '2026-10-21T15:10:00.000Z', geofenceId: '87934134', inYardSince: null }, new Date(CLOSED))?.kind)
      .toBe('left_yard');
  });

  it('an outside reading from before the close says nothing (it may be stale)', () => {
    expect(readyToGoYardMove({ locationAt: '2026-10-21T13:00:00.000Z', geofenceId: null, inYardSince: null }, CLOSED)).toBeNull();
  });

  it('still in the yard since before the close is nothing: it waits to leave', () => {
    expect(readyToGoYardMove({ locationAt: '2026-10-21T16:00:00.000Z', geofenceId: HOME, inYardSince: '2026-10-21T08:00:00.000Z' }, CLOSED)).toBeNull();
  });

  it('in the yard again with an arrival after the close is back_in_yard, with the arrival time', () => {
    expect(readyToGoYardMove({ locationAt: '2026-10-22T10:00:00.000Z', geofenceId: HOME, inYardSince: '2026-10-22T09:00:00.000Z' }, CLOSED))
      .toEqual({ kind: 'back_in_yard', at: '2026-10-22T09:00:00.000Z' });
  });

  it('an arrival stamped when D49 went live is not a real arrival', () => {
    expect(readyToGoYardMove({ locationAt: '2026-10-20T05:00:00.000Z', geofenceId: HOME, inYardSince: '2026-10-20T04:00:00.000Z' }, '2026-10-18T14:00:00.000Z')).toBeNull();
  });

  it('no Samsara, no GPS point or no close says nothing', () => {
    expect(readyToGoYardMove(null, CLOSED)).toBeNull();
    expect(readyToGoYardMove({ locationAt: null, geofenceId: null, inYardSince: null }, CLOSED)).toBeNull();
    expect(readyToGoYardMove({ locationAt: '2026-10-21T15:10:00.000Z', geofenceId: null, inYardSince: null }, null)).toBeNull();
  });
});
