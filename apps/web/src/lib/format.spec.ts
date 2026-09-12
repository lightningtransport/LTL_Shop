import { describe, expect, it } from 'vitest';
import { formatIsoDate } from './format';
import { formatAdminDateOnly } from './admin-format';

describe('date-only identity formatters', () => {
  it('formats a stored ISO date without implying a time or yard state', () => {
    expect(formatIsoDate('2026-09-11', 'en')).toMatch(/Sep(t)?\.? 11, 2026|September 11, 2026/);
    expect(formatAdminDateOnly('2026-09-11', 'en')).toMatch(/Sep(t)?\.? 11, 2026|September 11, 2026/);
    expect(formatIsoDate(null)).toBe('—');
    expect(formatAdminDateOnly(null, 'es')).toBe('—');
  });
});
