import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestTimingInterceptor } from './request-timing.interceptor';

describe('RequestTimingInterceptor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds Server-Timing and emits a structured completion log', async () => {
    const setHeader = vi.fn();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const request = {
      method: 'GET',
      originalUrl: '/api/health?probe=true',
      headers: { 'x-vercel-id': 'iad1::test-request' },
    };
    const response = { statusCode: 200, headersSent: false, setHeader };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ ok: true }) } as CallHandler;

    await lastValueFrom(new RequestTimingInterceptor().intercept(context, next));

    expect(setHeader).toHaveBeenCalledWith(
      'Server-Timing',
      expect.stringMatching(/^app;dur=\d+(\.\d)$/),
    );
    const event = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(event).toMatchObject({
      message: 'request_completed',
      requestId: 'iad1::test-request',
      method: 'GET',
      route: '/api/health',
      statusCode: 200,
    });
    expect(event).not.toHaveProperty('authorization');
  });
});
