/** Lightweight, explicit browser telemetry. Never send request bodies, tokens, or IDs. */

import * as Sentry from '@sentry/nextjs';
import { isSentryEnabled } from './sentry-environment';

const SENTRY_CONTEXT_KEYS = new Set(['kind', 'status', 'route', 'method', 'message']);

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

export function sentryErrorDetails(context?: Record<string, unknown>) {
  if (!context) return undefined;
  const details: Record<string, unknown> = {};
  for (const key of SENTRY_CONTEXT_KEYS) {
    const value = context[key];
    if (value === undefined) continue;
    details[key] = typeof value === 'string' ? value.slice(0, 200) : value;
  }
  return Object.keys(details).length ? details : undefined;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  const details = sentryErrorDetails(context);
  if (isSentryEnabled('client')) {
    Sentry.withScope((scope) => {
      if (details) {
        scope.setContext('error_details', details);
        if (
          typeof details.route === 'string' &&
          typeof details.method === 'string' &&
          details.status != null
        ) {
          scope.setTag('api.route', details.route);
          scope.setTag('api.method', details.method);
          scope.setTag('api.status', String(details.status));
          scope.setFingerprint([
            'api-error',
            details.method,
            details.route,
            String(details.status),
          ]);
        }
      }
      Sentry.captureException(error);
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[sentry]', error, details);
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthogClient?.capture(event, properties);
}
