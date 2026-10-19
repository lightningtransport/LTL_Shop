import { describe, expect, it } from 'vitest';
import { YardPresenceState } from './enums';
import { SAMSARA_SHOP_GEOFENCE_IDS, isShopGeofence, truckPresence } from './samsara';

describe('D49: In shop from the Samsara geofence', () => {
  it('the shop is the Home Office geofence, by id', () => {
    expect(SAMSARA_SHOP_GEOFENCE_IDS).toEqual(['12839282']);
    expect(isShopGeofence('12839282')).toBe(true);
    expect(isShopGeofence('32418339')).toBe(false);
    expect(isShopGeofence(null)).toBe(false);
  });

  it('inside the shop geofence is IN_YARD with its arrival time', () => {
    expect(truckPresence({ locationAt: '2026-10-19T15:00:00.000Z', geofenceId: '12839282', inShopSince: '2026-10-19T13:00:00.000Z' })).toEqual({
      state: YardPresenceState.IN_YARD, provenance: 'samsara_geofence', since: '2026-10-19T13:00:00.000Z', at: '2026-10-19T15:00:00.000Z',
    });
  });

  it('another geofence or none is OUTSIDE_YARD; no GPS point or no Samsara is UNKNOWN', () => {
    expect(truckPresence({ locationAt: '2026-10-19T15:00:00.000Z', geofenceId: '32418339', inShopSince: null }).state).toBe(YardPresenceState.OUTSIDE_YARD);
    expect(truckPresence({ locationAt: '2026-10-19T15:00:00.000Z', geofenceId: null, inShopSince: null }).state).toBe(YardPresenceState.OUTSIDE_YARD);
    expect(truckPresence({ locationAt: null, geofenceId: null, inShopSince: null }).state).toBe(YardPresenceState.UNKNOWN);
    expect(truckPresence(null)).toEqual({ state: YardPresenceState.UNKNOWN, provenance: 'phase_1_unavailable' });
  });

  it('an old reading keeps its answer (a parked truck stops reporting)', () => {
    expect(truckPresence({ locationAt: '2026-10-10T15:00:00.000Z', geofenceId: '12839282', inShopSince: '2026-10-10T13:00:00.000Z' }).state).toBe(YardPresenceState.IN_YARD);
  });
});
