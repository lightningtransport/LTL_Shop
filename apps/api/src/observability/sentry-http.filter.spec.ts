import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { BaseExceptionFilter, type HttpAdapterHost } from '@nestjs/core';
import type { ArgumentsHost } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
const withScope = vi.fn((callback: (scope: {
  setContext: ReturnType<typeof vi.fn>;
  setTag: ReturnType<typeof vi.fn>;
  setFingerprint: ReturnType<typeof vi.fn>;
}) => void) => {
  const scope = {
    setContext: vi.fn(),
    setTag: vi.fn(),
    setFingerprint: vi.fn(),
  };
  callback(scope);
  return scope;
});

vi.mock('@sentry/nestjs', () => ({
  withScope,
  captureException,
}));

describe('SentryHttpFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    captureException.mockClear();
    withScope.mockClear();
    delete process.env.VERCEL_ENV;
    delete process.env.SENTRY_DSN;
  });

  it('reports 500s with a templated route fingerprint', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);

    const { SentryHttpFilter } = await import('./sentry-http.filter');
    const adapterHost = { httpAdapter: {} } as HttpAdapterHost;
    const filter = new SentryHttpFilter(adapterHost);
    const exception = new InternalServerErrorException('Internal server error');
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/admin/dashboard',
          route: { path: '/admin/dashboard' },
        }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(exception, host);

    expect(withScope).toHaveBeenCalled();
    const scope = withScope.mock.results[0]?.value as {
      setFingerprint: ReturnType<typeof vi.fn>;
    };
    expect(scope.setFingerprint).toHaveBeenCalledWith([
      'api-server',
      'GET',
      '/api/admin/dashboard',
      '500',
    ]);
    expect(captureException).toHaveBeenCalledWith(exception);
  });

  it('does not report 401s', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);

    const { SentryHttpFilter } = await import('./sentry-http.filter');
    const filter = new SentryHttpFilter({ httpAdapter: {} } as HttpAdapterHost);
    filter.catch(
      new UnauthorizedException('Missing authorization token'),
      {
        switchToHttp: () => ({
          getRequest: () => ({ method: 'GET', originalUrl: '/api/admin/dashboard' }),
        }),
      } as unknown as ArgumentsHost,
    );

    expect(captureException).not.toHaveBeenCalled();
  });
});
