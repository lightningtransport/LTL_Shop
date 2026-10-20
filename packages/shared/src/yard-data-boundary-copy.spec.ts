import { describe, expect, it } from 'vitest';
import {
  YARD_DATA_BOUNDARY_COPY,
  YARD_DATA_BOUNDARY_SECTION_MESSAGE,
} from './yard-data-boundary-copy';

describe('Yard data-boundary PD copy', () => {
  it('locks EN/ES card labels, empty states, unavailable copy, and badges', () => {
    expect(YARD_DATA_BOUNDARY_COPY.en).toEqual({
      unavailable: 'Dispatch did not answer. The shop board is not affected; try again in a minute.',
      badge: 'No data',
      workLocation: { label: 'Where trucks are · Samsara', empty: 'No truck in our yard right now.' },
      incomingTrucks: { label: 'Incoming Trucks', empty: 'No incoming trucks.' },
      upcomingDepartures: { label: 'Upcoming Departures', empty: 'No upcoming departures.' },
    });
    expect(YARD_DATA_BOUNDARY_COPY.es).toEqual({
      unavailable: 'Dispatch no respondió. El tablero del taller no se afecta; inténtalo de nuevo en un minuto.',
      badge: 'Sin datos',
      workLocation: { label: 'Dónde están · Samsara', empty: 'Ningún camión en nuestra yard ahora.' },
      incomingTrucks: { label: 'Incoming Trucks', empty: 'No hay Incoming Trucks.' },
      upcomingDepartures: { label: 'Salidas próximas', empty: 'No hay salidas próximas.' },
    });
    expect(YARD_DATA_BOUNDARY_SECTION_MESSAGE).toBe('Dispatch did not answer. The shop board is not affected; try again in a minute.');
  });

  it('keeps Incoming Trucks in English in the ES catalog', () => {
    expect(YARD_DATA_BOUNDARY_COPY.es.incomingTrucks.label).toBe('Incoming Trucks');
    expect(YARD_DATA_BOUNDARY_COPY.es.incomingTrucks.empty).toContain('Incoming Trucks');
    expect(YARD_DATA_BOUNDARY_COPY.es.incomingTrucks.label).not.toMatch(/Llegadas/);
  });
});
