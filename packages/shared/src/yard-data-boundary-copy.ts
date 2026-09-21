/**
 * PD-locked EN/ES copy for Admin Yard Phase 1 cards (2026-09-21).
 *
 * FE owns labels, empty states, and the UNAVAILABLE badge via this catalog.
 * Nest `GET /api/admin/yard/data-boundary` may set optional section `message`
 * only for `unavailable` / `error`, using the English `unavailable` string.
 * Do not send empty-state or live labels from the API.
 *
 * Canonical English in ES UI (same as nav): Work Order, Jobs, Incoming Trucks.
 * Presence / geofence stays out of scope.
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
    unavailable: 'Data unavailable.',
    badge: 'UNAVAILABLE',
    workLocation: {
      label: 'Work location',
      empty: 'No work location yet.',
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
    unavailable: 'Datos no disponibles.',
    badge: 'NO DISPONIBLE',
    workLocation: {
      label: 'Ubicación de trabajo',
      empty: 'Aún no hay ubicación de trabajo.',
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
