import { describe, expect, it } from 'vitest';
import { describeTarget, resolveDemoTarget } from './resolve-target';

const trucks = [
  { id: 'T605', truckNumber: '605', openWorkOrder: { id: 'WO605' } },
  { id: 'T973', truckNumber: '973', openWorkOrder: null },
];

describe('resolveDemoTarget (D36)', () => {
  it('maps a unit number to the Admin and mechanic routes', () => {
    expect(resolveDemoTarget({ kind: 'path', path: '/qc?tab=done' }, trucks)).toEqual({ path: '/qc?tab=done' });
    expect(resolveDemoTarget({ kind: 'adminTruck', unit: '605' }, trucks)).toEqual({ path: '/admin/trucks/T605' });
    expect(resolveDemoTarget({ kind: 'adminTruck', unit: '605', tab: 'costs' }, trucks)).toEqual({ path: '/admin/trucks/T605?tab=costs' });
    expect(resolveDemoTarget({ kind: 'adminWorkOrder', unit: '605' }, trucks)).toEqual({ path: '/admin/work-orders/WO605' });
    expect(resolveDemoTarget({ kind: 'workOrder', unit: '605' }, trucks)).toEqual({ path: '/work-orders/WO605' });
    expect(resolveDemoTarget({ kind: 'workOrder', unit: '605', view: 'pm' }, trucks)).toEqual({ path: '/work-orders/WO605?view=pm' });
    expect(resolveDemoTarget({ kind: 'truckHistory', unit: '605' }, trucks)).toEqual({ path: '/trucks/T605/history' });
  });

  it('says what is missing instead of navigating', () => {
    expect(resolveDemoTarget({ kind: 'adminTruck', unit: '999' }, trucks)).toEqual({ error: 'truck_not_found', unit: '999' });
    expect(resolveDemoTarget({ kind: 'adminWorkOrder', unit: '973' }, trucks)).toEqual({ error: 'no_open_work_order', unit: '973' });
    expect(resolveDemoTarget({ kind: 'workOrder', unit: '973' }, trucks)).toEqual({ error: 'no_open_work_order', unit: '973' });
  });

  it('describes a target for the step card', () => {
    expect(describeTarget({ kind: 'adminTruck', unit: '611', tab: 'costs' })).toBe('Truck 611 · Costs');
    expect(describeTarget({ kind: 'workOrder', unit: '968', view: 'pm' })).toBe('Work Order of 968 (PM)');
    expect(describeTarget({ kind: 'path', path: '/admin' })).toBe('/admin');
  });
});
