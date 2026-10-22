import { describe, expect, it } from 'vitest';
import { withoutTicketId } from './catalog-reason';

describe('withoutTicketId (LTR-277 §9)', () => {
  it('drops a trailing ticket id from an old saved reason', () => {
    expect(withoutTicketId('Merged into Suspension & Steering (LTR-24)')).toBe('Merged into Suspension & Steering');
    expect(withoutTicketId('Merged into Air & Brake System')).toBe('Merged into Air & Brake System');
    expect(withoutTicketId('Not used (seasonal)')).toBe('Not used (seasonal)');
  });
});
