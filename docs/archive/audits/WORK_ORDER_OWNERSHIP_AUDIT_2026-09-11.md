> **ARCHIVADO (2026-09-29).** Documento histórico: no describe el sistema actual y no manda sobre el código. La fuente vigente es [`docs/README.md`](../../../README.md).

# Work Order Ownership Audit — 2026-09-11

> ⚠️ HISTORICAL DOCUMENT
> This document is preserved for historical/reference purposes and is not current product authority.
> See `docs/LIGHTNING_SHOP_MASTER_PRD.md`.

Read-only audit of the current implementation, written before any ownership
migration code. It answers the questions required by the ownership change
request (who creates Work Orders, what conflicts with a Manager-first model,
and the schema/API/UI/permission/PM impact). Every claim cites `file:line` at
commit on `main` after PR #67.

This document is descriptive. The migration plan lives in
[`../WORK_ORDER_OWNERSHIP_MIGRATION.md`](../WORK_ORDER_OWNERSHIP_MIGRATION.md).

---

## 1. Current behavior

### Who creates a Work Order

- The only create endpoint is `POST /work-orders`, guarded by `AuthGuard` only,
  with no capability decorator
  ([apps/api/src/work-orders/work-orders.controller.ts](../../../apps/api/src/work-orders/work-orders.controller.ts) L15-33).
- The service enforces mechanic capabilities directly:
  - Standard Work Orders require `MECHANIC_STANDARD` and at least one Job
    ([apps/api/src/work-orders/work-orders.service.ts](../../../apps/api/src/work-orders/work-orders.service.ts) L142-170).
  - PM Work Orders require `MECHANIC_PM`, carry no Jobs, and can only be
    assigned to their creator (same file L143-150).
- `ADMIN_ACCESS` alone cannot create a Work Order. `assertCapability` throws
  `ForbiddenException` when the mechanic capability is missing
  ([work-orders.service.ts](../../../apps/api/src/work-orders/work-orders.service.ts) L1053-1057), and this is asserted by a test
  ([apps/api/src/work-orders/work-orders.capabilities.spec.ts](../../../apps/api/src/work-orders/work-orders.capabilities.spec.ts) L36-39).
- There is no `POST /admin/work-orders`
  ([apps/api/src/admin/admin.controller.ts](../../../apps/api/src/admin/admin.controller.ts) full file). The admin surface only mutates
  existing Work Orders.
- The web create CTA renders in exactly one place: the mechanic home
  ([apps/web/src/app/page.tsx](../../../apps/web/src/app/page.tsx) L79-80). The creation form is the mechanic route
  `work-orders/new` ([apps/web/src/app/work-orders/new/page.tsx](../../../apps/web/src/app/work-orders/new/page.tsx)).

### Multi-category status (already implemented)

- Jobs are **not** restricted to `WorkOrder.primaryCategoryId`. Each
  `WorkOrderJob` carries its own `categoryId`
  ([apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) L477-505).
- Create validation checks each Job's own category is active and non-PM
  ([work-orders.service.ts](../../../apps/api/src/work-orders/work-orders.service.ts) L684-704).
- Add-Job validation validates against `input.categoryId`, not
  `primaryCategoryId` (same file L580-588, L707-720).
- A regression test already exercises multi-category creation
  ([apps/web/e2e/ux-regressions.spec.ts](../../../apps/web/e2e/ux-regressions.spec.ts) around the multi-category case).

### Priority

- Set on create from `createWorkOrderSchema.priority` (default `normal`),
  forced to `normal` for PM
  ([work-orders.service.ts](../../../apps/api/src/work-orders/work-orders.service.ts) L248).
- Only mutable afterward by admin `PATCH /admin/work-orders/:id`, guarded by
  `ADMIN_ACCESS` ([apps/api/src/admin/admin.service.ts](../../../apps/api/src/admin/admin.service.ts) L901-993). No mechanic endpoint
  changes priority after creation.

### Pause / resume

- Mechanic endpoints `POST /work-orders/:id/pause|pause-reason|resume` set the
  whole Work Order to `waiting_paused`
  ([work-orders.controller.ts](../../../apps/api/src/work-orders/work-orders.controller.ts) L40-56;
  [work-orders.service.ts](../../../apps/api/src/work-orders/work-orders.service.ts) L419-445).
- There is no admin/manager pause endpoint.
- `PauseReason` enum values: `waiting_for_parts`, `waiting_for_approval`,
  `waiting_for_vendor`, `waiting_for_equipment`, `waiting_for_bay`,
  `waiting_for_driver`, `truck_unavailable`, `working_on_another_wo`, `break`,
  `end_of_shift`, `other` ([schema.prisma](../../../apps/api/prisma/schema.prisma) L45-57).

### Assignment

- `MechanicAssignment` is Work-Order-level, keyed `(workOrderId, mechanicId)`,
  with `removedAt` soft-remove ([schema.prisma](../../../apps/api/prisma/schema.prisma) L538-552).
- There is no per-Job assignment field on `WorkOrderJob`.
- Assignments are created at WO create time (from `mechanicIds`) and mutated by
  admin `POST/DELETE /admin/work-orders/:id/mechanics[/:mechanicId]`
  ([admin.service.ts](../../../apps/api/src/admin/admin.service.ts) L363-521).

### Capabilities

- Only four exist: `admin.access`, `mechanic.standard`, `mechanic.pm`,
  `yard.operations.manage` ([schema.prisma](../../../apps/api/prisma/schema.prisma) L17-22;
  [packages/shared/src/enums.ts](../../../packages/shared/src/enums.ts) L7-12).
- There is no Shop Manager capability. `manager@lightning.local` is seeded with
  `ADMIN_ACCESS` + `YARD_OPERATIONS_MANAGE`
  ([apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts) L96-128), so Manager and Admin are indistinguishable
  today.

### Yard Phase

- Not persisted. Derived at runtime by `deriveReadiness`
  ([apps/api/src/admin/yard-operations-derivation.ts](../../../apps/api/src/admin/yard-operations-derivation.ts) L41-113) from readiness
  assessment + linked Work Order status. `ReadinessPhase` is a shared-only enum
  ([enums.ts](../../../packages/shared/src/enums.ts) L127-136) with no Prisma counterpart.

---

## 2. Conflicts with the Manager-first model

| Target rule | Current reality | Conflict |
| --- | --- | --- |
| Manager creates standard Work Orders | Only mechanics can create | No manager create path exists (API or UI) |
| Mechanic no longer defines priority | Mechanic sets priority on create | Create form exposes priority selector |
| Mechanic does not pause the whole WO | Mechanic pause sets `waiting_paused` | Pause is a mechanic action on the full WO |
| Manager pauses / resumes | No admin pause endpoint | Missing capability + endpoints |
| Per-Job assignment | Assignment is WO-level only | `WorkOrderJob` has no assignee field |
| Distinct Manager role | Manager == Admin (same capabilities) | No `work_orders.manage` capability |
| Mechanic Home = My Assigned Work | Home leads with Create CTA | Home IA is creation-first |

Not conflicts (already aligned): multi-category Jobs, one-open-WO-per-Truck,
Yard Phase separate from WO status, PM isolation.

---

## 3. Schema impact

Additive only. No destructive migration.

- `AppCapability` enum: add `WORK_ORDERS_MANAGE` → `"work_orders.manage"`
  ([schema.prisma](../../../apps/api/prisma/schema.prisma) L17-22). Postgres enum value add, never drop.
- `WorkOrderJob`: add nullable `assignedMechanicId` + relation, plus index
  ([schema.prisma](../../../apps/api/prisma/schema.prisma) L477-505). Nullable keeps historical rows valid.
- `PauseEvent`: add nullable `reportedById` and a discriminator (e.g. nullable
  `kind`/boolean) to distinguish a reported blocker from an official pause
  ([schema.prisma](../../../apps/api/prisma/schema.prisma) L520-536). Existing rows default to the official-pause meaning.
- Optional later: a separate auditable `YardPhaseEvent` model (Phase 7). Do not
  reuse `WorkOrder.status` or `JobCategory`.

Prisma remains the sole migration authority. Every enum change is generated by
`prisma migrate`, never hand-written SQL under `supabase/migrations`.

---

## 4. API impact

New endpoints:

- `POST /api/admin/work-orders` — Manager create (Phase 2).
- `POST /api/admin/work-orders/:id/jobs/:jobId/assign` and `/unassign` — per-Job
  assignment (Phase 3).
- `POST /api/admin/work-orders/:id/pause` and `/resume` — Manager pause (Phase 4).
- `POST /api/work-orders/:id/blockers` (or extend existing) — mechanic reports a
  blocker without pausing (Phase 4).

Changed/guarded:

- Manager-facing admin routes move from `ADMIN_ACCESS` to `WORK_ORDERS_MANAGE`
  where the action is operational rather than administrative, keeping
  `ADMIN_ACCESS` as a superset via seed. Decision recorded in the migration doc.

Unchanged (must not regress): every existing mechanic endpoint and every
existing admin mutation keep working during soft cutover.

---

## 5. UI impact

- Mechanic home ([apps/web/src/app/page.tsx](../../../apps/web/src/app/page.tsx)): remove creation-first IA; lead with
  My Assigned Work. The Create CTA (L79-80) is the only create entry point.
- Mechanic WO detail ([apps/web/src/app/work-orders/[id]/detail-client.tsx](../../../apps/web/src/app/work-orders/[id]/detail-client.tsx)):
  reorganize into My Jobs vs Other work; hide global pause and editable priority
  for mechanics.
- New manager creation UI at `apps/web/src/app/admin/work-orders/new/` with
  progressive disclosure.
- Manager WO detail ([apps/web/src/components/admin-work-order-detail.tsx](../../../apps/web/src/components/admin-work-order-detail.tsx)):
  Work Plan grouped by Category, inline assignment, pause/resume.
- All UI uses existing primitives in [apps/web/src/components/ui.tsx](../../../apps/web/src/components/ui.tsx). EN/ES
  message parity is enforced by
  [apps/web/src/lib/admin-routing.spec.ts](../../../apps/web/src/lib/admin-routing.spec.ts) L31-35.

---

## 6. Permission impact

- Introduce `work_orders.manage`. Grant to `manager@` and `admin@` in seed.
- Manager create + operational pause require `work_orders.manage`.
- Mechanic UI stops exposing priority and global pause; enforce server-side too
  (do not rely on hiding controls).
- PM authorization stays exclusively `mechanic.pm`.

---

## 7. PM impact (risk area)

PM must not regress. Current PM facts:

- PM create auto-starts: status `in_progress`, `startedAt`, initial
  `WorkSession` ([work-orders.service.ts](../../../apps/api/src/work-orders/work-orders.service.ts) L230-256).
- PM finish requires observed mileage + at least one part; mileage audit is
  immutable ([detail-client.tsx](../../../apps/web/src/app/work-orders/[id]/detail-client.tsx) L706-715; PM service card).
- PM authorized only by `mechanic.pm` ([pm-daniel.md](../pm-daniel.md)).

Decision for this migration: **PM untouched.** The PM mechanic keeps
self-creating the PM service. The Manager only sees PM and can mark `PM required`
in readiness. No PM code is modified by the ownership slices. Any future
Work Order ↔ PM Service bridge is documented before implementation.

---

## 8. Migration plan (order)

1. Phase 0 — documentation (this audit + migration plan + slice prompts + doc
   updates).
2. Phase 1 — `work_orders.manage` capability, additive, no behavior change.
3. Phase 2 — Manager create endpoint reusing the truck lock + idempotency.
4. Phase 3 — per-Job assignment, additive.
5. Phase 4 — blockers + Manager pause/resume.
6. Phase 5 — Mechanic UX to My Assigned Work.
7. Phase 6 — Manager creation UI + Work Plan.
8. Phase 7 — persistent Yard Phase (only if derivation proves insufficient).

Each phase is a single PR, additive, with rollback = revert the PR. Legacy
mechanic creation and pause endpoints stay live until the Manager flow is
verified (soft cutover), then are removed in a later, explicit slice.

---

## 9. Files affected (by phase)

- Phase 1: [schema.prisma](../../../apps/api/prisma/schema.prisma), [enums.ts](../../../packages/shared/src/enums.ts),
  [seed.ts](../../../apps/api/prisma/seed.ts), new migration folder.
- Phase 2: [admin.controller.ts](../../../apps/api/src/admin/admin.controller.ts),
  [admin.service.ts](../../../apps/api/src/admin/admin.service.ts),
  [work-orders.service.ts](../../../apps/api/src/work-orders/work-orders.service.ts) (extract shared create),
  [schemas.ts](../../../packages/shared/src/schemas.ts), [types.ts](../../../packages/shared/src/types.ts),
  [admin-data.ts](../../../apps/web/src/lib/admin-data.ts).
- Phase 3: [schema.prisma](../../../apps/api/prisma/schema.prisma), [admin.service.ts](../../../apps/api/src/admin/admin.service.ts),
  [admin.controller.ts](../../../apps/api/src/admin/admin.controller.ts), shared schemas/types, admin detail component.
- Phase 4: [schema.prisma](../../../apps/api/prisma/schema.prisma), work-orders + admin services/controllers,
  shared schemas/types, mechanic + admin detail components.
- Phase 5: [page.tsx](../../../apps/web/src/app/page.tsx),
  [detail-client.tsx](../../../apps/web/src/app/work-orders/[id]/detail-client.tsx), shop messages.
- Phase 6: new `apps/web/src/app/admin/work-orders/new/`,
  [admin-work-order-detail.tsx](../../../apps/web/src/components/admin-work-order-detail.tsx),
  [admin-messages.ts](../../../apps/web/src/lib/admin-messages.ts).

---

## 10. Tests required

- Permissions: mechanic cannot create standard WO; `work_orders.manage` can;
  mechanic cannot change priority; manager can; mechanic cannot global-pause;
  manager can pause/resume.
- Multi-category: one WO holds Jobs from Category A and B; duplicate protection
  intact; Jobs keep their own Category.
- Assignment: manager assigns a Job; mechanic sees the assigned Job; unassigned
  Job inherits the WO team visually.
- PM: `mechanic.pm` still works; mileage audit and part selection intact; no PM
  completion regression.
- History: legacy single-category WOs still render.
- Commands per slice: lint (api+web), test (api+web), build, `git diff --check`;
  Playwright only for visible slices.

---

## 11. Documentation contradictions resolved

The prior doc set disagreed on multi-category status and Add-Job idempotency.
This audit fixes the source of truth:

- Multi-category is **CURRENT**, not TARGET (contradicting
  [audits/WORK_ORDER_MULTICATEGORY_AUDIT_2026-09-09.md](WORK_ORDER_MULTICATEGORY_AUDIT_2026-09-09.md) L25).
- Add Job **requires** `expectedVersion` and `idempotencyKey`
  ([schemas.ts](../../../packages/shared/src/schemas.ts) L261-268), contradicting
  [SHOP_ADMIN_INTEGRATION_BLUEPRINT.md](../SHOP_ADMIN_INTEGRATION_BLUEPRINT.md) L336-338.
- Mechanic-creates-WO is now **legacy in transition**, contradicting
  [PRD_Lightning_Shop_Mechanic_P0.md](../PRD_Lightning_Shop_Mechanic_P0.md) L52-54.
