// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, getSentryEnvironment, isSentryEnabled } from "./lib/sentry-environment";

function sentryTracePropagationTargets() {
  const targets: Array<string | RegExp> = ['localhost', /^\//];
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return targets;
  try {
    targets.push(new URL(apiUrl).origin);
  } catch {
    // Ignore invalid NEXT_PUBLIC_API_URL; traces still stay on same-origin fetches.
  }
  return targets;
}

Sentry.init({
  dsn: getSentryDsn("client"),
  enabled: isSentryEnabled("client"),
  environment: getSentryEnvironment("client"),

  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  tracePropagationTargets: sentryTracePropagationTargets(),

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  // Session Replay is browser-only. Do not add replayIntegration to server/edge configs.
  integrations: [Sentry.replayIntegration()],
  // 10% of sessions; raise to 1.0 while verifying Replay locally or in a preview.
  replaysSessionSampleRate: 0.1,
  // Capture every session that hits an error.
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
