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
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
