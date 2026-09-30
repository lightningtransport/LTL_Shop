export type ShopLocale = 'en' | 'es';

/** Shared by mechanic Home/login and Shop Admin. Do not invent a second cookie. */
export const SHOP_LOCALE_COOKIE = 'ltl_shop_locale';

export const SHOP_LOCALE_COOKIE_MAX_AGE = 31_536_000;

export function parseShopLocale(value?: string | null): ShopLocale {
  return value === 'es' ? 'es' : 'en';
}

export function shopLocaleFromCookieHeader(cookieHeader?: string | null): ShopLocale {
  if (!cookieHeader) return 'en';
  const raw = cookieHeader
    .split('; ')
    .find((item) => item.startsWith(`${SHOP_LOCALE_COOKIE}=`))
    ?.slice(SHOP_LOCALE_COOKIE.length + 1);
  return parseShopLocale(raw);
}

export function shopLocaleCookieWrite(locale: ShopLocale): string {
  return `${SHOP_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${SHOP_LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function shopLocaleChangeEvent(): Event {
  return new Event('ltl-shop-locale-change');
}

/** Intl tag for dates and numbers. Formatting, not copy: the catalogs never carry this. */
export function intlLocale(locale: ShopLocale): 'en-US' | 'es-US' {
  return locale === 'es' ? 'es-US' : 'en-US';
}
