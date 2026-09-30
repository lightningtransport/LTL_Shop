import { ApiError } from './api';
import type { ApiErrorCopy } from './api-error-copy';
import type { ShopLocale } from './shop-locale';

/** The slice of either catalog (`useShopLocale().messages` or `getAdminMessages(locale)`) the helper needs. */
export type ApiErrorCatalog = { locale: ShopLocale; apiError: ApiErrorCopy };

/**
 * An error whose message is already in the user's language (auth-context builds these from the
 * catalog). `apiErrorMessage` shows it as is in every locale.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** The `code` the API attaches to its error body, when there is one. */
export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body;
  if (typeof body !== 'object' || body === null) return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/**
 * LTR-181: the API speaks English only. Known `code`s map to catalog copy, transport failures to
 * the network/timeout copy, and anything else to the localized `fallback`. The raw API message is
 * shown only in English, when there is no code (not wrong, just unmapped). Spanish never shows it.
 */
export function apiErrorMessage(error: unknown, messages: ApiErrorCatalog, fallback: string): string {
  if (error instanceof UserFacingError) return error.message || fallback;
  if (error instanceof ApiError) {
    if (error.kind === 'network') return messages.apiError.network;
    if (error.kind === 'timeout') return messages.apiError.timeout;
    const code = apiErrorCode(error);
    if (code && code in messages.apiError) return messages.apiError[code as keyof ApiErrorCopy];
  }
  if (messages.locale === 'en' && error instanceof Error && error.message) return error.message;
  return fallback;
}

export type AuthErrorCopy = {
  authInvalidCredentials: string;
  authEmailNotConfirmed: string;
  authRateLimited: string;
  authWeakPassword: string;
  authSamePassword: string;
};

/**
 * Supabase Auth errors carry a `code` (invalid_credentials, email_not_confirmed, over_request_rate_limit…)
 * and an English message. Map the common ones; everything else gets the caller's fallback.
 */
export function authErrorMessage(
  error: { code?: string | null; message?: string | null } | null | undefined,
  messages: AuthErrorCopy,
  fallback: string,
): string {
  const code = error?.code ?? '';
  const text = error?.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) return messages.authInvalidCredentials;
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(text)) return messages.authEmailNotConfirmed;
  if (/rate_limit/i.test(code) || /rate limit/i.test(text)) return messages.authRateLimited;
  if (code === 'weak_password' || /password should be at least|weak password/i.test(text)) return messages.authWeakPassword;
  if (code === 'same_password' || /different from the old password/i.test(text)) return messages.authSamePassword;
  return fallback;
}
