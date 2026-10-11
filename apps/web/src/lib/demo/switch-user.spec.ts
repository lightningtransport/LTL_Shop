import { describe, expect, it, vi } from 'vitest';
import { AUTH_TOKEN_KEY } from '../api';
import { devToken, switchDemoUser } from './switch-user';

describe('switchDemoUser (D36)', () => {
  it('sets the Admin cookie, then saves the dev token, then replaces the page', async () => {
    const order: string[] = [];
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      order.push(`fetch ${(init?.headers as Record<string, string>).Authorization}`);
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const storage = { setItem: vi.fn((key: string, value: string) => void order.push(`store ${key}=${value}`)) };
    const replace = vi.fn((path: string) => void order.push(`replace ${path}`));

    const result = await switchDemoUser({ email: 'Anthony@Lightning.local', path: '/mechanic/standard' }, { fetch: fetchMock, storage, replace });

    expect(result).toEqual({ ok: true });
    expect(order).toEqual([
      'fetch Bearer dev:anthony@lightning.local',
      `store ${AUTH_TOKEN_KEY}=dev:anthony@lightning.local`,
      'replace /mechanic/standard',
    ]);
  });

  it('changes nothing when the API refuses the account (inactive) or is down', async () => {
    const storage = { setItem: vi.fn() };
    const replace = vi.fn();
    const refused = (async () => new Response(null, { status: 403 })) as unknown as typeof fetch;
    expect(await switchDemoUser({ email: 'luis@lightning.local', path: '/admin' }, { fetch: refused, storage, replace }))
      .toEqual({ ok: false, status: 403 });

    const down = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await switchDemoUser({ email: 'manager@lightning.local', path: '/admin' }, { fetch: down, storage, replace }))
      .toEqual({ ok: false, status: 0 });

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('builds the same token the login page uses', () => {
    expect(devToken(' Manager@Lightning.local ')).toBe('dev:manager@lightning.local');
  });
});
