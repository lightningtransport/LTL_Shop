'use client';

import { useEffect, useRef } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { ApiError, apiFetch } from './api';
import { useAuth } from './auth-context';
import { captureException } from './observability';

const config = {
  fetcher: apiFetch,
  dedupingInterval: 5_000,
  errorRetryCount: 0,
  revalidateOnFocus: true,
  shouldRetryOnError: () => false,
  onError: (error: unknown) => {
    if (error instanceof ApiError && ![401, 403].includes(error.status)) {
      captureException(error, { kind: error.kind, status: error.status });
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
    if (previousToken.current && previousToken.current !== token) {
      void mutate(() => true, undefined, { revalidate: false });
    }
    previousToken.current = token;
  }, [token, mutate]);

  return children;
}
