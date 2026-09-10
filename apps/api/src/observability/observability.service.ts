import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { isSentryEnabled } from './sentry-environment';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger('Observability');

  captureException(error: unknown, context?: Record<string, unknown>) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    this.logger.error(`${message}${context ? ` ${JSON.stringify(context)}` : ''}`);
    if (isSentryEnabled()) {
      Sentry.withScope((scope) => {
        if (context) scope.setContext('error_details', context);
        Sentry.captureException(error);
      });
    }
  }

  track(event: string, properties?: Record<string, unknown>) {
    this.logger.log(`[analytics] ${event}${properties ? ` ${JSON.stringify(properties)}` : ''}`);
  }
}
