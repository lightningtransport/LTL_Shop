/**
 * D39 (DP5): turns a pg_dump of the built demo (stdin) into the SQL that replaces the published demo (stdout).
 *
 *   pg_dump ... ltl_shop_demo | npm run --silent prisma:demo-publish-sql --workspace=@ltl-shop/api > publish.sql
 *
 * It refuses unless DEMO_DATABASE_URL is the published demo's Supabase project (`demoDatabaseRefusal`, never
 * production). `.github/workflows/demo-reset.yml` runs it and loads the result with psql in one transaction.
 */
import { readFileSync } from 'node:fs';
import { publishSql } from '../src/dev-demo/demo-publish';
import { demoDatabaseRefusal } from '../src/dev-demo/demo-target';

function main() {
  const target = process.env.DEMO_DATABASE_URL ?? '';
  const refusal = demoDatabaseRefusal(target);
  if (refusal) throw new Error(refusal);
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(target).hostname)) {
    throw new Error('DEMO_DATABASE_URL is a local database; the copy is only for the published demo.');
  }
  process.stdout.write(publishSql(readFileSync(0, 'utf8')));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
