export { SHOP_LOCALE_COOKIE as ADMIN_LOCALE_COOKIE } from './shop-locale';

export const ADMIN_SESSION_COOKIE = 'ltl_shop_server_session';

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}
