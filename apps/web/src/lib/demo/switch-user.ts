import { AUTH_TOKEN_KEY } from '../api';

/**
 * D36: become another demo account without signing out. The Admin server session (httpOnly cookie read by
 * middleware.ts) is set first with the new `dev:` token; only then the token is saved and the page is loaded
 * again from scratch, so no data from the previous user stays on screen or in the SWR cache. The load
 * replaces the current history entry (UX-5-005): the browser's Back never lands on the previous account's page.
 */
export type SwitchDemoUserDeps = {
  fetch: typeof fetch;
  storage: Pick<Storage, 'setItem'>;
  replace: (path: string) => void;
};

export type SwitchDemoUserResult = { ok: true } | { ok: false; status: number };

export function devToken(email: string): string {
  return `dev:${email.trim().toLowerCase()}`;
}

export async function switchDemoUser(
  { email, path }: { email: string; path: string },
  deps: SwitchDemoUserDeps,
): Promise<SwitchDemoUserResult> {
  const token = devToken(email);
  let response: Response;
  try {
    response = await deps.fetch('/api/admin/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, status: 0 };
  }
  if (!response.ok) return { ok: false, status: response.status };
  deps.storage.setItem(AUTH_TOKEN_KEY, token);
  deps.replace(path);
  return { ok: true };
}

/** Same user, Admin route: renew the one-hour server cookie before the middleware sees the navigation. */
export async function refreshAdminSessionCookie(token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    await fetchImpl('/api/admin/session', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // The page falls back to the normal /login?next= bounce if the cookie is really gone.
  }
}
