import { describe, expect, it } from 'vitest';
import {
  truckInformationFieldClass,
  truckInformationGridClass,
  truckInformationLongFieldClass,
} from './truck-information-layout';

describe('TruckInformationFields layout', () => {
  it('uses a 2-column grid on small screens and 3 columns only from md up', () => {
    expect(truckInformationGridClass).toMatch(/\bgrid-cols-2\b/);
    expect(truckInformationGridClass).toMatch(/\bmd:grid-cols-3\b/);
    expect(truckInformationGridClass).not.toMatch(/(?:^|[\s"])grid-cols-3\b/);
  });

  it('keeps field values inside their cells', () => {
    expect(truckInformationFieldClass).toMatch(/\bmin-w-0\b/);
    expect(truckInformationFieldClass).toMatch(/\boverflow-hidden\b/);
  });

  it('stacks VIN and location to full width below md', () => {
    expect(truckInformationLongFieldClass).toMatch(/\bcol-span-2\b/);
    expect(truckInformationLongFieldClass).toMatch(/\bmd:col-span-1\b/);
    expect(truckInformationLongFieldClass).toMatch(/\bmin-w-0\b/);
    expect(truckInformationLongFieldClass).toMatch(/\boverflow-hidden\b/);
  });
});
