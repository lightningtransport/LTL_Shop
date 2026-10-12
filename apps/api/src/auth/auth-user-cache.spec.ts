import { afterEach, describe, expect, it } from 'vitest';
import type { AuthUser } from './auth.guard';
import {
  authUserCacheKey,
  authUserCacheTtlMs,
  DEFAULT_AUTH_USER_CACHE_TTL_MS,
  invalidateAuthUserCache,
  readAuthUserCache,
  writeAuthUserCache,
} from './auth-user-cache';

const user: AuthUser = {
  id: 'u1', email: 'ms@lightning.local', name: 'MS', role: 'manager', active: true, capabilities: [], supabaseAuthId: 'sub-1',
};

describe('auth user cache (P20, D38)', () => {
  afterEach(() => invalidateAuthUserCache());

  it('answers from memory until the TTL ends, then asks the database again', () => {
    const key = authUserCacheKey('MS@lightning.local', 'sub-1');
    writeAuthUserCache(key, user, 30_000, 1_000);
    expect(readAuthUserCache(key, 30_999)).toBe(user);
    expect(readAuthUserCache(key, 31_000)).toBeNull();
  });

  it('forgets everyone after a user write on this instance', () => {
    const key = authUserCacheKey(user.email, 'sub-1');
    writeAuthUserCache(key, user, 30_000);
    invalidateAuthUserCache();
    expect(readAuthUserCache(key)).toBeNull();
  });

  it('keeps tokens of another Supabase account apart and stores nothing with TTL 0', () => {
    expect(authUserCacheKey(user.email, 'sub-1')).not.toBe(authUserCacheKey(user.email, 'sub-2'));
    const key = authUserCacheKey(user.email, null);
    writeAuthUserCache(key, user, 0);
    expect(readAuthUserCache(key)).toBeNull();
  });

  it('reads the TTL from AUTH_USER_CACHE_TTL_MS (0 turns it off; garbage keeps the default)', () => {
    expect(authUserCacheTtlMs({} as NodeJS.ProcessEnv)).toBe(DEFAULT_AUTH_USER_CACHE_TTL_MS);
    expect(authUserCacheTtlMs({ AUTH_USER_CACHE_TTL_MS: '0' } as NodeJS.ProcessEnv)).toBe(0);
    expect(authUserCacheTtlMs({ AUTH_USER_CACHE_TTL_MS: 'soon' } as NodeJS.ProcessEnv)).toBe(DEFAULT_AUTH_USER_CACHE_TTL_MS);
  });
});
