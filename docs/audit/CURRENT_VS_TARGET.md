# Current vs target

**Classification:** REFERENCE — PRIMARY GAP CONTROL
**Audited commit:** `2a77d4e`
**Updated:** 2026-09-11

Use this table before opening any implementation task. “TARGET” means approved
direction, not implemented behavior. “Planned Phase” follows
`../DEVELOPMENT_ROADMAP.md`.

| Area | CURRENT | TARGET | Gap | Planned Phase |
|---|---|---|---|---|
| Work Order creation | Standard mechanics can create; Managers with both `admin.access` and `work_orders.manage` can also create Standard Work Orders. PM mechanics self-create PM services. | Manager normally creates/plans Standard; PM remains specialized. | Soft-cutover validation and eventual removal of normal mechanic create, including backend enforcement. | NOW validation; V2 cutover |
| Work Order ownership | Hybrid. Manager planning controls exist, but legacy mechanic planning remains. | Manager owns plan; mechanic executes assigned work. | Production validation, capability policy, UI/API legacy retirement. | NOW then V2 |
| Priority | Mechanic chooses at legacy Standard create; Manager chooses at Manager create and Admin can patch open Work Orders. PM is normal. | Manager owns Standard priority; mechanic sees it. | Remove mechanic priority authority only at cutover. | V2 |
| Pause/resume | Manager pause/resume exists. Standard mechanic UI reports blockers, but legacy mechanic pause/resume endpoints and resume/change-reason controls remain; PM keeps pause. | Manager owns global Standard pause/resume; mechanic reports blockers; PM retains specialized rules. | Clarify and enforce Standard cutover without breaking PM or historical pauses. | NOW regression coverage; V2 |
| Multi-category Jobs | Implemented for Standard create and Add Job. Each Job owns `categoryId`; `primaryCategoryId` remains required for compatibility. | Same model, with primary Category as initial reason only. | Production validation and legacy reader protection; no destructive schema change. | NOW |
| Mechanic assignments | Work Order-level `MechanicAssignment` remains the general team. | General team may remain for compatibility. | Define eventual role after Job-centered execution; do not delete now. | V1.2/V2 |
| Job assignments | Nullable per-Job assignee exists; Manager create and detail support assign/unassign; unassigned Jobs visually inherit the WO team. | Manager assigns Jobs; mechanic works assigned Jobs. | Verify list/detail filtering and end-to-end assignment semantics with real users. | NOW/V1.2 |
| Mechanic assigned-work UX | Home is titled “My Assigned Work” and displays assigned WOs/Jobs, but legacy Standard Create remains demoted. | Assignment-centered execution with no normal planning controls. | Validate assigned-work completeness; remove legacy controls only at cutover. | V1.2 then V2 |
| Blockers | Mechanic can report a blocker without changing WO status; record is a zero-duration non-official `PauseEvent`. Manager can officially pause. | Mechanic reports; Manager resolves/pauses with operational visibility. | Manager visibility/lifecycle semantics and focused regression coverage need validation. | V1.2 |
| PM | Specialized create-start, observed mileage, parts/fitment, notes, pause and completion rules; authorized by `mechanic.pm`. | Preserve specialized PM unless an approved migration says otherwise. | `pmAuthorized` compatibility column remains; removal waits for production stability. | NOW cleanup later |
| Admin | Dashboard, Work Orders, corrections, assignments, cancel/complete/reopen, priority/notes, time corrections, Returned to Service, read-only Trucks/Mechanics/History/Catalog. V1-004 matrix: corrections and WO-level team assignment stay on `admin.access`; Manager create/pause/Job assign need `work_orders.manage`. | System Admin handles administration; Shop Manager handles operations without requiring System Admin. | Boundaries overlap by design in V1; catalog writes and permission UI remain deferred. | V1-004 audit done; LATER where approved |
| Truck Detail | Admin Truck Detail shows identity, active readiness, derived phase/blockers, active WO, and history links/data. | Canonical Truck view with overview, work, readiness, and history. | Validate completeness and avoid parallel history. | V2.1 |
| Yard Operations | Phase 1 implemented: Truck-centric list/board, readiness assessments, derived phases and blockers. | Mature Yard progression independent of Category and WO status. | Persist Yard Phase only if validated derivation is insufficient; Detailing/Quality Check maturity remains. | V2.1 |
| Readiness | Six persisted assessment requirements with evidence/waivers and optimistic/idempotent mutations. | Explain all remaining requirements and blockers reliably. | Operational validation and stronger evidence rules where real data requires them. | V2.1 |
| Ready to Go | Explicit authorized readiness approval; separate from WO completion and Returned to Service. | Same conceptual separation. | Validate operational approval/invalidations in production. | NOW/V2.1 |
| Yard Presence | Always `UNKNOWN`; no inferred location. | `IN_YARD`, `OUTSIDE_YARD`, or `UNKNOWN` from reliable evidence. | No source integration. | V3 |
| Samsara | Not integrated. | Geofence-based physical location when approved. | Contract, credentials, mapping, failure behavior, and auditability. | V3 |
| Dispatch / McLeod | Not integrated; Incoming/Departures are unavailable. | Future arrival/departure and capacity planning inputs. | Approved source contracts and real data. No fake integration. | V3 |
| Catalog | Mechanic active-only reads; Admin read-only Categories, Jobs, aliases, including inactive records. | System Admin governs catalog when approved. | Write contracts, Custom Job review/mapping, permissions, and audit are not approved for NOW. | LATER |
| Permissions/capabilities | Persisted `admin.access`, `mechanic.standard`, `mechanic.pm`, `yard.operations.manage`, `work_orders.manage`; HTTP guards match the V1-004 matrix in `CAPABILITY_BOUNDARY_AUDIT.md`. | Capability-based operational separation between Manager, Admin, Yard, Standard, and PM. | V1 HTTP matrix is tested; remaining Admin/Manager overlap and service-layer re-asserts wait for V2. No general permission UI. | V1-004 audit done; V2 enforcement |
| Authentication | Supabase Auth in hosted environments; dev bypass locally; application user/capabilities resolved server-side. Temporary approved production test users exist (Admin / Standard / PM). | Supabase Auth with the real Shop roster. | Real roster still pending; interactive landing, reset-email, and Safari smoke remain OPERATOR_REQUIRED in `V1_003_RELEASE_SMOKE.md`. | NOW |
| Runtime data | Supabase PostgreSQL is operational. Ninox client is a placeholder/status endpoint only. | Supabase PostgreSQL remains operational source. | Remove contradictory Ninox-era wording; no dual-write. | NOW docs complete |

## Locked interpretation rules

- CURRENT changes only when tested code changes.
- TARGET changes only in `LIGHTNING_SHOP_MASTER_PRD.md`.
- A roadmap phase does not imply that its features are absent; several Manager
  planning slices landed before this normalization and now require validation.
- PM, Activity Log, existing Work Orders, historical Categories, and Prisma
  migration history are protected during every cutover.
