import { describe, expect, it } from 'vitest';
import { loadCanonicalPmParts } from '../../prisma/pm-parts';

function countsByCategory(parts: ReturnType<typeof loadCanonicalPmParts>) {
  return parts.reduce<Record<string, number>>((counts, part) => {
    counts[part.category] = (counts[part.category] ?? 0) + 1;
    return counts;
  }, {});
}

describe('PM parts CSV fixture', () => {
  const canonical = loadCanonicalPmParts();

  it('normalizes the source to 91 canonical filter records', () => {
    expect(canonical).toHaveLength(91);
    expect(new Set(canonical.map((part) => `${part.category}:${part.partNumber}:${part.displayName}`))).toHaveLength(91);
    expect(canonical.some((part) => part.partNumber === 'K37-1021')).toBe(true);
    expect(canonical.some((part) => part.partNumber === '20483578')).toBe(true);
  });

  it('preserves the source category distribution after normalization', () => {
    expect(countsByCategory(canonical)).toEqual({
      'Fuel Filter': 23,
      'Paper Fuel Filter': 13,
      'Cabin Air Filter': 10,
      'Engine Air Filter': 7,
      'Wiper Blades': 4,
      'Coolant Filter': 3,
      'Oil Filter 2 Unit': 11,
      'Oil Filter 1 Unit': 11,
      'Desiccant Filter': 9,
    });
  });

  it('infers truck makes without inventing fitment for generic rows', () => {
    expect(canonical.find((part) => part.partNumber === '2234788')?.fitments).toEqual([{ make: 'Peterbilt', model: null }]);
    expect(canonical.find((part) => part.partNumber === 'WIX WF10447')?.fitments).toEqual([{ make: 'Volvo', model: null }]);
    expect(canonical.find((part) => part.partNumber === '21707135')?.fitments).toEqual([{ make: 'Mack', model: null }]);
    expect(canonical.find((part) => part.partNumber === 'WL10663')?.fitments).toEqual([{ make: 'Freightliner', model: 'Cascadia' }]);
    expect(canonical.find((part) => part.partNumber === 'LFF8059')?.fitments).toEqual([]);
  });

  it('keeps same-code variants while collapsing the exact inactive duplicate', () => {
    const byCode = (code: string) => canonical.filter((part) => part.partNumber === code);
    expect(byCode('L9765FXL')).toHaveLength(1);
    expect(byCode('WIX WF10755')).toHaveLength(2);
    expect(byCode('WF10678')).toHaveLength(2);
    expect(byCode('K37-1021')).toHaveLength(1);
  });
});
