import { describe, expect, it } from 'vitest';
import { YardPresenceState } from './enums';
import { SAMSARA_YARD_GEOFENCE_IDS, isYardGeofence, truckPlace, truckPresence } from './samsara';

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
