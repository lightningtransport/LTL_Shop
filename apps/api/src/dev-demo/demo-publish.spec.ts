import { describe, expect, it } from 'vitest';
import { PUBLISH_PRELUDE, publishSql } from './demo-publish';

const DUMP = [
  "SELECT pg_catalog.set_config('search_path', '', false);",
  'CREATE SCHEMA public;',
  'CREATE TABLE public._prisma_migrations (id character varying(36) NOT NULL);',
  'CREATE TABLE public.work_orders (id uuid NOT NULL);',
  'COPY public.work_orders (id) FROM stdin;',
].join('\n');

describe('publishSql (D39, DP5)', () => {
  it('drops the old demo first, then loads the dump without recreating public', () => {
    const sql = publishSql(DUMP);
    expect(sql.startsWith(PUBLISH_PRELUDE)).toBe(true);
    expect(sql).toContain('COPY public.work_orders (id) FROM stdin;');
    expect(sql).not.toMatch(/^CREATE SCHEMA public;/m);
  });

  it('leaves extension objects alone and drops by name', () => {
    expect(PUBLISH_PRELUDE.match(/d\.deptype = 'e'/g)).toHaveLength(3);
    expect(PUBLISH_PRELUDE).not.toMatch(/::regclass|::regprocedure|::regtype/);
  });

  it('refuses a dump without the demo tables, so an empty build never wipes the demo', () => {
    expect(() => publishSql('')).toThrow(/demo tables/);
    expect(() => publishSql('CREATE TABLE public._prisma_migrations (id text);')).toThrow(/demo tables/);
  });
});
