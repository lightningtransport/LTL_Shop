import { afterEach, describe, expect, it } from 'vitest';
import { getSentryDsn, getSentryEnvironment, isSentryEnabled } from './sentry-environment';

const originalEnvironment = process.env.NEXT_PUBLIC_VERCEL_ENV;
const originalServerEnvironment = process.env.VERCEL_ENV;
const originalPublicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const originalServerDsn = process.env.SENTRY_DSN;

afterEach(() => {
  process.env.NEXT_PUBLIC_VERCEL_ENV = originalEnvironment;
  process.env.VERCEL_ENV = originalServerEnvironment;
  process.env.NEXT_PUBLIC_SENTRY_DSN = originalPublicDsn;
  process.env.SENTRY_DSN = originalServerDsn;
});

describe('Sentry deployment gating', () => {
  it('enables the client only in Production with a public DSN', () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example.invalid/1';

    expect(isSentryEnabled('client')).toBe(true);
    expect(getSentryEnvironment('client')).toBe('production');
    expect(getSentryDsn('client')).toBe('https://example.invalid/1');
  });

  it.each(['preview', 'development', undefined])('disables the client in %s', (environment) => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = environment;
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example.invalid/1';

    expect(isSentryEnabled('client')).toBe(false);
  });

  it('enables server and edge runtimes only in Production', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.SENTRY_DSN = 'https://example.invalid/1';

    expect(isSentryEnabled('server')).toBe(true);
    expect(getSentryEnvironment('server')).toBe('production');
    expect(getSentryDsn('server')).toBe('https://example.invalid/1');
  });

  it('disables server and edge runtimes without a DSN', () => {
    process.env.VERCEL_ENV = 'production';
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    expect(isSentryEnabled('server')).toBe(false);
  });
});
