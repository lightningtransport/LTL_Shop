import { describe, expect, it } from 'vitest';
import {
  YARD_DATA_BOUNDARY_COPY,
  YARD_DATA_BOUNDARY_SECTION_MESSAGE,
} from './yard-data-boundary-copy';

describe('Yard data-boundary PD copy', () => {
  it('locks EN/ES card labels, empty states, unavailable copy, and badges', () => {
    expect(YARD_DATA_BOUNDARY_COPY.en).toEqual({
      unavailable: 'Data unavailable.',
      badge: 'UNAVAILABLE',
      workLocation: { label: 'Dispatch status', empty: 'No Dispatch status yet.' },
      incomingTrucks: { label: 'Incoming Trucks', empty: 'No incoming trucks.' },
      upcomingDepartures: { label: 'Upcoming Departures', empty: 'No upcoming departures.' },
    });
    expect(YARD_DATA_BOUNDARY_COPY.es).toEqual({
      unavailable: 'Datos no disponibles.',
      badge: 'NO DISPONIBLE',
      workLocation: { label: 'Estado de Dispatch', empty: 'Aún no hay estado de Dispatch.' },
      incomingTrucks: { label: 'Incoming Trucks', empty: 'No hay Incoming Trucks.' },
      upcomingDepartures: { label: 'Salidas próximas', empty: 'No hay salidas próximas.' },
    });
    expect(YARD_DATA_BOUNDARY_SECTION_MESSAGE).toBe('Data unavailable.');
  });

  it('keeps Incoming Trucks in English in the ES catalog', () => {
    expect(YARD_DATA_BOUNDARY_COPY.es.incomingTrucks.label).toBe('Incoming Trucks');
    expect(YARD_DATA_BOUNDARY_COPY.es.incomingTrucks.empty).toContain('Incoming Trucks');
    expect(YARD_DATA_BOUNDARY_COPY.es.incomingTrucks.label).not.toMatch(/Llegadas/);
  });
});
