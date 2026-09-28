import { describe, expect, it } from 'vitest';
import { adminSessionCookieSecure, devLoginEnabled } from './dev-login';

describe('Dev Login gate (LTR-163)', () => {
  it('shows Dev Login outside production and only in the e2e production build', () => {
    expect(devLoginEnabled('development', undefined)).toBe(true);
    expect(devLoginEnabled('test', undefined)).toBe(true);
    expect(devLoginEnabled('production', undefined)).toBe(false);
    expect(devLoginEnabled('production', '0')).toBe(false);
    expect(devLoginEnabled('production', '1')).toBe(true);
  });

  it('keeps the Admin session cookie Secure in production unless it is the e2e build', () => {
    expect(adminSessionCookieSecure('production', undefined)).toBe(true);
    expect(adminSessionCookieSecure('production', '1')).toBe(false);
    expect(adminSessionCookieSecure('development', undefined)).toBe(false);
  });
});
