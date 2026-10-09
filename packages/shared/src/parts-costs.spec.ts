import { describe, expect, it } from 'vitest';
import { adminCreateVendorSchema, centsToInput, formatCents, parseMoneyToCents, partFitsTruck } from './parts-costs';

describe('money as cents (LTR-200 / D-PC1)', () => {
  it('reads what the Manager types', () => {
    expect(parseMoneyToCents('1,250.00')).toBe(125000);
    expect(parseMoneyToCents('$1250')).toBe(125000);
    expect(parseMoneyToCents('12.5')).toBe(1250);
    expect(parseMoneyToCents('0.07')).toBe(7);
    expect(parseMoneyToCents('  ')).toBeNull();
  });

  it('refuses what is not an amount', () => {
    expect(parseMoneyToCents('12.345')).toBeUndefined();
    expect(parseMoneyToCents('-5')).toBeUndefined();
    expect(parseMoneyToCents('abc')).toBeUndefined();
    expect(parseMoneyToCents('99999999999')).toBeUndefined();
  });

  it('shows cents as dollars', () => {
    expect(formatCents(125000)).toBe('$1,250.00');
    expect(centsToInput(2410)).toBe('24.10');
    expect(centsToInput(null)).toBe('');
  });
});

describe('partFitsTruck (HU-PM1)', () => {
  const cascadia = { make: 'Freightliner', model: 'Cascadia' };
  it('no rows fit every truck; a make fits its trucks; a model narrows it', () => {
    expect(partFitsTruck([], cascadia)).toBe(true);
    expect(partFitsTruck([{ make: 'freightliner', model: null }], cascadia)).toBe(true);
    expect(partFitsTruck([{ make: 'Freightliner', model: 'M2' }], cascadia)).toBe(false);
    expect(partFitsTruck([{ make: 'Volvo', model: null }], cascadia)).toBe(false);
  });
});

describe('vendor form', () => {
  it('needs parts, repairs or both; an empty email is no email', () => {
    expect(adminCreateVendorSchema.safeParse({ name: 'Diesel Pro', doesParts: false, doesRepairs: false }).success).toBe(false);
    expect(adminCreateVendorSchema.parse({ name: 'Diesel Pro', doesRepairs: true, email: '' }).email).toBeNull();
  });
});
