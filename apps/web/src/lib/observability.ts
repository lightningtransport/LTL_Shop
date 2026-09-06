/** Lightweight, explicit browser telemetry. Never send request bodies, tokens, or IDs. */

import * as Sentry from '@sentry/nextjs';
import { isSentryEnabled } from './sentry-environment';

let posthogClient: { capture: (event: string, properties?: Record<string, unknown>) => void } | null = null;

export async function initBrowserObservability() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined' || posthogClient) return;

  const posthog = (await import('posthog-js')).default;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
  });
  posthogClient = posthog;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (isSentryEnabled('client')) {
    Sentry.withScope((scope) => {
      if (context) scope.setContext('error_details', context);
      Sentry.captureException(error);
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[sentry]', error, context);
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthogClient?.capture(event, properties);
}
