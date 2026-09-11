# V1-000 API deployment investigation

**Classification:** REFERENCE
**Investigated:** 2026-09-11
**Production commit:** `436988f`
**Deployment:** `dpl_Fg4eJtMiABB8UhuNqm42i7oHfgkA`
**Status:** BLOCKED — production migration approval and redeploy required

## Root cause

The `ltl-shop-api` production deployment is not failing compilation. Its
Prisma release gate correctly refuses to build application code while the
production database has four unapplied migrations:

- `20260910180000_truck_service_status_events`
- `20260911120000_work_orders_manage_capability`
- `20260911130000_work_order_job_assignment`
- `20260911140000_pause_event_blockers`

The Vercel build completed dependency installation, the shared build, and
Prisma Client generation. `npm run prisma:release-gate` then reported the
migrations as pending and exited non-zero by design. Preview success does not
contradict this result because `PRISMA_RELEASE_GATE=1` is production-only.

This is a release-order failure, not a repository build/config defect. No code,
schema, migration, or Vercel configuration should be changed to bypass it.

## Evidence

| Check | Result |
|---|---|
| GitHub CI for `436988f` | PASS — run `34624747455` |
| Vercel web deployment | PASS |
| Vercel API deployment | FAIL — Prisma release gate |
| Combined commit status | FAIL — only `Vercel – ltl-shop-api` is failing |
| Production `GET /api/health` | PASS — HTTP 200 and `ok: true` |
| Production `GET /` | PASS — HTTP 200 and `ok: true` |
| API runtime errors, previous 24 hours | None reported |
| Local/Vercel deployment credentials in this agent | BLOCKED — no authorized workflow-dispatch or redeploy credential |

The healthy probes describe the previous production deployment. They do not
make the failed `436988f` deployment READY.

## Required production action

An authorized maintainer must:

1. Run GitHub Actions workflow **Release safety** on `main` with
   `apply_migrations=true` and `verify_api=true`.
2. Confirm all four Prisma migrations apply, the post-deploy migration status
   is up to date, and both API probes pass.
3. Redeploy production deployment `dpl_Fg4eJtMiABB8UhuNqm42i7oHfgkA` (or trigger
   a fresh Git-integrated production deployment for current `main`).
4. Confirm the API deployment is READY and the combined status for `436988f`
   is green.

The workflow in `.github/workflows/release-safety.yml` is the only approved
production migration path. Prisma files under `apps/api/prisma/migrations`
remain the sole migration authority.

## Resolution criteria

Do not mark V1-000 complete until:

- the approved Release safety run succeeds;
- a current-`main` API production deployment is READY;
- `/api/health` and `/` return HTTP 200 with `ok: true`; and
- the combined commit status is green.
