/**
 * Sentry/PostHog stubs — wire DSN/keys via env when ready.
 * Keep no-op in local unless configured.
 */

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
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ph = (window as any).posthog;
    if (ph?.capture) ph.capture(event, properties);
    else console.info('[posthog:stub]', event, properties);
  }
}
