export const ADMIN_SESSION_COOKIE = 'ltl_shop_server_session';
// Shared by Admin server components and the client-side Mechanic shell.
export const ADMIN_LOCALE_COOKIE = 'ltl_shop_locale';

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}
