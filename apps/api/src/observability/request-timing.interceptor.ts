import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const instanceStartedAt = Date.now();
let firstRequest = true;

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = process.hrtime.bigint();
    const coldStart = firstRequest;
    firstRequest = false;
    const requestId = readRequestId(request);
    let recorded = false;

    const record = (statusCode: number, error?: unknown) => {
      if (recorded) return;
      recorded = true;

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (!response.headersSent) {
        response.setHeader('Server-Timing', `app;dur=${durationMs.toFixed(1)}`);
      }

      const event = {
        level: error ? 'error' : 'info',
        message: error ? 'request_failed' : 'request_completed',
        requestId,
        method: request.method,
        route: request.originalUrl.split('?')[0],
        statusCode,
        durationMs: Number(durationMs.toFixed(1)),
        coldStart,
        instanceAgeMs: Date.now() - instanceStartedAt,
        ...(error
          ? { error: error instanceof Error ? error.message : String(error) }
          : {}),
      };

      const serialized = JSON.stringify(event);
      if (error) console.error(serialized);
      else console.log(serialized);
    };

    return next.handle().pipe(
      tap({
        next: () => record(response.statusCode),
        error: (error) =>
          record(error instanceof HttpException ? error.getStatus() : 500, error),
      }),
    );
  }
}

function readRequestId(request: Request) {
  const vercelId = request.headers['x-vercel-id'];
  if (typeof vercelId === 'string' && vercelId) return vercelId;
  return randomUUID();
}
