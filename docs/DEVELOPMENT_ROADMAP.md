# Development roadmap

**Classification:** IMPLEMENTATION PLAN
**Authority:** Derived from `LIGHTNING_SHOP_MASTER_PRD.md` and audited CURRENT
**Updated:** 2026-09-11

This roadmap sequences approved product direction. It does not redefine the
domain and does not authorize work outside `IMPLEMENTATION_QUEUE.md`.

# NOW

## V1 — Stable Shop Core

**Goal:** operate the current Shop workflow reliably in production.

Current scope:

- stabilize the existing Standard, PM, Admin, Manager planning, and Yard Phase
  1 behavior already on `main`;
- provision and link real production Supabase Auth users;
- run production/staging smoke coverage for login/reset, Standard, PM, Admin,
  Manager planning, assignments, blockers, and readiness;
- isolate and repair the existing E2E baseline failures;
- verify migrations and both Vercel applications through the approved release
  path;
- preserve one open Work Order per Truck, Activity Log, PM, and historical data.

Out of scope:

- removing legacy mechanic Standard creation;
- destructive ownership cutover;
- new Yard entities;
- Catalog writes;
- Samsara, McLeod, Dispatch, or Ninox dual-write.

Exit criteria:

- automated baseline is green or every accepted exception has an owner and
  explicit rationale;
- real Standard and PM users can complete a Shop day;
- Manager can create/plan/assign and Admin can observe/correct;
- production smoke and rollback evidence exist;
- `CURRENT_PRODUCT_STATUS.md` matches deployed behavior.

## V1.1 — Manager Planning Additive (implemented, validate in V1)

Manager Create Work Order, multi-category planning, Manager priority,
per-Job assignment, Manager pause/resume, and grouped work-plan UI are already
present at the audited commit. Do not reimplement them. Treat them as
stabilization/acceptance work until real-user validation is complete.

# NEXT

## V1.2 — Assigned Work UX

**Goal:** make existing assignments operationally useful without performing the
ownership cutover.

Approved scope:

- validate “My Assigned Work” with real mechanics;
- ensure Job assignment and inherited Work Order team behavior are clear;
- validate Report Blocker and Manager operational visibility;
- repair existing behavior where acceptance tests prove a gap.

Legacy Standard Create remains available during this milestone. Changes must be
small, additive, and selected from the implementation queue.

## V2 — Ownership Cutover

Begin only after V1/V1.2 production validation and an explicit product decision.

The approval artifact is `OWNERSHIP_CUTOVER_CONTRACT.md`. Cristian approved
Q1–Q18 on 2026-09-12: implement TARGET directly. There is no W1 soak and no
parallel Standard operating model. Preserve data, PM, Activity Log, and
migrations. V2-002 implemented that TARGET cutover.

Manager:

- creates and plans normal Work Orders;
- assigns and prioritizes work;
- owns global Standard pause/resume.

Mechanic:

- executes and completes assigned Jobs;
- reports blockers.

Cutover requirements:

- UI and API authorization change together;
- PM self-create and PM pause rules remain intact;
- in-flight and historical Work Orders remain readable and operable;
- legacy endpoints are retired only with migration/rollback evidence.

# LATER

## V2.1 — Yard Operations maturity

- V2.1-001 decided not to persist Yard Phase; Cristian approved the
  next-unresolved-gate derivation (Ready for Approval included);
  a live Operational Yard pilot may still refine copy;
- mature Truck Detail, Readiness, Quality Check, Detailing, blockers, and Ready
  to Go;
- preserve separation among Yard Phase, Category, Job status, Work Order
  status, Returned to Service, and Ready to Go.

## V3 — Integrations

- Samsara geofence and physical Yard Presence;
- incoming/departures;
- McLeod/Dispatch inputs;
- readiness capacity and at-risk departures.

Each integration requires an approved source contract, ownership, failure
behavior, reconciliation, security, and real test data. No fake integration or
address-string inference is allowed.

## Deferred unless the Master PRD changes

- full TMS;
- simultaneous open Work Orders per Truck;
- generic workflow/rules engines;
- unsupported per-Job timers or productivity rankings;
- complex inventory/purchasing ERP;
- permanent Ninox dual-write;
- Catalog write governance and general permission UI without approved
  contracts.

## Sequencing rule

Finish one queue task through tests, review, status-document update, and commit
before selecting another. A landed feature is not a reason to skip validation;
it moves from implementation work to NOW stabilization.
