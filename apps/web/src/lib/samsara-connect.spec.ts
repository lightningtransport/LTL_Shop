import { describe, expect, it } from 'vitest';
import { needsComparison, samsaraFieldRows } from './samsara-connect';

const vehicle = { vin: '3akj-hhdr5msmn1234', make: 'Freightliner', model: 'Cascadia', year: 2021, licensePlate: null };

describe('samsaraFieldRows (D44 §4)', () => {
  it('marks what Samsara fills, what is the same and what differs', () => {
    const rows = samsaraFieldRows({ vin: '3AKJHHDR5MSMN1234', make: 'freightliner', model: null, year: 2020, licensePlate: 'TX 1' }, vehicle);
    expect(rows.map((row) => [row.field, row.state])).toEqual([
      ['vin', 'same'], ['make', 'same'], ['model', 'fill'], ['year', 'differ'], ['licensePlate', 'none'],
    ]);
    expect(needsComparison(rows)).toBe(true);
  });

  it('connects in one tap when nothing differs', () => {
    const rows = samsaraFieldRows({ vin: null, make: 'Freightliner', model: '', year: null, licensePlate: null }, vehicle);
    expect(needsComparison(rows)).toBe(false);
    expect(rows.filter((row) => row.state === 'fill').map((row) => row.field)).toEqual(['vin', 'model', 'year']);
  });
});
