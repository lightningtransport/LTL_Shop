'use client';

import { useEffect, useRef } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { ApiError, apiFetchWithRetry } from './api';
import { useAuth } from './auth-context';
import { captureException } from './observability';

const config = {
  fetcher: apiFetchWithRetry,
  dedupingInterval: 5_000,
  // Transient GET retries live in apiFetchWithRetry so the UI stays on the
  // skeleton instead of flashing LoadFailure between SWR errorRetry attempts.
  errorRetryCount: 0,
  revalidateOnFocus: true,
  shouldRetryOnError: () => false,
  onError: (error: unknown) => {
    if (error instanceof ApiError && ![401, 403].includes(error.status)) {
      captureException(error, {
        kind: error.kind,
        status: error.status,
        route: error.route,
        method: error.method,
        message: error.message,
      });
    }
  },
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={config}>
      <SessionCacheReset>{children}</SessionCacheReset>
    </SWRConfig>
  );
}

function SessionCacheReset({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { mutate } = useSWRConfig();
  const previousToken = useRef(token);

  useEffect(() => {
    const previous = previousToken.current;
    if (previous && previous !== token) {
      // Drop the previous session's cache. Refetch when a new token is present
      // so a JWT rotation does not leave `!data` as a first-load LoadFailure.
      void mutate(() => true, undefined, { revalidate: Boolean(token) });
    }
    previousToken.current = token;
  }, [token, mutate]);

  return children;
}
