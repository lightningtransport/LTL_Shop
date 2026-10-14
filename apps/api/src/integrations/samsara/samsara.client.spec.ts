import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SAMSARA_API_URL,
  SAMSARA_VEHICLES_PAGE_SIZE,
  SamsaraClient,
  SamsaraConfigError,
  SamsaraUpstreamError,
  getSamsaraConfig,
} from './samsara.client';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const config = { url: DEFAULT_SAMSARA_API_URL, token: 'samsara-secret', timeoutMs: 1_000 };

describe('getSamsaraConfig', () => {
  it('returns null when the server-only token is missing', () => {
    expect(getSamsaraConfig({})).toBeNull();
    expect(getSamsaraConfig({ SAMSARA_API_TOKEN: '  ' })).toBeNull();
  });

  it('uses the US host by default', () => {
    expect(getSamsaraConfig({ SAMSARA_API_TOKEN: 'samsara-secret' })).toEqual({
      url: 'https://api.samsara.com',
      token: 'samsara-secret',
      timeoutMs: 20_000,
    });
  });

  it('accepts the EU host and rejects a non-HTTPS one', () => {
    expect(getSamsaraConfig({ SAMSARA_API_TOKEN: 't', SAMSARA_API_URL: 'https://api.eu.samsara.com/' })?.url).toBe('https://api.eu.samsara.com');
    expect(() => getSamsaraConfig({ SAMSARA_API_TOKEN: 't', SAMSARA_API_URL: 'http://api.samsara.com' })).toThrow(SamsaraConfigError);
    expect(getSamsaraConfig({ SAMSARA_API_TOKEN: 't', SAMSARA_API_URL: 'http://127.0.0.1:3199' })?.url).toBe('http://127.0.0.1:3199');
  });

  it('rejects a timeout that is not a positive integer', () => {
    expect(() => getSamsaraConfig({ SAMSARA_API_TOKEN: 't', SAMSARA_TIMEOUT_MS: '0' })).toThrow(SamsaraConfigError);
  });
});

describe('SamsaraClient.listOdometers', () => {
  it('asks for both odometer types and prefers OBD over the GPS estimate', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { id: '1', obdOdometerMeters: { time: '2026-10-14T15:00:00Z', value: 1_609_344 } },
          { id: '2', gpsOdometerMeters: { time: '2026-10-14T14:00:00Z', value: 3_218_688 } },
          { id: '3', obdOdometerMeters: { time: 't', value: 0 } },
          { id: '4' },
        ],
        pagination: { endCursor: '', hasNextPage: false },
      }),
    );

    const odometers = await new SamsaraClient(config, fetchImpl as unknown as typeof fetch).listOdometers();

    const [url] = fetchImpl.mock.calls[0] as [URL];
    expect(url.pathname).toBe('/fleet/vehicles/stats');
    expect(url.searchParams.get('types')).toBe('obdOdometerMeters,gpsOdometerMeters');
    expect(odometers.get('1')).toEqual({ meters: 1_609_344, source: 'obd', at: '2026-10-14T15:00:00Z' });
    expect(odometers.get('2')).toEqual({ meters: 3_218_688, source: 'gps', at: '2026-10-14T14:00:00Z' });
    expect(odometers.has('3')).toBe(false);
    expect(odometers.has('4')).toBe(false);
  });
});

describe('SamsaraClient.listVehicles', () => {
  it('follows the cursor and sends the token only as a Bearer header', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: '281474977075805', name: '601', vin: '3AKJHHDR5MSMN1234' }],
          pagination: { endCursor: 'cursor-1', hasNextPage: true },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 281474977075806, name: ' 614 ', vin: '' }, { name: 'no id' }],
          pagination: { endCursor: '', hasNextPage: false },
        }),
      );

    const vehicles = await new SamsaraClient(config, fetchImpl as unknown as typeof fetch).listVehicles();

    expect(vehicles).toEqual([
      { id: '281474977075805', name: '601', vin: '3AKJHHDR5MSMN1234' },
      { id: '281474977075806', name: '614', vin: null },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    const [secondUrl] = fetchImpl.mock.calls[1] as [URL, RequestInit];
    expect(firstUrl.pathname).toBe('/fleet/vehicles');
    expect(firstUrl.searchParams.get('limit')).toBe(String(SAMSARA_VEHICLES_PAGE_SIZE));
    expect(firstUrl.searchParams.has('after')).toBe(false);
    expect(secondUrl.searchParams.get('after')).toBe('cursor-1');
    expect(firstUrl.toString()).not.toContain('samsara-secret');
    expect((firstInit.headers as Record<string, string>).Authorization).toBe('Bearer samsara-secret');
    expect(firstInit.method).toBe('GET');
  });

  it('marks a rejected token as unauthorized without echoing it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401));
    const error = await new SamsaraClient(config, fetchImpl as unknown as typeof fetch).listVehicles().catch((caught) => caught);

    expect(error).toBeInstanceOf(SamsaraUpstreamError);
    expect(error.unauthorized).toBe(true);
    expect(error.message).not.toContain('samsara-secret');
  });

  it('turns a network failure into an upstream error that is not unauthorized', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const error = await new SamsaraClient(config, fetchImpl as unknown as typeof fetch).listVehicles().catch((caught) => caught);

    expect(error).toBeInstanceOf(SamsaraUpstreamError);
    expect(error.unauthorized).toBe(false);
  });
});
