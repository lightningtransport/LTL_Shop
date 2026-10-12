/**
 * Local demo database with every scenario of the mockups, to review the app with real-looking data.
 *
 *   npm run prisma:demo-local --workspace=@ltl-shop/api
 *
 * Creates `ltl_shop_demo` on this machine (DEMO_DATABASE_URL), applies the migrations, runs the seed (users,
 * catalog, PM parts, Shop workflow, trucks) and rebuilds the demo Work Orders (`reset-demo-work-orders --demo`).
 * It refuses any host other than this machine, and any database whose name lacks "demo"; the published demo's own
 * Supabase project (DEMO_SUPABASE_REF, D39) is the only remote one it accepts. Run it again to reset.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { demoDatabaseRefusal } from '../src/dev-demo/demo-target';

const DEMO_DATABASE_URL = process.env.DEMO_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ltl_shop_demo';

async function main() {
  const refusal = demoDatabaseRefusal(DEMO_DATABASE_URL);
  if (refusal) throw new Error(refusal);
  const database = new URL(DEMO_DATABASE_URL).pathname.replace(/^\//, '');
  const maintenance = new URL(DEMO_DATABASE_URL);
  maintenance.pathname = '/postgres';
  const prisma = new PrismaClient({ datasourceUrl: maintenance.toString() });
  const existing = await prisma.$queryRawUnsafe<unknown[]>('select 1 from pg_database where datname = $1', database);
  if (!existing.length) {
    await prisma.$executeRawUnsafe(`create database "${database.replace(/"/g, '')}"`);
    console.log(`Created database ${database}`);
  }
  await prisma.$disconnect();

  const cwd = resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: DEMO_DATABASE_URL, DIRECT_URL: DEMO_DATABASE_URL, DEMO_DATABASE_URL };
  const bin = (name: string) => resolve(cwd, '../../node_modules/.bin', name);
  execFileSync(bin('prisma'), ['migrate', 'deploy'], { cwd, env, stdio: 'inherit' });
  execFileSync(bin('tsx'), ['prisma/seed.ts'], { cwd, env, stdio: 'inherit' });
  execFileSync(bin('tsx'), ['prisma/reset-demo-work-orders.ts', '--demo', '--apply'], { cwd, env, stdio: 'inherit' });
  // The published demo's URL carries its password: only a local one is printed.
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(DEMO_DATABASE_URL).hostname);
  console.log(`\nDemo database ready: ${database}.${local ? ` Start the API with DATABASE_URL=${DEMO_DATABASE_URL}.` : ''}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
