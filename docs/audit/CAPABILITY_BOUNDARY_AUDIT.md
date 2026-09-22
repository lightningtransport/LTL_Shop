# Capability boundary audit

**Classification:** AUDIT EVIDENCE
**Task:** V1-004
**Audited commit:** see `CURRENT_PRODUCT_STATUS.md`
**Updated:** 2026-09-12 — V2-002 TARGET enforcement applied. Historical V1
wording below is superseded by the executable matrix in
`capability-boundary.matrix.ts`.

This is a read-first authorization matrix for Lightning Shop V1. It records
what each Admin, Work Order, and Yard mutation **declares**, what the public
HTTP path **enforces**, and the V1 **expected** capability. It does not
authorize ownership cutover, mechanic-legacy removal, or a general permissions
UI.

Executable copy of the mutation matrix lives in
`apps/api/src/auth/capability-boundary.matrix.ts` and is asserted by
`apps/api/src/auth/capability-boundary.matrix.spec.ts`.

## Authority used

| Source | Used for |
|---|---|
| `LIGHTNING_SHOP_MASTER_PRD.md` | TARGET Manager vs System Admin responsibilities |
| `CURRENT_PRODUCT_STATUS.md` | CURRENT implemented behavior |
| `audit/CURRENT_VS_TARGET.md` | V1 audit vs V2 enforcement sequencing |
| `YARD_OPERATIONS_PHASE_1_CONTRACT.md` | Yard read vs mutate split |
| Controller/guard/service code | Declared vs enforced truth |

TARGET still distinguishes Shop Manager (plan, assign, official pause, Yard
progression, Ready to Go) from System Admin (application administration,
catalog, elevated corrections). V1 does **not** require that split on every
Admin mutation. Full capability-based separation remains V2 enforcement.

## How authorization is implemented

1. `AuthGuard` authenticates the Supabase/dev token and loads **persisted**
   application capabilities. Role classifies the user. It does not grant
   Work Order or Yard mutation authority. LTR-77 / LTR-78 roster and catalog
   writes are the exception: they require `role === admin` (see below).
2. `CapabilitiesGuard` reads `@Capabilities(...)` with Nest
   `getAllAndOverride`. **Method metadata replaces class metadata.** A method
   that needs a second capability must re-declare `admin.access`.
3. `AdminController` applies `AuthGuard` + `CapabilitiesGuard` and class-level
   `admin.access`.
4. `WorkOrdersController` applies `AuthGuard` only. Mechanic capability,
   assignment, and PM vs Standard rules are enforced in
   `WorkOrdersService.assertMechanicAccess`.
5. Manager wrappers `createByManager`, `pauseByManager`, and `resumeByManager`
   skip assignment checks and **do not re-assert** `work_orders.manage`.
   Yard mutation methods likewise trust the HTTP guard.
6. **LTR-77 / LTR-78 exception (2026-09-22).** Roster and catalog writes are
   not a new capability. `SystemAdminGuard` allows them only when
   `users.role === admin` (System Admin). Shop Manager is `role = manager`
   and already has `admin.access`, so capability checks alone would let
   Manager write. Class-level `admin.access` still applies. See
   `SYSTEM_ADMIN_ROLE_WRITES` in `capability-boundary.matrix.ts`.

## Capability catalog

| Capability | V1 meaning |
|---|---|
| `admin.access` | Enter the Admin shell; read Admin/Yard; perform V1 Admin corrections |
| `work_orders.manage` | Additive Manager planning: Admin create, official pause/resume, per-Job assign/unassign |
| `yard.operations.manage` | Mutate readiness assessments and explicit Ready |
| `mechanic.standard` | Legacy Standard create/execute on assigned Work Orders |
| `mechanic.pm` | Specialized PM create-start and PM execution |

Seeded `manager@lightning.local` and `admin@lightning.local` hold
`admin.access` + `yard.operations.manage` + `work_orders.manage`. Seeded
`ibrain@ltransl.com` and `cristian240588@hotmail.com` hold `admin.access` plus
mechanic workspaces and **do not** hold `work_orders.manage` or
`yard.operations.manage`. That is why V1 cannot silently move every Admin
mutation onto `work_orders.manage`.

## Admin and Yard mutations

| Method and path | Declared | HTTP enforced | V1 expected | Verdict |
|---|---|---|---|---|
| `POST /admin/work-orders` | `admin.access` + `work_orders.manage` | same | same | Aligned |
| `PATCH /admin/work-orders/:id` | `admin.access` (class) | same | `admin.access` | Aligned — V1 correction |
| `POST /admin/time-corrections` | `admin.access` (class) | same | `admin.access` | Aligned — V1 correction |
| `POST /admin/jobs/:id/reopen` | `admin.access` (class) | same | `admin.access` | Aligned — V1 correction |
| `POST /admin/jobs/:id/cancel` | `admin.access` (class) | same | `admin.access` | Aligned — V1 correction |
| `POST /admin/work-orders/:id/reopen` | `admin.access` (class) | same | `admin.access` | Aligned — V1 correction |
| `POST /admin/work-orders/:id/return-to-service` | `admin.access` (class) | same | `admin.access` | Aligned — V1 correction |
| `POST /admin/work-orders/:id/complete` | `admin.access` (class) | same | `admin.access` | Aligned — V1 correction |
| `POST /admin/work-orders/:id/cancel` | `admin.access` (class) | same | `admin.access` | Aligned — V1 correction |
| `POST /admin/work-orders/:id/pause` | `admin.access` + `work_orders.manage` | same | same | Aligned |
| `POST /admin/work-orders/:id/resume` | `admin.access` + `work_orders.manage` | same | same | Aligned |
| `POST /admin/work-orders/:id/mechanics` | `admin.access` (class) | same | `admin.access` | Aligned for V1; TARGET Manager assignment |
| `DELETE /admin/work-orders/:id/mechanics/:mechanicId` | `admin.access` (class) | same | `admin.access` | Aligned for V1; TARGET Manager assignment |
| `POST /admin/work-orders/:id/jobs/:jobId/assign` | `admin.access` + `work_orders.manage` | same | same | Aligned |
| `POST /admin/work-orders/:id/jobs/:jobId/unassign` | `admin.access` + `work_orders.manage` | same | same | Aligned |
| `POST /admin/trucks/:id/readiness-assessments` | `admin.access` + `yard.operations.manage` | same | same | Aligned |
| `PATCH /admin/readiness-assessments/:id/requirements/:type` | `admin.access` + `yard.operations.manage` | same | same | Aligned |
| `POST /admin/readiness-assessments/:id/mark-ready` | `admin.access` + `yard.operations.manage` | same | same | Aligned |
| `POST /admin/readiness-assessments/:id/close` | `admin.access` + `yard.operations.manage` | same | same | Aligned |

Admin reads (`/admin/access`, dashboard, lists, detail, catalog, trucks,
mechanics, history, yard-operations, truck detail, repair history) all require
`admin.access` only. That matches the Yard Phase 1 contract.

## System Admin role gate (LTR-77 / LTR-78)

`admin.access` is shared by Shop Manager and System Admin. These writes add
`SystemAdminGuard` (`users.role === admin`) on top of class-level
`admin.access`. A Manager who holds `admin.access`, `work_orders.manage`, and
`yard.operations.manage` still receives 403. No permissions matrix and no new
capability.

| Method and path | Capability declared | Role gate | Manager |
|---|---|---|---|
| `POST /api/admin/mechanics` | `admin.access` (class) | `role === admin` | 403 |
| `PATCH /api/admin/mechanics/:id` | `admin.access` (class) | `role === admin` | 403 |
| `POST /api/admin/catalog/jobs` | `admin.access` (class) | `role === admin` | 403 |
| `PATCH /api/admin/catalog/jobs/:id` | `admin.access` (class) | `role === admin` | 403 |

Mechanic create applies exactly one of `mechanic.standard` or `mechanic.pm`
and records `user_capabilities.granted_by_id`. Catalog create records
`catalog_jobs.created_by_id` and keeps the job id stable across rename and
activate. Category create, Custom Job review, and Supabase Auth provisioning
are not part of this gate.

## Mechanic Work Order mutations

The mechanic controller has **no** `@Capabilities` decorator. Missing
`mechanic.standard` / `mechanic.pm` or missing assignment returns 403 from the
service. `admin.access` and `work_orders.manage` do **not** grant these routes.

| Method and path | Declared on controller | Service enforced | V1 expected | Verdict |
|---|---|---|---|---|
| `POST /work-orders` | Auth only | `mechanic.standard` or `mechanic.pm` | same (legacy create kept) | Aligned — do not remove in V1 |
| `POST /work-orders/:id/start` | Auth only | assigned + matching mechanic capability | same | Aligned |
| `POST /work-orders/:id/pause` | Auth only | assigned + matching mechanic capability | same (legacy) | Aligned — do not remove in V1 |
| `POST /work-orders/:id/pause-reason` | Auth only | assigned + matching mechanic capability | same (legacy) | Aligned |
| `POST /work-orders/:id/resume` | Auth only | assigned + matching mechanic capability | same (legacy) | Aligned |
| `POST /work-orders/:id/blockers` | Auth only | assigned + matching mechanic capability | same | Aligned |
| `POST /work-orders/:id/complete` | Auth only | assigned + matching mechanic capability | same | Aligned |
| `POST /work-orders/:id/jobs` | Auth only | assigned + matching mechanic capability | same | Aligned |
| `POST /work-orders/:id/notes` | Auth only | assigned + matching mechanic capability | same | Aligned |
| `POST /work-orders/:id/jobs/:jobId/complete` | Auth only | assigned + matching mechanic capability | same | Aligned |
| `POST /work-orders/:id/pm` | Auth only | assigned + `mechanic.pm` | same | Aligned |

## Findings

### F1 — Mixed Admin guards are CURRENT V1, not an HTTP hole

Newer Manager-planning routes require `work_orders.manage`. Older Admin
corrections and Work Order-level team assignment require only `admin.access`.
Product CURRENT documents both. TARGET wants Manager operations without System
Admin, but `CURRENT_VS_TARGET.md` schedules that enforcement for V2.

**V1 repair:** none. Tightening corrections or WO-level assignment onto
`work_orders.manage` would lock out seeded Admin users who have `admin.access`
without Manager planning, and would start the ownership cutover.

### F2 — Service-layer Manager/Yard methods trust the HTTP guard

`createByManager`, `pauseByManager`, `resumeByManager`, and Yard readiness
commands do not call `hasCapability`. The public HTTP paths are guarded.
Mechanic methods self-check because their controller has no capability
decorator.

**V1 repair:** none. This is defense-in-depth, not a reachable anonymous or
mechanic-to-Admin hole. Re-asserting capabilities inside those services is
safe later work and must not change the HTTP matrix above.

### F3 — `getAllAndOverride` is a footgun that current methods handle

If a future method adds `@Capabilities(work_orders.manage)` without also
listing `admin.access`, the class-level Admin requirement is dropped. Current
overrides re-declare both capabilities. The matrix test fails if that regresses.

### F4 — Web Admin create CTA is not capability-filtered

`/admin/work-orders` always offers Create. Users with `admin.access` and
without `work_orders.manage` can open the form and receive API 403. Yard
mutation controls already hide without `yard.operations.manage`.

**V1 repair:** none. A general permissions UI is out of scope.

## Defects repaired in this task

None. No public mutation was found that is missing its V1 expected capability,
or that enforces a weaker set than it declares.

## V2 follow-up (not started)

The product-approval contract is `docs/OWNERSHIP_CUTOVER_CONTRACT.md`
(V2-001). It does not change this V1 matrix. After Cristian approves that
contract:

- decide which remaining `admin.access` mutations become Manager
  (`work_orders.manage`) vs elevated System Admin (contract Q3–Q7);
- optionally re-assert those capabilities in Admin/Yard services;
- hide Admin planning controls that the API already rejects (contract Q16);
- retire mechanic legacy create/pause only through the approved W1/W2
  window. Do not implement those changes in V2-001.
