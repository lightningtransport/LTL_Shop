import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';
import { publicRequestRoute } from './public-request-route';
import { isSentryEnabled } from './sentry-environment';

@Catch()
@Injectable()
export class SentryHttpFilter extends BaseExceptionFilter {
  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500 && isSentryEnabled()) {
      const request = host.switchToHttp().getRequest<Request>();
      const route = publicRequestRoute(request);
      Sentry.withScope((scope) => {
        scope.setTag('api.route', route);
        scope.setTag('api.method', request.method);
        scope.setTag('api.status', String(status));
        scope.setFingerprint(['api-server', request.method, route, String(status)]);
        scope.setContext('error_details', {
          kind: 'http',
          method: request.method,
          route,
          status,
          message: exception instanceof Error ? exception.message.slice(0, 200) : 'Internal server error',
        });
        Sentry.captureException(exception);
      });
    }
    super.catch(exception, host);
  }
}
