# Current product status

This document describes the implemented mechanic experience as of the current
release branch. It is an operational summary, not a replacement for the P0
PRD.

## What is implemented

### Shop Admin read-only operations

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
  notes, pause history, and Activity Log remain read-only. On an open Standard
  Work Order, managers with `admin.access` can add or soft-remove assigned
  mechanics. PM Work Orders stay assigned to their creator. Assignments keep at
  least one active mechanic, use Work Order versioning and idempotency, and
  write `mechanic_added` / `mechanic_removed` Activity Log events. On any open
  Work Order, including PM, managers can cancel it with a required reason. Cancel
  stops open labor and wait time, sets status `cancelled`, and records a
  `manager_correction` Activity Log event. Jobs are not cancelled separately.
  On an in-progress Work Order, managers can complete it with the same finish
  rules as the mechanic workspace: Standard Jobs cannot still be `to_do`, PM
  still needs observed mileage and at least one part, and completion writes
  `work_order_completed`. This is not Off Duty, Catalog, reopen, field edits,
  or Job-level assignment.
- The responsive Admin shell reuses the current LTL shadcn primitives, semantic
  tokens, typography, icon family, light/dark theme, and 44 px controls.
- Typed English and Spanish message catalogs share one React component tree.
- The Admin dashboard offers capability-filtered Workspaces cards for Standard
  Mechanic and PM Mechanic. Work performed there retains the signed-in user's
  identity; it is not impersonation.
- Catalog management and Ninox data remain deferred. Truck Detail and Yard
  Operations are implemented as the scoped readiness slice described below.
  `/admin/trucks` is a read-only list of Shop trucks and any open Work Order.
  It does not invent Off Duty. `/admin/mechanics` and `/admin/history` are
  read-only manager views.

### Yard Operations and readiness Phase 1

- Users with `admin.access` can read `/admin/yard-operations` and
  `/admin/trucks/[id]`. Presence is explicitly `UNKNOWN`; Incoming Trucks and
  Upcoming Departures are unavailable because no telematics, gate, or Dispatch
  source is connected.
- Users with `yard.operations.manage` can start or close a readiness
  assessment, update its six requirements, and explicitly mark it Ready when
  the rules pass. These mutations use server authorization, optimistic version
  checks, idempotency, and Activity Log records.
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
- `admin.access`, `mechanic.standard`, and `mechanic.pm` are persisted and
  independently auditable. A role classifies a user but does not grant mechanic
  mutation authority.

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
- **DEFERRED:** Job timers/assignments, configurable rules, unconfirmed
  integrations, multiple open Work Orders per Truck, and removing or making
  `primaryCategoryId` nullable.

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
  migration history under `supabase/migrations`.

## Explicit next steps

These are deliberately outside the current implementation:

1. Create and invite production Supabase Auth users for each mechanic, then
   connect their Auth IDs to the existing application users.
2. Perform a production smoke test with a real reset-password email and a real
   Safari mobile device.
3. Remove the compatibility-only `pmAuthorized` column after production
   stability is confirmed; a general permission-management UI remains deferred.
4. Continue Shop Admin Fase 3 with reopen and allowed field edits;
   keep Yard/readiness mutations scoped to `yard.operations.manage`.
   Do not invent Off Duty or Catalog management.
5. Integrate live Ninox data only after its adapter contract and write model
   are approved.
6. Keep release discipline: merge only after CI and both Vercel deployments
   pass, then run the production smoke test.

## Verification baseline

The release branch is expected to pass:

```bash
npm run lint
npm run test --workspace=@ltl-shop/shared
npm run test --workspace=@ltl-shop/api
npm run test --workspace=@ltl-shop/web
npm run test:e2e --workspace=@ltl-shop/web -- admin-shell.spec.ts
npm run build
git diff --check
```

The web E2E suite additionally validates mobile interactions, PM behavior,
job duplication protection, and page-scroll restoration.
