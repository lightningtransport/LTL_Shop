# Current product status

This document describes the implemented mechanic experience as of the current
release branch. It is an operational summary, not a replacement for the P0
PRD.

## What is implemented

### Shop Admin foundation

- Active users with role `manager` or `admin` can enter the server-protected
  `/admin` shell; a Mechanic receives a secure 403 response and no Admin data.
- NestJS exposes reusable declarative RBAC through a roles decorator and guard.
- Login redirects by verified application role, using the shared authentication
  flow rather than a second Admin login.
- The responsive Admin shell reuses the current LTL shadcn primitives, semantic
  tokens, typography, icon family, light/dark theme, and 44 px controls.
- Typed English and Spanish message catalogs share one React component tree.
  Operational data and administrative mutations remain deferred to later phases.

### Authentication and profile

- Mechanics sign in through Supabase Auth.
- The Home top bar shows the active user's name through the profile menu, which
  includes password reset and sign-out actions.
- Password-reset emails direct users to `/reset-password` on the configured
  production site URL. Local development preserves the current local origin.
- The web app restores navigation at the top of the page, including Safari
  back/forward cache restoration.

### Standard mechanic work orders

- A mechanic selects a truck, a non-PM category, one or more jobs, optional
  collaborators, priority, and optional notes.
- PM is not offered to a mechanic without PM authorization. Collaborators are
  optional and never default to the work-order creator.
- Jobs are selected through one shared picker in creation and detail screens.
  Catalog aliases search to one canonical result; a catalog job or normalized
  custom job cannot be added twice.
- Work can start, pause only while a job remains pending, resume, and finish
  after all required jobs are complete.
- Finished work returns to Home and is available from the completed-work
  section. Active and paused work remain separate.

### Daniel PM workflow

`pmAuthorized` is a temporary capability; the current PM mechanic is Daniel.
The capability—not a name or email—is the authorization check.

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
3. Replace `pmAuthorized` with a managed assignment policy that can assign
   multiple mechanics to categories or individual jobs.
4. Continue Shop Admin with Phase 2 read-only Work Orders, Trucks, Mechanics,
   History, and evidence-backed dashboard metrics before adding mutations.
5. Integrate live Ninox data only after its adapter contract and write model
   are approved.
6. Keep release discipline: merge only after CI and both Vercel deployments
   pass, then run the production smoke test.

## Verification baseline

The release branch is expected to pass:

```bash
npm run lint
npm run test --workspace=@ltl-shop/api
npm run test --workspace=@ltl-shop/web
npm run build
git diff --check
```

The web E2E suite additionally validates mobile interactions, PM behavior,
job duplication protection, and page-scroll restoration.
