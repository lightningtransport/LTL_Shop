import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_READ_TIMEOUT_MS } from './api';
import { adminReadFetcher, withAdminReadPending } from './admin-data';

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

describe('admin read loaders', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('treats a missing Bearer token as still loading so Admin does not paint LoadFailure', () => {
    const pending = withAdminReadPending(null, {
      isLoading: false,
      isValidating: false,
      data: undefined,
    });
    expect(pending.isLoading).toBe(true);
  });

  it('keeps the skeleton up while a timeout/network retry is in flight', () => {
    const retrying = withAdminReadPending('dev:manager@example.com', {
      isLoading: false,
      isValidating: true,
      data: undefined,
    });
    expect(retrying.isLoading).toBe(true);
  });

  it('stops pending once a page has loaded', () => {
    const loaded = withAdminReadPending('dev:manager@example.com', {
      isLoading: false,
      isValidating: false,
      data: { items: [] },
    });
    expect(loaded.isLoading).toBe(false);
  });

  it('uses the 20s Admin read timeout so a late first byte is not aborted at 8s', async () => {
    vi.useFakeTimers();
    installBrowserGlobals();
    let aborted = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              aborted = true;
              reject(new DOMException('Aborted', 'AbortError'));
            });
            window.setTimeout(() => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })), 9_000);
          }),
      ),
    );

    const pending = adminReadFetcher<{ ok: boolean }>('/api/admin/work-orders');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(ADMIN_READ_TIMEOUT_MS).toBe(20_000);
    vi.useRealTimers();
  });
});
