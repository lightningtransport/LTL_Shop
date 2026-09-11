# Agent and development workflow

**Classification:** ENGINEERING
**Updated:** 2026-09-11

## Required task framing

Before code, every iteration records:

- Problem: the operational or technical defect being solved.
- Current: tested behavior today.
- Target: the relevant canonical product rule.
- Scope: the smallest safe change.
- Out of Scope: nearby work intentionally excluded.
- Risk: data, authorization, PM, history, UX, or integration impact.
- Verification: commands and acceptance evidence.

## Context loading

Load only:

1. the relevant Master PRD section;
2. the relevant Current Product Status section;
3. the selected `IMPLEMENTATION_QUEUE.md` task;
4. affected code and related tests.

Use `DOCUMENTATION_INDEX.md`, `audit/CURRENT_VS_TARGET.md`, and
`DEVELOPMENT_ROADMAP.md` as reusable context. Do not reread historical packages
unless the active task explicitly needs historical reasoning.

## Responsibility strategy

### Product / Architecture

Use for domain conflicts, schema/migration decisions, authorization,
concurrency, integrations, and cross-module changes. It must read relevant
Master PRD and Current Status sections.

### Implementation

Use for one scoped queue task, API/web changes, and tests. It must receive the
task ID, boundaries, affected files, and acceptance criteria.

### Documentation

Use for classification, index/status maintenance, and mechanical headers. It
must not reinterpret product rules.

### Test / Review

Use after implementation for regression review, isolated reproduction, full
verification, and diff review.

Do not launch an agent when a direct edit or command is smaller than the
handoff. Prefer faster/lower-cost execution for formatting, headers, repetitive
test updates, and obvious refactors; reserve deeper reasoning for domain,
schema, authorization, concurrency, and multi-module work.

## Development loop

```text
Select one READY task
  → Read relevant product rule
  → Inspect current implementation
  → Define gap and boundaries
  → Implement smallest safe change
  → Run focused and regression tests
  → Review diff
  → Update CURRENT_PRODUCT_STATUS.md
  → Update task status/evidence
  → Commit
```

Do not start another feature while the selected task has unreviewed code,
failing required tests, or stale current-state documentation.

## Non-negotiable verification

- Prisma migrations are the only schema authority.
- Authorization and business rules remain server-side.
- Existing Work Orders, Activity Log, PM, and historical data remain protected.
- Unit/type/build checks run in proportion to scope.
- User-visible changes receive seeded E2E coverage.
- Failures are recorded as FAIL/BLOCKED, never relabelled PASS.
- Documentation-only changes run `git diff --check` and link to existing
  runtime evidence; they do not justify product behavior changes.

## Commit discipline

Keep documentation, runtime refactors, features, tests, and migrations in
separate semantic commits when independently reviewable. Never use a large
prompt as a substitute for a queue task.
