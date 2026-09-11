# Lightning Shop Developer Handoff — 2026-09-10

> ⚠️ HISTORICAL DOCUMENT
> This document is preserved for historical/reference purposes and is not current product authority.
> See `docs/LIGHTNING_SHOP_MASTER_PRD.md`.

## Scope and repository state

- Canonical starting point: `main` at merge commit `3a9fb10` (PR #47).
- The Standard Work Order multi-category rollout has been merged through PRs #37–#47.
- The local untracked path `supabase/.temp/` predates this handoff. Do not add, delete, or alter it as part of this work.
- This document records production operations. It contains no credentials or secret values.

## Current domain behavior

- `WorkOrder.primaryCategoryId` remains the required legacy/primary category.
- `WorkOrderJob.categoryId` is canonical for each Job. A Standard Work Order can therefore contain Jobs from multiple categories.
- Standard Create saves a Work Order; Start Work begins labour. Completing a Job does not complete the Work Order.
- Finish Work requires all required Jobs to be resolved.
- PM remains isolated: it requires `mechanic.pm` and retains its specialised atomic create/start, mileage, parts/fitment, and completion flow.
- Work sessions, pauses, and mechanic assignment remain Work-Order-level concepts.

## Production operations already completed

### API CORS and deployment

- Vercel project: `ltl-shop-api`.
- Production `CORS_ORIGIN` was replaced with the production web origin: `https://ltl-shop-web.vercel.app`.
- The API was redeployed and reached Ready status. This is an environment/deployment change, not a Git commit.

### Prisma migration recovery

The deployed API expected a column that did not yet exist in production, causing `500` responses from Standard and Admin reads. Prisma was used as the only migration authority to apply these pending, additive migrations:

1. `20260908100000_yard_operations_readiness`
2. `20260908113000_readiness_mutation_idempotency`
3. `20260909110000_work_order_mutation_idempotency`

Afterward, production `prisma migrate status` reported `Database schema is up to date`.

Important release lesson: a successful application deploy did not prove that the production database migrations were applied. Do not deploy Prisma-dependent code without a migration gate and a post-deploy health check.

### Production smoke evidence

A deliberately labeled, auditable Standard smoke test was completed with the user’s explicit authorization to use a real unit:

- Work Order: `WO-041` / ID `d2262a20-0862-4f18-a6c8-184a88a42f78`
- Truck: `#900`
- Note: `QA smoke test: no repair performed. Multi-category workflow validation.`
- Primary category: Suspension
- Jobs: `Suspension Inspection` (Suspension) and `Brake Inspection` (Brakes)
- Verified sequence: Create -> Start Work -> Add Job in a second category -> complete first Job while the WO remained In Progress -> complete second Job -> Finish Work.
- Final state: Completed; Standard dashboard returned to zero active Jobs.

The Standard-only QA account is `qa.multicategory.31b7ed5a@lightning.local`. It has only `mechanic.standard`. Its password is intentionally not recorded; reset or replace it in Supabase Auth if another QA session is needed. Navigating to `/mechanic/pm` as this account redirected to Standard.

## Required next work

1. Create a small release-safety PR that defines and implements the production migration gate. It must be reviewed before enabling it:
   - run `prisma migrate status` against the intended production datasource;
   - run `prisma migrate deploy` only through the approved release path;
   - fail the release when migrations are pending/failed;
   - verify the API health/read endpoints after deployment;
   - never print, commit, or download production credentials into a tracked file.
2. Decide whether the QA Standard account should remain available or be deleted after the release-safety work is accepted.
3. Do not create further Work Orders on real trucks for routine verification. Use a clearly designated QA/demo unit once product/operations supplies one.

## Local setup and validation

From a clean clone of `main`:

```bash
npm ci
npm run build --workspace=@ltl-shop/shared
npm run lint --workspace=@ltl-shop/api
npm test --workspace=@ltl-shop/api
npm run build --workspace=@ltl-shop/web
git diff --check
```

Before any production release, run the approved migration-status path and inspect the deployment/API health. Do not use production for load or performance tests.

## Copy-ready prompt for the next developer

```text
Work in the Lightning Shop repository from the current origin/main. Read docs/DEVELOPER_HANDOFF_2026-09-10.md first, then README.md, DEPLOY.md, docs/CURRENT_PRODUCT_STATUS.md, docs/ENGINEERING_PRACTICES.md, and the Prisma schema/migrations.

Task: propose and implement only a small, reviewable release-safety change that prevents deployed Prisma code from reaching production before its required migrations are applied. Do not alter the Standard/PM multi-category domain, Yard functionality, UI behavior, or existing migrations.

Before editing, report Git root, branch, status, deployment/migration mechanism discovered, exact files proposed, rollback, and how secrets remain protected. Preserve Prisma as the only migration authority. Do not manually execute migration SQL, do not write production data, and do not use production for performance tests.

The release path must make a failed or pending Prisma migration visible before application traffic depends on the new schema, and it must include a post-deploy API health/read verification. Use additive, reversible configuration/code changes where possible. Run the relevant shared/API/web checks and git diff --check. Create one scoped commit and PR, but do not merge it.
```
