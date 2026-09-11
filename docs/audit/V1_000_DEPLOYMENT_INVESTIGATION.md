# V1-000 API deployment investigation

**Classification:** REFERENCE
**Investigated:** 2026-09-11
**Production commit:** `436988f`
**Deployment:** `dpl_Fg4eJtMiABB8UhuNqm42i7oHfgkA`
**Redeployment:** `dpl_46ydTmr8ETSiLqnKysbh3Z7Vr7Td`
**Status:** COMPLETE

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

## Resolution

The approved production action completed on 2026-09-11:

1. GitHub Actions **Release safety** run `34626614809` completed successfully
   on current `main` with the production migration path and API verification.
2. The production API deployment was redeployed from the failed current-main
   build as `dpl_46ydTmr8ETSiLqnKysbh3Z7Vr7Td`.
3. Vercel reports that deployment as READY, with the `ltl-shop-api.vercel.app`
   alias assigned.
4. `GET /api/health` and `GET /` return HTTP 200 with `ok: true`.
5. The combined status for `436988f` is green: both Vercel API and web
   deployments completed successfully.

The workflow in `.github/workflows/release-safety.yml` is the only approved
production migration path. Prisma files under `apps/api/prisma/migrations`
remain the sole migration authority.

## Completed criteria

All V1-000 acceptance criteria are satisfied. No repository build/configuration
change was required, and the release gate remains enforced.
