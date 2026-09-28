# Current vs target

**Classification:** REFERENCE — PRIMARY GAP CONTROL
**Audited commit:** `2a77d4e` (CURRENT code); V2 pointers updated with V2-001
**Updated:** 2026-09-28 (Flujo v3, epic LTR-149: LTR-150–LTR-159)

Use this table before opening any implementation task. “TARGET” means approved
direction, not implemented behavior. “Planned Phase” follows
`../DEVELOPMENT_ROADMAP.md`.

| Area | CURRENT | TARGET | Gap | Planned Phase |
|---|---|---|---|---|
| Work Order creation | Managers with `admin.access` + `work_orders.manage` create a Work Order with only the Truck, priority and note (D13); PM, Alignment, Detailing and QC come from Setup → Shop workflow with default owners (D15, D16). Standard mechanic create is API 403. "Create PM service" joins the truck Work Order. | Manager normally creates/plans Standard; PM remains specialized. | Flujo v3 implemented (LTR-157). | Implemented |
| Work Order ownership | TARGET. Manager plans/controls Standard work; mechanic executes assigned Jobs and reports blockers/additional work. | Manager owns plan; mechanic executes assigned work. | V2-002 implemented. | V2 implemented |
| Priority | Mechanic chooses at legacy Standard create; Manager chooses at Manager create and Admin can patch open Work Orders. PM is normal. | Manager owns Standard priority; mechanic sees it. | Remove mechanic priority only after approved W1/W2. PATCH capability home is Q4 in the contract. | V2 gated |
| Pause/resume | Manager pause/resume exists. Standard mechanic UI reports blockers, but legacy mechanic pause/resume endpoints and resume/change-reason controls remain; PM keeps pause. | Manager owns global Standard pause/resume; mechanic reports blockers; PM retains specialized rules. | Contract pairs UI hide (W1) with API 403 (W2) and keeps PM pause. In-flight paused WOs are Q12. | V2 gated |
| Multi-category Jobs | Implemented for Standard create and Add Job. Each Job owns `categoryId`; `primaryCategoryId` remains required for compatibility. | Same model, with primary Category as initial reason only. | Production validation and legacy reader protection; no destructive schema change. | NOW |
| Mechanic assignments | `MechanicAssignment` is a derived cache of Job owners (D11); there is no editable team. | Team derived from Job owners. | D11 replaces Q10/Q17 (LTR-154). | Implemented |
| Job assignments | One owner per Job (D11); set on the WO detail and the Truck Work Plan. A mechanic sees and completes only their own Jobs (403 otherwise); unassigned pending Jobs are a Dashboard reason. Labor is per mechanic (D18). | Manager assigns Jobs; mechanic works assigned Jobs. | Implemented (LTR-154). | Implemented |
| Mechanic assigned-work UX | Home lists only my Jobs with the next one marked, "Resolved · tap Continue"; WO shows Your Jobs, read-only other work, per-Job Report blocker, "You finished your part" and Continue. | Assignment-centered execution with no normal planning controls. | Implemented (LTR-154, LTR-155, LTR-158). | Implemented |
| Blockers | A blocker belongs to one Job (D17), mechanic reasons only; only the Manager resolves (optional note) from Dashboard, Truck or WO; mechanics add notes. Blocking a mechanic's last workable Job stops their labor; Continue restarts it. | Mechanic reports; Manager resolves/pauses with operational visibility. | D17 replaces D3 (LTR-155). | Implemented |
| PM | Specialized create-start, observed mileage, parts/fitment, notes, pause and completion rules; authorized by `mechanic.pm`. | Preserve specialized PM unless an approved migration says otherwise. | `pmAuthorized` compatibility column remains; removal waits for production stability. | NOW cleanup later |
| Admin | Dashboard, Work Orders, corrections, assignments, cancel/complete/reopen, priority/notes, time corrections, Returned to Service, read-only Trucks/Mechanics/History/Catalog screens. V1-004 matrix: corrections and WO-level team assignment stay on `admin.access`; Manager create/pause/Job assign need `work_orders.manage`. LTR-78 API: System Admin (`role = admin`) can create/activate mechanics and set `mechanic.standard` or `mechanic.pm`. | System Admin handles administration; Shop Manager handles operations without requiring System Admin. | Admin UI still has no roster write controls. Permission UI remains deferred. Manager with `admin.access` is 403 on roster writes. | LTR-78 API; UI LATER |
| Truck Detail | The Manager's workplace (D14): one Next step card, inspection and Work Plan with per-Job owners, close and Return to Service, "Add missing steps"; truck data and history folded. | Canonical Truck view with overview, work, readiness, and history. | Implemented (LTR-158); LTR-59 validation on production data. | Implemented |
| Yard Operations | Work Plan board (LTR-150). Cards show the one Next step, "Blocked · reason", and Return to Service on a Ready to Go truck. | Mature Yard progression independent of Category and WO status. | Do not persist Yard Phase. See `V2_1_001_YARD_PHASE_PERSISTENCE_GAP.md`. | Implemented |
| Next step | One rule (`deriveTruckNextStep` via `workOrderNextStep`) on Truck Detail, Yard cards, Dashboard attention items, Work Order list and detail, and the Truck list, with a contract test (LTR-159). | Every surface says the same thing is next. | Implemented. | Implemented |
| Readiness | Six persisted assessment requirements with evidence/waivers and optimistic/idempotent mutations. | Explain all remaining requirements and blockers reliably. | Operational validation and stronger evidence rules where real data requires them. | V2.1 |
| Ready to Go | Explicit authorized readiness approval; separate from WO completion and Returned to Service. | Same conceptual separation. | Validate operational approval/invalidations in production. | NOW/V2.1 |
| Yard Presence | Always `UNKNOWN`; no inferred location. | `IN_YARD`, `OUTSIDE_YARD`, or `UNKNOWN` from reliable evidence. | No source integration. | V3 |
| Samsara | Not integrated. | Geofence-based physical location when approved. | Contract, credentials, mapping, failure behavior, and auditability. | V3 |
| Dispatch / McLeod | Not integrated; Incoming/Departures are unavailable. | Future arrival/departure and capacity planning inputs. | Approved source contracts and real data. No fake integration. | V3 |
| Catalog | Mechanic active-only reads. Admin UI lists Categories, Jobs, and aliases, including inactive records, with no write controls. LTR-77 API: System Admin (`role = admin` plus `admin.access`) can `POST`/`PATCH /api/admin/catalog/jobs` (create, rename, activate/deactivate) on an existing active category. | System Admin governs catalog when approved. | Custom Job review/mapping, category create, alias management beyond the display-name alias, permissions UI, and Admin write controls remain deferred. Shop Manager is 403 on catalog writes. | LTR-77 API; governance LATER |
| Permissions/capabilities | Persisted `admin.access`, `mechanic.standard`, `mechanic.pm`, `yard.operations.manage`, `work_orders.manage`; HTTP guards match the V1-004 matrix in `CAPABILITY_BOUNDARY_AUDIT.md`. LTR-77 / LTR-78 writes use `users.role === admin` instead of a new capability. | Capability-based operational separation between Manager, Admin, Yard, Standard, and PM. | Remaining Admin/Manager overlap is contract Q3–Q7, Q14–Q16. Full permissions UI stays deferred. Do not invent a cap matrix for roster or catalog. | V2 gated |
| Authentication | Supabase Auth in hosted environments; dev bypass locally; application user/capabilities resolved server-side. Temporary approved production test users exist (Admin / Standard / PM) and their login landings PASS. | Supabase Auth with the real Shop roster. | Real roster still pending; Safari mobile remains OPERATOR_REQUIRED in `V1_003_RELEASE_SMOKE.md`. | NOW |
| Runtime data | Supabase PostgreSQL is operational. Ninox client is a placeholder/status endpoint only. | Supabase PostgreSQL remains operational source. | Remove contradictory Ninox-era wording; no dual-write. | NOW docs complete |

## Locked interpretation rules

- CURRENT changes only when tested code changes.
- TARGET changes only in `LIGHTNING_SHOP_MASTER_PRD.md`.
- A roadmap phase does not imply that its features are absent; several Manager
  planning slices landed before this normalization and now require validation.
- PM, Activity Log, existing Work Orders, historical Categories, and Prisma
  migration history are protected during every cutover.
- V2-001 is approved (2026-09-12). V2-002 TARGET ownership is implemented
  on `main` (`bbd315f`). V2.1-001 decided not to persist Yard Phase yet
  (`V2_1_001_YARD_PHASE_PERSISTENCE_GAP.md`).
