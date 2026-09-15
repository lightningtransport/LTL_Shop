'use client';

import { useEffect, useRef } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { ApiError, apiFetch } from './api';
import { useAuth } from './auth-context';
import { captureException } from './observability';

export function sessionCacheAction(
  previousToken: string | null,
  nextToken: string | null,
): 'none' | 'clear' | 'revalidate' {
  if (!previousToken || previousToken === nextToken) return 'none';
  return nextToken ? 'revalidate' : 'clear';
}

const config = {
  fetcher: apiFetch,
  dedupingInterval: 5_000,
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
    const action = sessionCacheAction(previousToken.current, token);
    previousToken.current = token;
    if (action === 'clear') {
      void mutate(() => true, undefined, { revalidate: false });
    } else if (action === 'revalidate') {
      // Keep cached rows visible while the Bearer token rotates (Supabase refresh).
      // Clearing with revalidate:false made Admin `error || !data` paint LoadFailure.
      void mutate(() => true);
    }
  }, [token, mutate]);

  return children;
}
