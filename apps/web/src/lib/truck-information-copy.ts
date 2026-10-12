/**
 * PF12: the nine labels of the Truck information block. `TruckInformationFields` renders on mechanic screens
 * too, so it reads these directly instead of the Admin catalog (2 995 lines) that used to ride into every
 * bundle for them. The Admin catalog spreads the same object in, so there is still one source of truth.
 */
export const TRUCK_INFORMATION_COPY = {
  en: {
    make: 'Make',
    model: 'Model',
    year: 'Year',
    mileage: 'Mileage',
    company: 'Company',
    owner: 'Owner',
    vin: 'VIN',
    lastReportedLocation: 'Last reported location',
    locationUpdatedOn: 'Last reported on',
  },
  es: {
    make: 'Marca',
    model: 'Modelo',
    year: 'Año',
    mileage: 'Millaje',
    company: 'Empresa',
    owner: 'Propietario',
    vin: 'VIN',
    lastReportedLocation: 'Ubicación reportada',
    locationUpdatedOn: 'Reportada el',
  },
} as const;
