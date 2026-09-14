import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currentAppPath,
  fetchWithDeadline,
  isStandaloneDisplay,
  replaceAppLocation,
  withDeadline,
} from './session-restore';

describe('session restore helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves before the deadline', async () => {
    await expect(withDeadline(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('rejects when the deadline elapses', async () => {
    vi.useFakeTimers();
    const pending = withDeadline(new Promise<string>(() => undefined), 25, 'timed out');
    const assertion = expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });

  it('detects iOS standalone and display-mode standalone', () => {
    expect(
      isStandaloneDisplay({
        navigator: { standalone: true },
        matchMedia: () => ({ matches: false }),
      }),
    ).toBe(true);

    expect(
      isStandaloneDisplay({
        navigator: {},
        matchMedia: (query: string) => ({ matches: query.includes('standalone') }),
      }),
    ).toBe(true);

    expect(
      isStandaloneDisplay({
        navigator: {},
        matchMedia: () => ({ matches: false }),
      }),
    ).toBe(false);
  });

  it('uses a full location replace in standalone and the router on the regular web', () => {
    const replace = vi.fn();
    const router = { replace: vi.fn() };

    replaceAppLocation('/login', router, { scroll: true }, {
      location: { pathname: '/', search: '', replace },
      navigator: { standalone: true },
      matchMedia: () => ({ matches: false }),
    });
    expect(replace).toHaveBeenCalledWith('/login');
    expect(router.replace).not.toHaveBeenCalled();

    replaceAppLocation('/login', router, { scroll: true }, {
      location: { pathname: '/', search: '', replace },
      navigator: {},
      matchMedia: () => ({ matches: false }),
    });
    expect(router.replace).toHaveBeenCalledWith('/login', { scroll: true });
  });

  it('aborts a hung fetch at the deadline', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const pending = fetchWithDeadline('/api/admin/session', { method: 'POST' }, 20);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    vi.unstubAllGlobals();
  });

  it('does not navigate when the path is already current', () => {
    const replace = vi.fn();
    replaceAppLocation('/login', { replace }, undefined, {
      location: { pathname: '/login', search: '', replace },
      navigator: { standalone: true },
      matchMedia: () => ({ matches: false }),
    });
    expect(replace).not.toHaveBeenCalled();
    expect(currentAppPath({ location: { pathname: '/login', search: '?next=/admin', replace } })).toBe(
      '/login?next=/admin',
    );
  });
});
