/** Admin SWR should not fetch until a client token exists. */
export function resolveAdminQueryToken(
  token: string | null | undefined,
  storedToken: string | null | undefined,
) {
  return token || storedToken || null;
}

export function adminQueryKey(token: string | null, key: string | null) {
  return token ? key : null;
}

export type AdminResourceLoadState = 'loading' | 'error' | 'ready';

/**
 * Cache wipe with `revalidate: false` leaves `data` empty and `error` unset.
 * Treat that as still loading so first-load does not fail-closed into LoadFailure.
 * Real failures keep `error` so Retry remains available.
 */
export function adminResourceLoadState(input: {
  isLoading: boolean;
  data: unknown;
  error: unknown;
}): AdminResourceLoadState {
  if (input.isLoading || (input.data == null && !input.error)) return 'loading';
  if (input.error) return 'error';
  return 'ready';
}

export function adminPagedLoadState(input: {
  isLoading: boolean;
  data: unknown[] | undefined;
  error: unknown;
}): AdminResourceLoadState {
  return adminResourceLoadState({
    isLoading: input.isLoading,
    data: input.data?.[0],
    error: input.error,
  });
}
