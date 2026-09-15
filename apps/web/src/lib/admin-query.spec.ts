import { describe, expect, it } from 'vitest';
import {
  adminPagedLoadState,
  adminQueryKey,
  adminResourceLoadState,
  resolveAdminQueryToken,
} from './admin-query';

describe('admin query auth gate', () => {
  it('prefers the in-memory session token', () => {
    expect(resolveAdminQueryToken('session', 'stored')).toBe('session');
    expect(resolveAdminQueryToken(null, 'stored')).toBe('stored');
    expect(resolveAdminQueryToken(undefined, undefined)).toBe(null);
  });

  it('does not build an Admin SWR key before a token is ready', () => {
    expect(adminQueryKey(null, '/api/admin/work-orders?limit=25')).toBeNull();
    expect(adminQueryKey('tok', '/api/admin/work-orders?limit=25')).toBe(
      '/api/admin/work-orders?limit=25',
    );
    expect(adminQueryKey('tok', null)).toBeNull();
  });
});

describe('adminResourceLoadState', () => {
  it('keeps a skeleton while auth is pending or the cache was wiped', () => {
    expect(adminResourceLoadState({ isLoading: true, data: undefined, error: undefined })).toBe(
      'loading',
    );
    expect(adminResourceLoadState({ isLoading: false, data: undefined, error: undefined })).toBe(
      'loading',
    );
  });

  it('surfaces LoadFailure only after a real error', () => {
    expect(
      adminResourceLoadState({ isLoading: false, data: undefined, error: new Error('nope') }),
    ).toBe('error');
    expect(adminResourceLoadState({ isLoading: false, data: { id: 't1' }, error: undefined })).toBe(
      'ready',
    );
  });

  it('does not treat a missing first page as ready', () => {
    expect(adminPagedLoadState({ isLoading: false, data: undefined, error: undefined })).toBe(
      'loading',
    );
    expect(adminPagedLoadState({ isLoading: false, data: [], error: undefined })).toBe('loading');
    expect(
      adminPagedLoadState({
        isLoading: false,
        data: [{ items: [], nextCursor: null }],
        error: undefined,
      }),
    ).toBe('ready');
  });
});
