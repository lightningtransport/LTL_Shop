export const DEFAULT_SAMSARA_API_URL = 'https://api.samsara.com';

/** Samsara's maximum page size for `/fleet/vehicles`. */
export const SAMSARA_VEHICLES_PAGE_SIZE = 512;
/** 40 pages × 512 is far above the fleet; stops a cursor that never ends. */
export const SAMSARA_MAX_PAGES = 40;

export type SamsaraConfig = {
  url: string;
  token: string;
  timeoutMs: number;
};

export class SamsaraConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SamsaraConfigError';
  }
}

/** `status` 401/403 means Samsara rejected the token. Messages never carry the token. */
export class SamsaraUpstreamError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SamsaraUpstreamError';
  }

  get unauthorized() {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * D35 / P12: the token "LTL Shop" (Read Vehicles, Read Vehicle Statistics) is the API's server-only secret
 * `SAMSARA_API_TOKEN`. `SAMSARA_API_URL` exists for Samsara's EU host and a local stand-in.
 */
export function getSamsaraConfig(env: NodeJS.ProcessEnv = process.env): SamsaraConfig | null {
  const token = env.SAMSARA_API_TOKEN?.trim();
  if (!token) return null;

  const rawUrl = (env.SAMSARA_API_URL?.trim() || DEFAULT_SAMSARA_API_URL).replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SamsaraConfigError('SAMSARA_API_URL must be a valid URL');
  }
  // Plain HTTP only for a local stand-in (tests, the local demo); Samsara itself is always HTTPS.
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new SamsaraConfigError('SAMSARA_API_URL must use HTTPS');
  }

  const rawTimeout = env.SAMSARA_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout ? Number(rawTimeout) : 20_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new SamsaraConfigError('SAMSARA_TIMEOUT_MS must be a positive integer');
  }

  return { url: rawUrl, token, timeoutMs };
}

export type SamsaraVehicle = {
  id: string;
  name: string;
  vin: string | null;
};

export type SamsaraOdometer = {
  meters: number;
  source: 'obd' | 'gps';
  at: string;
};

export const METERS_PER_MILE = 1609.344;

/**
 * GET-only client for the Samsara REST API. The token is a header only: never put it in the URL, logs, errors or DTOs.
 */
export class SamsaraClient {
  constructor(
    private readonly config: SamsaraConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Every vehicle in the organization (`GET /fleet/vehicles`, cursor pagination). */
  async listVehicles(): Promise<SamsaraVehicle[]> {
    const vehicles: SamsaraVehicle[] = [];
    let after: string | null = null;

    for (let page = 0; page < SAMSARA_MAX_PAGES; page += 1) {
      const params: Record<string, string> = { limit: String(SAMSARA_VEHICLES_PAGE_SIZE) };
      if (after) params.after = after;
      const body = await this.get('/fleet/vehicles', params);
      const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
      for (const row of data) {
        const vehicle = toVehicle(row);
        if (vehicle) vehicles.push(vehicle);
      }
      const pagination = (body.pagination ?? {}) as Record<string, unknown>;
      const next = typeof pagination.endCursor === 'string' ? pagination.endCursor : '';
      if (!pagination.hasNextPage || !next) return vehicles;
      after = next;
    }

    return vehicles;
  }

  /**
   * Last known odometer per vehicle id (`GET /fleet/vehicles/stats`). D35: OBD first (the engine computer); the GPS
   * estimate only when the ECU reports none. A vehicle reports one or the other, so both types are asked for.
   */
  async listOdometers(): Promise<Map<string, SamsaraOdometer>> {
    const odometers = new Map<string, SamsaraOdometer>();
    let after: string | null = null;

    for (let page = 0; page < SAMSARA_MAX_PAGES; page += 1) {
      const params: Record<string, string> = { types: 'obdOdometerMeters,gpsOdometerMeters', limit: String(SAMSARA_VEHICLES_PAGE_SIZE) };
      if (after) params.after = after;
      const body = await this.get('/fleet/vehicles/stats', params);
      const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
      for (const row of data) {
        const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id).trim() : '';
        const odometer = reading(row.obdOdometerMeters, 'obd') ?? reading(row.gpsOdometerMeters, 'gps');
        if (id && odometer) odometers.set(id, odometer);
      }
      const pagination = (body.pagination ?? {}) as Record<string, unknown>;
      const next = typeof pagination.endCursor === 'string' ? pagination.endCursor : '';
      if (!pagination.hasNextPage || !next) return odometers;
      after = next;
    }

    return odometers;
  }

  private async get(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const url = new URL(`${this.config.url}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new SamsaraUpstreamError(`Samsara ${path} failed with HTTP ${response.status}`, response.status);
      }
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof SamsaraUpstreamError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SamsaraUpstreamError(`Samsara ${path} timed out`);
      }
      throw new SamsaraUpstreamError(`Samsara ${path} request failed`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function toVehicle(row: Record<string, unknown>): SamsaraVehicle | null {
  const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id).trim() : '';
  if (!id) return null;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const vin = typeof row.vin === 'string' && row.vin.trim() ? row.vin.trim() : null;
  return { id, name, vin };
}

function reading(value: unknown, source: SamsaraOdometer['source']): SamsaraOdometer | null {
  if (!value || typeof value !== 'object') return null;
  const { value: meters, time } = value as Record<string, unknown>;
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters <= 0) return null;
  return { meters, source, at: typeof time === 'string' ? time : '' };
}
