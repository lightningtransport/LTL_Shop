# Staging / Production deploy checklist (P0)

Prisma (`apps/api/prisma/migrations`) is the only schema-migration authority.
Do not run migration SQL by hand and do not add a parallel history under
`supabase/migrations`.

## Approved production Prisma release path

A successful Vercel deploy does not prove that production migrations were
applied. Use this path before application traffic depends on a new schema.

1. Configure the GitHub Environment `production` with secrets `DATABASE_URL`
   and `DIRECT_URL` (direct connection for migrations) and variable
   `API_BASE_URL` (for example `https://ltl-shop-api.vercel.app`). Never commit,
   print, or download those values.
2. Run workflow **Release safety** (`workflow_dispatch`).
   - Default: `prisma migrate status` must report an up-to-date schema, then
     unauthenticated `GET /api/health` and `GET /` must return `{ ok: true }`.
   - Enable **Run prisma migrate deploy** only after review. That is the only
     approved production `migrate deploy` path (`PRISMA_APPROVED_RELEASE_PATH=1`).
   - The same job then runs `prisma:apply-catalog` (idempotent LTR-24 categories
     + discrete jobs, including LTR-35 Detailing). Merging the seed PR does not
     update the live shop until this path runs.
   - The gate fails the job on pending, failed, or drifted migrations.
3. Optional production build enforcement: set Vercel env `PRISMA_RELEASE_GATE=1`
   on `ltl-shop-api`. The API build then runs the same status check and refuses
   to ship if the database is behind. Leave it unset until the workflow has
   been reviewed. This flag never runs `migrate deploy`.
4. Rollback: keep the previous Vercel API/web deployments. Schema rollback is
   not automatic; restore a prior Prisma migration only with a new Prisma
   migration, never with ad-hoc SQL. Disable `PRISMA_RELEASE_GATE` only if the
   build gate itself is blocking a known-good rollback artifact.

Local CI Postgres may still run `prisma migrate deploy` directly. That is not
the production release path.

## Staging

- [ ] Supabase project created (separate from Production)
- [ ] `DATABASE_URL` + `DIRECT_URL` set (pooler + direct)
- [ ] Prisma migrate deploy applied
- [ ] Seed categories/catalog via `prisma:apply-catalog` (or full `db:seed` in local/dev)
- [ ] Mechanic users inserted in `users` with matching Supabase Auth emails
- [ ] `AUTH_DEV_BYPASS=false`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set on Vercel
- [ ] `SUPABASE_JWT_SECRET` or JWKS reachable from API
- [ ] API on Vercel Functions in `pdx1` with `CORS_ORIGIN` pointing to the Staging web URL
- [ ] Sentry DSN (web + api)
- [ ] PostHog key (optional)
- [ ] Smoke: login → create WO → Start Work → complete job → pause → resume → finish

## Production

- [ ] Branch protection + CI green
- [ ] No `AUTH_DEV_BYPASS`
- [ ] `DATA_SOURCE=supabase` (Ninox adapter is a stub; do not set `ninox`)
- [ ] Secrets only in host env (never `NEXT_PUBLIC_` for service role)
- [ ] Optional Yard Phase 1 cards: set server-only `AGENT_REPORTING_KEY` on
      the API project (never `NEXT_PUBLIC_*`). See `YARD_DATA_BOUNDARY.md`.
- [ ] Ninox live sync is **not** required for Shop go-live. Truck join, if a
      future sync is approved, is `truckNumber` ↔ Ninox `E.A` only.
- [ ] Staging acceptance signed off
- [ ] Rollback plan: previous Vercel web and API deployments
- [ ] Release safety workflow green: Prisma migrate status (deploy only via that workflow) and API health/root reads
- [ ] For a multi-Category rollout, deploy additive readers/contracts before writers; rollback may disable new writes but must continue reading existing multi-Category Work Orders
