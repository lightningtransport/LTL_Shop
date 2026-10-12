import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages-catalog';
import { TRUCK_INFORMATION_COPY } from './truck-information-copy';

// PF12: the mechanic-side Truck fields read this small module; the Admin catalog spreads the same object in.
describe('TRUCK_INFORMATION_COPY', () => {
  it('is the single source for the Truck labels in both catalogs, in both languages', () => {
    for (const locale of ['en', 'es'] as const) {
      const catalog = getAdminMessages(locale);
      for (const [key, value] of Object.entries(TRUCK_INFORMATION_COPY[locale])) {
        expect(catalog[key as keyof typeof catalog]).toBe(value);
      }
    }
  });
});
