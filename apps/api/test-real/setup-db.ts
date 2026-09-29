/**
 * Creates (if missing), migrates and seeds the flow-test database.
 *   npm run test:real:setup --workspace=@ltl-shop/api
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { REAL_DATABASE_URL, assertLocalDatabase } from './env';

async function main() {
  assertLocalDatabase(REAL_DATABASE_URL);
  const target = new URL(REAL_DATABASE_URL);
  const database = target.pathname.replace(/^\//, '');
  const maintenance = new URL(REAL_DATABASE_URL);
  maintenance.pathname = '/postgres';

  const prisma = new PrismaClient({ datasourceUrl: maintenance.toString() });
  const existing = await prisma.$queryRawUnsafe<unknown[]>('select 1 from pg_database where datname = $1', database);
  if (!existing.length) {
    await prisma.$executeRawUnsafe(`create database "${database.replace(/"/g, '')}"`);
    console.log(`Created database ${database}`);
  }
  await prisma.$disconnect();

  const cwd = resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: REAL_DATABASE_URL, DIRECT_URL: REAL_DATABASE_URL };
  const bin = (name: string) => resolve(cwd, '../../node_modules/.bin', name);
  execFileSync(bin('prisma'), ['migrate', 'deploy'], { cwd, env, stdio: 'inherit' });
  execFileSync(bin('tsx'), ['prisma/seed.ts'], { cwd, env, stdio: 'inherit' });
  console.log(`Flow-test database ready: ${database}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
