# Git branch audit

**Classification:** REFERENCE
**Audited:** 2026-09-11 after `git fetch origin`
**Default branch:** `main`

## Summary

- Starting local state: only `main`, clean at `2a77d4e`.
- Working branch: `cursor/normalize-repository-be36`.
- GitHub reports zero open pull requests.
- The latest 20 visible Actions runs were successful, including the current
  `main` CI run.
- GitHub reports `main` as `protected: false`; no required checks are configured.
- The combined `main` status is failing because Vercel API failed, while CI and
  Vercel web passed.
- Repository setting `deleteBranchOnMerge` is false, which explains the large
  merged-branch inventory.

No local or remote branch was deleted.

## ACTIVE

| Branch | Basis |
|---|---|
| `main` | Default and production branch. |
| `cursor/normalize-repository-be36` | Current normalization work. |

## MERGED

The following remote branches are fully contained in `origin/main`. Their
commits are not unique relative to `main`:

```text
codex/a11y-open-work-order
codex/admin-operations-ux-fixes
codex/audit-ux-corrections
codex/branded-authentication-header
codex/daniel-pm-only
codex/document-multicategory-current
codex/fix-post-login-home-loading
codex/fix-screen-position-consistency
codex/fix-truck-mutation-lock
codex/header-branding-layout
codex/install-sentry
codex/instant-shop-interactions
codex/mechanic-access-and-work-order-flow
codex/mechanic-roster
codex/multi-workspace-access
codex/multicategory-mobile-regression
codex/normal-mechanic-form
codex/password-recovery
codex/performance-engineering-practices
codex/performance-optimization
codex/production-handoff
codex/sentry-production-only
codex/shop-admin-integration-blueprint
codex/shop-admin-phase-1
codex/shop-admin-phase-2-dashboard-work-orders
codex/shop-admin-responsive-layout-fix
codex/ux-theme-accessibility
codex/work-order-add-job-multicategory
codex/work-order-add-job-safety-main
codex/work-order-create-multicategory
codex/work-order-history-category-readers
codex/work-order-multicategory-docs
codex/work-order-multicategory-e2e
codex/yard-operations-phase-1
cursor/sentry-api-error-grouping-114c
cursor/sentry-mcp-json-114c
cursor/sentry-replay-unmask-b4c8
cursor/sentry-session-replay-114c
cursor/setup-dev-environment-4c72
feat/admin-catalog-read
feat/admin-job-cancel-reopen-main
feat/admin-mechanics-history
feat/admin-return-to-service
feat/admin-time-corrections
feat/admin-trucks-list
feat/admin-work-order-assignments
feat/admin-work-order-cancel
feat/admin-work-order-complete
feat/wo-ownership-docs
```

Recommendation: these are cleanup candidates, but remote deletion should be a
separate repository-administration action after confirming rollback/tag policy
and ownership. They were intentionally kept.

## MERGED BY PR — tip not directly contained

These branches all have merged pull-request evidence, but their tips are not
directly contained in `origin/main` because of squash, stacked work, or later
branch commits:

```text
codex/document-workflow-status
codex/fix-vercel-nest-esm
codex/pm-daniel-parts
codex/prevent-duplicate-jobs
codex/standardize-page-navigation
codex/work-order-add-job-safety
codex/work-order-completion-ux
codex/work-order-job-category-readers
codex/workflow-regression-fixes
cursor/document-dev-environment-4c72
feat/admin-job-cancel-reopen
feat/admin-work-order-fields
feat/admin-work-order-reopen
fix/manager-create-wo-ux
release-safety/prisma-migration-gate
```

Eleven are patch-equivalent to `main` under `git cherry` and are lower-risk
cleanup candidates:

```text
codex/pm-daniel-parts
codex/prevent-duplicate-jobs
codex/standardize-page-navigation
codex/work-order-add-job-safety
codex/work-order-completion-ux
codex/work-order-job-category-readers
codex/workflow-regression-fixes
cursor/document-dev-environment-4c72
feat/admin-work-order-reopen
fix/manager-create-wo-ux
release-safety/prisma-migration-gate
```

Four retain patches that `git cherry` does not recognize in `main` and require
diff review before deletion:

| Branch | Commits ahead | Unrecognized patches |
|---|---:|---:|
| `codex/document-workflow-status` | 10 | 9 |
| `codex/fix-vercel-nest-esm` | 9 | 9 |
| `feat/admin-job-cancel-reopen` | 2 | 2 |
| `feat/admin-work-order-fields` | 2 | 2 |

Recommendation: KEEP all 15 until the appropriate cleanup review. “Merged PR”
does not prove that every later branch-tip patch is disposable.

## ABANDONED

None. No branch had sufficient evidence for this classification.

## UNKNOWN

None after correlating every pre-normalization remote work branch with merged
pull-request history. The four review-required branches above remain classified
MERGED but are not safe-delete candidates yet.

## GitHub configuration observations

| Item | Result |
|---|---|
| Visibility | Private |
| Default branch | `main` |
| Merge commit | Allowed |
| Squash merge | Allowed |
| Rebase merge | Allowed |
| Delete branch on merge | Disabled |
| Open PRs | 0 |
| Recent GitHub Actions | Green |
| Combined `main` status | FAIL — Vercel API failed; Vercel web passed |
| Branch protection | Disabled |
| Required checks | None |

## Recommended hygiene action

After the normalization PR is accepted, run a human-reviewed branch cleanup
batch beginning with the 49 directly contained branches. Review the four
unrecognized-patch branches before any deletion. Protect `main`, require PR +
CI, block force-push/deletion, investigate the Vercel API failure, and consider
delete-on-merge if rollback policy permits.
