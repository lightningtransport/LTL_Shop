'use client';

import { useEffect, useRef } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { ApiError, apiFetch } from './api';
import { useAuth } from './auth-context';

const config = {
  fetcher: apiFetch,
  dedupingInterval: 5_000,
  errorRetryCount: 2,
  revalidateOnFocus: true,
  shouldRetryOnError: (error: unknown) =>
    !(error instanceof ApiError && [401, 403].includes(error.status)),
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
