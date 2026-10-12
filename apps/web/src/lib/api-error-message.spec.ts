import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages-catalog';
import { ApiError } from './api';
import { API_ERROR_COPY } from './api-error-copy';
import { apiErrorCode, apiErrorMessage, authErrorMessage, UserFacingError } from './api-error-message';
import { getShopCopy } from './locale-context';

const en = getShopCopy('en');
const es = getShopCopy('es');

function coded(code: string, status = 409, message = 'Some English sentence from the API') {
  return new ApiError(message, status, { code, message });
}

describe('apiErrorMessage', () => {
  it('maps a known API code to catalog copy in both languages', () => {
    expect(apiErrorMessage(coded('VERSION_CONFLICT'), en, 'fallback')).toBe(en.apiError.VERSION_CONFLICT);
    expect(apiErrorMessage(coded('VERSION_CONFLICT'), es, 'fallback')).toBe(es.apiError.VERSION_CONFLICT);
    expect(apiErrorMessage(coded('QC_TAKEN'), es, 'fallback')).toMatch(/Safety/);
    expect(apiErrorMessage(coded('START_REQUIRED', 400), es, 'fallback')).toBe(es.apiError.START_REQUIRED);
  });

  it('reads the same code copy through the Admin catalog', () => {
    const admin = getAdminMessages('es');
    expect(apiErrorMessage(coded('OPEN_WORK_ORDER_EXISTS'), admin, 'fallback')).toBe(API_ERROR_COPY.es.OPEN_WORK_ORDER_EXISTS);
    expect(apiErrorMessage(coded('OPEN_WORK_ORDER_EXISTS'), getAdminMessages('en'), 'fallback')).toBe(API_ERROR_COPY.en.OPEN_WORK_ORDER_EXISTS);
  });

  it('uses the network and timeout copy for transport failures', () => {
    const network = new ApiError('Unable to reach the Shop. Please try again.', 0, null, 'network');
    const timeout = new ApiError('The request took too long. Please try again.', 0, null, 'timeout');
    expect(apiErrorMessage(network, es, 'fallback')).toBe(es.apiError.network);
    expect(apiErrorMessage(timeout, es, 'fallback')).toBe(es.apiError.timeout);
    expect(apiErrorMessage(network, en, 'fallback')).toMatch(/Unable to reach/);
    expect(apiErrorMessage(timeout, en, 'fallback')).toMatch(/took too long/);
  });

  it('keeps the raw API message only in English when there is no code', () => {
    const raw = new ApiError('Notes are required when reason is Other', 400, { message: 'Notes are required when reason is Other' });
    expect(apiErrorMessage(raw, en, 'fallback')).toBe('Notes are required when reason is Other');
    expect(apiErrorMessage(raw, es, 'respaldo')).toBe('respaldo');
    expect(apiErrorMessage(coded('NOT_A_KNOWN_CODE'), es, 'respaldo')).toBe('respaldo');
    expect(apiErrorMessage(new Error('boom'), es, 'respaldo')).toBe('respaldo');
    expect(apiErrorMessage(new Error('boom'), en, 'fallback')).toBe('boom');
  });

  it('shows an already localized error as is and falls back for unknown values', () => {
    expect(apiErrorMessage(new UserFacingError('Ya está en español'), es, 'respaldo')).toBe('Ya está en español');
    expect(apiErrorMessage(new UserFacingError('Localized'), en, 'fallback')).toBe('Localized');
    expect(apiErrorMessage(undefined, es, 'respaldo')).toBe('respaldo');
    expect(apiErrorMessage('string', en, 'fallback')).toBe('fallback');
  });

  it('reads the code from the API body only', () => {
    expect(apiErrorCode(coded('PM_JOB_EXISTS'))).toBe('PM_JOB_EXISTS');
    expect(apiErrorCode(new ApiError('x', 500, 'text body'))).toBeNull();
    expect(apiErrorCode(new Error('x'))).toBeNull();
  });

  it('covers every code the catalog declares, in both languages', () => {
    expect(Object.keys(API_ERROR_COPY.en).sort()).toEqual(Object.keys(API_ERROR_COPY.es).sort());
    for (const key of Object.keys(API_ERROR_COPY.en)) {
      expect(API_ERROR_COPY.es[key as keyof typeof API_ERROR_COPY.es]).not.toBe(API_ERROR_COPY.en[key as keyof typeof API_ERROR_COPY.en]);
    }
  });
});

describe('authErrorMessage', () => {
  it('maps the common Supabase Auth codes and messages', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }, es, 'x')).toBe(es.authInvalidCredentials);
    expect(authErrorMessage({ message: 'Invalid login credentials' }, en, 'x')).toBe(en.authInvalidCredentials);
    expect(authErrorMessage({ code: 'email_not_confirmed', message: 'Email not confirmed' }, es, 'x')).toBe(es.authEmailNotConfirmed);
    expect(authErrorMessage({ code: 'over_request_rate_limit', message: 'Request rate limit reached' }, es, 'x')).toBe(es.authRateLimited);
    expect(authErrorMessage({ code: 'weak_password', message: 'Password should be at least 8 characters' }, es, 'x')).toBe(es.authWeakPassword);
    expect(authErrorMessage({ code: 'same_password', message: 'New password should be different from the old password.' }, es, 'x')).toBe(es.authSamePassword);
  });

  it('falls back for anything else', () => {
    expect(authErrorMessage({ code: 'unexpected_failure', message: 'Database error' }, es, 'respaldo')).toBe('respaldo');
    expect(authErrorMessage(null, es, 'respaldo')).toBe('respaldo');
  });
});
