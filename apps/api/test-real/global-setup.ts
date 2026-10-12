import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { GlobalSetupContext } from 'vitest/node';
import { REAL_CRON_SECRET, REAL_DATABASE_URL, assertLocalDatabase } from './env';

declare module 'vitest' {
  export interface ProvidedContext {
    apiUrl: string;
    databaseUrl: string;
    /** False when attached to an API we did not start: its env (YARD_READY_TO_GO_SINCE) is unknown. */
    ownsApi: boolean;
  }
}

let child: ChildProcess | undefined;

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForHealth(url: string, output: () => string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`The API exited with code ${child.exitCode}.\n${output()}`);
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  throw new Error(`The API did not answer ${url}/api/health in 60 s.\n${output()}`);
}

export default async function setup({ provide }: GlobalSetupContext) {
  assertLocalDatabase(REAL_DATABASE_URL);

  const prisma = new PrismaClient({ datasourceUrl: REAL_DATABASE_URL });
  try {
    const users = await prisma.user.count();
    if (!users) throw new Error('empty');
  } catch {
    throw new Error('The flow-test database is missing or empty. Run: npm run test:real:setup --workspace=@ltl-shop/api');
  } finally {
    await prisma.$disconnect();
  }

  provide('databaseUrl', REAL_DATABASE_URL);

  const attached = process.env.REAL_API_URL;
  if (attached) {
    provide('apiUrl', attached.replace(/\/$/, ''));
    provide('ownsApi', false);
    await waitForHealth(attached.replace(/\/$/, ''), () => '');
    return;
  }

  const cwd = resolve(__dirname, '..');
  const entry = resolve(cwd, 'dist/src/main.js');
  if (!existsSync(entry)) throw new Error(`Missing ${entry}. Run "nest build" first (npm run test:real does).`);

  const port = await freePort();
  let log = '';
  child = spawn(process.execPath, [entry], {
    cwd,
    env: {
      ...process.env,
      DATABASE_URL: REAL_DATABASE_URL,
      DIRECT_URL: REAL_DATABASE_URL,
      PORT: String(port),
      AUTH_DEV_BYPASS: 'true',
      // P20 / D38: these tests deactivate users straight in the database, so the guard's user cache is off here.
      AUTH_USER_CACHE_TTL_MS: '0',
      NODE_ENV: 'development',
      DATA_SOURCE: 'supabase',
      // Every completed Work Order stays Ready to Go until Return to Service (row A21).
      YARD_READY_TO_GO_SINCE: '2000-01-01T00:00:00Z',
      // LTR-186: the Vercel Cron backstop for the day close (row A32).
      CRON_SECRET: REAL_CRON_SECRET,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { log = (log + chunk).slice(-8_000); });
  child.stderr?.on('data', (chunk) => { log = (log + chunk).slice(-8_000); });

  const url = `http://127.0.0.1:${port}`;
  await waitForHealth(url, () => log);
  provide('apiUrl', url);
  provide('ownsApi', true);

  return async () => {
    child?.kill('SIGTERM');
  };
}
