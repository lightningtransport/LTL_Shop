import './instrument';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import { AppModule } from './app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require('express') as typeof import('express');
const expressApp: Express = express();

/**
 * PF8 (OPEN_ISSUES §1s): the web app lives on another origin, so every API call with an Authorization header
 * needs a CORS preflight. Without `Access-Control-Max-Age` the browser repeats it about every 5 s, which doubles
 * the trips of every read and every poll. Ten minutes is within what every browser honours (Chrome caps at 2 h).
 */
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

export function buildCorsOptions(): CorsOptions {
  const configured = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    return {
      origin: configured.length === 1 ? configured[0] : configured,
      credentials: true,
      maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
    };
  }

  return {
    // Reflect request origin in development (fixes Failed to fetch / CORS)
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const ok =
        configured.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      callback(null, ok);
    },
    credentials: true,
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  };
}

let appPromise: Promise<NestExpressApplication> | undefined;

async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  app.enableCors(buildCorsOptions());
  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  await app.init();
  return app;
}

function ensureApp() {
  if (!appPromise) {
    appPromise = createApp();
  }
  return appPromise;
}

async function bootstrap() {
  const app = await ensureApp();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

// Vercel / serverless: export the Express instance (Nest mounts onto it).
// Local: listen on PORT.
if (process.env.VERCEL) {
  void ensureApp().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to bootstrap Nest on Vercel', err);
  });
} else {
  void bootstrap();
}

export default expressApp;
