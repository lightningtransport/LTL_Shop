import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertApprovedReleasePath,
  evaluateMigrateStatus,
  parseReleaseGateArgs,
  redactSecrets,
  shouldRunVercelBuildGate,
  verifyApiReads,
} from './prisma-release-gate';

const UP_TO_DATE = `
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "db.example.supabase.co:5432"

11 migrations found in prisma/migrations

Database schema is up to date!
`;

const PENDING = `
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "db.example.supabase.co:5432"

Following migrations have not yet been applied:
20260908100000_yard_operations_readiness
20260909110000_work_order_mutation_idempotency

To apply pending migrations, run prisma migrate deploy.
`;

const FAILED = `
The \`20260909110000_work_order_mutation_idempotency\` migration started at 2026-09-10 12:00:00.000000 UTC failed

`;

describe('prisma release gate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('treats an up-to-date schema as safe', () => {
    expect(evaluateMigrateStatus(UP_TO_DATE, 0)).toMatchObject({
      kind: 'up-to-date',
      ok: true,
    });
  });

  it('fails visibly on pending migrations', () => {
    expect(evaluateMigrateStatus(PENDING, 1)).toMatchObject({
      kind: 'pending',
      ok: false,
      message: expect.stringContaining('20260908100000_yard_operations_readiness'),
    });
  });

  it('fails visibly on failed migrations and does not treat them as pending', () => {
    const result = evaluateMigrateStatus(FAILED, 1);
    expect(result.kind).toBe('failed');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('20260909110000_work_order_mutation_idempotency');
  });

  it('redacts datasource URLs, hosts, and env assignments', () => {
    const leaked =
      'connected with postgresql://postgres:secret@db.example.supabase.co:5432/postgres DATABASE_URL=postgresql://postgres:secret@db.example.supabase.co:5432/postgres DIRECT_URL=postgres://u:p@localhost/db at "db.example.supabase.co:5432"';
    const redacted = redactSecrets(leaked);
    expect(redacted).not.toMatch(/secret/);
    expect(redacted).not.toMatch(/postgres:\/\/u:p/);
    expect(redacted).toContain('postgresql://***');
    expect(redacted).toContain('at "[redacted-host]"');
    expect(redacted).toContain('DATABASE_URL=***');
  });

  it('allows migrate deploy only on the approved release path', () => {
    expect(() => assertApprovedReleasePath({})).toThrow(/approved GitHub release path/);
    expect(() => assertApprovedReleasePath({ PRISMA_APPROVED_RELEASE_PATH: '1' })).not.toThrow();
  });

  it('keeps the Vercel build gate off until explicitly enabled', () => {
    expect(shouldRunVercelBuildGate({})).toBe(false);
    expect(shouldRunVercelBuildGate({ PRISMA_RELEASE_GATE: '1' })).toBe(true);
  });

  it('verifies unauthenticated API health and root reads', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith('/api/health')) {
        return new Response(JSON.stringify({ ok: true, dataSource: 'supabase' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, name: 'Lightning Shop API' }), { status: 200 });
    }) as unknown as typeof fetch;

    const probes = await verifyApiReads('https://ltl-shop-api.example', fetchImpl);
    expect(probes).toHaveLength(2);
    expect(probes.every((probe) => probe.ok)).toBe(true);
  });

  it('rejects credential-bearing API_BASE_URL values', async () => {
    await expect(verifyApiReads('https://user:pass@example.com')).rejects.toThrow(/must not include credentials/);
  });

  it('fails post-deploy verification on non-OK health payloads', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })) as unknown as typeof fetch;
    await expect(verifyApiReads('https://ltl-shop-api.example', fetchImpl)).rejects.toThrow(/Post-deploy read failed/);
  });

  it('parses CLI flags without enabling deploy by default', () => {
    expect(parseReleaseGateArgs(['--status', '--require-up-to-date'])).toMatchObject({
      deploy: false,
      requireUpToDate: true,
    });
    expect(parseReleaseGateArgs(['--deploy', '--verify-api'])).toMatchObject({
      deploy: true,
      verifyApi: true,
    });
  });
});
