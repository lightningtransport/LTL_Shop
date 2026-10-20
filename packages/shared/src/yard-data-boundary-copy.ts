/**
 * PD-locked EN/ES copy for Admin Yard Phase 1 cards (2026-09-21).
 *
 * FE owns labels, empty states, and the "No data" badge via this catalog (LTR-206: plain words, not UNAVAILABLE).
 * Nest `GET /api/admin/yard/data-boundary` may set optional section `message`
 * only for `unavailable` / `error`, using the English `unavailable` string.
 * Do not send empty-state or live labels from the API.
 *
 * Canonical English in ES UI (same as nav): Work Order, Jobs, Incoming Trucks.
 * D50: the third card is "Where trucks are · Samsara" (D49 places), no longer Dispatch's typed location.
 */
export type YardDataBoundaryLocale = 'en' | 'es';

export type YardDataBoundaryCardId =
  | 'workLocation'
  | 'incomingTrucks'
  | 'upcomingDepartures';

export type YardDataBoundaryCardCopy = {
  label: string;
  empty: string;
};

export const YARD_DATA_BOUNDARY_COPY = {
  en: {
    unavailable: 'Dispatch did not answer. The shop board is not affected; try again in a minute.',
    badge: 'No data',
    workLocation: {
      label: 'Where trucks are · Samsara',
      empty: 'No truck in our yard right now.',
    },
    incomingTrucks: {
      label: 'Incoming Trucks',
      empty: 'No incoming trucks.',
    },
    upcomingDepartures: {
      label: 'Upcoming Departures',
      empty: 'No upcoming departures.',
    },
  },
  es: {
    unavailable: 'Dispatch no respondió. El tablero del taller no se afecta; inténtalo de nuevo en un minuto.',
    badge: 'Sin datos',
    workLocation: {
      label: 'Dónde están · Samsara',
      empty: 'Ningún camión en nuestra yard ahora.',
    },
    incomingTrucks: {
      label: 'Incoming Trucks',
      empty: 'No hay Incoming Trucks.',
    },
    upcomingDepartures: {
      label: 'Salidas próximas',
      empty: 'No hay salidas próximas.',
    },
  },
} as const satisfies Record<
  YardDataBoundaryLocale,
  {
    unavailable: string;
    badge: string;
    workLocation: YardDataBoundaryCardCopy;
    incomingTrucks: YardDataBoundaryCardCopy;
    upcomingDepartures: YardDataBoundaryCardCopy;
  }
>;

/** English PD string Nest may put on `message` for unavailable/error sections. */
export const YARD_DATA_BOUNDARY_SECTION_MESSAGE =
  YARD_DATA_BOUNDARY_COPY.en.unavailable;
