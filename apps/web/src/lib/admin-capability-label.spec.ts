import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages-catalog';
import { adminCapabilityLabel } from './admin-messages';

describe('adminCapabilityLabel (LTR-169)', () => {
  it('names each capability for people, in both languages', () => {
    const en = getAdminMessages('en');
    const es = getAdminMessages('es');
    expect(adminCapabilityLabel('mechanic.standard', en)).toBe('Standard');
    expect(adminCapabilityLabel('mechanic.pm', en)).toBe('PM');
    expect(adminCapabilityLabel('admin.access', en)).toBe('Shop Admin');
    expect(adminCapabilityLabel('yard.operations.manage', es)).toBe('Patio');
    expect(adminCapabilityLabel('work_orders.manage', es)).toBe('Work Orders');
  });

  it('passes an unknown key through instead of hiding it', () => {
    expect(adminCapabilityLabel('reports.view', getAdminMessages('en'))).toBe('reports.view');
  });
});
