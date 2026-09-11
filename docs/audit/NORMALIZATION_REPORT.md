# Normalization report

**Classification:** REFERENCE
**Date:** 2026-09-11
**Scope:** Repository normalization only; no product feature development.

## Repository state

- Started from clean `main` at `2a77d4e`.
- Work is isolated on `cursor/normalize-repository-be36`.
- Application, shared contracts, data, docs, tests, and tooling are inventoried
  in `REPOSITORY_INVENTORY.md`.
- No runtime source, test, migration, branch, or history was deleted.
- Generated local outputs are ignored and no generated output is tracked.

## Documentation state

- `docs/LIGHTNING_SHOP_MASTER_PRD.md` is the sole canonical product/domain
  TARGET authority.
- `docs/CURRENT_PRODUCT_STATUS.md` now records the actual soft-cutover hybrid on
  the audited commit and no longer presents future work as current.
- `docs/DOCUMENTATION_INDEX.md` classifies every relevant Markdown document and
  establishes a required reading order.
- Historical PRDs, dated packages, audits, blueprints, handoffs, and stale
  prompts remain in place with explicit historical/deprecated warnings where
  needed.
- `README.md` points new developers to the canonical/current/engineering order
  and no longer frames the whole repository as only a greenfield mechanic P0.

## Git state

- GitHub default branch: `main`; zero open PRs at audit time.
- Recent visible GitHub Actions CI runs are green, but the combined status for
  current `main` is failing because `Vercel – ltl-shop-api` failed; the web
  deployment passed.
- Fully merged remote branches and unique/unknown branches are separated in
  `GIT_BRANCH_AUDIT.md`.
- No branch was removed. Unique branches are KEEP by default.
- GitHub reports `main` as unprotected with no required checks.

## Build/test state

- PASS: all workspace typechecks/lint.
- PASS: shared 11 tests.
- PASS: API 109 tests.
- PASS: web 19 tests.
- PASS: full workspace production build.
- FAIL / INCOMPLETE: full Playwright baseline after browsers were installed.
  Many cases passed, but multiple existing cross-browser failures/timeouts were
  observed and the overlong run was stopped without claiming a false aggregate.
- FAIL: current `main` combined deployment status because the Vercel API
  deployment failed while CI and Vercel web passed.
- The exact matrix and CI coverage gaps are in `BASELINE_VERIFICATION.md`.

## Current product state

The code is not purely “mechanic-owned” and not fully cut over:

- Manager Standard creation/planning, multi-category Jobs, per-Job assignment,
  Manager pause/resume, Report Blocker, and My Assigned Work are implemented.
- Legacy mechanic Standard Create and some pause/resume behavior remain.
- PM remains specialized and capability-controlled.
- Admin operational corrections, read-only Catalog, Truck Detail, Yard
  readiness Phase 1, explicit Ready to Go, and Returned to Service exist.
- Yard Presence is UNKNOWN; external integrations are absent.

`CURRENT_VS_TARGET.md` is the mandatory control for this boundary.

## Target product state

The Master PRD defines:

- a Work Order as the complete Truck intervention;
- one active Work Order per Truck initially;
- multi-category Jobs;
- Manager-owned planning and operational control after a safe cutover;
- assignment-centered mechanic execution;
- Truck-centric Yard Operations and explicit readiness;
- later, evidence-backed Samsara/McLeod/Dispatch integration.

The target does not authorize immediate destructive cutover.

## Technical debt discovered

- E2E suite is not currently a trustworthy green gate.
- Admin/Manager capability boundaries need an explicit endpoint matrix.
- Compatibility fields/relations remain: `pmAuthorized`,
  `primaryCategoryId`, Work Order-level assignments, Ninox IDs/stub.
- Blockers share `PauseEvent` through an additive discriminator and need
  operational lifecycle validation.
- CI does not run all local unit/type/E2E checks.
- Prisma package seed configuration is deprecated for the next major version.
- A legacy initial-schema SQL file remains under `supabase/migrations`; Prisma
  is still the sole migration authority.
- Many merged remote branches remain because automatic deletion is disabled.

See `CODE_CLEANUP_CANDIDATES.md` for risk and recommended action.

## Cleanup completed

- Installed canonical documents and authority links.
- Reconciled Current State with the latest implementation.
- Classified and warned historical/deprecated documents.
- Added inventory, gap audit, cleanup triage, branch audit, verification
  baseline, roadmap, task queue, and agent workflow.
- Confirmed Prisma-only migrations, Supabase PostgreSQL/Auth, NestJS, Next.js,
  and the existing design system/shadcn direction.
- Confirmed `.gitignore` protects observed build/test/local outputs.

## Cleanup deferred

- All branch deletion, including merged-PR branches whose tips are not directly
  contained in `main`.
- All runtime/schema cleanup candidates.
- Moving/renaming historical paths.
- Removing compatibility behavior or fields.
- E2E repair, because it is a separate scoped V1 stabilization task.
- CI expansion, branch-protection changes, and Vercel API failure remediation.

## Risks

- Existing failed E2E cases may hide real regressions until isolated.
- The failed Vercel API deployment may affect production readiness and should
  be investigated before lower-priority stabilization.
- Documentation can drift again if landed features do not update Current Status
  and queue state.
- Treating the already-landed Manager slices as “not implemented” would cause
  duplicate feature work.
- Removing legacy mechanic or PM behavior before production acceptance could
  strand current users or in-flight Work Orders.
- Assuming unknown branches are abandoned could destroy unique work.

## Recommended next task

Select `V1-000 — Investigate failed Vercel API deployment` from
`docs/IMPLEMENTATION_QUEUE.md`.

Inspect the failed deployment logs, identify whether repository build code or
Vercel configuration caused the failure, repair only that existing deployment
defect, and verify health/root reads. Then select `V1-001` for the E2E gate. Do
not begin the next milestone during either task.

## Normalization completion check

| Question | Single answer |
|---|---|
| What product are we building? | `LIGHTNING_SHOP_MASTER_PRD.md` |
| What works today? | `CURRENT_PRODUCT_STATUS.md` |
| What comes next? | `DEVELOPMENT_ROADMAP.md` |
| Which documentation controls? | `DOCUMENTATION_INDEX.md` |
| What tasks remain? | `IMPLEMENTATION_QUEUE.md` |
| What is out of scope? | Master PRD + roadmap phase boundaries |
| What rules cannot break? | Master PRD + engineering/deploy documents |
| How is a change verified? | `AGENT_WORKFLOW.md` + task tests + baseline |
| What is the next task? | `V1-000` |
