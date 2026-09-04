'use client';

import { useEffect } from 'react';
import { initBrowserObservability } from '@/lib/observability';

export function ObservabilityProvider() {
  useEffect(() => {
    void initBrowserObservability();
  }, []);

  return null;
}
