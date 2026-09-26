import { describe, expect, it } from 'vitest';
import { jobCategoriesLine, liveLaborMs, vehicleLine } from './work-order-identity';

describe('work order identity (LTR-130 / LTR-131)', () => {
  it('describes the Truck by year, make and model', () => {
    expect(vehicleLine({ year: 2026, make: 'Volvo', model: 'VNL 860' })).toBe('2026 Volvo VNL 860');
    expect(vehicleLine({ year: null, make: null, model: null })).toBe('');
    expect(vehicleLine(undefined)).toBe('');
  });

  it('lists distinct Job categories and skips cancelled Jobs', () => {
    expect(jobCategoriesLine([
      { status: 'to_do', category: { name: 'DPF/DEF' } },
      { status: 'completed', category: { name: 'Tires & Wheels' } },
      { status: 'to_do', category: { name: 'DPF/DEF' } },
      { status: 'cancelled', category: { name: 'Engine' } },
    ])).toBe('DPF/DEF, Tires & Wheels');
  });

  it('adds elapsed time only while labor is running', () => {
    expect(liveLaborMs(60_000, true, 1_000, 31_000)).toBe(90_000);
    expect(liveLaborMs(60_000, false, 1_000, 31_000)).toBe(60_000);
  });
});
