import { afterEach, describe, expect, it } from 'vitest';
import { getSentryDsn, getSentryEnvironment, isSentryEnabled } from './sentry-environment';

const originalEnv = process.env.VERCEL_ENV;
const originalDsn = process.env.SENTRY_DSN;
const originalPublicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

afterEach(() => {
  process.env.VERCEL_ENV = originalEnv;
  process.env.SENTRY_DSN = originalDsn;
  process.env.NEXT_PUBLIC_SENTRY_DSN = originalPublicDsn;
});

describe('API Sentry gating', () => {
  it('enables only in production with a DSN', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.SENTRY_DSN = 'https://example.invalid/1';

    expect(isSentryEnabled()).toBe(true);
    expect(getSentryEnvironment()).toBe('production');
    expect(getSentryDsn()).toBe('https://example.invalid/1');
  });

  it.each(['preview', 'development', undefined])('disables in %s', (environment) => {
    process.env.VERCEL_ENV = environment;
    process.env.SENTRY_DSN = 'https://example.invalid/1';

    expect(isSentryEnabled()).toBe(false);
  });
});
