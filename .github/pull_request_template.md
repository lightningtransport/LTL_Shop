## Summary

- What changed and why?

## Verification

- [ ] Relevant typechecks and tests pass.
- [ ] Production build passes when runtime code changed.
- [ ] User-visible flows were checked with seeded local or staging data.
- [ ] No production write operations were used for testing.

## Documentation

- [ ] Behavior changed → `docs/SYSTEM.md` updated in this PR (or: no behavior change).
- [ ] New or changed product decision → recorded in `docs/DECISIONS.md`.
- [ ] Known defect fixed or found → `docs/OPEN_ISSUES.md` updated.
- [ ] No new documents at the root of `docs/` (see `docs/README.md`).

## Data-flow and performance review

- [ ] Independent requests start in parallel; no new authentication or data waterfall was introduced.
- [ ] Small reference data is cached/deduplicated instead of fetched per interaction.
- [ ] Large or volatile searches cancel stale requests and use measured database indexes.
- [ ] Mutation responses update the cache directly; redundant blocking refetches were avoided.
- [ ] Optimistic updates have rollback behavior, or the PR explains why optimism is unsafe.
- [ ] Cache invalidation is scoped and does not block the visible success state.
- [ ] Loading/error states affect only the relevant section or control.
- [ ] JWT validation, active-user checks, permissions, and domain rules remain server-enforced.
- [ ] Logs and documentation contain no tokens, credentials, sensitive bodies, or credential-bearing URLs.
- [ ] Performance-sensitive changes include before/after evidence or explain why it is not applicable.

See `docs/reference/ENGINEERING_PRACTICES.md`.
