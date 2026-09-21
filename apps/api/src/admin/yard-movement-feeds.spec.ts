import { describe, expect, it } from 'vitest';
import {
  buildYardMovementFeeds,
  extractMovementRows,
  isReportedYardLocation,
  unavailableFeed,
} from './yard-movement-feeds';

describe('yard movement feeds', () => {
  it('treats 301 Yard as a reported shop location and streets as on-road', () => {
    expect(isReportedYardLocation('301 Yard')).toBe(true);
    expect(isReportedYardLocation('West Main Street, Woodville, OH')).toBe(false);
    expect(isReportedYardLocation('US 301, Bradford County, FL')).toBe(false);
  });

  it('includes open Work Orders and reported yard units, not a fleet-wide 301 Yard dump', () => {
    const shop = [
      { id: 'a', truckNumber: '600', yardLocation: '301 Yard', workOrders: [{ displayId: 'WO-1' }] },
      { id: 'b', truckNumber: '301', yardLocation: '301 Yard', workOrders: [] },
      { id: 'c', truckNumber: '612', yardLocation: '301 Yard', workOrders: [] },
      { id: 'd', truckNumber: '820', samsaraTruckLocation: 'West Main Street, Woodville, OH', workOrders: [] },
    ];
    for (let index = 0; index < 12; index += 1) {
      shop.push({
        id: `n${index}`,
        truckNumber: String(900 + index),
        yardLocation: '301 Yard',
        workOrders: [],
      });
    }

    const feeds = buildYardMovementFeeds({
      shop,
      reporting: { available: true, trucks: [{ unit: '835', yard_location: 'Shop' }], returns: [], driverPay: [] },
      now: new Date('2026-09-21T16:00:00.000Z'),
    });

    expect(feeds.workLocation.status).toBe('ok');
    expect(feeds.workLocation.items.map((item) => item.truckNumber)).toEqual(['600', '835']);
    expect(feeds.workLocation.items[0]).toMatchObject({ source: 'open_work_order', detail: 'WO-1' });
  });

  it('keeps incoming returns for today or later and drops trucks already in shop work', () => {
    const feeds = buildYardMovementFeeds({
      shop: [{ id: '600', truckNumber: '600', yardLocation: '301 Yard', workOrders: [{ displayId: 'WO-1' }] }],
      reporting: {
        available: true,
        trucks: [],
        returns: [
          { Truck: '600', Date: '2026-09-21', Driver: 'ALREADY HERE' },
          { unit: '602', return_date: '2026-09-20', drivers: 'YESTERDAY' },
          { truck_number: '609', Date: '2026-09-21', team: 'MARITZA HERNANDEZ' },
          { truck: '828', expected_date: '2026-09-22', driver: 'FRANCISCO' },
        ],
        driverPay: [],
      },
      now: new Date('2026-09-21T16:00:00.000Z'),
    });

    expect(feeds.incomingTrucks.items.map((item) => item.truckNumber)).toEqual(['609', '828']);
    expect(feeds.incomingTrucks.items[0].detail).toBe('MARITZA HERNANDEZ');
  });

  it('keeps upcoming departures only for the shop local day', () => {
    const feeds = buildYardMovementFeeds({
      shop: [],
      reporting: {
        available: true,
        trucks: [],
        returns: [],
        driverPay: [
          { unit: '614', 'Out Date': '2026-09-21', Driver: 'LEYDER ESTRADA' },
          { unit: '892', out_date: '2026-09-22', Driver: 'TOMORROW' },
          { unit: '100', out_date: '2026-09-20', Driver: 'YESTERDAY' },
        ],
      },
      now: new Date('2026-09-21T16:00:00.000Z'),
    });

    expect(feeds.upcomingDepartures.items.map((item) => item.truckNumber)).toEqual(['614']);
    expect(feeds.upcomingDepartures.total).toBe(1);
  });

  it('marks movement integrations unavailable when the reporting key is missing', () => {
    const feeds = buildYardMovementFeeds({
      shop: [{ id: '1', truckNumber: '600', workOrders: [{ displayId: 'WO-1' }] }],
      reporting: { available: false, trucks: null, returns: null, driverPay: null },
    });
    expect(feeds.incomingTrucks).toEqual(unavailableFeed());
    expect(feeds.upcomingDepartures).toEqual(unavailableFeed());
    expect(feeds.workLocation.items).toHaveLength(1);
  });

  it('keeps shop work when a reporting payload is missing after the key is present', () => {
    const feeds = buildYardMovementFeeds({
      shop: [{ id: '1', truckNumber: '600', workOrders: [{ displayId: 'WO-1' }] }],
      reporting: { available: true, trucks: null, returns: null, driverPay: [] },
    });
    expect(feeds.workLocation.items.map((item) => item.truckNumber)).toEqual(['600']);
    expect(feeds.incomingTrucks).toEqual(unavailableFeed('upstream_error'));
    expect(feeds.upcomingDepartures.status).toBe('ok');
    expect(feeds.upcomingDepartures.items).toEqual([]);
  });

  it('reads nested reporting arrays', () => {
    expect(extractMovementRows({ rows: [{ unit: '602', date: '2026-09-21' }] }).map((row) => row.truckNumber)).toEqual(['602']);
  });
});
