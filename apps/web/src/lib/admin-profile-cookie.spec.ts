import { describe, expect, it } from 'vitest';
import {
  ADMIN_PROFILE_MAX_AGE_SECONDS,
  adminProfileSecret,
  jwtExpiry,
  readAdminProfile,
  signAdminProfile,
} from './admin-profile-cookie';

const SECRET = 'x'.repeat(48);
const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

function jwt(exp: number) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'ES256' })}.${part({ sub: 'u1', exp })}.sig`;
}

const manager = { admin: true, name: 'MS · Manager Shop', role: 'manager' };
const tokenValidForAnHour = jwt(Math.floor(NOW / 1000) + 3600);

describe('admin profile cookie (P19, D38)', () => {
  it('lets the middleware answer without the API for the token it was made for', async () => {
    const cookie = await signAdminProfile(manager, tokenValidForAnHour, SECRET, NOW);
    await expect(readAdminProfile(cookie, tokenValidForAnHour, SECRET, NOW + 60_000)).resolves.toEqual(manager);
  });

  it('keeps the 403 screen: a profile without Admin access says so', async () => {
    const mechanic = { admin: false, name: 'MG1', role: 'mechanic' };
    const cookie = await signAdminProfile(mechanic, tokenValidForAnHour, SECRET, NOW);
    await expect(readAdminProfile(cookie, tokenValidForAnHour, SECRET, NOW)).resolves.toEqual(mechanic);
  });

  it('falls back to the API for another token, a tampered cookie, another secret, or no secret', async () => {
    const cookie = await signAdminProfile(manager, tokenValidForAnHour, SECRET, NOW);
    await expect(readAdminProfile(cookie, jwt(Math.floor(NOW / 1000) + 3600) + 'x', SECRET, NOW)).resolves.toBeNull();
    const [body, signature] = cookie.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), role: 'system_admin' })).toString('base64url');
    await expect(readAdminProfile(`${forged}.${signature}`, tokenValidForAnHour, SECRET, NOW)).resolves.toBeNull();
    await expect(readAdminProfile(cookie, tokenValidForAnHour, 'y'.repeat(48), NOW)).resolves.toBeNull();
    await expect(readAdminProfile(cookie, tokenValidForAnHour, null, NOW)).resolves.toBeNull();
    await expect(readAdminProfile(undefined, tokenValidForAnHour, SECRET, NOW)).resolves.toBeNull();
  });

  it('falls back to the API once the cookie or the token itself has expired', async () => {
    const cookie = await signAdminProfile(manager, tokenValidForAnHour, SECRET, NOW);
    await expect(readAdminProfile(cookie, tokenValidForAnHour, SECRET, NOW + ADMIN_PROFILE_MAX_AGE_SECONDS * 1000)).resolves.toBeNull();
    const shortToken = jwt(Math.floor(NOW / 1000) + 60);
    const shortCookie = await signAdminProfile(manager, shortToken, SECRET, NOW);
    await expect(readAdminProfile(shortCookie, shortToken, SECRET, NOW + 61_000)).resolves.toBeNull();
  });

  it('accepts dev tokens (no exp) and requires a real secret', () => {
    expect(jwtExpiry('dev:ms@lightning.local')).toBeNull();
    expect(jwtExpiry(tokenValidForAnHour)).toBe(Math.floor(NOW / 1000) + 3600);
    expect(adminProfileSecret({})).toBeNull();
    expect(adminProfileSecret({ ADMIN_PROFILE_SECRET: 'short' })).toBeNull();
    expect(adminProfileSecret({ ADMIN_PROFILE_SECRET: SECRET })).toBe(SECRET);
  });
});
