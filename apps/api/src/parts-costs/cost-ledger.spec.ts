import { describe, expect, it } from 'vitest';
import { allocateExtra, truckAmounts } from './cost-ledger';

describe('allocateExtra (D-PC2)', () => {
  it('shares tax and freight by lines and always adds up to the cents given', () => {
    const shares = allocateExtra([{ truckId: 'a', baseCents: 1000 }, { truckId: 'b', baseCents: 2000 }, { truckId: null, baseCents: 1000 }], 101);
    expect([shares.get('a'), shares.get('b'), shares.get(null)]).toEqual([25, 51, 25]);
    expect([...shares.values()].reduce((sum, value) => sum + value, 0)).toBe(101);
  });

  it('the cent left goes to the biggest group', () => {
    const shares = allocateExtra([{ truckId: 'a', baseCents: 1 }, { truckId: 'b', baseCents: 2 }], 1);
    expect([shares.get('a'), shares.get('b')]).toEqual([0, 1]);
  });

  it('no extra, nothing to share; a zero subtotal puts it all on one group', () => {
    expect(allocateExtra([{ truckId: 'a', baseCents: 500 }], 0).get('a')).toBe(0);
    expect(allocateExtra([{ truckId: 'a', baseCents: 0 }], 300).get('a')).toBe(300);
  });
});

describe('truckAmounts', () => {
  it('groups lines by truck and the trucks plus "no truck" equal the invoice total', () => {
    const lines = [
      { truckId: '606', lineTotalCents: 4820 },
      { truckId: '918', lineTotalCents: 3100 },
      { truckId: '606', lineTotalCents: 1999 },
      { truckId: null, lineTotalCents: 12550 },
    ];
    const amounts = truckAmounts(lines, 1733);
    const total = lines.reduce((sum, line) => sum + line.lineTotalCents, 0) + 1733;
    expect(amounts.reduce((sum, row) => sum + row.amountCents, 0)).toBe(total);
    expect(amounts.find((row) => row.truckId === '606')!.amountCents).toBeGreaterThan(6819);
  });
});
