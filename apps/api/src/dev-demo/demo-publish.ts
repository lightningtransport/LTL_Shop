/**
 * D39 (DP5): the published demo is built on the runner's own Postgres (fast) and copied to its Supabase project in
 * one transaction. Seeding straight into Supabase took 2 h 45 min (thousands of queries, each crossing the country);
 * a copy is a handful of big statements. Inside the transaction the old demo stays visible until the commit, so
 * visitors never see it half built.
 *
 * `publishSql` wraps a plain `pg_dump --schema=public --no-owner --no-privileges --no-comments` of the built demo:
 * first it drops what the app owns in `public` (tables, views, sequences, functions, types), leaving anything an
 * extension installed, then the dump recreates schema and data.
 */
export const PUBLISH_PRELUDE = `-- DP5: replace the demo's public schema contents (run with psql --single-transaction)
DO $$
DECLARE r record;
BEGIN
  -- By name, not by oid cast: an object an earlier CASCADE already dropped would print as a bare number.
  FOR r IN SELECT format('public.%I', c.relname) AS obj, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    ORDER BY c.relkind = 'S', c.relkind IN ('v', 'm') DESC
  LOOP
    EXECUTE format('DROP %s IF EXISTS %s CASCADE',
      CASE r.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, r.obj);
  END LOOP;
  FOR r IN SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.fn);
  END LOOP;
  FOR r IN SELECT format('public.%I', t.typname) AS ty FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS %s CASCADE', r.ty);
  END LOOP;
END $$;
`;

/** The SQL that replaces the published demo with `dump`; throws when the dump does not look like the built demo. */
export function publishSql(dump: string): string {
  if (!/CREATE TABLE public\."?_prisma_migrations"?/.test(dump) || !/CREATE TABLE public\."?work_orders"?/.test(dump)) {
    throw new Error('The dump does not contain the demo tables; nothing was copied.');
  }
  // `public` already exists on Supabase; the dump must only fill it.
  const body = dump.replace(/^CREATE SCHEMA public;\s*$/m, '');
  return `${PUBLISH_PRELUDE}\n${body}`;
}
