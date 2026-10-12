/**
 * P19 / D38: the Admin middleware used to call `GET /api/admin/access` on every `/admin/*` request, so every click
 * in the Admin sidebar waited for a trip edge → API (and an API cold start) before anything painted.
 *
 * Now `POST /api/admin/session`, which already asks the API for the profile, also sets a small signed cookie with
 * what the middleware needs: whether the person has Admin access, their name and role, and a hash of the token it
 * was issued for. The middleware trusts that cookie while it is valid and falls back to the API call otherwise.
 *
 * Trade-off the owner accepted: a deactivation or a lost Admin capability takes up to the cookie's life (the
 * Admin session's 60 minutes) to stop the Admin *screens* from opening; every Admin *action and read* is still
 * checked by the API on each request. Without `ADMIN_PROFILE_SECRET` nothing is signed and nothing changes.
 *
 * Web Crypto only, so the same code runs in the edge middleware and in the Node route handler.
 */
export const ADMIN_PROFILE_COOKIE = 'ltl_shop_admin_profile';
export const ADMIN_PROFILE_MAX_AGE_SECONDS = 60 * 60;

export type AdminProfile = {
  /** Has `admin.access` (the same rule as the API's `/admin/*` routes). */
  admin: boolean;
  name: string;
  role: string;
};

type Payload = AdminProfile & { v: 1; th: string; exp: number };

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function tokenHash(token: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))));
}

/** The secret, or null when this deployment has none (then the middleware keeps calling the API). */
export function adminProfileSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.ADMIN_PROFILE_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export async function signAdminProfile(
  profile: AdminProfile,
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): Promise<string> {
  const payload: Payload = {
    v: 1,
    admin: profile.admin,
    name: profile.name,
    role: profile.role,
    th: await tokenHash(token),
    exp: Math.floor(nowMs / 1000) + ADMIN_PROFILE_MAX_AGE_SECONDS,
  };
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body)));
  return `${body}.${base64url(signature)}`;
}

/** Seconds-since-epoch `exp` of a JWT, read without verifying it (the API verified it when the cookie was made). */
export function jwtExpiry(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromBase64url(part))) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

/**
 * The profile when the cookie is genuine, unexpired, made for this very token, and the token itself has not
 * expired; otherwise null and the caller asks the API as before.
 */
export async function readAdminProfile(
  cookie: string | undefined,
  token: string,
  secret: string | null,
  nowMs: number = Date.now(),
): Promise<AdminProfile | null> {
  if (!cookie || !secret) return null;
  const [body, signature] = cookie.split('.');
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64url(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as Payload;
    const now = Math.floor(nowMs / 1000);
    if (payload.v !== 1 || typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (payload.th !== (await tokenHash(token))) return null;
    const tokenExp = jwtExpiry(token);
    if (tokenExp !== null && tokenExp <= now) return null;
    return { admin: payload.admin === true, name: String(payload.name ?? ''), role: String(payload.role ?? '') };
  } catch {
    return null;
  }
}
