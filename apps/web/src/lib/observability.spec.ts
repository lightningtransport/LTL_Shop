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

vi.mock('@sentry/nextjs', () => ({
  withScope,
  captureException,
}));

describe('browser Sentry error details', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it('fingerprints API failures by method, templated route, and status', async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://example.invalid/1';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { captureException: report } = await import('./observability');
    const error = new Error('Internal server error');
    report(error, {
      kind: 'http',
      status: 500,
      route: '/api/admin/dashboard',
      method: 'GET',
      message: 'Internal server error',
      authorization: 'Bearer secret',
      userId: 'should-not-send',
      body: { token: 'nope' },
    });

    expect(withScope).toHaveBeenCalled();
    const scope = withScope.mock.results[0]?.value as {
      setContext: ReturnType<typeof vi.fn>;
      setTag: ReturnType<typeof vi.fn>;
      setFingerprint: ReturnType<typeof vi.fn>;
    };
    expect(scope.setFingerprint).toHaveBeenCalledWith([
      'api-error',
      'GET',
      '/api/admin/dashboard',
      '500',
    ]);
    expect(scope.setContext).toHaveBeenCalledWith('error_details', {
      kind: 'http',
      status: 500,
      route: '/api/admin/dashboard',
      method: 'GET',
      message: 'Internal server error',
    });
    expect(scope.setContext.mock.calls[0]?.[1]).not.toHaveProperty('authorization');
    expect(scope.setContext.mock.calls[0]?.[1]).not.toHaveProperty('userId');
    expect(scope.setContext.mock.calls[0]?.[1]).not.toHaveProperty('body');
    expect(captureException).toHaveBeenCalledWith(error);
  });
});
