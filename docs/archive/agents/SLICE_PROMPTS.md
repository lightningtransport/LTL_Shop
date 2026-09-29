> **ARCHIVADO (2026-09-29).** Documento histórico: no describe el sistema actual y no manda sobre el código. La fuente vigente es [`docs/README.md`](../../README.md).

# Slice Prompts — Work Order Ownership Migration

> ⚠️ DEPRECATED
> Do not use this document for new implementation decisions.
> See `docs/LIGHTNING_SHOP_MASTER_PRD.md`.

Copy-paste prompts for running each slice with a subagent on a cheaper model, in
a loop. Each prompt is self-contained: it names the goal, the files, the
acceptance criteria, and the verification commands. Run one slice per PR, in
order. Do not start a slice until the previous one is merged.

Authoritative context (the agent should read these first):
- [`../WORK_ORDER_OWNERSHIP_MIGRATION.md`](../WORK_ORDER_OWNERSHIP_MIGRATION.md) — master plan and locked decisions.
- [`../audits/WORK_ORDER_OWNERSHIP_AUDIT_2026-09-11.md`](../audits/WORK_ORDER_OWNERSHIP_AUDIT_2026-09-11.md) — current-state audit with `file:line` refs.

## Shared preamble (prepend to every slice prompt)

```
You are implementing ONE slice of the Work Order Ownership Migration for the
Lightning Shop monorepo. Read docs/WORK_ORDER_OWNERSHIP_MIGRATION.md and
docs/audits/WORK_ORDER_OWNERSHIP_AUDIT_2026-09-11.md before editing.

Non-negotiable rules:
- Additive only. No destructive migrations. Postgres enum values are added,
  never dropped. New columns are nullable or defaulted.
- Prisma is the sole migration authority (apps/api/prisma/migrations). Never
  write SQL under supabase/migrations.
- Do NOT modify PM code. PM stays untouched in this migration.
- Do not break auth, capabilities, Work Sessions, Pause Events, Activity Log,
  Work Order/Repair history, Admin shell, or the mobile mechanic experience.
- Enforce permissions in the API, not just the UI.
- Keep EN/ES message parity (apps/web/src/lib/admin-routing.spec.ts).

Environment gotchas:
- The workspace path has spaces and colons. Never add node_modules/.bin to PATH.
  Invoke binaries by quoted absolute path, or cd into the package.
- If dev deps are missing, run: NODE_ENV=development npm install --include=dev
- Build shared before API tests: npm run build --workspace=@ltl-shop/shared
- admin-shell.spec.ts has a stale language selector; fix the spec if you touch it
  as a gate.

Definition of done for the slice:
- All acceptance criteria met.
- These pass:
  npm run lint --workspace=@ltl-shop/api
  npm run lint --workspace=@ltl-shop/web
  npm run test --workspace=@ltl-shop/api
  npm run test --workspace=@ltl-shop/web
  npm run build
  git diff --check
- Update docs/CURRENT_PRODUCT_STATUS.md and the slice status in
  docs/WORK_ORDER_OWNERSHIP_MIGRATION.md in the same PR.
- Commit with the GitHub-linked author and open a PR to main. Do not merge.
- Do not include .cursor/settings.json or supabase/.temp/ in the commit.
```

---

## Slice 1 prompt — capability `work_orders.manage`

```
Implement Slice 1 (see master plan). Add an additive capability
work_orders.manage with no behavior change.

Do:
- schema.prisma enum AppCapability: add WORK_ORDERS_MANAGE mapped to
  "work_orders.manage".
- packages/shared/src/enums.ts: add WORK_ORDERS_MANAGE = 'work_orders.manage'.
- apps/api/prisma/seed.ts: grant WORK_ORDERS_MANAGE to manager@lightning.local
  and admin@lightning.local, keeping their existing capabilities.
- Generate a Prisma migration (enum value add only).
- apps/web/e2e/fixtures/admin-api.mjs: add work_orders.manage to the manager and
  admin fixture users.

Acceptance:
- Capability present in Prisma, shared enum, seed, and fixtures.
- No route uses it yet. All existing tests pass. Migration applies and reverts
  cleanly.
```

---

## Slice 2 prompt — Manager creates Work Orders

```
Implement Slice 2 (see master plan). Add POST /api/admin/work-orders for
work_orders.manage.

Do:
- In apps/api/src/work-orders/work-orders.service.ts, extract the core create
  logic into a method that does NOT require a mechanic capability, preserving the
  per-truck advisory lock (lockTruckMutation), idempotency (payload hash +
  actor), and the one-open-WO-per-Truck rule.
- Add AdminService.createWorkOrder(user, body) using that shared method; write
  Activity Log work_order_created.
- admin.controller.ts: POST work-orders with
  @Capabilities(AppCapability.WORK_ORDERS_MANAGE).
- packages/shared/src/schemas.ts: adminCreateWorkOrderSchema (truckId, jobs[]
  reusing createWorkOrderJobSchema, priority, notes, optional assignees,
  idempotencyKey).
- apps/web/src/lib/admin-data.ts: createAdminWorkOrder helper + invalidate the
  admin WO list cache.

Acceptance:
- work_orders.manage user creates a standard WO with Jobs across >=2 Categories;
  priority respected; status created; not auto-started.
- mechanic.standard-only user gets 403 on this endpoint.
- One-open-WO-per-Truck enforced (409). PM category rejected here.
- admin.service spec covers happy path, 403, duplicate, PM reject, multi-category.

Do NOT build the creation UI here (that is Slice 6).
```

---

## Slice 3 prompt — per-Job assignment

```
Implement Slice 3 (see master plan). Add additive per-Job assignment.

Do:
- schema.prisma WorkOrderJob: add nullable assignedMechanicId + relation +
  index. Additive migration.
- Shared: extend AdminWorkOrderJobDto with assignedMechanicId /
  assignedMechanicName; add adminAssignJobSchema (mechanicId + mutation meta) and
  an unassign schema (meta only).
- admin.service.ts: assignJob / unassignJob with version + idempotency +
  Activity Log. Document which event type you use.
- admin.controller.ts: POST work-orders/:id/jobs/:jobId/assign and /unassign,
  guarded by work_orders.manage.
- Admin WO detail component: inline assign/unassign per Job row.

Rule to implement and document: a Job with no assignedMechanicId visually
inherits the WO general team. MechanicAssignment is unchanged.

Acceptance:
- Assign/unassign works; 409 on version conflict; idempotent replay is a no-op.
- Unassigned Jobs render the general team. Legacy WOs render correctly.
```

---

## Slice 4 prompt — blockers and Manager pause

```
Implement Slice 4 (see master plan). Mechanic reports a blocker; Manager
pauses/resumes. Keep it minimal, no workflow engine.

Do:
- schema.prisma PauseEvent: add nullable reportedById and a discriminator
  (nullable kind or boolean isOfficialPause) separating a reported blocker from
  an official pause. Additive; existing rows read as official pause.
- Mechanic: POST /work-orders/:id/blockers records a reported blocker (reason +
  notes) WITHOUT changing WO status. Keep the existing mechanic pause endpoint
  live.
- Manager: POST /admin/work-orders/:id/pause and /resume, guarded by
  work_orders.manage, reusing existing pause/resume mechanics with version +
  idempotency.
- Shared schemas/types for blocker + admin pause.

Acceptance:
- Mechanic reports a blocker; WO status unchanged; Manager sees it.
- Manager pauses and resumes; totals recompute; Activity Log written.
- PauseEvent history preserved.
```

---

## Slice 5 prompt — Mechanic UX: My Assigned Work

```
Implement Slice 5 (see master plan). Make the mechanic home assigned-work-first.

Do:
- apps/web/src/app/page.tsx: replace the Create-CTA-led home with an
  "Assigned to Me" list (Truck #, WO #, assigned Job(s), Category, Priority,
  status, blocker, primary action View/Start Work). Remove the standard Create
  CTA. Keep PM's own path per the PM-untouched decision (document what you did).
- apps/web/src/app/work-orders/[id]/detail-client.tsx: reorganize the standard
  WO detail into "My Jobs" and "Other work on this Truck"; hide editable priority
  and the global pause control for mechanics; keep Start/Complete Job and add
  Report Blocker.
- Shop EN/ES messages for new labels.
- Update mechanic e2e specs that asserted the old Create CTA.

Acceptance:
- Mechanic home leads with assigned work; no standard Create CTA.
- Mechanic cannot see editable priority or global pause; Report Blocker present.
- Mobile-first layout preserved; mechanic e2e passes.
```

---

## Slice 6 prompt — Manager creation UI + Work Plan

```
Implement Slice 6 (see master plan). Build the manager creation UI and Work Plan.

Do:
- New route apps/web/src/app/admin/work-orders/new/ with progressive disclosure:
  Step 1 Select Truck (summary + open-WO warning), Step 2 Work Required
  (Category selector -> Job search -> Add, grouped by Category), Assign, Priority,
  Notes, Confirm. POST to /api/admin/work-orders (Slice 2).
- Manager WO detail (apps/web/src/components/admin-work-order-detail.tsx): Work
  Plan grouped by Category with per-Job status, assignee, blocker; inline
  assignment; Add Job; Pause/Resume; Update Priority.
- Use only apps/web/src/components/ui.tsx primitives and semantic tokens.
- EN/ES messages; keep the parity test green.

Acceptance:
- Manager creates a multi-category WO end to end from the UI.
- Work Plan groups Jobs by Category with inline assignment.
- Usable at 390/834/1440 widths; 44px targets. Playwright covers the flow.
```

---

## Slice 7 prompt — persistent Yard Phase (only if needed)

```
Only implement if runtime derivation (deriveReadiness) proves insufficient.
If pursued: add a separate auditable YardPhaseEvent model. Never reuse
WorkOrder.status or JobCategory. Otherwise, leave deferred and note why.
```
