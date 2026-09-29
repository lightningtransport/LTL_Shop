> **ARCHIVADO (2026-09-29).** Documento histórico: no describe el sistema actual y no manda sobre el código. La fuente vigente es [`docs/README.md`](../../README.md).

# Repository baseline

**Classification:** REFERENCE
**Captured:** 2026-09-11
**Purpose:** Safety snapshot taken before repository normalization.

## Git state

| Item | Baseline |
|---|---|
| Starting branch | `main` |
| Starting HEAD | `2a77d4e` — `Fix Manager new Work Order UX: truck search, catalog jobs, and per-job assign. (#69)` |
| Upstream | `origin/main` |
| Working tree | Clean |
| Staged changes | None |
| Unstaged changes | None |
| Untracked files | None |
| Normalization branch | `cursor/normalize-repository-be36` |

The baseline commands were `git status`, `git branch --show-current`,
`git branch -a`, `git log --oneline --decorate -n 30`, `git diff`, and
`git diff --cached`. No destructive Git command was run.

The checkout had one local branch (`main`) and many remote topic branches under
`codex/*`, `feat/*`, `fix/*`, `cursor/*`, and `release-safety/*`. They are
classified separately in `GIT_BRANCH_AUDIT.md`; no branch was deleted.

## Repository inventory at capture

- Application: Next.js in `apps/web`; NestJS in `apps/api`.
- Shared contracts: `packages/shared`.
- Data: Prisma schema, seed, and 15 authoritative migrations in
  `apps/api/prisma`; one legacy initial-schema SQL snapshot also exists at
  `supabase/migrations/20260825140000_init_domain.sql` and is not authority.
- Documentation: 21 Markdown files under `docs` plus `README.md`; no canonical
  `docs/LIGHTNING_SHOP_MASTER_PRD.md` was present.
- Tests: 17 API test files, 6 web unit test files, 1 shared test file, and 6
  Playwright E2E specifications.
- Tooling: npm workspaces, TypeScript checks as lint, Vitest, Playwright,
  Vercel configuration, and two GitHub Actions workflows.

## Initial verification

| Check | Result | Evidence |
|---|---|---|
| `npm run lint` | PASS | API, web, and shared TypeScript checks passed. |
| Shared tests | PASS | 11/11 tests passed. |
| API tests | PASS | 109/109 tests passed. |
| Web tests | PASS | 19/19 tests passed. |
| `npm run build` | PASS | API, web, and shared production builds completed. |
| Full Playwright suite, first attempt | BLOCKED | Browser executables were not installed in the VM. |
| Full Playwright suite after browser install | FAIL / INCOMPLETE | Many cases passed, but existing Chromium and WebKit failures/timeouts were observed; the run was stopped after more than ten minutes rather than hiding the failures. |

The final post-normalization matrix is in `BASELINE_VERIFICATION.md`.

## Documents found

The initial set included:

- current/engineering documents: `CURRENT_PRODUCT_STATUS.md`,
  `ENGINEERING_PRACTICES.md`, `PERFORMANCE.md`, `DEPLOY.md`;
- product and implementation documents: the mechanic P0 PRD, Shop Admin
  blueprint, Yard Phase 1 contract, ownership migration plan, PM note, and
  developer handoff;
- a dated eight-document product package;
- two dated implementation audits;
- agent slice prompts and a UX audit README.

The complete classification is maintained in `../DOCUMENTATION_INDEX.md`.

## Apparently incomplete or transitional features

This is an observation list, not approval to continue feature development:

- Work Order ownership is in soft cutover: Manager creation, per-Job
  assignment, Manager pause/resume, blocker reporting, and Manager planning UI
  exist, while legacy mechanic Standard creation and some global pause/resume
  behavior remain.
- Mechanic Home is labelled “My Assigned Work” but still exposes the legacy
  Standard creation CTA.
- Yard Operations Phase 1 and explicit readiness approval exist; physical Yard
  Presence, persisted Yard Phase events, Incoming/Departures, Samsara, McLeod,
  and Dispatch do not.
- Catalog management is read-only in Admin; write governance and Custom Job
  review are deferred.
- `pmAuthorized` remains as a compatibility column; `mechanic.pm` is the
  authorization source.
- Ninox has only a placeholder/status adapter and is not an operational source.
- Existing E2E expectations and/or fixture stability need a dedicated V1
  stabilization task before the suite can be treated as a green gate.

## Safety conclusion

No pre-existing local work required preservation beyond Git history and remote
branches. No code, migration, test, historical document, branch, or generated
artifact was deleted during baseline capture.
