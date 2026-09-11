# Implementation queue

**Classification:** IMPLEMENTATION PLAN
**Updated:** 2026-09-11
**Selection rule:** Take the first unblocked task in milestone order. Do not
combine tasks or start a later milestone without the roadmap gate.

## V1-000 — Investigate failed Vercel API deployment

ID: V1-000
Milestone: V1 — Stable Shop Core
Problem: GitHub's combined status for current `main` is failing because the
`Vercel – ltl-shop-api` deployment failed, although CI and web deployment pass.
Outcome: The API deployment failure has an evidence-backed root cause and the
existing application deploys successfully without feature expansion.
Scope: Inspect the failed deployment/build logs, reproduce the release/build
path where possible, and repair only the existing build/deployment defect.
Out of Scope: Product features, schema redesign, environment-secret disclosure,
or bypassing the Prisma release gate.
Dependencies: Authorized Vercel deployment-log access.
Files likely affected: API/Vercel/release configuration only if the failure is
in repository code; otherwise environment configuration and audit evidence.
Acceptance Criteria: API deployment is READY, health/root probes pass, combined
`main` status is green, and no migration authority is duplicated.
Tests: API build, Prisma release status, focused failure reproduction, API
health/root reads, workspace regression checks.
Risk: HIGH — production API availability and migration safety.
Status: COMPLETE — approved Release safety applied the pending migrations and
verified the API; the current `main` API deployment is READY and combined
status is green. See `audit/V1_000_DEPLOYMENT_INVESTIGATION.md`.

## V1-001 — Restore a trustworthy E2E gate

ID: V1-001
Milestone: V1 — Stable Shop Core
Problem: The full Playwright suite has existing failures/timeouts and cannot be
used as a release gate.
Outcome: Each failure is classified and the complete fixture suite finishes
with reliable results.
Scope: Reproduce failing specs one browser/one worker at a time; fix stale
fixtures/assertions or existing-product regressions only; document any accepted
environment limitation.
Out of Scope: UI redesign, ownership cutover, new behavior, test deletion.
Dependencies: Seeded fixture server; installed Chromium and WebKit.
Files likely affected: `apps/web/e2e`, related existing web code only when a
runtime defect is proven.
Acceptance Criteria: All 86 configured cases pass, or a narrowly documented
browser/environment exception is approved; no test is weakened to hide a bug.
Tests: Isolated failing tests, then full `ADMIN_E2E_FIXTURE=1` Playwright suite,
unit tests, lint, build.
Risk: MEDIUM — stale tests can be confused with regressions.
Status: READY — V1-000 is resolved; select only when explicitly beginning the
next stabilization task.

## V1-002 — Provision production users

ID: V1-002
Milestone: V1 — Stable Shop Core
Problem: Real Shop users must exist in Supabase Auth and map to active
application users/capabilities.
Outcome: Every approved mechanic/Manager can authenticate with least-privilege
capabilities.
Scope: User inventory, Auth invitation/reset, application-user linking,
capability verification.
Out of Scope: General permission-management UI, role redesign.
Dependencies: Approved user list and authorized Supabase production access.
Files likely affected: Usually none; operating evidence/runbook only.
Acceptance Criteria: Each approved account signs in and lands in the correct
workspace; inactive/unapproved users are denied.
Tests: Auth/capability smoke matrix without recording credentials.
Risk: HIGH — production identity and authorization.
Status: BLOCKED — requires product/operations user list and production access.

## V1-003 — Run production release smoke

ID: V1-003
Milestone: V1 — Stable Shop Core
Problem: Automated tests do not prove the real deployment, email reset, or
mobile Safari path.
Outcome: A real Standard + PM + Manager/Admin day flow is evidenced.
Scope: Approved release gate, both Vercel deployments, reset email, Standard,
PM, Manager planning/assignment/blocker, Admin correction, readiness, rollback
check.
Out of Scope: Production load testing or unapproved data mutation.
Dependencies: V1-001, V1-002, staging/production test records and devices.
Files likely affected: `docs/CURRENT_PRODUCT_STATUS.md`, release evidence only
unless a defect is found.
Acceptance Criteria: Smoke checklist passes with no unexpected 401/403/500 and
rollback target is known.
Tests: Real Safari mobile plus supported desktop browser; API health/root reads.
Risk: HIGH — production operations.
Status: BLOCKED.

## V1-004 — Audit operational capability boundaries

ID: V1-004
Milestone: V1 — Stable Shop Core
Problem: The Admin controller mixes class-level `admin.access` with selective
`work_orders.manage`, while product responsibilities distinguish Manager from
System Admin.
Outcome: A tested endpoint/capability matrix describes current authorization
and any V1 defect.
Scope: Read-only audit first; repair only proven access defects without
performing ownership cutover.
Out of Scope: General permissions UI or removing mechanic legacy authority.
Dependencies: Master PRD, Current Status, production user policy.
Files likely affected: `apps/api/src/admin`, auth tests, shared capabilities,
authorization documentation.
Acceptance Criteria: Every mutation has an explicit expected capability and
positive/negative test.
Tests: Capability guard and service/controller authorization tests.
Risk: HIGH — authorization changes can widen access.
Status: DONE — matrix in `docs/audit/CAPABILITY_BOUNDARY_AUDIT.md` and
`apps/api/src/auth/capability-boundary.matrix.spec.ts`. No V1 HTTP access
defect was repaired; Manager vs System Admin enforcement remains V2.

## V1.2-001 — Validate My Assigned Work

ID: V1.2-001
Milestone: V1.2 — Assigned Work UX
Problem: The assignment-centered label and per-Job assignment are implemented
but not yet validated as a complete mechanic workflow.
Outcome: Mechanics can identify and execute assigned work without ambiguity.
Scope: User validation and smallest fixes to list/detail assignment
presentation and inherited-team behavior.
Out of Scope: Removing Standard Create, changing global pause authorization, or
adding timers.
Dependencies: V1 production stability and real mechanic feedback.
Files likely affected: mechanic Home/detail, DTO mapping, focused E2E.
Acceptance Criteria: Assigned/unassigned Jobs and Work Order team inheritance
are clear at mobile size; existing PM remains unchanged.
Tests: Mobile Chromium/WebKit assignment flows plus API access tests.
Risk: MEDIUM.
Status: PENDING.

## V1.2-002 — Validate blocker lifecycle and visibility

ID: V1.2-002
Milestone: V1.2 — Assigned Work UX
Problem: Report Blocker and Manager pause exist, but operational resolution and
visibility need validation.
Outcome: A mechanic report is visible/actionable to Manager without corrupting
waiting totals or status.
Scope: Validate report, display, official pause/resume, audit, and totals;
repair proven gaps.
Out of Scope: Workflow engine or new generic blocker entity.
Dependencies: V1-001 and Manager/mechanic feedback.
Files likely affected: Work Order service, Admin detail, shared DTOs, focused
tests.
Acceptance Criteria: Report does not pause; official pause does; actor/reason
are auditable; totals exclude report-only events.
Tests: API transaction/timing tests and both-role E2E.
Risk: HIGH — timing and operational status.
Status: PENDING.

## V2-001 — Approve ownership cutover contract

ID: V2-001
Milestone: V2 — Ownership Cutover
Problem: Legacy mechanic planning cannot be removed safely without evidence and
a complete UI/API authorization contract.
Outcome: Product approves a cutover matrix, compatibility window, rollback, and
acceptance plan.
Scope: Decision document and audited impact; no implementation in this task.
Out of Scope: Code/schema changes.
Dependencies: V1 and V1.2 acceptance evidence.
Files likely affected: Master PRD decision log, Current vs Target, roadmap,
queue.
Acceptance Criteria: Every mechanic/Manager/PM action has CURRENT, post-cutover,
migration, and rollback behavior.
Tests: Test plan only.
Risk: HIGH.
Status: GATED.

## V2.1-001 — Validate the Yard Phase persistence gap

ID: V2.1-001
Milestone: V2.1 — Yard Operations maturity
Problem: Derived Yard Phase may not represent manual operational transitions,
but a new event model is not yet justified.
Outcome: Evidence decides whether persistence is necessary.
Scope: Observe Detailing/Quality Check/Ready workflows and compare them with
current derivation.
Out of Scope: Creating `YardPhaseEvent` before the gap is proven.
Dependencies: Operational Yard pilot.
Files likely affected: Audit and product decision documents first.
Acceptance Criteria: Concrete cases, source owner, audit needs, and migration
requirements are documented.
Tests: Proposed only if implementation is later approved.
Risk: MEDIUM.
Status: GATED.

## V3-001 — Define integration source contracts

ID: V3-001
Milestone: V3 — Integrations
Problem: Presence and departures have no approved operational source contract.
Outcome: Samsara/McLeod/Dispatch responsibilities and data quality are defined
before code.
Scope: Read-only discovery, ownership, security, mapping, reconciliation,
failure modes.
Out of Scope: Fake data, address comparison, implementation, dual-write.
Dependencies: Vendor access and product approval.
Files likely affected: Architecture/reference documentation only.
Acceptance Criteria: Each field has source, freshness, owner, fallback, audit,
and test strategy.
Tests: Contract test plan.
Risk: HIGH.
Status: GATED.
