# Code cleanup candidates

**Classification:** REFERENCE
**Audited commit:** `2a77d4e`
**Policy:** A candidate is not permission to delete it.

| Candidate | Reason | References | Risk | Recommended Action |
|---|---|---|---|---|
| Legacy Standard mechanic Create CTA and route | Manager create exists, but soft cutover intentionally preserves mechanic creation. | `apps/web/src/app/page.tsx`, `apps/web/src/app/mechanic/standard/new/page.tsx`, `apps/api/src/work-orders` | HIGH | KEEP until production validation and explicit V2 cutover task. |
| Legacy Standard mechanic pause/resume/change-reason API and UI paths | Manager pause and blocker reporting exist, but old contracts support in-flight/legacy behavior and PM shares service logic. | `apps/api/src/work-orders/work-orders.controller.ts`, `work-orders.service.ts`, `apps/web/src/app/work-orders/[id]/detail-client.tsx` | HIGH | KEEP; separate Standard from PM only in an approved, tested cutover. |
| `User.pmAuthorized` | Capability `mechanic.pm` is current authorization; column is compatibility-only. | `apps/api/prisma/schema.prisma`, auth DTO/seed paths | HIGH | Remove only after production stability, data verification, additive transition, and a dedicated Prisma migration. |
| `primaryCategoryId` | Per-Job Category is current, but this required field supports historical readers/reports. | Prisma `WorkOrder`, shared DTOs, API mappers | HIGH | KEEP; do not make nullable/drop during normalization. |
| Work Order-level `MechanicAssignment` | Per-Job assignment now exists, but general team and legacy access rely on this relation. | Prisma schema, Admin and Work Order services | HIGH | KEEP; define coexistence semantics before any retirement. |
| `PauseEvent` used for reported blockers | Current additive implementation distinguishes blockers with `isOfficialPause=false`; the model name is broader than the new concept. | Prisma `PauseEvent`, `reportBlocker` | MEDIUM | KEEP and validate lifecycle/reporting before considering a dedicated entity. |
| Ninox placeholder client/status endpoint | No live read/write exists and historical docs can make it look operational. | `apps/api/src/integrations/ninox`, `DATA_SOURCE=supabase` | MEDIUM | Keep as explicit stub or remove in a separately approved integration cleanup after checking deployed consumers. |
| `ninoxExternalId` compatibility fields | No operational Ninox source is active, but fields may preserve import traceability. | Multiple Prisma models | HIGH | KEEP; inventory production data before any schema decision. |
| Legacy Supabase initial-schema SQL | Duplicates the initial Prisma migration and can be mistaken for a second migration authority. | `supabase/migrations/20260825140000_init_domain.sql` | HIGH | KEEP during normalization; add a dedicated deprecation marker or relocate/remove only after deployment tooling confirms nothing consumes it. Never extend it. |
| Admin operational routes guarded by class-level `admin.access` plus selective `work_orders.manage` | Manager/Admin responsibility boundaries are partially migrated and documented as V1 CURRENT. | `apps/api/src/admin/admin.controller.ts`, `docs/audit/CAPABILITY_BOUNDARY_AUDIT.md` | HIGH | KEEP V1 guards. Do not retarget corrections or WO-level assignment until the V2 ownership cutover. |
| Stale E2E assertions/fixture behavior | Full Playwright baseline has current failures/timeouts around blocker dialog, Manager shell, navigation, and multi-category flow. | `apps/web/e2e` | MEDIUM | Create a focused V1 stabilization task; distinguish stale assertions from product regressions with isolated runs. |
| Duplicate `.env` ignore patterns | `.gitignore` repeats broad and specific `.env` entries. | `.gitignore` | LOW | Optional mechanical cleanup only; no functional benefit, so deferred. |
| Prisma seed configuration in `package.json` | Prisma warns that package-level seed config is deprecated for Prisma 7. | `apps/api/package.json` | LOW now / MEDIUM on upgrade | Move to Prisma config only during a planned Prisma upgrade. |
| Dated `docs/audits` directory beside new `docs/audit` | Naming is duplicated, but moving files would break historical links and add noisy churn. | `docs/audits`, `docs/audit` | LOW | KEEP paths; index both. Consolidate only with redirect/link updates in a docs-only task. |
| Historical prompts and superseded plans | They are unused by runtime but useful as decision history. | Dated package, `docs/agents`, old PRDs/plans | LOW | Preserve with warnings; do not execute as backlog. |
| Generated local outputs | Build/test runs create `dist`, `.next`, `test-results`, and `*.tsbuildinfo`. | Workspace output directories | LOW | Keep ignored; never commit. Local deletion is unnecessary for repository normalization. |

## Cleanup completed

- Added an authority index so old plans cannot silently drive implementation.
- Classified stale plans and audits without deleting history.
- Confirmed generated outputs are ignored and no generated artifacts are
  tracked.

No runtime code or schema cleanup was sufficiently low-risk and necessary to
perform in this normalization-only iteration.
