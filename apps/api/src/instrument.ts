import * as Sentry from '@sentry/nestjs';
import { getSentryDsn, getSentryEnvironment, isSentryEnabled } from './observability/sentry-environment';

Sentry.init({
  dsn: getSentryDsn(),
  enabled: isSentryEnabled(),
  environment: getSentryEnvironment(),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event, hint) {
    const exception = hint.originalException;
    if (exception && typeof exception === 'object' && 'getStatus' in exception) {
      const status = (exception as { getStatus?: () => number }).getStatus?.();
      if (typeof status === 'number' && status < 500) return null;
    }
    return event;
  },
});
