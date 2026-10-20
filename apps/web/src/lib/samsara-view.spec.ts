import { describe, expect, it } from 'vitest';
import { isStaleLocation, shortLocation, yardPlaceText, isOpenWorkOrderStatus } from './samsara-view';
import { getAdminMessages } from './admin-messages-catalog';
import type { TruckSamsaraDto } from '@ltl-shop/shared';

describe('shortLocation (TL-4)', () => {
  it('keeps city and state and drops the street and ZIP', () => {
    expect(shortLocation('Pennsylvania Turnpike, Napier Township, PA, 15550')).toBe('Napier Township, PA');
    expect(shortLocation('11190 Baileyton Road, Greeneville, TN, 37745')).toBe('Greeneville, TN');
    expect(shortLocation('I 40, Van Buren, AR')).toBe('Van Buren, AR');
  });

  it('leaves a single place as it is and empties as null', () => {
    expect(shortLocation('LTL yard')).toBe('LTL yard');
    expect(shortLocation('  ')).toBeNull();
    expect(shortLocation(null)).toBeNull();
  });
});

describe('isStaleLocation (TL-7)', () => {
  const now = Date.parse('2026-10-14T18:00:00Z');
  it('is stale after a day without a new point', () => {
    expect(isStaleLocation('2026-10-09T18:00:00Z', now)).toBe(true);
    expect(isStaleLocation('2026-10-14T17:58:00Z', now)).toBe(false);
    expect(isStaleLocation(null, now)).toBe(false);
  });
});

describe('D49 (LTR-257): yardPlaceText', () => {
  const en = getAdminMessages('en');
  const es = getAdminMessages('es');
  const samsara = (geofenceId: string | null, inYardSince: string | null): TruckSamsaraDto => ({
    odometerMiles: null, odometerSource: null, odometerAt: null, address: null, latitude: null, longitude: null, speedMph: null,
    locationAt: '2026-10-19T15:00:00.000Z', geofenceId, geofenceName: null, inYardSince, syncedAt: null, lamps: null,
  });
  const now = new Date('2026-10-19T20:00:00.000Z');

  it('in our yard: In yard; with an open Work Order: In shop; the time alone on the same day', () => {
    expect(yardPlaceText(samsara('32418339', '2026-10-19T13:00:00.000Z'), false, 'en', en, now)).toMatch(/^In yard · since 9:00\sAM$/);
    expect(yardPlaceText(samsara('12839282', '2026-10-19T13:00:00.000Z'), true, 'en', en, now)).toMatch(/^In shop · in yard since 9:00\sAM$/);
    expect(yardPlaceText(samsara('12839282', '2026-10-19T13:00:00.000Z'), true, 'es', es, now)).toMatch(/^En el shop · en la yard desde 9:00/);
  });

  it('the date too when it arrived another day; no time when it is unknown', () => {
    expect(yardPlaceText(samsara('12839282', '2026-10-17T13:00:00.000Z'), false, 'en', en, now)).toMatch(/^In yard · since Oct 17, 9:00\sAM$/);
    expect(yardPlaceText(samsara('12839282', null), true, 'en', en, now)).toBe('In shop');
  });

  it('outside the yard nothing, even with an open Work Order', () => {
    expect(yardPlaceText(samsara('87934134', null), true, 'en', en, now)).toBeNull();
    expect(yardPlaceText(null, true, 'en', en, now)).toBeNull();
  });

  it('only created, in progress and paused Work Orders are open', () => {
    expect(['created', 'in_progress', 'waiting_paused'].map(isOpenWorkOrderStatus)).toEqual([true, true, true]);
    expect(['completed', 'cancelled', null].map(isOpenWorkOrderStatus)).toEqual([false, false, false]);
  });
});
