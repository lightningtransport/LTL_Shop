import { describe, expect, it } from 'vitest';
import { normalizeTruckSearch, rankTruckResults } from './truck-search';

const truck = (
  truckNumber: string,
  extra: { make?: string | null; model?: string | null; company?: string | null } = {},
) => ({
  truckNumber,
  make: extra.make ?? null,
  model: extra.model ?? null,
  company: extra.company ?? null,
});

describe('rankTruckResults', () => {
  it('normalizes # without collapsing make/model queries', () => {
    expect(normalizeTruckSearch(' # 9 ')).toBe('9');
    expect(normalizeTruckSearch('Peterbilt 579')).toBe('peterbilt 579');
  });

  it('ranks query 9 as exact → prefix → rest', () => {
    const { results, isFallback } = rankTruckResults([
      truck('609'),
      truck('619'),
      truck('19'),
      truck('905'),
      truck('91'),
      truck('9'),
      truck('90'),
      truck('579', { model: '579' }),
    ], '9');
    const numbers = results.map((item) => item.truckNumber);

    expect(isFallback).toBe(false);
    expect(numbers[0]).toBe('9');
    expect(numbers.slice(0, 4)).toEqual(['9', '90', '91', '905']);
    expect(numbers.indexOf('905')).toBeLessThan(numbers.indexOf('609'));
    expect(numbers.indexOf('90')).toBeLessThan(numbers.indexOf('609'));
    expect(numbers).toContain('19');
    expect(numbers).toContain('579');
  });

  it('never places contains matches above exact or prefix units', () => {
    expect(rankTruckResults([
      truck('609'),
      truck('9'),
      truck('90'),
    ], ' 9').results.map((item) => item.truckNumber)).toEqual(['9', '90', '609']);
  });

  it('keeps make/model contains search for non-numeric queries', () => {
    expect(rankTruckResults([
      truck('609', { make: 'Volvo', model: 'VNL' }),
      truck('90', { make: 'Peterbilt', model: '579' }),
      truck('12', { make: 'Freightliner', model: 'Cascadia' }),
    ], 'Peterbilt').results.map((item) => item.truckNumber)).toEqual(['90']);
    expect(rankTruckResults([
      truck('609', { model: 'VNL' }),
      truck('12', { model: 'Cascadia' }),
    ], 'cascadia').results.map((item) => item.truckNumber)).toEqual(['12']);
  });
});
