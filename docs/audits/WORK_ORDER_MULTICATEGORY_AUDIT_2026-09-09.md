# Work Order multi-Category audit — 2026-09-09

## 1. Checkout and scope

- Branch audited: `codex/work-order-multicategory-docs`, created from refreshed
  `origin/main` at `2d18680f47565b563f0b04ec7fe6677bc03ea571`.
- Base commit: merge of PR #36, Yard Operations Phase 1.
- Initial status: the seven supplied package documents were untracked. The
  unrelated `supabase/.temp/` directory was already untracked and is excluded
  from this documentation change.
- Inspected: requested canonical documents and package; Prisma schema and all
  migrations; shared enums/types/Zod; Work Orders, Trucks, Admin, auth and Yard
  services/controllers; Standard and PM web paths; tests; deploy configuration.
- Audit methods were read-only. No database rows or external integration data
  were queried, so production data consistency is not claimed.

## 2. Document-to-implementation matrix

| Document claim | Classification | Implementation evidence | Test/evidence |
| --- | --- | --- | --- |
| Standard Create does not Start | LOCKED/CURRENT | `apps/api/src/work-orders/work-orders.service.ts:233-250`; PM alone starts at create | `apps/api/src/work-orders/work-orders.pm.spec.ts` |
| PM authority is `mechanic.pm` | LOCKED/CURRENT | `packages/shared/src/enums.ts:7-12`; service capability checks at `work-orders.service.ts:142-154` | `work-orders.capabilities.spec.ts`, `work-orders.pm.spec.ts` |
| One open Work Order per Truck | LOCKED/CURRENT | transactional Truck advisory lock and post-lock re-read at `work-orders.service.ts:190-226` | PM/create concurrency and Yard mutation specs |
| Every Job stores Category | CURRENT | Work Order FK at `apps/api/prisma/schema.prisma:295-336`; Job FK at `:432-455`; DTO at `packages/shared/src/types.ts:59-69` | shared schema and API tests |
| Standard may mix Categories | TARGET, not CURRENT | rejected at `work-orders.service.ts:170-173` and `:575-578`; creation UI filters by one Category at `apps/web/src/app/work-orders/new/page.tsx:138-172,457-560` | existing tests assert rejection |
| Yard Phase is separate from Category/WO status | CURRENT | readiness derivation and routes under `apps/api/src/admin`; contract in `docs/YARD_OPERATIONS_PHASE_1_CONTRACT.md` | `yard-operations-derivation.spec.ts`, service/mutation specs |
| WO Completed is not Ready to Go | LOCKED/CURRENT | readiness assessment is a separate aggregate; Admin controller routes at `apps/api/src/admin/admin.controller.ts:52-95` | Yard readiness specs |
| Job timers/assignments | DEFERRED | WorkSession, PauseEvent and MechanicAssignment remain Work Order-level | schema plus Work Order tests |

## 3. Exact single-Category restrictions

### Database

- `WorkOrder.primaryCategoryId` and `WorkOrderJob.categoryId` are both required
  foreign keys. They point independently to `JobCategory`.
- No migration, check constraint, trigger, or composite relation forces the two
  values to match. No Category backfill is needed merely to enable the target.

### Shared/API

- `createWorkOrderJobSchema` requires each Job `categoryId`, while
  `createWorkOrderSchema` also requires `primaryCategoryId`
  (`packages/shared/src/schemas.ts:126-143`).
- Create rejects any Job whose Category differs from primary
  (`apps/api/src/work-orders/work-orders.service.ts:170-173`).
- Add Job repeats that equality check (`work-orders.service.ts:575-578`) and
  validates Catalog Jobs against the primary Category.
- `addJobSchema` has no `expectedVersion` or `idempotencyKey`
  (`packages/shared/src/schemas.ts:170-175`).

### Web

- New Standard Work Order holds one `categoryId`, fetches aliases for it,
  filters one catalog, and confirms before changing it while Jobs exist
  (`apps/web/src/app/work-orders/new/page.tsx:128-172,457-560`).
- The client and server currently also reject duplicate normalized display
  names, which would collapse distinct Catalog Job IDs with the same name.
- A remaining open-WO message checks `user.pmAuthorized` at
  `apps/web/src/app/work-orders/new/page.tsx:434`; this is legacy compatibility,
  not valid authority. Implementation must replace it with capability data.

### Tests

- `apps/api/src/work-orders/work-orders.pm.spec.ts` includes rejection coverage
  for cross-Category jobs and PM/Standard separation.
- Web tests cover category change clearing/confirmation and duplicate behavior.
  These expectations must change only with the corresponding implementation PR.

## 4. Field status

- `WorkOrder.primaryCategoryId`: required and widely consumed in summaries,
  Admin list/search and repair history. Approved TARGET meaning is
  **Initial/Primary Category**; it remains required in this initiative.
- `WorkOrderJob.categoryId`: already required and returned in mechanic detail.
  Admin detail additionally returns `{id,name}` per Job
  (`apps/api/src/admin/admin.service.ts:269-287`). It is the TARGET source of
  Category truth for each Job.
- Mechanic summary Jobs omit Category (`packages/shared/src/types.ts:88-103` and
  `apps/api/src/work-orders/work-order.mapper.ts:75-98`), so additive reader
  contracts must precede multi-Category writers.

## 5. PM isolation

- Preserve PM create-and-start, sole creator assignment, one open Work Session,
  mileage, parts/fitment, completion requirements, and read-only completed PM.
- `mechanic.pm` is the only authorization authority. `pmAuthorized` remains a
  temporary profile/database compatibility field.
- Standard must not add PM as a Job Category, including for a user who has both
  mechanic capabilities. Such a user enters the PM workspace for PM work.
- Do not convert PM parts into Jobs or route PM through Standard multi-Category
  pickers, duplicate rules, or completion validation.

## 6. Consumers and contract impact

- Mechanic summaries need additive Job Category data; mechanic detail already
  carries Job `categoryId` but needs display Category for grouped UI.
- Admin Work Order detail already carries Category per Job. Admin summaries and
  search still center on primary Category.
- Repair History currently filters only `primaryCategoryId` and serializes Jobs
  as names (`apps/api/src/trucks/trucks.service.ts:72-108,116-139`). TARGET is
  to match if any Job has the selected Category and return additive per-Job
  Category while preserving legacy primary fields.
- Yard Operations/Truck Detail are CURRENT readers and must render mixed
  Categories without changing readiness derivation.
- No implemented `/api/admin/reports/*` endpoints were found. Report designs in
  the Blueprint are TARGET/DEFERRED consumers, not current integrations.

## 7. Migration, concurrency, idempotency, audit, rollback

- Data: schema evolution is not required for Job Category ownership. Before any
  destructive change, query real rows for missing/contradictory Catalog Job
  mappings and preserve inactive historical labels.
- Concurrency: Create now serializes per Truck using a transaction advisory lock
  and rechecks open Work Orders. Preserve it. A partial unique index may be
  evaluated after real-data/SQL review, but is not required to document the
  approved behavior.
- Idempotency: Create fingerprints payload and actor. Add Job has neither
  idempotency nor optimistic version input and is the main write-contract gap.
- Duplicate policy: TARGET rejects repeated `catalogJobId`; Custom Jobs use a
  normalized Custom name. Different Catalog Job IDs may coexist even when their
  display names normalize equally.
- Activity Log: `JOB_ADDED` currently records only display name and omits the
  created entity ID and Category. TARGET records Job ID, Category and actor.
- Rollback: deploy additive readers/contracts first. A rollback may disable
  multi-Category writes, but may never delete, recategorize, or fail to render
  already-written mixed Jobs.

## 8. Recommended minimal PR sequence

1. Documentation-only PR: this audit, canonical status corrections, approved
   domain direction and phased plan.
2. Additive read-contract PR: Category per Job in mechanic summaries/history;
   any-Job Category history filter; legacy primary fields preserved.
3. API mutation-safety PR: Add Job `expectedVersion`/`idempotencyKey`, Category
   validation, corrected duplicate identity, richer Activity Log; keep
   cross-Category writes disabled.
4. Existing-WO Add Job PR: enable multi-Category behind the safe contract and
   update Standard detail UI/tests.
5. Standard creation PR: grouped multi-Category selection and mobile E2E.
6. Cleanup/observability PR only after rollout evidence; do not remove
   `primaryCategoryId` in this initiative.

## 9. Approved decisions and remaining gates

The user accepted the recommendations: Initial/Primary Category remains
required; history matches any Job Category; Standard excludes PM; duplicate
identity follows Catalog ID versus normalized Custom name; Add Job requires
version/idempotency; inactive catalog records remain readable but not
selectable; one-open-WO protection remains transactional.

No unresolved product choice blocks the next contract PR. Human approval is
still required before any destructive data migration, enabling an unconfirmed
external integration, changing the one-open-WO rule, or merging a PR.

## Validation limits

The audit did not query production/staging data, call Supabase/Ninox/Samsara,
run a deployment, or claim external integration state. Repository checks for
the documentation PR are recorded in its final summary and commit/PR checks.
