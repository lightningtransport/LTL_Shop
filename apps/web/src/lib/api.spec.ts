import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, apiFetchWithRetry, isTransientApiError, setAuthToken } from './api';

function installBrowserGlobals() {
  const storage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  vi.stubGlobal('window', {
    setTimeout: ((...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args)) as typeof setTimeout,
    clearTimeout: ((...args: Parameters<typeof clearTimeout>) => globalThis.clearTimeout(...args)) as typeof clearTimeout,
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal('localStorage', storage);
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setAuthToken(null);
  });

  it('returns a parsed successful response', async () => {
    installBrowserGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));

    await expect(apiFetch<{ ok: boolean }>('/api/work-orders')).resolves.toEqual({ ok: true });
  });

  it('aborts a read that exceeds its timeout with a transport error', async () => {
    installBrowserGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      ),
    );

    await expect(apiFetch('/api/work-orders', { timeoutMs: 10 })).rejects.toMatchObject({
      kind: 'timeout',
      status: 0,
      route: '/api/work-orders',
      method: 'GET',
    });
  });

  it('records a templated route on HTTP failures without leaking IDs', async () => {
    installBrowserGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ statusCode: 500, message: 'Internal server error' }), {
            status: 500,
          }),
        ),
      ),
    );

    await expect(apiFetch('/api/admin/dashboard')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      route: '/api/admin/dashboard',
      method: 'GET',
      message: 'Internal server error',
    });

    await expect(
      apiFetch('/api/work-orders/d2262a20-0862-4f18-a6c8-184a88a42f78'),
    ).rejects.toMatchObject({
      status: 500,
      route: '/api/work-orders/:id',
    });
    await expect(
      apiFetch('/api/admin/trucks/d2262a20-0862-4f18-a6c8-184a88a42f78/work-plan/jobs', { method: 'POST' }),
    ).rejects.toMatchObject({
      status: 500,
      route: '/api/admin/trucks/:id/work-plan/jobs',
      method: 'POST',
    });
  });
});

describe('apiFetchWithRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setAuthToken(null);
  });

  it('treats network, timeout, and 503 as transient', () => {
    expect(isTransientApiError(new ApiError('n', 0, null, 'network'))).toBe(true);
    expect(isTransientApiError(new ApiError('t', 0, null, 'timeout'))).toBe(true);
    expect(isTransientApiError(new ApiError('cold', 503, null, 'http'))).toBe(true);
    expect(isTransientApiError(new ApiError('nope', 401, null, 'http'))).toBe(false);
    expect(isTransientApiError(new ApiError('missing', 404, null, 'http'))).toBe(false);
  });

  it('retries a transient GET then succeeds without a manual Retry', async () => {
    installBrowserGlobals();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'cold' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const pending = apiFetchWithRetry<{ items: unknown[] }>('/api/admin/work-orders?limit=25');
    await vi.advanceTimersByTimeAsync(400);
    await expect(pending).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry 401 or mutations', async () => {
    installBrowserGlobals();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'no' }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetchWithRetry('/api/admin/work-orders')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'cold' }), { status: 503 }));
    await expect(apiFetchWithRetry('/api/admin/work-orders', { method: 'POST' })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws after GET retries are exhausted so LoadFailure can show', async () => {
    installBrowserGlobals();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ message: 'down' }), { status: 503 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const pending = apiFetchWithRetry('/api/admin/trucks/abc');
    const assertion = expect(pending).rejects.toMatchObject({ status: 503, kind: 'http' });
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(1_200);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
