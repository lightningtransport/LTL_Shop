import { CatalogStatus, MechanicMode, UserRole } from '@ltl-shop/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_READ_TIMEOUT_MS, ApiError } from './api';
import {
  ADMIN_CATALOG_JOBS_PATH,
  ADMIN_MECHANICS_COLLECTION_PATH,
  adminInfiniteOptions,
  adminMechanicsPageKey,
  adminReadRetryPending,
  adminReadFetcher,
  createAdminCatalogJob,
  createAdminMechanic,
  hasUnloadedAdminPage,
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

  it('keeps a first transient failure loading until its retry settles (LTR-84)', () => {
    const timeout = new ApiError('slow', 0, null, 'timeout');
    expect(adminReadRetryPending(timeout, undefined, 1)).toBe(true);
    expect(adminReadRetryPending(timeout, undefined, 2)).toBe(false);
    expect(adminReadRetryPending(new ApiError('nope', 500, null, 'http'), undefined, 1)).toBe(false);
    expect(adminReadRetryPending(timeout, { ok: true }, 1)).toBe(false);
    expect(adminReadRetryPending(undefined, undefined, 0)).toBe(false);
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
    // LTR-253 / D48: a Shop Manager goes as a role, without a mechanic type.
    await createAdminMechanic({ name: 'Jess', email: 'jess@shop.example', mode: UserRole.MANAGER });
    const [, staffInit] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    expect(JSON.parse(String(staffInit.body))).toEqual({ name: 'Jess', email: 'jess@shop.example', role: 'manager' });
    expect(patchUrl).toBe('http://localhost:3001/api/admin/mechanics/00000000-0000-4000-8000-000000000007');
    expect(patchInit.method).toBe('PATCH');
    expect(JSON.parse(String(patchInit.body))).toEqual({
      active: true,
      mode: MechanicMode.STANDARD,
      name: 'Ana',
    });
  });
});

describe('assignable mechanics picker (LTR-151)', () => {
  it('requests assignable mechanics and follows the cursor', () => {
    expect(adminMechanicsPageKey('token', 'assignable=true', 100, 0, null))
      .toBe('/api/admin/mechanics?assignable=true&limit=100');
    expect(adminMechanicsPageKey('token', 'assignable=true', 100, 1, { items: [], nextCursor: 'abc' }))
      .toBe('/api/admin/mechanics?assignable=true&limit=100&cursor=abc');
    expect(adminMechanicsPageKey('token', 'assignable=true', 100, 1, { items: [], nextCursor: null })).toBeNull();
    expect(adminMechanicsPageKey(null, 'assignable=true', 100, 0, null)).toBeNull();
  });

  it('keeps loading pages until the last page has no cursor', () => {
    expect(hasUnloadedAdminPage(undefined, 1)).toBe(false);
    expect(hasUnloadedAdminPage([{ items: [], nextCursor: 'abc' }], 1)).toBe(true);
    expect(hasUnloadedAdminPage([{ items: [], nextCursor: 'abc' }], 2)).toBe(false);
    expect(hasUnloadedAdminPage([{ items: [], nextCursor: 'abc' }, { items: [], nextCursor: null }], 2)).toBe(false);
  });
});

describe('admin paged list options (PF4)', () => {
  it('keeps the rows on screen while a new filter or page loads, and still refreshes on mount (#109)', () => {
    expect(adminInfiniteOptions.keepPreviousData).toBe(true);
    expect(adminInfiniteOptions.revalidateOnMount).toBe(true);
    expect(adminInfiniteOptions.dedupingInterval).toBe(5_000);
  });
});
