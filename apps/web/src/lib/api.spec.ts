import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_READ_TIMEOUT_MS,
  ApiError,
  apiFetch,
  DEFAULT_READ_TIMEOUT_MS,
  isTransientApiError,
} from './api';

function installBrowserGlobals() {
  const storage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal('localStorage', storage);
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('keeps the default GET budget at 8s and exposes a longer Admin read budget', () => {
    expect(DEFAULT_READ_TIMEOUT_MS).toBe(8_000);
    expect(ADMIN_READ_TIMEOUT_MS).toBe(20_000);
  });

  it('treats timeout and network ApiErrors as transient, not HTTP failures', () => {
    expect(isTransientApiError(new ApiError('slow', 0, null, 'timeout'))).toBe(true);
    expect(isTransientApiError(new ApiError('offline', 0, null, 'network'))).toBe(true);
    expect(isTransientApiError(new ApiError('nope', 401, null, 'http'))).toBe(false);
    expect(isTransientApiError(new ApiError('boom', 500, null, 'http'))).toBe(false);
    expect(isTransientApiError(new Error('nope'))).toBe(false);
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
