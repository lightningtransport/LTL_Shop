# Work Order Ownership Migration — Master Plan

> ⚠️ HISTORICAL DOCUMENT
> This document is preserved for historical/reference purposes and is not current product authority.
> See `docs/LIGHTNING_SHOP_MASTER_PRD.md`.

Target experience:

> Managers plan and control the intervention. Mechanics execute assigned work.
> One Work Order represents the Truck's service intervention and can contain
> multiple Jobs across multiple Categories. Yard Operations tracks the Truck's
> operational progression separately from Work Order and Job status.

This is the authoritative, slice-by-slice plan. It is written so a subagent
running a cheaper model can pick up a single slice, implement it, verify it, and
open a PR without re-auditing. The read-only audit is in
[`audits/WORK_ORDER_OWNERSHIP_AUDIT_2026-09-11.md`](audits/WORK_ORDER_OWNERSHIP_AUDIT_2026-09-11.md).
Copy-paste prompts per slice are in [`agents/SLICE_PROMPTS.md`](agents/SLICE_PROMPTS.md).

## Decisions (locked)

- **Manager identity:** new additive capability `work_orders.manage`. Granted to
  `manager@` and `admin@`. It does not widen `admin.access`.
- **Cutover:** soft. Remove the mechanic Create CTA and hide mechanic
  priority/global-pause controls, but keep the legacy endpoints alive until the
  Manager flow is verified. Legacy removal is a later, explicit slice.
- **PM:** untouched. The PM mechanic keeps self-creating the PM service. No PM
  code is modified by these slices.

## Non-negotiable rules (every slice)

1. No destructive migrations. Postgres enum values are added, never dropped.
   New columns are nullable or defaulted so historical rows stay valid.
2. Prisma is the sole migration authority (`apps/api/prisma/migrations`). Never
   write SQL under `supabase/migrations`.
3. Do not break: auth, existing capabilities, PM, Work Sessions, Pause Events,
   Activity Log, Work Order history, Repair History, Admin shell, mobile
   mechanic experience, existing performance/caching.
4. Additive before destructive: keep `primaryCategoryId` and `MechanicAssignment`.
5. Enforce permissions in the API, not only in the UI.
6. Keep EN/ES message parity (`admin-routing.spec.ts`).
7. Follow [`ENGINEERING_PRACTICES.md`](ENGINEERING_PRACTICES.md): no request
   waterfalls, no full-table reads for operational screens, scoped cache
   invalidation, return the updated DTO from mutations.

## Environment gotchas (this repo)

- The workspace path contains spaces and colons
  (`.../LTL SHOP : ADMIN : MECHANICS/LTL_Shop`). Never put
  `$PWD/node_modules/.bin` on `PATH`. Invoke binaries by quoted absolute path,
  e.g. `NODE_ENV=test "/abs/path/node_modules/.bin/vitest" run`, or `cd` into
  the package and use the repo-root bin.
- Agent shells often set `NODE_ENV=production`, which makes a bare
  `npm install` skip dev deps (vitest/tsx). Use
  `NODE_ENV=development npm install --include=dev`.
- API tests need a built `@ltl-shop/shared` (`packages/shared/dist` is
  gitignored). Run `npm run build --workspace=@ltl-shop/shared` first;
  `tsc --noEmit` is not enough.
- `admin-shell.spec.ts` currently has a stale selector (`Language: English` vs
  the current `ES` button). Fix the spec before treating Playwright as a gate.

## Verification per slice

```bash
npm run lint --workspace=@ltl-shop/api
npm run lint --workspace=@ltl-shop/web
npm run test --workspace=@ltl-shop/api
npm run test --workspace=@ltl-shop/web
npm run build
git diff --check
```

Playwright only for slices with a visible change, against a seeded local DB.

---

## Slice 1 — Capability `work_orders.manage`

Goal: introduce the Manager capability with zero behavior change.

Changes:
- `schema.prisma` enum `AppCapability`: add `WORK_ORDERS_MANAGE @map("work_orders.manage")`.
- `packages/shared/src/enums.ts`: add `WORK_ORDERS_MANAGE = 'work_orders.manage'`.
- `apps/api/prisma/seed.ts`: grant it to `manager@lightning.local` and
  `admin@lightning.local` (keep their existing capabilities).
- New Prisma migration (enum value add only).
- E2E fixture `apps/web/e2e/fixtures/admin-api.mjs`: add the capability to the
  manager/admin fixture users so later slices can assert it.

Acceptance:
- New capability exists in Prisma, shared enum, and seed.
- No route changes yet. All existing tests still pass.
- Migration applies cleanly and is reversible by revert.

Out of scope: any endpoint using the new capability.

---

## Slice 2 — Manager creates Work Orders

Goal: `POST /api/admin/work-orders` lets `work_orders.manage` create a standard
Work Order with Jobs from multiple Categories and a Manager-set priority.

Changes:
- Extract the core create logic in
  `apps/api/src/work-orders/work-orders.service.ts` into a method that does not
  require a mechanic capability, preserving the per-truck advisory lock
  (`lockTruckMutation`), idempotency (payload hash + actor), and the
  one-open-WO-per-Truck rule.
- New admin service method `createWorkOrder(user, body)` calling that shared
  method; Activity Log `work_order_created`.
- `admin.controller.ts`: `POST work-orders` with
  `@Capabilities(AppCapability.WORK_ORDERS_MANAGE)` (method-level override).
- Shared: `adminCreateWorkOrderSchema` (truck, jobs[], priority, notes,
  optional assignees, idempotencyKey). Reuse `createWorkOrderJobSchema`.
- `admin-data.ts`: `createAdminWorkOrder` helper + cache invalidation of the
  admin WO list.

Acceptance:
- A `work_orders.manage` user creates a standard WO with Jobs across ≥2
  Categories; priority is respected; `created` status; not auto-started.
- A `mechanic.standard`-only user is rejected (403) by this endpoint.
- One-open-WO-per-Truck still enforced (409 on duplicate).
- PM category rejected on this endpoint (PM stays in the mechanic flow).
- Tests: admin.service spec for create (happy path, 403, duplicate, PM reject,
  multi-category).

Out of scope: the manager creation UI (Slice 6), per-Job assignment (Slice 3).

---

## Slice 3 — Per-Job assignment

Goal: assign a mechanic to a specific Job, additively.

Changes:
- `schema.prisma` `WorkOrderJob`: add nullable `assignedMechanicId` + relation +
  index. Migration additive.
- Shared: `AdminWorkOrderJobDto` gains `assignedMechanicId` /
  `assignedMechanicName`; new `adminAssignJobSchema` (mechanicId + mutation meta)
  and unassign (meta only).
- `admin.service.ts`: `assignJob` / `unassignJob` with version + idempotency +
  Activity Log (`mechanic_added` / `mechanic_removed` scoped to the Job, or a
  new event if clearer — decide and document in the PR).
- `admin.controller.ts`: `POST work-orders/:id/jobs/:jobId/assign` and
  `/unassign`, guarded by `work_orders.manage`.
- Admin WO detail component: inline assign/unassign per Job row.

Rule (documented): a Job with no `assignedMechanicId` visually inherits the WO's
general mechanic team. `MechanicAssignment` is unchanged and still the source of
the general team.

Acceptance:
- Manager assigns and unassigns a Job; version conflicts return 409; idempotent
  replay is a no-op.
- Unassigned Jobs render the general team in the UI.
- Legacy WOs (no assignment) render correctly.

Out of scope: mechanic-initiated assignment.

---

## Slice 4 — Blockers and Manager pause

Goal: the mechanic reports a blocker; the Manager pauses/resumes.

Changes:
- `schema.prisma` `PauseEvent`: add nullable `reportedById` and a discriminator
  (nullable `kind` string or boolean `isOfficialPause`) to separate a reported
  blocker from an official Work Order pause. Additive; existing rows read as
  official pause.
- Mechanic: `POST /work-orders/:id/blockers` records a reported blocker
  (reason + notes) without changing WO status. The existing mechanic pause
  endpoint stays live (soft cutover) but the UI stops offering it in Slice 5.
- Manager: `POST /admin/work-orders/:id/pause` and `/resume`, guarded by
  `work_orders.manage`, reusing the existing pause/resume mechanics
  (close/open session, PauseEvent, totals) with version + idempotency.
- Shared schemas/types for blocker + admin pause.
- Activity Log: reuse `work_paused` / `work_resumed`; add a blocker event only
  if needed (decide and document).

Acceptance:
- Mechanic reports a blocker; WO status unchanged; Manager sees it.
- Manager pauses and resumes; totals recompute; Activity Log written.
- No destruction of `PauseEvent` history.

Out of scope: a workflow engine. Keep it minimal.

---

## Slice 5 — Mechanic UX: My Assigned Work

Goal: the mechanic home stops being creation-first.

Changes:
- `apps/web/src/app/page.tsx`: replace the Create-CTA-led home with an
  "Assigned to Me" list (Truck #, WO #, assigned Job(s), Category, Priority,
  status, blocker, primary action View/Start Work). Remove the standard Create
  CTA (keep PM's own path per PM-untouched decision, or gate behind an
  authorized exception — document which).
- `detail-client.tsx`: reorganize standard WO detail into "My Jobs" and
  "Other work on this Truck"; hide editable priority and the global pause
  control for mechanics; keep Start/Complete Job and Report Blocker.
- Shop messages EN/ES for the new labels.

Acceptance:
- Mechanic home leads with assigned work; no standard Create CTA.
- Mechanic cannot see editable priority or global pause; Report Blocker present.
- Mobile-first layout preserved; existing mechanic e2e still passes (update
  specs that asserted the old CTA).

Out of scope: API permission changes already covered by earlier slices.

---

## Slice 6 — Manager creation UI + Work Plan

Goal: managers build a work plan, not fill a long form.

Changes:
- New route `apps/web/src/app/admin/work-orders/new/` with progressive
  disclosure: Step 1 Select Truck (+ summary, open-WO warning), Step 2 Work
  Required (Category selector → Job search → Add, grouped by Category), Assign,
  Priority, Notes, Confirm.
- Manager WO detail: Work Plan grouped by Category with per-Job status,
  assignee, blocker; inline assignment; Add Job; Pause/Resume; Update Priority.
- Use only `apps/web/src/components/ui.tsx` primitives and semantic tokens.
- EN/ES messages; keep parity test green.

Acceptance:
- Manager creates a multi-category WO end to end from the UI.
- Work Plan groups Jobs by Category and supports inline assignment.
- Desktop-dense but usable at 390/834/1440 widths; 44px targets.

Out of scope: persistent Yard Phase.

---

## Slice 7 — Persistent Yard Phase (conditional)

Only if runtime derivation proves insufficient (e.g. Detailing / Quality Check /
Ready need to persist independent of Jobs). If pursued: a separate auditable
`YardPhaseEvent` model. Never reuse `WorkOrder.status` or `JobCategory`.
`deriveReadiness` already covers the seven phases, so this stays deferred until a
concrete gap appears.

---

## Documentation upkeep

After each slice, update the affected docs in the same PR so code and docs never
disagree: `CURRENT_PRODUCT_STATUS.md`, this plan's slice status, and any API
notes. Do not leave a slice merged with stale docs.
