// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn, getSentryEnvironment, isSentryEnabled } from "./src/lib/sentry-environment";

Sentry.init({
  dsn: getSentryDsn("server"),
  enabled: isSentryEnabled("server"),
  environment: getSentryEnvironment("server"),

  tracesSampleRate: 0.1,
  sendDefaultPii: false,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});
