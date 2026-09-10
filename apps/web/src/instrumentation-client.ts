// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, getSentryEnvironment, isSentryEnabled } from "./lib/sentry-environment";

Sentry.init({
  dsn: getSentryDsn("client"),
  enabled: isSentryEnabled("client"),
  environment: getSentryEnvironment("client"),

  tracesSampleRate: 0.1,
  sendDefaultPii: false,

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
