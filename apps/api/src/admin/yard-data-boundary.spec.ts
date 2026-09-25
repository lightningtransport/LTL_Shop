import { describe, expect, it } from 'vitest';
import {
  classifyMovementWindow,
  dominateWorkLocation,
  mapIncomingTrucks,
  mapUpcomingDepartures,
  mapWorkLocationItems,
  pickField,
  toIsoDate,
} from './yard-data-boundary';

const windows = {
  timeZone: 'America/New_York' as const,
  today: '2026-09-21',
  thisWeek: { from: '2026-09-21', to: '2026-09-27' },
  nextWeek: { from: '2026-09-28', to: '2026-10-04' },
};

describe('yard data-boundary mappers', () => {
  it('reads kit field names including spaces', () => {
    expect(pickField({ 'Return Date': '2026-09-22' }, ['Return Date'])).toBe('2026-09-22');
    expect(pickField({ Truck_Number: '277' }, ['Truck_Number', 'Truck'])).toBe('277');
    expect(toIsoDate('2026-09-22T00:00:00.000Z')).toBe('2026-09-22');
    expect(toIsoDate('9/22/2026')).toBe('2026-09-22');
  });

  it('keeps only trucks with a non-empty yard_location and summarizes a majority', () => {
    const mapped = mapWorkLocationItems([
      { truck_number: 202, yard_location: 'Vendor' },
      { truck_number: 101, yard_location: '301 Yard' },
      { truck_number: 303, yard_location: '301 Yard' },
      { truck_number: 404, yard_location: '   ' },
      { truck_number: 505 },
    ]);
    expect(mapped.items).toEqual([
      { truckNumber: '101', location: '301 Yard' },
      { truckNumber: '202', location: 'Vendor' },
      { truckNumber: '303', location: '301 Yard' },
    ]);
    expect(mapped.summary).toBe('301 Yard');
  });

  it('omits a work-location summary when no location dominates', () => {
    expect(
      dominateWorkLocation([
        { truckNumber: '1', location: '301 Yard' },
        { truckNumber: '2', location: 'Vendor' },
      ]),
    ).toBeUndefined();
  });

  it('collapses returns driver rows to distinct trucks in the default window', () => {
    const items = mapIncomingTrucks(
      [
        { Truck: '277', 'Return Date': '2026-09-22', 'Driver Name': 'Ana' },
        { Truck: '277', 'Return Date': '2026-09-23', 'Driver Name': 'Luis' },
        { Truck: '905', 'Return Date': null, 'First Name': 'Pat', 'Last Name': 'Lee' },
        { Truck: '922', 'Return Date': '2026-09-10', 'Driver Name': 'Too early' },
        { Truck: '968', 'Return Date': '2026-09-29', 'Driver Name': 'Next week' },
        { Truck: '277', 'Phone Number': '555-0100', CDL: 'X' },
      ],
      windows,
    );

    expect(items).toEqual([
      {
        truckNumber: '277',
        returnDate: '2026-09-22',
        window: 'this_week',
        drivers: ['Ana', 'Luis'],
      },
      {
        truckNumber: '968',
        returnDate: '2026-09-29',
        window: 'next_week',
        drivers: ['Next week'],
      },
      {
        truckNumber: '905',
        returnDate: null,
        window: 'undated',
        drivers: ['Pat Lee'],
      },
    ]);
    expect(JSON.stringify(items)).not.toContain('555-0100');
    expect(JSON.stringify(items)).not.toContain('"X"');
  });

  it('collapses driver_pay Out Date rows to distinct trucks', () => {
    const items = mapUpcomingDepartures(
      [
        { Truck_Number: '101', 'Out Date': '2026-09-21', 'Driver Name': 'A' },
        { Truck_Number: '101', 'Out Date': '2026-09-21', 'Driver Name': 'B' },
        { Truck_Number: '202', 'Out Date': '2026-10-01' },
        { Truck_Number: '303', 'Out Date': '2026-09-01', 'Driver Name': 'Past' },
      ],
      windows,
    );
    expect(items.map((item) => item.truckNumber)).toEqual(['101', '202']);
    expect(items[0]).toMatchObject({
      outDate: '2026-09-21',
      window: 'this_week',
      drivers: ['A', 'B'],
    });
    expect(classifyMovementWindow('2026-10-01', windows)).toBe('next_week');
  });
});

describe('Upcoming Departures hides past dates (LTR-93)', () => {
  it('drops departures before shop-local today but keeps today and later', () => {
    const items = mapUpcomingDepartures([
      { Truck_Number: '614', 'Out Date': '2026-09-21' },
      { Truck_Number: '906', 'Out Date': '2026-09-23' },
      { Truck_Number: '830', 'Out Date': '2026-09-24' },
      { Truck_Number: '888', 'Out Date': '2026-09-29' },
    ], { ...windows, today: '2026-09-24' });
    expect(items.map((item) => item.truckNumber)).toEqual(['830', '888']);
  });
});
