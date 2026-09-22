import { CatalogStatus, MechanicMode } from '@ltl-shop/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_READ_TIMEOUT_MS } from './api';
import {
  ADMIN_CATALOG_JOBS_PATH,
  ADMIN_MECHANICS_COLLECTION_PATH,
  adminReadFetcher,
  createAdminCatalogJob,
  createAdminMechanic,
  updateAdminCatalogJob,
  updateAdminMechanic,
  withAdminReadPending,
} from './admin-data';

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

describe('system admin write contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockJson(body: unknown, status = 201) {
    installBrowserGlobals();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('posts and patches catalog jobs without creating a category', async () => {
    const fetchMock = mockJson({ id: 'job-1' });
    await createAdminCatalogJob({
      categoryId: '00000000-0000-4000-8000-000000000301',
      displayName: '  Bleed brakes  ',
    });
    await updateAdminCatalogJob('00000000-0000-4000-8000-000000000803', {
      displayName: ' Bleed brakes again ',
      status: CatalogStatus.ACTIVE,
    });
    const [createUrl, createInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(createUrl).toBe(`http://localhost:3001${ADMIN_CATALOG_JOBS_PATH}`);
    expect(createInit.method).toBe('POST');
    expect(JSON.parse(String(createInit.body))).toEqual({
      categoryId: '00000000-0000-4000-8000-000000000301',
      displayName: 'Bleed brakes',
    });
    expect(patchUrl).toBe('http://localhost:3001/api/admin/catalog/jobs/00000000-0000-4000-8000-000000000803');
    expect(patchInit.method).toBe('PATCH');
    expect(JSON.parse(String(patchInit.body))).toEqual({
      displayName: 'Bleed brakes again',
      status: CatalogStatus.ACTIVE,
    });
  });

  it('creates a mechanic with mode and patches activate or tier', async () => {
    const fetchMock = mockJson({ id: 'mechanic-1' });
    await createAdminMechanic({ name: ' Ana ', email: ' Ana@Shop.Example ', mode: MechanicMode.PM });
    await updateAdminMechanic('00000000-0000-4000-8000-000000000007', {
      active: true,
      mode: MechanicMode.STANDARD,
      name: 'Ana',
    });
    const [createUrl, createInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(createUrl).toBe(`http://localhost:3001${ADMIN_MECHANICS_COLLECTION_PATH}`);
    expect(createInit.method).toBe('POST');
    expect(JSON.parse(String(createInit.body))).toEqual({
      name: 'Ana',
      email: 'ana@shop.example',
      mode: MechanicMode.PM,
    });
    expect(patchUrl).toBe('http://localhost:3001/api/admin/mechanics/00000000-0000-4000-8000-000000000007');
    expect(patchInit.method).toBe('PATCH');
    expect(JSON.parse(String(patchInit.body))).toEqual({
      active: true,
      mode: MechanicMode.STANDARD,
      name: 'Ana',
    });
  });
});
