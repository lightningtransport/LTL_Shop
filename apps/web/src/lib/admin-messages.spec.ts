import { describe, expect, it } from 'vitest';
import { adminCountLabel } from './admin-messages';
import { getAdminMessages } from './admin-messages-catalog';

describe('adminCountLabel (DM3, LTR-204)', () => {
  it('uses the singular text for exactly one and the plural with the count otherwise', () => {
    const en = getAdminMessages('en');
    expect(adminCountLabel(1, en.shopWorkflowMemberOpenWorkOne, en.shopWorkflowMemberOpenWork)).toBe('1 open Work Order');
    expect(adminCountLabel(3, en.shopWorkflowMemberOpenWorkOne, en.shopWorkflowMemberOpenWork)).toBe('3 open Work Orders');
    expect(adminCountLabel(0, en.pcVendorPartCountValueOne, en.pcVendorPartCountValue)).toBe('0 parts');
    expect(adminCountLabel(1, en.pcVendorPartCountValueOne, en.pcVendorPartCountValue)).toBe('1 part');
    expect(adminCountLabel(1, en.pcLinesCountOne, en.pcLinesCount)).toBe('1 line');
    expect(adminCountLabel(2, en.pcLinesCountOne, en.pcLinesCount)).toBe('2 lines');
  });

  it('reads both forms from the ES catalog too', () => {
    const es = getAdminMessages('es');
    expect(adminCountLabel(1, es.shopWorkflowMemberOpenWorkOne, es.shopWorkflowMemberOpenWork)).toBe('1 Work Order abierto');
    expect(adminCountLabel(2, es.pcVendorPartCountValueOne, es.pcVendorPartCountValue)).toBe('2 partes');
    expect(adminCountLabel(1, es.pcLinesCountOne, es.pcLinesCount)).toBe('1 línea');
  });
});
