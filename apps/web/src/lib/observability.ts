/** Lightweight, explicit browser telemetry. Never send request bodies, tokens, or IDs. */

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

export function initSentryBrowser() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  // Dynamic import kept out of bundle path until DSN exists.
  console.info('[sentry] browser DSN configured');
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[sentry:stub]', error, context);
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthogClient?.capture(event, properties);
}
