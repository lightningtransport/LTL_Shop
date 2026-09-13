import { describe, expect, it } from 'vitest';
import { normalizeTruckSearch, rankTruckSearchResults, truckSearchTier } from './truck-search';

const truck = (
  truckNumber: string,
  extra: { make?: string | null; model?: string | null; company?: string | null } = {},
) => ({
  truckNumber,
  make: extra.make ?? null,
  model: extra.model ?? null,
  company: extra.company ?? null,
});

describe('truck search ranking', () => {
  it('normalizes # and extra spaces without collapsing make/model queries', () => {
    expect(normalizeTruckSearch(' # 9 ')).toBe('9');
    expect(normalizeTruckSearch('Peterbilt 579')).toBe('peterbilt 579');
  });

  it('ranks query 9 as exact → prefix → rest', () => {
    const ranked = rankTruckSearchResults([
      truck('609'),
      truck('619'),
      truck('19'),
      truck('905'),
      truck('91'),
      truck('9'),
      truck('90'),
      truck('579', { model: '579' }),
    ], '9').map((item) => item.truckNumber);

    expect(ranked[0]).toBe('9');
    expect(ranked.slice(0, 4)).toEqual(['9', '90', '91', '905']);
    expect(ranked.indexOf('9')).toBeLessThan(ranked.indexOf('90'));
    expect(ranked.indexOf('905')).toBeLessThan(ranked.indexOf('609'));
    expect(ranked.indexOf('90')).toBeLessThan(ranked.indexOf('609'));
    expect(ranked.indexOf('609')).toBeLessThan(ranked.indexOf('619'));
    expect(ranked).toContain('19');
    expect(ranked).toContain('579');
  });

  it('never places contains matches above exact or prefix units', () => {
    const ranked = rankTruckSearchResults([
      truck('609'),
      truck('9'),
      truck('90'),
    ], ' 9').map((item) => item.truckNumber);

    expect(ranked).toEqual(['9', '90', '609']);
    expect(truckSearchTier(truck('9'), '9')).toBe('exact');
    expect(truckSearchTier(truck('90'), '9')).toBe('prefix');
    expect(truckSearchTier(truck('609'), '9')).toBe('rest');
  });

  it('keeps make/model contains search for non-numeric queries', () => {
    const ranked = rankTruckSearchResults([
      truck('609', { make: 'Volvo', model: 'VNL' }),
      truck('90', { make: 'Peterbilt', model: '579' }),
      truck('12', { make: 'Freightliner', model: 'Cascadia' }),
    ], 'Peterbilt');

    expect(ranked.map((item) => item.truckNumber)).toEqual(['90']);
    expect(rankTruckSearchResults([
      truck('609', { model: 'VNL' }),
      truck('12', { model: 'Cascadia' }),
    ], 'cascadia').map((item) => item.truckNumber)).toEqual(['12']);
  });

  it('reads nested admin truck summaries through a field getter', () => {
    const ranked = rankTruckSearchResults([
      { truck: truck('609') },
      { truck: truck('9') },
      { truck: truck('90') },
    ], '9', (item) => item.truck);

    expect(ranked.map((item) => item.truck.truckNumber)).toEqual(['9', '90', '609']);
  });
});
