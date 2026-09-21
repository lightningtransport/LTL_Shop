import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { YardDataBoundaryService } from './yard-data-boundary.service';
import {
  AGENT_REPORTING_UPSTREAM_ERROR_MESSAGE,
  MISSING_AGENT_REPORTING_KEY_MESSAGE,
} from './yard-data-boundary';
import { DEFAULT_AGENT_REPORTING_URL } from '../integrations/agent-reporting/agent-reporting.client';

const NOW = new Date('2026-09-21T16:00:00.000Z');

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('YardDataBoundaryService', () => {
  it('returns unavailable sections when AGENT_REPORTING_KEY is missing', async () => {
    const fetchImpl = vi.fn();
    const service = new YardDataBoundaryService(config({}));
    const dto = await service.get(NOW, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(dto.asOf).toBe(NOW.toISOString());
    expect(dto.windows.thisWeek).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(dto.workLocation).toEqual({
      status: 'unavailable',
      items: [],
      message: MISSING_AGENT_REPORTING_KEY_MESSAGE,
    });
    expect(dto.incomingTrucks.status).toBe('unavailable');
    expect(dto.upcomingDepartures.status).toBe('unavailable');
    expect(JSON.stringify(dto)).not.toMatch(/NEXT_PUBLIC/);
  });

  it('maps mocked agent-reporting pages into the FE contract', async () => {
    const fetchImpl = vi.fn(async (input: URL) => {
      const url = String(input);
      if (url.includes('report=trucks')) {
        return jsonResponse({
          data: [
            { truck_number: 277, yard_location: '301 Yard' },
            { truck_number: 905, yard_location: '301 Yard' },
          ],
          has_more: false,
          as_of: '2026-09-21T16:00:00.000Z',
        });
      }
      if (url.includes('report=returns')) {
        return jsonResponse({
          data: [
            { Truck: '277', 'Return Date': '2026-09-22', 'Driver Name': 'Ana' },
            { Truck: '277', 'Return Date': '2026-09-22', 'Driver Name': 'Luis' },
          ],
          has_more: false,
        });
      }
      if (url.includes('report=driver_pay')) {
        expect(url).toContain('out_from=2026-09-21');
        expect(url).toContain('out_to=2026-10-04');
        return jsonResponse({
          data: [{ Truck_Number: '905', 'Out Date': '2026-09-23', 'Driver Name': 'Kai' }],
          has_more: false,
        });
      }
      throw new Error(`unexpected URL ${url}`);
    });

    const service = new YardDataBoundaryService(
      config({ AGENT_REPORTING_KEY: 'server-only-key' }),
    );
    const dto = await service.get(NOW, fetchImpl as unknown as typeof fetch);

    expect(dto.workLocation).toEqual({
      status: 'ok',
      items: [
        { truckNumber: '277', location: '301 Yard' },
        { truckNumber: '905', location: '301 Yard' },
      ],
      summary: '301 Yard',
    });
    expect(dto.incomingTrucks).toEqual({
      status: 'ok',
      items: [
        {
          truckNumber: '277',
          returnDate: '2026-09-22',
          window: 'this_week',
          drivers: ['Ana', 'Luis'],
        },
      ],
    });
    expect(dto.upcomingDepartures.items).toEqual([
      {
        truckNumber: '905',
        outDate: '2026-09-23',
        window: 'this_week',
        drivers: ['Kai'],
      },
    ]);
    expect(JSON.stringify(dto)).not.toContain('server-only-key');
    expect(String(fetchImpl.mock.calls[0][0])).toContain(new URL(DEFAULT_AGENT_REPORTING_URL).host);
  });

  it('keeps HTTP 200-shaped error sections when one upstream report fails', async () => {
    const fetchImpl = vi.fn(async (input: URL) => {
      const url = String(input);
      if (url.includes('report=trucks')) {
        return jsonResponse({ error: 'boom' }, 500);
      }
      if (url.includes('report=returns')) {
        return jsonResponse({ data: [], has_more: false });
      }
      return jsonResponse({ data: [], has_more: false });
    });

    const service = new YardDataBoundaryService(
      config({ AGENT_REPORTING_KEY: 'server-only-key' }),
    );
    const dto = await service.get(NOW, fetchImpl as unknown as typeof fetch);

    expect(dto.workLocation).toEqual({
      status: 'error',
      items: [],
      message: AGENT_REPORTING_UPSTREAM_ERROR_MESSAGE,
    });
    expect(dto.incomingTrucks.status).toBe('ok');
    expect(dto.upcomingDepartures.status).toBe('ok');
    expect(JSON.stringify(dto)).not.toContain('server-only-key');
    expect(dto.workLocation.message).not.toContain('500');
  });
});
