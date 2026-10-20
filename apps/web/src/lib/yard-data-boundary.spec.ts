import { YARD_DATA_BOUNDARY_COPY } from '@ltl-shop/shared';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_YARD_DATA_BOUNDARY_PATH,
  formatYardBoundaryDrivers,
  yardDataBoundaryCardKind,
  yardDataBoundaryCopy,
} from './yard-data-boundary';

describe('Yard data-boundary FE mapping', () => {
  it('calls the Nest proxy path and never an agent-reporting URL', () => {
    expect(ADMIN_YARD_DATA_BOUNDARY_PATH).toBe('/api/admin/yard/data-boundary');
    expect(ADMIN_YARD_DATA_BOUNDARY_PATH).not.toMatch(/agent-reporting|supabase|x-agent-key/i);
  });

  it('uses PD-locked EN/ES copy from shared', () => {
    expect(yardDataBoundaryCopy('en')).toBe(YARD_DATA_BOUNDARY_COPY.en);
    expect(yardDataBoundaryCopy('es')).toBe(YARD_DATA_BOUNDARY_COPY.es);
    expect(yardDataBoundaryCopy('en').badge).toBe('No data');
    expect(yardDataBoundaryCopy('es').badge).toBe('Sin datos');
    expect(yardDataBoundaryCopy('es').incomingTrucks.label).toBe('Incoming Trucks');
    expect(yardDataBoundaryCopy('es').incomingTrucks.empty).toBe('No hay Incoming Trucks.');
    expect(yardDataBoundaryCopy('es').workLocation.label).toBe('Dónde están · Samsara');
    expect(yardDataBoundaryCopy('es').upcomingDepartures.label).toBe('Salidas próximas');
  });

  it('maps ok items, ok empty, unavailable, and error without inventing Presence', () => {
    expect(yardDataBoundaryCardKind({ status: 'ok', items: [{ truckNumber: '277' }] }, { loading: false, fetchFailed: false })).toBe('ok');
    expect(yardDataBoundaryCardKind({ status: 'ok', items: [] }, { loading: false, fetchFailed: false })).toBe('empty');
    expect(yardDataBoundaryCardKind({ status: 'unavailable', items: [] }, { loading: false, fetchFailed: false })).toBe('unavailable');
    expect(yardDataBoundaryCardKind({ status: 'error', items: [] }, { loading: false, fetchFailed: false })).toBe('unavailable');
    expect(yardDataBoundaryCardKind(undefined, { loading: true, fetchFailed: false })).toBe('loading');
    expect(yardDataBoundaryCardKind(undefined, { loading: false, fetchFailed: true })).toBe('unavailable');
    expect(yardDataBoundaryCardKind({ status: 'ok', items: [] }, { loading: true, fetchFailed: false })).toBe('loading');
  });

  it('joins driver display names only', () => {
    expect(formatYardBoundaryDrivers(['Ana', 'Luis'])).toBe('Ana, Luis');
    expect(formatYardBoundaryDrivers(['', 'Kai'])).toBe('Kai');
    expect(formatYardBoundaryDrivers(undefined)).toBe('');
  });
});
