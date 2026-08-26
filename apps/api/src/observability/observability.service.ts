import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger('Observability');

  captureException(error: unknown, context?: Record<string, unknown>) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    this.logger.error(`${message}${context ? ` ${JSON.stringify(context)}` : ''}`);
  }

  track(event: string, properties?: Record<string, unknown>) {
    this.logger.log(`[analytics] ${event}${properties ? ` ${JSON.stringify(properties)}` : ''}`);
  }
}
