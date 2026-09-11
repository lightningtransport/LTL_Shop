# Current product status

**Classification:** CURRENT STATE
**Audited commit:** `4d25876`
**Updated:** 2026-09-11

This document describes only behavior implemented in the audited code. It does
not define TARGET behavior. Product direction lives exclusively in
`LIGHTNING_SHOP_MASTER_PRD.md`; gaps and sequencing live in
`audit/CURRENT_VS_TARGET.md` and `DEVELOPMENT_ROADMAP.md`.

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
  Work Order, users with `admin.access` can add or soft-remove assigned
  mechanics; per-Job assign/unassign also requires `work_orders.manage`.
  PM Work Orders stay assigned to their creator. Assignments keep at
  least one active mechanic, use Work Order versioning and idempotency, and
  write `mechanic_added` / `mechanic_removed` Activity Log events. On any open
  Work Order, including PM, managers can cancel it with a required reason. Cancel
  stops open labor and wait time, sets status `cancelled`, and records a
  `manager_correction` Activity Log event. Jobs are not cancelled separately.
  On an in-progress Work Order, managers can complete it with the same finish
  rules as the mechanic workspace: Standard Jobs cannot still be `to_do`, PM
  still needs observed mileage and at least one part, and completion writes
  `work_order_completed`. Managers can reopen a completed or cancelled Work
  Order with a required reason when the Truck has no other open Work Order.
  Reopen restores `in_progress` if work had started, otherwise `created`,
  clears completion metadata, and records a `manager_correction` event. Jobs
  are not reopened separately. On any open Work Order, managers can PATCH
  allowed fields: `priority` and `notes`. Empty notes store as null. PM
  priority stays `normal`. Closed Work Orders stay read-only for these fields.
  Field edits use versioning and idempotency and write `priority_changed`
  and/or `notes_updated`. Managers can correct a closed labor session or wait
  interval with a required reason. Totals are recalculated from those segments;
  open time is not edited here. The correction writes `manager_correction` with
  `time_corrected`. On an open Standard Work Order, managers can cancel a to-do
  Job or reopen a cancelled Job with a required reason. Cancel writes
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
- `/admin/catalog` is a read-only Job Catalog for managers. It lists Categories
  with active/inactive Job counts and alias counts, including inactive
  Categories and Jobs. `/admin/catalog/categories/[id]` shows Jobs and aliases.
  There are no create, rename, deactivate, or Custom Job mapping actions.
  Mechanic catalog APIs remain active-only. Catalog writes, Custom Jobs review,
  Waiting by Reason, and Job Performance stay deferred. Ninox data remains
  deferred. Truck Detail and Yard Operations are implemented as the scoped
  readiness slice described below. `/admin/trucks` lists Shop trucks, any open
  Work Order, and operational status derived from service-status events. Off
  Duty is not inferred and has no mutation yet. `/admin/mechanics` and
  `/admin/history` are read-only manager views.

### Yard Operations and readiness Phase 1

- Users with `admin.access` can read `/admin/yard-operations` and
  `/admin/trucks/[id]`. Presence is explicitly `UNKNOWN`; Incoming Trucks and
  Upcoming Departures are unavailable because no telematics, gate, or Dispatch
  source is connected.
- Users with both `admin.access` and `yard.operations.manage` can start or close
  a readiness assessment, update its six requirements, and explicitly mark it
  Ready when the rules pass. These mutations use server authorization,
  optimistic version checks, idempotency, and Activity Log records.
- Yard Phase is derived for presentation from assessment and Work Order
  evidence. It is not a persisted Work Order status, not a Job Category, and
  does not create another Work Order.
- `Ready to Go` is an explicit readiness approval. Completing a Work Order does
  not establish physical presence, departure, or return to service.

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

- A mechanic selects a truck, a non-PM category, one or more jobs, optional
  collaborators, priority, and optional notes.
- PM is not offered to a user without `mechanic.pm`. Collaborators are
  optional and never default to the work-order creator.
- On creation, choosing a non-PM category immediately lists its catalog jobs
  inline. “Job not listed” switches to an exclusive custom-job form. A Standard
  Work Order may contain Jobs from multiple non-PM Categories; changing the
  Initial/Primary Category never silently removes selected Jobs. Existing
  orders use a picker that can add a Job from another Standard Category.
- Catalog aliases resolve to one canonical result; a catalog job or normalized
  custom job cannot be added twice.
- Work can start, pause only while a job remains pending, resume, and finish
  after all required jobs are complete.
- Finished work returns to Home and is available from the completed-work
  section. Active and paused work remain separate.

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
- **CURRENT contract rules:** Standard may not add the PM Category; catalog
  duplicates use `catalogJobId`, Custom Job duplicates use normalized custom
  name; inactive Categories and historical Jobs remain readable but cannot be
  selected for new work; repair-history Category filters match any Job
  Category; Add Job requires `expectedVersion` and `idempotencyKey`.
- **DEFERRED:** Job timers, configurable rules, unconfirmed
  integrations, multiple open Work Orders per Truck, and removing or making
  `primaryCategoryId` nullable.

### Work Order ownership and permissions

- Ownership is currently a **soft-cutover hybrid**.
- A Standard mechanic with `mechanic.standard` can still create a Standard Work
  Order, choose its initial priority, and use the legacy Standard create route.
  The Home screen is titled “My Assigned Work,” but the Standard Create CTA
  remains available in a secondary style.
- A Manager with both `admin.access` and `work_orders.manage` can create a
  Standard Work Order from `/admin/work-orders/new`, select a Truck, add
  multi-category catalog or Custom Jobs, set priority/notes, and optionally
  assign individual Jobs. Manager-created Standard work is `created`, not
  auto-started. Managers cannot create PM through this route.
- `MechanicAssignment` remains the Work Order-level general team.
  `WorkOrderJob.assignedMechanicId` is an optional per-Job assignment. Manager
  create unions Job assignees into the general team; Manager detail can
  assign/unassign a Job with version and idempotency checks. An unassigned Job
  has no persisted per-Job owner and may be presented as inheriting the general
  team.
- Managers with `work_orders.manage` can officially pause/resume a Standard
  Work Order from Admin. Standard mechanics can report a blocker without
  changing Work Order status or waiting totals. The blocker is stored as a
  closed, zero-duration non-official `PauseEvent` and writes
  `blocker_reported`.
- Legacy mechanic pause/resume endpoints still exist. Standard detail presents
  Report Blocker while in progress, but a paused Work Order still exposes
  resume/change-reason behavior. PM retains its specialized pause behavior.
- Users with `admin.access` can patch priority/notes on open Work Orders and
  perform the other V1 Admin corrections (cancel/complete/reopen, Job
  cancel/reopen, time correction, Returned to Service). Official pause/resume,
  Manager create, and per-Job assignment require `work_orders.manage` in
  addition. There is no general permission-management UI.
- The persisted capabilities are `admin.access`, `mechanic.standard`,
  `mechanic.pm`, `yard.operations.manage`, and `work_orders.manage`. The
  endpoint/capability matrix is in `audit/CAPABILITY_BOUNDARY_AUDIT.md`.

### PM workflow

`mechanic.pm` is the authorization check. Daniel remains PM-only, while an
approved multi-workspace user may also perform PM work under their own identity.
The legacy `pmAuthorized` column remains only for migration compatibility.

1. Select a truck.
2. Create PM Work Order. It starts immediately with one assigned PM mechanic
   and one open work session; no category, jobs, collaborator, priority, or
   creation-notes form is shown.
3. Review Truck Information and enter Observed mileage.
4. After a valid integer mileage is present, select parts used from the
   compatible catalog and save notes automatically.
5. Pause or finish. Finish requires a saved observed mileage and at least one
   selected part; it confirms a canonical truck-mileage update when needed.

PM Service records the observed mileage, selected parts, and notes as a draft
while work is open. Finishing creates the immutable mileage audit and completes
the work order. Completed PM records are read-only.

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
- Prisma is the sole schema-migration authority. Do not add a parallel
  migration history under `supabase/migrations`. The existing
  `supabase/migrations/20260825140000_init_domain.sql` is a preserved legacy
  snapshot, not an active or extensible migration source.

## Known current limitations

- Physical Yard Presence is always `UNKNOWN`; Samsara, McLeod, Dispatch,
  Incoming, and Departures are not connected.
- Yard Phase is derived for presentation; no persisted Yard Phase event exists.
- Ready to Go, Returned to Service, and Work Order completion are separate
  implemented concepts.
- Admin Catalog is read-only. Catalog writes, Custom Job review/mapping, Job
  performance, and a general permission UI do not exist.
- Shop Manager and System Admin still share the Admin shell. V1-004 documents
  the HTTP capability matrix; it does not split remaining `admin.access`
  corrections onto `work_orders.manage`.
- Ninox is not an operational source. The code has only a placeholder/status
  integration surface, and `DATA_SOURCE=supabase` is the current mode.
- `pmAuthorized` remains in the schema for compatibility but does not grant PM
  authority.
- The V1-001 Playwright fixture gate is restored (PR #73, 86 cases). The
  earlier incomplete baseline run in `audit/BASELINE_VERIFICATION.md` is
  historical. Production smoke evidence is in `audit/V1_003_RELEASE_SMOKE.md`.
