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
- GitHub branch-protection details returned HTTP 403 to the available
  integration. `docs/DEPLOY.md` requires branch protection, but its live
  configuration is therefore `UNKNOWN` in this audit.
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

## UNKNOWN — unique commits or unverifiable intent

These branches are not fully contained in `origin/main` and have no open PR.
That is not enough evidence to call them abandoned:

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

Recommendation: KEEP. For each branch, ask the original owner or compare its
unique commits/patch-id against merged squash commits before deciding whether
to archive or delete it.

## ABANDONED

None. No branch had sufficient evidence for this classification.

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
| Recent Actions | Green |
| Branch protection | UNKNOWN (read denied) |

## Recommended hygiene action

After the normalization PR is accepted, run a human-reviewed branch cleanup
batch for the MERGED list and enable delete-on-merge if rollback policy permits.
Do not include UNKNOWN branches in that batch.
