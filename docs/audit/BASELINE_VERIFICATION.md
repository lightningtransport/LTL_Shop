# Baseline verification

**Classification:** REFERENCE
**Baseline commit:** `2a77d4e`
**Run date:** 2026-09-11

## Results

| Verification | Result | Details |
|---|---|---|
| `npm run lint` | PASS | API, web, and shared TypeScript checks passed. |
| `npm run test --workspace=@ltl-shop/shared` | PASS | 1 file, 11 tests. |
| `npm run test --workspace=@ltl-shop/api` | PASS | 17 files, 109 tests. |
| `npm run test --workspace=@ltl-shop/web` | PASS | 6 files, 19 tests. |
| `npm run build` | PASS | Shared, NestJS, Prisma generation, and Next.js production build passed. |
| `ADMIN_E2E_FIXTURE=1 npm run test:e2e --workspace=@ltl-shop/web` | FAIL / INCOMPLETE | Initial run was blocked by missing browser binaries. After installing Chromium/WebKit, many cases passed but multiple existing failures/timeouts occurred; the overlong run was stopped after more than ten minutes. |
| `git diff --check origin/main...HEAD` | PASS | Committed normalization diff has no whitespace errors. |
| V1-000 production release safety | PASS | Run `34626614809` applied the four pending Prisma migrations and passed API health/root verification on current `main`. |
| V1-000 API production redeploy | PASS | Deployment `dpl_46ydTmr8ETSiLqnKysbh3Z7Vr7Td` is READY; health and root return HTTP 200 with `ok: true`. |
| Documentation index coverage | PASS | All 33 Markdown files under `docs` other than the self-classifying index are listed. |
| Active documentation links | PASS | Relative links in README, active authorities, plans, and audit deliverables resolve locally. |

## E2E evidence and interpretation

V1-001 (PR #73) later restored the fixture gate: 86 cases passed one browser /
one worker. The notes below are the historical incomplete baseline run from
this normalization snapshot; they are not the current gate result.

The browser-installed run started 86 project cases across mobile Chromium and
mobile WebKit. Passing observations included:

- mechanic authentication, cache/navigation, Standard create CTA, and PM flows;
- Admin authorization, dashboard metrics, read-only views, Yard Operations,
  and several Truck Detail/readiness cases;
- responsive controls, catalog selection, sign-out, and PM regression cases.

Observed failures/timeouts included both-browser variants of:

- blocker dialog focus/top positioning;
- some Manager Admin shell navigation/locale flows;
- multi-workspace navigation;
- stalled Home retry and logical back-destination flows;
- multi-category Standard creation fixture flow;
- finish confirmation;
- one WebKit readiness mutation flow.

Because the run was stopped before Playwright emitted its aggregate summary,
individual pass/fail totals are intentionally not claimed. These failures
predate the docs-only normalization changes and require isolated reproduction.
They are not hidden and are queued as the recommended V1 stabilization task.

## Build warnings

- Prisma warns that `package.json#prisma` seed configuration will be removed in
  Prisma 7. This does not fail the current Prisma 6 build.
- Next.js reports large serialized webpack cache strings. The build still
  compiles and generates all routes.
- Playwright reports `NO_COLOR` is ignored because `FORCE_COLOR` is set.

## CI baseline

`.github/workflows/ci.yml` currently:

1. installs dependencies;
2. builds shared;
3. generates Prisma;
4. applies and checks migrations against PostgreSQL 16;
5. runs API tests and API typecheck;
6. builds web.

It does not currently run shared tests, web unit tests, full workspace lint,
Playwright, or an explicit API production build. This is a verification gap,
not a failure in the current visible GitHub runs. The latest 20 visible Actions
runs, including `main`, were successful.

The V1-000 release action resolved the former separate combined-status failure
on current `main`:

- CI/check `test`: successful;
- `Vercel – ltl-shop-web`: successful;
- `Vercel – ltl-shop-api`: successful after the approved migration release and
  redeploy.

## Status vocabulary

- PASS: command completed successfully.
- FAIL: command executed and produced failing assertions or an error.
- NOT RUN: intentionally omitted.
- BLOCKED: prerequisite prevented test execution.
- FAIL / INCOMPLETE: failures were observed, but the aggregate run did not
  finish cleanly.

## Required next verification

V1-001 is complete (PR #73). Remaining V1 production smoke rows are
OPERATOR_REQUIRED in `V1_003_RELEASE_SMOKE.md`.
