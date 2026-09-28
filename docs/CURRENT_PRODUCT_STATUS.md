# Current product status

**Classification:** CURRENT STATE
**Audited commit:** V2-002 TARGET cutover (this branch)
**Updated:** 2026-09-28 (LTR-155 per-Job blockers; LTR-154 Job owner and per-mechanic labor; LTR-153 labor/blocker columns; LTR-156 shop workflow steps schema; LTR-151)

This document describes only behavior implemented in the audited code. It does
not define TARGET behavior. Product direction lives exclusively in
`LIGHTNING_SHOP_MASTER_PRD.md`; gaps and sequencing live in
`audit/CURRENT_VS_TARGET.md` and `DEVELOPMENT_ROADMAP.md`. The approved V2
ownership contract is `OWNERSHIP_CUTOVER_CONTRACT.md`. V2-002 implemented that
TARGET authorization/UX.

## What is implemented

### Shop Admin operations

- Active users with `admin.access` can enter the server-protected `/admin`
  shell; users without that capability receive a secure 403 response and no
  Admin data.
- NestJS exposes reusable declarative authorization through a capability
  decorator and guard. Capabilities are read from application tables for each
  authenticated request instead of editable user metadata or stale JWT claims.
- The role still selects the initial destination. Login uses one shared
  authentication flow, and users classified as Admin land on `/admin`.
- `/admin` displays the current operational state from Supabase PostgreSQL with
  a generated-at timestamp and explicit `supabase_postgres` provenance. Its
  actionable counts are Open Work Orders, Waiting/Paused, High/Critical open,
  open more than 24 hours, completed today, and completed in the last seven
  calendar days. Today and seven-day windows use `America/New_York` calendar
  boundaries represented as explicit UTC instants for drill-down queries.
  Each metric link is announced as "<metric>: <value>" (LTR-151).
- Dashboard attention is ordered by Critical, High, Waiting/Paused, and then
  least recently updated open Work Orders. It does not show downtime averages,
  Off Duty, historical trends, percentages, or per-Job timing.
- `/admin/work-orders` is a read-only global list. It defaults to all Work
  Orders and supports validated status/priority and absolute date filters,
  search by Work Order,
  Truck, category, or Mechanic, stable cursor pagination, and sorting by updated
  date, created date, or display ID. Dashboard links pass their filters
  explicitly, and URL query parameters preserve list state across refreshes.
- `/admin/work-orders/[id]` prioritizes operational status, age, progress,
  assigned Mechanics, and the current pause; shows the available Truck number,
  make, model, year, mileage, company, and owner; and provides category-filtered,
  cursor-paginated recent completed repair history. Work Order timing, Jobs,
  pause history, and Activity Log remain visible. On an open Standard
  Work Order, users with `admin.access` and `work_orders.manage` can add or
  soft-remove assigned mechanics and add Jobs after create; per-Job
  assign/unassign also requires `work_orders.manage`.
  Mechanic pickers (per-Job assignee, team, New Work Order) read
  `GET /api/admin/mechanics?assignable=true`, which excludes `role = admin`
  accounts even when they hold a mechanic capability, and load every page of
  the roster. Each per-Job picker is labeled "Mechanic for <Job>". The
  `/admin/mechanics` roster lists every mechanic-capable account; deactivated
  accounts are hidden unless "Show inactive" is applied
  (`?includeInactive=true`, LTR-160). An
  empty mechanics list reads "No mechanics assigned" on the Work Order, its
  list card, and Truck Detail (LTR-151).
  PM Work Orders stay assigned to their creator. Assignments keep at
  least one active mechanic, use Work Order versioning and idempotency, and
  write `mechanic_added` / `mechanic_removed` Activity Log events. On any open
  Work Order, including PM, Managers with `work_orders.manage` can cancel it
  with a required reason. Cancel
  stops open labor and wait time, sets status `cancelled`, and records a
  `manager_correction` Activity Log event. Jobs are not cancelled separately.
  On an in-progress Work Order, Managers with `work_orders.manage` can complete
  it: Standard Jobs cannot still be `to_do`, PM
  still needs observed mileage and at least one part, and completion writes
  `work_order_completed`. Users with `admin.access` can reopen a completed or cancelled Work
  Order with a required reason when the Truck has no other open Work Order.
  Reopen restores `in_progress` if work had started, otherwise `created`,
  clears completion metadata, and records a `manager_correction` event. Jobs
  are not reopened separately.   On any open Work Order, Managers with `work_orders.manage` can PATCH
  allowed fields: `priority` and `notes`. Empty notes store as null. PM
  priority stays `normal`. Closed Work Orders stay read-only for these fields.
  Field edits use versioning and idempotency and write `priority_changed`
  and/or `notes_updated`. Users with `admin.access` can correct a closed labor session or wait
  interval with a required reason. Totals are recalculated from those segments;
  open time is not edited here. The correction writes `manager_correction` with
  `time_corrected`. On an open Standard Work Order, Managers with
  `work_orders.manage` can cancel a to-do
  Job with a required reason. Reopening a cancelled Job stays
  `admin.access`. Cancel writes
  `job_cancelled`; reopen writes `manager_correction` with `job_reopened`.
  Completed Jobs stay as they are. PM Work Orders have no Jobs. After a Work
  Order is completed, managers can mark the Truck **Returned to Service** with
  a required reason. That writes an append-only `TruckServiceStatusEvent`
  (`in_service`) and `truck_returned_to_service`. It does not change Work Order
  status, Ready to Go, presence, or Off Duty. Trucks without an event stay
  `Unknown`. This is not Catalog or Job-level assignment.
- The responsive Admin shell reuses the current LTL shadcn primitives, semantic
  tokens, typography, icon family, light/dark theme, and 44 px controls.
- Typed English and Spanish message catalogs share one React component tree.
- The Admin dashboard offers capability-filtered Workspaces cards for Standard
  Mechanic and PM Mechanic. Work performed there retains the signed-in user's
  identity; it is not impersonation.
- `/admin/catalog` UI is still a read-only Job Catalog. It lists Categories
  with active/inactive Job counts and alias counts, including inactive
  Categories and Jobs. `/admin/catalog/categories/[id]` shows Jobs and aliases.
  The screen has no create, rename, deactivate, or Custom Job mapping actions.
  Mechanic catalog APIs remain active-only. Custom Job review, Waiting by
  Reason, and Job Performance stay deferred. Ninox data remains deferred.
  System Admin catalog writes exist on the API only (LTR-77): `POST` and
  `PATCH /api/admin/catalog/jobs` for an existing active category. Shop Manager
  reads stay open and those writes return 403. Truck Detail and Yard Operations
  are implemented as the scoped readiness slice described below. `/admin/trucks`
  lists Shop trucks, any open Work Order, and operational status derived from
  service-status events. Off Duty is not inferred and has no mutation yet.
  `/admin/mechanics` UI and `/admin/history` stay read-only views. System Admin
  roster writes exist on the API only (LTR-78): `POST` and
  `PATCH /api/admin/mechanics`.

### Yard Operations and readiness Phase 1

- Users with `admin.access` can read `/admin/yard-operations` and
  `/admin/trucks/[id]`. Presence is explicitly `UNKNOWN`. Incoming Trucks,
  Upcoming Departures, and Work location on the board list remain
  disconnected until Frontend wires `GET /api/admin/yard/data-boundary`
  (`docs/YARD_DATA_BOUNDARY.md`). The board list does not call
  agent-reporting. That Nest proxy maps agent-reporting
  `returns`, `driver_pay`, and `trucks.yard_location` when
  `AGENT_REPORTING_KEY` is set on the API; it never exposes the key to the
  web app. PD-locked EN/ES card copy lives in `YARD_DATA_BOUNDARY_COPY`.
  Schedule_Teams is not unioned yet. Presence stays `UNKNOWN`.
- **Work Plan is the only mode (LTR-150).** `YARD_WORK_PLAN_SLICE1`,
  `YARD_WORK_PLAN_SLICE2` and `WORK_PLAN_PM_PHASE` are retired: the API no
  longer reads them and there is no flag-off path. Setting or removing them in
  an environment has no effect.
- Truck Detail shows Inspection discovery (**No issues found** /
  **Issues found**, requires `yard.operations.manage`) and a Work Plan of the
  jobs on the open Work Order. `GET /api/admin/trucks/:id` always returns
  `workPlan`; the hooks live at `GET/POST /api/admin/trucks/:id/work-plan*`
  (LTR-34). Work Plan CTAs open Add work pre-focused on the next pending
  mandatory step. Managers with `work_orders.manage` add jobs there (the Admin
  Work Order links to it; LTR-119 / D6) and can complete open Work Plan jobs
  from Admin (LTR-38).
- Truck Detail "Current Work" shows only an open Work Order; the completed
  Work Order that keeps a Truck Ready to Go is not listed there. Return to
  Service copy states that the Truck leaves Ready to Go. The Yard card says
  "1 Job pending" / "N Jobs pending" (LTR-151).
- The Work Plan is `Inspection → Shop Work → PM → Alignment → Detailing →
  Quality Check → Ready to close → Ready to Go`. PM, Alignment, Detailing and
  QC are always required. A step whose Jobs were all cancelled with a reason
  counts as not applicable (LTR-144). The order is shown, not enforced.
- Ready is derived, never marked: every step resolved **and** the Work Order
  Completed (LTR-90 / D1). With the steps done and the Work Order still open
  the phase is **Ready to close**.
- The Yard board/list, its Ready filter and its counters use the **same**
  `deriveWorkPlan` rules as Truck Detail (LTR-39). Counters are exclusive
  buckets that add up to the board (LTR-100); Blocked means an official pause
  or an active mechanic blocker, not "has open work" (LTR-92 / LTR-98).
  Yard Phase is presentation only: it is not a persisted Work Order status,
  not a Job Category, and does not create another Work Order.
- `YARD_READY_TO_GO_SINCE` (API env, ISO date; `apps/api/src/admin/yard-ready-window.ts`)
  is still configuration: a truck whose Work Order was completed on or after
  that date stays on the board as Ready to Go until Return to Service. Unset,
  completed Work Orders leave the board.
- A new truck Work Order automatically gets PM A Service, Alignment, Detailing
  and Quality Check (catalog names; no backfill of open WOs). One PM job per
  Work Order; the Manager or the assigned PM mechanic switches PM A ↔ PM B.
- `shop_workflow_steps` (LTR-156, schema only): one row per mandatory step
  (`step_key` from `ShopWorkflowStepKey`: `pm`, `alignment`, `detailing`,
  `quality_check`) → catalog Job, optional `default_mechanic_id`, `sort_order`,
  `active`, `updated_by_id`, `updated_at`. The migration seeds the four steps
  above by catalog name with no default mechanic; `prisma/seed.ts` fills any
  step whose catalog Job did not exist yet. Nothing reads the table at runtime
  yet: Work Order creation still uses `MANDATORY_WORK_PLAN_JOBS` until LTR-157
  (Setup "Shop workflow" screen and defaults on create).
- The PM job is assigned to a `mechanic.pm` user (not added to the Standard
  team). That mechanic opens only the PM job, starts it
  (`POST /work-orders/:id/jobs/:jobId/pm/start`), records mileage + parts
  (`/work-orders/:id/pm`) and finishes it; finishing moves the truck odometer
  and does **not** complete the Work Order.
- "Create PM service" joins the truck's open Work Order (adds PM A if missing)
  or creates the full truck Work Order. It no longer creates a standalone PM
  Work Order. One running PM per PM mechanic (D2) counts started PM jobs and
  in-progress legacy PM Work Orders.
- Legacy PM Work Orders keep working (pause, resume, finish) and show in the PM
  column; a fresh PM service is not "Needs attention" (LTR-116).
- Phase 1 six-gate readiness has no UI (the six-gate editor, Mark Ready to Go
  and the Blockers card are gone from Truck Detail). Its mutation endpoints
  (`/api/admin/trucks/:id/readiness-assessments`,
  `/api/admin/readiness-assessments/:id/*`) remain `@deprecated` until a
  cleanup PR. Inspection outcome is still stored on the assessment's
  Inspection requirement.

### Authentication and profile

- Mechanics sign in through Supabase Auth.
- The Home top bar shows the active user's name through the profile menu, which
  includes password reset and sign-out actions.
- Password-reset emails direct users to `/reset-password` on the configured
  production site URL. Local development preserves the current local origin.
- The web app restores navigation at the top of the page, including Safari
  back/forward cache restoration.
- `admin.access`, `mechanic.standard`, `mechanic.pm`, and
  `yard.operations.manage` are persisted and independently auditable. A role
  classifies a user but does not grant mechanic mutation authority. The
  ownership migration adds `work_orders.manage` for Manager operational
  authority (see Work Order ownership below).

### Standard mechanic work orders

- A Standard mechanic does **not** create Work Orders, choose Priority, add
  Jobs, globally pause/resume, or finish the Work Order. Those actions require
  `work_orders.manage` on the Admin path and return API 403 for the mechanic
  Standard routes. The Standard Create CTA and `/mechanic/standard/new` form
  are gone; the deep link asks the mechanic to contact their Shop Manager.
- An assigned Standard mechanic can start work (Continue), complete their own
  Jobs, block one of their own pending Jobs, and save execution notes
  (including additional work for the Manager to add as a Job).
- UI vocabulary follows the Flujo v3 glossary (LTR-152,
  `design-system/glossary-en-es.md`). A Job without an owner reads
  "Unassigned" / "Sin asignar"; the "inherits the Work Order team" wording is
  gone, although an unassigned Job can still be completed by any team member
  until per-Job ownership ships (PR 4). The Job-state keys (Pending, In
  progress, Blocked) exist in both catalogs, but no screen uses them yet.
- The PM job of a truck Work Order is listed read-only in the Standard view
  for anyone but its PM assignee (no "Complete job"); the API already rejected
  it (LTR-151).
- PM is not offered to a user without `mechanic.pm`.
- Catalog aliases resolve to one canonical result; a catalog job or normalized
  custom job cannot be added twice when a Manager adds work.
- Finished work remains available from the completed-work section. Active and
  paused work remain separate. The Standard empty active list reads “No
  assigned work in progress.” A paused Standard Work Order tells the mechanic
  the Manager will resume it.

### Work Order multi-Category implementation

- **CURRENT/legacy-compatible:** both `WorkOrder.primaryCategoryId` and
  `WorkOrderJob.categoryId` are required. `primaryCategoryId` remains the
  Initial/Primary Category for compatible clients and existing reports;
  `WorkOrderJob.categoryId` owns each Job's Category.
- **CURRENT:** the Work Order represents the complete intervention for a Truck;
  Standard may mix non-PM Job Categories in one Work Order. Readers continue
  rendering legacy single-Category Work Orders.
- **LOCKED:** there remains one open Work Order per Truck; work found during the
  same intervention is added to it, while a new service event creates a new
  Work Order. Standard Create does not Start, PM remains a `mechanic.pm`
  exception, Job completion does not complete the Work Order, and Work Order
  `Completed` does not mean `Ready to Go`/`Returned to Service`.
- **CURRENT contract rules:** PM is a mandatory Job of the truck Work Order,
  one per WO (LTR-145); catalog
  duplicates use `catalogJobId`, Custom Job duplicates use normalized custom
  name; inactive Categories and historical Jobs remain readable but cannot be
  selected for new work; repair-history Category filters match any Job
  Category; Add Job requires `expectedVersion` and `idempotencyKey`.
- **DEFERRED:** Job timers, configurable rules, unconfirmed
  integrations, multiple open Work Orders per Truck, and removing or making
  `primaryCategoryId` nullable.

### Work Order ownership and permissions

- Ownership is the approved V2 TARGET model (V2-002). UI and API change
  together. There is no W1 compatibility soak.
- A Standard mechanic with `mechanic.standard` executes assigned work. Home
  remains “My Assigned Work.” Standard Create, global pause/resume/change-reason,
  Add Job, and Finish Work Order are hidden. Those mechanic APIs return 403.
  The mechanic can start work, complete their own Jobs, block one of their
  own pending Jobs, and save execution notes so the Manager can add discovered
  work. Unassigned Jobs are not executable by anyone until the Manager assigns
  them (LTR-154 / D11).
- A Manager with both `admin.access` and `work_orders.manage` creates Standard
  Work Orders from `/admin/work-orders/new`, adds Jobs after create, sets
  priority/notes, assigns the team and per-Job mechanics, officially
  pauses/resumes, and completes or cancels the Work Order. Manager-created
  Standard work is `created`, not auto-started. Managers cannot create PM
  through this route. The Admin Create CTA is hidden without
  `work_orders.manage`; the API returns 403.
- LTR-154 / D11: each Job has one owner (`WorkOrderJob.assignedMechanicId`).
  `MechanicAssignment` is a derived cache of Job owners: assign adds or
  reactivates the owner; unassign or reassign removes a mechanic who no longer
  owns a Job there. Create ignores `mechanicIds` (deprecated, logged) and uses
  Job assignees. The Admin "Assignments" team card is gone; the owner is set per
  Job on the Work Order detail and on the Truck Work Plan. The team endpoints
  `POST/DELETE /admin/work-orders/:id/mechanics` remain but are deprecated.
  A Standard mechanic lists and reads a Work Order only through a non-cancelled
  Job assigned to them (legacy PM Work Orders keep creator/team access), and
  completes only their own Jobs (`403 JOB_NOT_ASSIGNED_TO_YOU`). Mechanic
  detail returns `myJobs`, `otherJobs` (read-only) and `myPartDone`. An
  unassigned pending Job gives the Dashboard reason `unassigned` (after
  blocker, before open more than 24 hours).
- LTR-154 / D18: labor is per mechanic (`work_sessions.user_id`). Start Work /
  Continue opens the actor's own session while they have a pending Job (not
  while paused). Completing, unassigning or cancelling a mechanic's last pending
  Job closes that mechanic's session only; with no pending Job at all every
  session closes. An official pause closes every open session and resume
  reopens exactly the mechanics it stopped. Work Order labor = sum of sessions.
  `laborRunning` is the viewer's own session for an assignee, any session
  otherwise. Job `workStatus` (and the Truck Work Plan `uiStatus`) is In
  Progress while the owner has an open session, Pending otherwise. Sessions
  without `user_id` (before LTR-154) count for every assignee until they close.
- Managers with `work_orders.manage` officially pause/resume a Standard
  Work Order from Admin; the Standard mechanic never pauses (D12) and the Home
  section reads "Paused by the Manager" (read-only, with reason).
- LTR-155 / D17 (replaces D3): a blocker always belongs to one Job.
  `POST /work-orders/:id/blockers { jobId, reason, notes? }` needs a pending
  Job owned by the actor (403 otherwise, 409 when already blocked) and a
  `BlockerReason` (Break, End of Shift, Working on Another WO and Truck
  Unavailable → 400). It stores a closed, zero-duration non-official
  `PauseEvent` with `job_id` and `blocker_reason` (also `reason`, for older
  readers) and logs `blocker_reported` on entity `pause_event`. Work Order
  status and waiting totals do not change. D18: when the mechanic has no
  unblocked pending Job left there, their own labor session closes. A blocked
  Job cannot be completed (`JOB_BLOCKED`) and does not count for Continue.
- The mechanic cannot resolve: the mechanic resolve route is gone. They append
  notes with `POST /work-orders/:id/blockers/:blockerId/notes { body }`
  (Activity Log `note_added` on the blocker). Only
  `POST /admin/work-orders/:id/blockers/:blockerId/resolve { notes? }`
  resolves (`blocker_resolved` with the note). The Job goes back to Pending;
  labor restarts only when the mechanic taps Continue.
- Job DTOs carry `activeBlocker` and `workStatus: blocked`; blocker DTOs carry
  `job`, `blockerReason`, `blockerNotes` and `resolutionNote`. "Blocked ·
  reason" shows on the mechanic Home and WO, the Truck Work Plan and the Yard.
  The Manager resolves (optional note) from the Dashboard attention item, the
  Truck Current Work card and the Work Order Reported blockers card.
- Pause history and time correction use official pauses only; waiting totals
  exclude mechanic blockers.
- LTR-153 columns: `work_sessions.user_id` (nullable FK `users`, index
  `(work_order_id, user_id)`) is used by LTR-154; `pause_events.job_id`
  (nullable FK `work_order_jobs`) and `pause_events.blocker_reason` (nullable
  Postgres enum `blocker_reason`, mirrored by `BlockerReason` in
  `@ltl-shop/shared`: the waiting reasons of `PauseReason` plus `other`) are
  used by LTR-155. `PauseReason` is unchanged and still used by official
  pauses.
- PM retains its specialized create-start, pause, resume, and finish behavior.
- Reopen Work Order, time correction, reopen Job, and Returned to Service stay
  on `admin.access`. There is no general permission-management UI.
- The persisted capabilities are `admin.access`, `mechanic.standard`,
  `mechanic.pm`, `yard.operations.manage`, and `work_orders.manage`. The
  endpoint/capability matrix is in `audit/CAPABILITY_BOUNDARY_AUDIT.md`.
- Ops still must grant `work_orders.manage` to the real Shop Manager roster
  and System Admin (contract Q14). That is not a code task.

### PM workflow

`mechanic.pm` is the authorization check. Daniel remains PM-only, while an
approved multi-workspace user may also perform PM work under their own identity.
The legacy `pmAuthorized` column remains only for migration compatibility.

1. Select a truck.
2. Create PM service. It joins the truck's open Work Order (or creates the
   truck Work Order with its mandatory steps), assigns the PM job to the PM
   mechanic and starts it (LTR-147). No category, jobs, collaborator,
   priority, or creation-notes form is shown.
3. Review Truck Information and enter Observed mileage.
4. After a valid integer mileage is present, select parts used from the
   compatible catalog and save notes automatically.
5. Finish. Finish requires a saved observed mileage and at least one selected
   part; it confirms a canonical truck-mileage update when needed.

PM Service records the observed mileage, selected parts, and notes as a draft
while work is open. The card shows "Saved" only after a write in the current
visit succeeds, not on open (LTR-151). Finishing creates the immutable mileage audit and completes
the PM job; the truck Work Order stays open for its other steps. Legacy PM Work
Orders (created before LTR-141) keep their pause and finish-the-WO behavior
(Q13, D12). Completed PM records are read-only.

### PM catalog and fitment

- The PM catalog has nine part categories.
- Parts are persisted server-side and are never exposed as direct database
  tables to the browser.
- Parts mentioning Peterbilt, Volvo, Freightliner, or Mack are restricted to
  those makes. Freightliner Cascadia entries additionally require model
  Cascadia. Parts with no stated fitment are generic.
- A category with compatible parts offers `No part used` plus the compatible
  choices. A category without a match is disabled with a clear message.

## Production operating configuration

- Vercel Production must define
  `NEXT_PUBLIC_SITE_URL=https://ltl-shop-web.vercel.app`.
- Supabase Auth Site URL is `https://ltl-shop-web.vercel.app`.
- Supabase Redirect URLs must allow the production reset route, Vercel preview
  URLs, and approved local development URLs.
- The Supabase Reset Password email template must use
  `{{ .ConfirmationURL }}`.
- Test roster (LTR-160): until Flujo v3 ships, only four test accounts are
  active: Crixcrox (admin), Cristian (manager), MG (Standard) and MPM (PM).
  `npm run prisma:reset-test-roster --workspace=@ltl-shop/api` (dry-run by
  default, `-- --apply` to write) reads `apps/api/.env.production.local` and
  deactivates every other user. It never deletes anyone, and it refuses to run
  while a user it would deactivate still has open work. Supabase Auth accounts
  and passwords are managed in the Supabase dashboard.
- Prisma is the sole schema-migration authority. Do not add a parallel
  migration history under `supabase/migrations`. The existing
  `supabase/migrations/20260825140000_init_domain.sql` is a preserved legacy
  snapshot, not an active or extensible migration source.

## Known current limitations

- Physical Yard Presence is always `UNKNOWN`; Samsara geofence is not connected.
  Incoming Trucks, Upcoming Departures, and Work location have a Nest
  agent-reporting proxy (`GET /api/admin/yard/data-boundary`) that stays
  `unavailable` until `AGENT_REPORTING_KEY` is set on the API. The
  yard-operations list keeps those three feeds `unavailable` even when the
  key is set. The Admin UI cards are not wired to the proxy yet.
  McLeod / Dispatch / Schedule_Teams are not used.
- Yard Phase is derived for presentation; no persisted Yard Phase event
  exists. V2.1-001 recorded Cristian’s 2026-09-12 answers and implemented
  the next-unresolved-gate derivation plus **Ready for Approval**. See
  `audit/V2_1_001_YARD_PHASE_PERSISTENCE_GAP.md`.
- Ready to Go, Returned to Service, and Work Order completion are separate
  implemented concepts.
- Admin Catalog UI is read-only. System Admin (`users.role = admin` and
  `admin.access`) can create, rename, and activate/deactivate catalog jobs
  through `POST`/`PATCH /api/admin/catalog/jobs`, and can create or activate
  Standard/PM mechanics through `POST`/`PATCH /api/admin/mechanics`. Shop
  Manager (`users.role = manager`) keeps `admin.access` and still receives 403
  on those writes. The gate is the role, not a new capability. Custom Job
  review/mapping, category create, a general permission UI, and Job performance
  do not exist. Supabase Auth accounts are not provisioned by the roster API.
- Shop Manager and System Admin still share the Admin shell, now
  capability-differentiated: planning/complete/cancel/team/priority/notes/add
  Job require `work_orders.manage`; reopen WO, time correction, Job reopen,
  and Returned to Service stay on `admin.access`.
- Ninox is not an operational source. The code has only a placeholder/status
  integration surface, and `DATA_SOURCE=supabase` is the current mode.
  Product-owner seed contract: one-shot GET TrucksDB `E`, upsert Shop trucks
  by VIN + `truckNumber` (`E.A` / `E.CG`). Last-reported location comes from
  `E.X1`/`E.AN` onto `samsaraTruckLocation` and is **not** Presence.
  `E.Y1`/`E.TA`/`E.T5`/`E.BM` are optional metadata, never Ready or board
  phase. No WO/history import. After a completed run the job does not query
  Ninox again. See `NINOX_TRUCK_SEED.md`.
- `pmAuthorized` remains in the schema for compatibility but does not grant PM
  authority.
- The V1-001 Playwright fixture gate is restored (PR #73, 86 cases). The
  earlier incomplete baseline run in `audit/BASELINE_VERIFICATION.md` is
  historical. Production smoke evidence is in `audit/V1_003_RELEASE_SMOKE.md`.
