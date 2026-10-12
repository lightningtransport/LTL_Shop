import type { AuthUser } from './auth.guard';

/**
 * P20 / D38: every authenticated request used to read the user and its capabilities from Postgres (two queries).
 * The guard now keeps that answer for a short time per process. The owner accepted the trade-off: a deactivation or
 * a capability change made on another server instance takes up to the TTL to apply there; on the instance that
 * made the change it applies at once, because every user write calls `invalidateAuthUserCache()`.
 *
 * `AUTH_USER_CACHE_TTL_MS` overrides the TTL; `0` turns the cache off (the real-flow tests flip users straight in
 * the database, behind the API's back, so they run with it off).
 */
export const DEFAULT_AUTH_USER_CACHE_TTL_MS = 30_000;
const MAX_ENTRIES = 500;

type Entry = { user: AuthUser; expiresAt: number };
const entries = new Map<string, Entry>();

export function authUserCacheTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.AUTH_USER_CACHE_TTL_MS;
  if (raw === undefined || raw === '') return DEFAULT_AUTH_USER_CACHE_TTL_MS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_AUTH_USER_CACHE_TTL_MS;
}

export function authUserCacheKey(email: string, supabaseAuthId: string | null): string {
  return `${email.toLowerCase()}|${supabaseAuthId ?? ''}`;
}

export function readAuthUserCache(key: string, now = Date.now()): AuthUser | null {
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    entries.delete(key);
    return null;
  }
  return entry.user;
}

export function writeAuthUserCache(key: string, user: AuthUser, ttlMs: number, now = Date.now()): void {
  if (ttlMs <= 0) return;
  if (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.set(key, { user, expiresAt: now + ttlMs });
}

/** Call after any write to a user or its capabilities (create, edit, deactivate, remove, delete, link). */
export function invalidateAuthUserCache(): void {
  entries.clear();
}
