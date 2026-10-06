import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { YARD_DATA_BOUNDARY_SECTION_MESSAGE } from '@ltl-shop/shared';
import { YardDataBoundaryService } from './yard-data-boundary.service';
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
      message: YARD_DATA_BOUNDARY_SECTION_MESSAGE,
    });
    expect(dto.incomingTrucks.status).toBe('unavailable');
    expect(dto.upcomingDepartures.status).toBe('unavailable');
    expect(dto.workLocation.message).toBe('Data unavailable.');
    expect(JSON.stringify(dto)).not.toMatch(/NEXT_PUBLIC/);
    expect(JSON.stringify(dto)).not.toContain('AGENT_REPORTING_KEY');
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
    expect(dto.workLocation.message).toBeUndefined();
    expect(dto.incomingTrucks.message).toBeUndefined();
    expect(dto.upcomingDepartures.message).toBeUndefined();
    expect(JSON.stringify(dto)).not.toContain('server-only-key');
    expect(String(fetchImpl.mock.calls[0][0])).toContain(new URL(DEFAULT_AGENT_REPORTING_URL).host);
  });

  it('Stage 6 (D8): adds the shop side of each Truck Dispatch names — link, open Work Order, out of shop', async () => {
    const fetchImpl = vi.fn(async (input: URL) => {
      const url = String(input);
      if (url.includes('report=trucks')) return jsonResponse({ data: [{ truck_number: 277, yard_location: 'Outside' }], has_more: false });
      if (url.includes('report=returns')) return jsonResponse({ data: [{ Truck: '905', 'Return Date': '2026-09-22' }], has_more: false });
      return jsonResponse({ data: [], has_more: false });
    });
    const findMany = vi.fn().mockResolvedValue([
      { id: 't-277', truckNumber: '277', workOrders: [{ id: 'wo-1', displayId: 'WO-001', jobs: [] }] },
      { id: 't-905', truckNumber: '905', workOrders: [] },
    ]);
    const service = new YardDataBoundaryService(config({ AGENT_REPORTING_KEY: 'server-only-key' }), { truck: { findMany } } as never);
    const dto = await service.get(NOW, fetchImpl as unknown as typeof fetch);

    expect(findMany.mock.calls[0][0].where).toEqual({ truckNumber: { in: ['277', '905'] } });
    expect(dto.shop).toEqual([
      { truckNumber: '277', truckId: 't-277', openWorkOrder: { id: 'wo-1', displayId: 'WO-001' }, outOfShop: false, phase: null, readyToGo: false, jobsLeft: 0 },
      { truckNumber: '905', truckId: 't-905', openWorkOrder: null, outOfShop: false, phase: null, readyToGo: false, jobsLeft: 0 },
    ]);
  });

  it('Stage 8: the shop side carries the Work Plan step, Ready to Go and Jobs left from the Yard', async () => {
    const fetchImpl = vi.fn(async (input: URL) => {
      const url = String(input);
      if (url.includes('report=trucks')) return jsonResponse({ data: [{ truck_number: 277, yard_location: '301 Yard' }, { truck_number: 601, yard_location: '301 Yard' }], has_more: false });
      return jsonResponse({ data: [], has_more: false });
    });
    const findMany = vi.fn().mockResolvedValue([
      { id: 't-277', truckNumber: '277', workOrders: [{ id: 'wo-1', displayId: 'WO-001', jobs: [] }] },
      { id: 't-601', truckNumber: '601', workOrders: [] },
    ]);
    const yard = { shopStatusByTruckNumber: vi.fn().mockResolvedValue(new Map([
      ['277', { phase: 'pm', readyToGo: false, jobsLeft: 3 }],
      ['601', { phase: 'ready_to_go', readyToGo: true, jobsLeft: 0 }],
    ])) };
    const service = new YardDataBoundaryService(config({ AGENT_REPORTING_KEY: 'server-only-key' }), { truck: { findMany } } as never, yard as never);
    const dto = await service.get(NOW, fetchImpl as unknown as typeof fetch);
    expect(yard.shopStatusByTruckNumber).toHaveBeenCalledWith(['277', '601']);
    expect(dto.shop).toEqual([
      expect.objectContaining({ truckNumber: '277', phase: 'pm', readyToGo: false, jobsLeft: 3 }),
      expect.objectContaining({ truckNumber: '601', phase: 'ready_to_go', readyToGo: true, jobsLeft: 0 }),
    ]);
  });

  it('Stage 6: Dispatch still answers when the shop lookup fails', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [{ truck_number: 277, yard_location: 'Outside' }], has_more: false }));
    const findMany = vi.fn().mockRejectedValue(new Error('db down'));
    const service = new YardDataBoundaryService(config({ AGENT_REPORTING_KEY: 'server-only-key' }), { truck: { findMany } } as never);
    const dto = await service.get(NOW, fetchImpl as unknown as typeof fetch);
    expect(dto.workLocation.status).toBe('ok');
    expect(dto.shop).toBeUndefined();
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
      message: YARD_DATA_BOUNDARY_SECTION_MESSAGE,
    });
    expect(dto.incomingTrucks).toEqual({ status: 'ok', items: [] });
    expect(dto.upcomingDepartures).toEqual({ status: 'ok', items: [] });
    expect(dto.incomingTrucks.message).toBeUndefined();
    expect(JSON.stringify(dto)).not.toContain('server-only-key');
    expect(dto.workLocation.message).toBe('Data unavailable.');
    expect(dto.workLocation.message).not.toContain('500');
  });
});
