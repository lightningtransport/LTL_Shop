> **ARCHIVADO (2026-09-29).** Documento histórico: no describe el sistema actual y no manda sobre el código. La fuente vigente es [`docs/README.md`](../README.md).

# Lightning Shop — Master Product Requirements Document

**Status:** Canonical Product & Domain Specification
**Version:** 1.0
**Date:** 2026-09-11
**Owner:** Product
**Product:** Lightning Shop
**Canonical terms:** Truck, Work Order, Job, Ready to Go, Off Duty

---

# 0. Document Authority

This document is the **single product source of truth for Lightning Shop**.

It defines:

- what Lightning Shop is;
- current implemented behavior;
- target product behavior;
- domain model;
- roles and responsibilities;
- UX direction;
- Yard Operations;
- Work Orders;
- Jobs;
- Readiness;
- development phases;
- what is explicitly out of scope.

When another document conflicts with this document:

1. **This Master PRD defines TARGET product behavior.**
2. `CURRENT_PRODUCT_STATUS.md` and tested production behavior define what exists CURRENTLY.
3. Existing code remains implementation truth until its corresponding migration is completed.
4. Previous PRDs, prototypes and planning documents are historical/reference material only.

No engineer or coding agent should implement a conflicting rule from an older document without first updating this Master PRD.

---

# 1. Product Definition

Lightning Shop is the operational system used by Lightning Transport to manage the process required to take a Truck that needs inspection, maintenance or repair and return it to operational service.

The core operational lifecycle is:

```text
Truck arrives / requires service
        ↓
Inspection / Assessment
        ↓
Work required is identified
        ↓
Work Order is planned
        ↓
Jobs are assigned and executed
        ↓
Truck progresses through required preparation
        ↓
Quality Check
        ↓
Ready to Go
```

Lightning Shop is composed of three connected product areas:

## 1. Shop Operations

Manage:

- Work Orders
- Jobs
- Mechanics
- Work Sessions
- Waiting / blockers
- maintenance execution
- repair history

## 2. Yard Operations

Understand:

- which Trucks are in the operational process;
- what phase each Truck is in;
- what is blocking each Truck;
- what still needs to happen;
- which Trucks are approaching readiness.

## 3. Fleet Readiness

Determine:

- which Trucks are Ready to Go;
- why a Truck is not ready;
- which requirements remain;
- eventually whether available Trucks are sufficient for upcoming departures.

Lightning Shop is **not intended to replace McLeod or become the company's complete TMS**.

---

# 2. Current vs Target

This distinction is mandatory.

## CURRENT

CURRENT describes what the production code does today.

Examples currently implemented may include:

- mechanics creating Standard Work Orders;
- mechanics selecting priority;
- mechanics pausing/resuming Work Orders;
- Work Order-level MechanicAssignment;
- special PM workflow;
- current Admin tools;
- current Yard Operations Phase 1.

CURRENT behavior must remain functional until its replacement has been implemented and verified.

## TARGET

TARGET describes the approved future operating model.

TARGET is not automatically implemented just because it appears in this document.

Every TARGET change must have a migration phase.

---

# 3. Users

## Shop Manager

The Shop Manager owns the operational plan for the Truck.

TARGET responsibilities:

- review incoming Truck;
- inspect / coordinate inspection;
- create or manage Work Order;
- determine required Jobs;
- define Priority;
- assign work to Mechanics;
- manage Work Order operational pause/resume;
- monitor blockers;
- move Truck through Yard Operations;
- coordinate Quality Check;
- approve or manage Ready to Go.

The Shop Manager should be able to operate the Shop without requiring System Admin intervention.

---

## System Admin

Responsible for:

- application administration;
- capabilities;
- catalog administration;
- corrections requiring elevated permission;
- system configuration;
- audit and support.

System Admin is not the operational Shop Manager.

---

## Standard Mechanic

TARGET responsibility:

**execute assigned work.**

Mechanic should:

- see assigned work;
- open Work Order / Truck context;
- start work;
- execute Jobs;
- complete Jobs;
- add relevant notes;
- report blockers;
- see Priority.

Mechanic should not normally:

- define Work Order Priority;
- control global Yard Phase;
- approve Ready to Go;
- decide global Work Order pause;
- manage the entire Truck intervention.

---

## PM Mechanic

PM remains a specialized workflow.

PM Mechanic:

- executes assigned PM;
- records observed mileage;
- selects parts used;
- completes PM requirements;
- follows `mechanic.pm` authorization.

Existing PM functionality must not be replaced by a generic Job implementation unless a future approved migration explicitly does so.

---

## Future operational users

Potential future workspaces:

- Detailing
- Body Shop
- Trailer
- Inspector

Do not build until operational requirements are validated.

---

# 4. Core Jobs To Be Done

## Shop Manager

### JTBD-M01

When a Truck arrives or requires service,

I want to inspect it and build the work plan,

so that the correct work is performed before the Truck returns to operation.

### JTBD-M02

When multiple Mechanics are working,

I want to assign the correct Jobs to the correct people,

so that work can progress efficiently.

### JTBD-M03

When a Truck is delayed,

I want to know exactly what is blocking it,

so that I can resolve the operational constraint.

### JTBD-M04

When Trucks are needed for operation,

I want to know which ones are actually Ready to Go,

so that an unavailable Truck is not dispatched.

---

## Mechanic

### JTBD-MECH01

When I start my shift,

I want to see the work assigned to me,

so that I know immediately what Truck and Job I should work on.

### JTBD-MECH02

When I finish a Job,

I want to record completion quickly,

so that the Manager and Shop see real progress.

### JTBD-MECH03

When I cannot continue,

I want to report the blocker,

so that the Manager can take the appropriate operational action.

---

# 5. Core Domain Model

The canonical relationship is:

```text
Truck
  │
  ├── Work Order history
  │
  └── Active Work Order
        │
        ├── Jobs
        │    ├── Category
        │    ├── Status
        │    ├── Assignment
        │    └── work information
        │
        ├── Work Sessions
        ├── Pause / Waiting Events
        ├── Mechanics
        ├── Activity Log
        └── intervention metadata
```

---

# 6. Truck

Truck represents the physical fleet unit.

Truck is the central entity connecting:

- Work Orders;
- repair history;
- Yard Operations;
- Readiness;
- Samsara information;
- future Dispatch / McLeod information.

Truck operational information must not be represented only through Work Order status.

---

# 7. Work Order

## Canonical definition

A Work Order represents:

> **the complete service / maintenance intervention performed on a Truck during a service event or visit.**

A Work Order does **not** represent one mechanic's individual task.

A Work Order does **not** represent one Yard Phase.

A Work Order does **not** need to represent only one Category.

---

# 8. One Active Work Order per Truck

Initial TARGET rule:

**A Truck may have a maximum of one open Work Order at a time.**

When additional work is discovered during the same intervention:

**add it to the existing Work Order.**

Example:

```text
Truck #905
WO #123

Inspection
- Yard Inspection

Air & Brake System
- Repair Air Leak

Electrical & Starting
- Replace Battery

Suspension & Steering
- Alignment
```

Do not create four separate Work Orders.

A new Work Order normally represents a **new service intervention/event**.

Example:

Truck returns two weeks later with an A/C issue:

```text
WO #170

HVAC / A/C
- Diagnose A/C
- Repair A/C
```

This rule can be reconsidered only if real Shop operation demonstrates the need for simultaneous Work Orders.

---

# 9. Multi-Category Work Orders

TARGET:

A Standard Work Order can contain Jobs from multiple Categories.

Example:

```text
WO #123

Air & Brake System
    Repair Air Leak

Electrical & Starting
    Replace Battery

Tires & Wheels
    Replace Tire

Suspension & Steering
    Alignment
```

Each Job owns its Category.

Existing `primaryCategoryId` may remain during migration for compatibility.

Its TARGET meaning becomes:

**initial / primary reason for the intervention**

and it must not prevent Jobs from other Categories.

Do not remove `primaryCategoryId` destructively.

---

# 10. Job

Job represents:

> **a specific unit of work that must be completed.**

Examples:

- Repair Air Leak
- Replace Battery
- Replace Brake Chamber
- Alignment
- Replace EGR Valve
- DOT Inspection

Each Job should retain:

- Job identity;
- Category;
- status;
- Work Order;
- timestamps;
- assignment when supported;
- completion information;
- Custom Job original text when applicable.

---

# 11. Job Categories

Categories answer:

> **What type of work is this?**

Initial canonical Categories:

1. Inspection
2. Engine & Emissions
3. Fuel System
4. Cooling System
5. Electrical & Starting
6. Air & Brake System
7. Suspension & Steering
8. Transmission & Drivetrain
9. Tires & Wheels
10. HVAC / A/C
11. Cab, Body & Glass
12. Trailer
13. Road Service & Towing
14. Other

PM remains a special domain/workflow and should not be converted blindly into a generic Standard category.

---

# 12. Category ≠ Job ≠ Yard Phase

These concepts must never be mixed.

## Category

Type of maintenance.

Example:

`Air & Brake System`

## Job

Specific work.

Example:

`Replace Brake Chamber`

## Yard Phase

Operational stage of the Truck.

Example:

`Repair`

A Truck may be in Yard Phase:

`Repair`

while its Work Order contains Jobs from:

- Engine
- Electrical
- Brakes
- Cooling.

---

# 13. Yard Operations

Yard Operations answers:

> **What is happening with this Truck operationally right now?**

It is a Truck-centric experience.

It is not another Work Order Board.

---

# 14. Yard Phase

Initial operational model:

```text
Inspection
↓
Repair
↓
PM if required
↓
Alignment if required
↓
Detailing
↓
Quality Check
↓
Ready to Go
```

This is not a rigid universal state machine.

Not every Truck must require every stage.

Examples:

- no Heavy Repair;
- PM not due;
- emergency repair only;
- external repair;
- manager-authorized exception.

Yard Phase must remain conceptually independent from:

- Job Category;
- Job status;
- Work Order status.

---

# 15. Inspection

Inspection is the beginning of the normal Yard workflow.

Inspection determines:

- what is wrong;
- required Jobs;
- repair requirements;
- PM requirement;
- additional issues.

New work discovered during Inspection should normally be added to the existing Work Order.

---

# 16. Repair

Repair is a general Yard operational phase.

It can include Jobs from several Categories.

Examples:

- Engine
- Brakes
- Electrical
- Cooling
- Suspension
- Tires

`Heavy Repair` may be represented as an operational label/classification if useful but must not force a separate Work Order model.

---

# 17. Preventive Maintenance

PM remains a specialized workflow.

A Truck should be evaluated for PM.

PM may eventually depend on:

- mileage;
- last PM;
- service interval;
- Samsara mileage;
- manual requirement.

Do not invent automatic PM rules until reliable data exists.

Existing `PmService`, mileage audit, parts/fitment and `mechanic.pm` must remain intact.

---

# 18. Alignment

Alignment may be:

```text
Category:
Suspension & Steering

Job:
Alignment
```

while simultaneously representing an important Yard readiness checkpoint.

Do not duplicate the Job only because Yard Operations displays Alignment prominently.

---

# 19. Detailing

Detailing is primarily a Yard preparation step.

It does not need to become a mechanical Job Category unless operational evidence later requires that.

---

# 20. Quality Check

Quality Check verifies the Truck after required work.

Initial information may include:

- result;
- performed by;
- timestamp;
- notes;
- discovered issues.

If Quality Check identifies additional work:

add new Jobs to the active Work Order and return the Truck to the appropriate operational phase.

---

# 21. Ready to Go

Ready to Go means:

> **the Truck has satisfied the requirements needed to return to operation.**

Ready to Go is not:

- a Job Category;
- Work Order status;
- a Job status.

Work Order Completed and Ready to Go must remain separate concepts.

The UI should explain why a Truck is not ready.

Example:

```text
Truck #905
NOT READY

✓ Inspection
✓ Required Repair
✓ PM
✓ Alignment
✕ Detailing
○ Quality Check
```

---

# 22. Blockers

Potential blockers already supported by operational concepts include:

- Waiting for Parts
- Waiting for Approval
- Waiting for Vendor
- Waiting for Tool
- Waiting for Bay
- Waiting for Driver
- Truck unavailable
- required work incomplete

Prefer deriving blockers from existing Work Order / Pause information before introducing a new domain entity.

---

# 23. Yard Presence

Yard Presence answers only:

> **Is the Truck physically inside our Yard?**

Values:

```text
IN_YARD
OUTSIDE_YARD
UNKNOWN
```

It must not encode service type.

---

# 24. Service Location

Service Location answers:

> **Where is the maintenance work occurring?**

Possible values:

```text
INTERNAL_SHOP
EXTERNAL_SHOP
ROADSIDE
```

Example:

```text
Truck #905

Yard Presence:
OUTSIDE_YARD

Service Location:
EXTERNAL_SHOP
```

---

# 25. Samsara

Future source for physical Truck location.

Preferred approach:

Samsara Geofence.

Do not compare address strings as the primary method if geofence data is available.

Samsara should answer:

> Where is the Truck?

It should not be used to infer future Dispatch assignments.

---

# 26. Incoming / Departures

Future operational planning may use:

- McLeod;
- Dispatch;
- Truck assignment;
- Load assignment;
- manual planning.

Do not create fake integrations.

Eventually Lightning Shop should answer:

```text
12 Trucks scheduled to leave
8 Ready to Go
4 at risk
```

and identify why those 4 are at risk.

---

# 27. Manager TARGET Workflow

```text
Dashboard / Yard Operations
        ↓
Select Truck
        ↓
Inspect / assess
        ↓
Open existing Work Order
        OR
Create Work Order
        ↓
Add required Jobs
        ↓
Jobs may belong to multiple Categories
        ↓
Set Priority
        ↓
Assign work
        ↓
Mechanics execute
        ↓
Manager monitors progress / blockers
        ↓
Truck advances through Yard preparation
        ↓
Quality Check
        ↓
Ready to Go
```

---

# 28. Mechanic TARGET Workflow

```text
Login
 ↓
My Assigned Work
 ↓
Select Truck / Work
 ↓
Review assigned Jobs
 ↓
Start Work
 ↓
Execute Job
 ↓
Complete Job
      OR
Report Blocker
 ↓
Continue assigned work
```

Mechanic experience should progressively move from:

**creating/planning work**

toward:

**executing assigned work.**

---

# 29. Work Order Ownership — Migration

This is a migration, not an immediate destructive change.

## CURRENT

Mechanics may still:

- create Standard Work Orders;
- select Priority;
- pause/resume.

Do not pretend this behavior has disappeared before it actually has.

## TARGET

Manager:

- creates/plans Work Order;
- defines Priority;
- assigns work;
- owns operational pause/resume.

Mechanic:

- executes assigned Jobs;
- reports blockers.

---

# 30. Ownership Migration Strategy

## Phase A — Additive Manager Workflow

Add Manager creation/planning while existing Mechanic flow remains functional.

> **Implementation status at normalization (2026-09-11):** the additive
> Manager creation/planning, multi-category planning, priority, assignment,
> Manager pause/resume, and blocker-reporting foundations are present in code.
> They remain in validation/soft cutover; use `CURRENT_PRODUCT_STATUS.md` for
> exact CURRENT behavior and do not reimplement this phase from this TARGET
> description.

Manager can:

- create WO;
- add multi-category Jobs;
- assign;
- set Priority.

No legacy removal yet.

---

## Phase B — Assignment-centered Mechanic UX

Mechanic Home evolves toward:

**My Assigned Work**

Existing creation flow may remain temporarily available behind capability/configuration during validation.

---

## Phase C — Operational Cutover

After real Shop validation:

remove Standard WO planning responsibilities from Mechanic UI.

Mechanic no longer:

- creates normal WO;
- changes Priority;
- performs global Pause.

Backend permission enforcement changes together with UI.

The product-approval contract for this phase is
`OWNERSHIP_CUTOVER_CONTRACT.md` (V2-001). It proposes a W1 UI window and a
W2 API-enforcement stage plus rollback. It does **not** authorize
implementation until the Decision Log records Cristian’s answers.

---

# 31. Manager UX Principles

Manager UI should optimize for:

- high information density;
- quick scanning;
- inline actions;
- few page transitions;
- visible blockers;
- visible unassigned work;
- clear priority;
- clear Truck progression.

Use:

- tables;
- cards;
- sheets;
- dropdowns;
- inline assignment;
- filters;
- board when appropriate.

---

# 32. Mechanic UX Principles

Mechanic UI must remain mobile-first.

Prioritize:

- one obvious next action;
- large touch targets;
- little typing;
- simple Job list;
- clear Truck number;
- clear status;
- clear priority;
- easy completion;
- easy blocker reporting.

Do not expose Manager controls unnecessarily.

---

# 33. Design System

All new interfaces must use the existing Lightning Shop Design System.

Use existing:

- shadcn primitives;
- semantic tokens;
- typography;
- spacing;
- Card;
- Badge;
- Button;
- Table;
- Dialog;
- Sheet;
- Dropdown;
- Tabs;
- Input;
- Skeleton;
- Empty State;
- responsive conventions.

Do not create another visual system.

Do not copy prototype CSS or external layouts literally.

Extend shared components when necessary.

---

# 34. Information Architecture

Target Admin structure:

```text
/admin
   Dashboard

/admin/yard
   Yard Operations

/admin/work-orders
   Work Order List

/admin/work-orders/:id
   Manager Work Order Detail

/admin/trucks
   Truck List

/admin/trucks/:id
   Truck Detail

/admin/mechanics
   Mechanics

/admin/history
   History

/admin/catalog
   Job Catalog
```

Mechanic workspace remains separate.

---

# 35. Truck Detail

Truck Detail is the canonical view of a Truck.

Initial sections:

## Overview

- Truck #
- operational status
- Yard Presence
- Readiness
- Driver / Driver Team when available
- current work
- blocker

## Current Work

- active Work Order
- Jobs
- Categories
- assignments
- Priority
- status

## Readiness

- Inspection
- Repairs
- PM
- Alignment
- Detailing
- Quality Check
- blockers

## History

Historical Work Orders and maintenance.

Do not build a duplicate maintenance-history database.

---

# 36. Yard Operations UI

Desktop may use Board + Table.

Example Board:

```text
Inspection
Repair
PM
Alignment
Detailing
Quality Check
Ready
```

Each card represents a **Truck**.

Not a Work Order.

Potential card information:

- Truck #
- Phase
- Priority
- progress
- blocker
- assigned mechanic/team
- age where reliable

Mobile should use grouped lists rather than compressing the desktop Kanban.

---

# 37. Work Order Board vs Yard Board

## Work Order Board

Entity:

**Work Order**

Question:

> What maintenance work is being executed?

## Yard Operations Board

Entity:

**Truck**

Question:

> What is happening with the Truck operationally?

Never merge these concepts.

---

# 38. Dashboard

Dashboard answers:

> **What is happening?**

Possible future KPIs:

- Trucks In Yard
- Ready to Go
- Out of Service
- Blocked
- Open Work Orders
- Waiting for Parts
- Jobs Completed
- Aging interventions

Yard Operations answers:

> **What needs attention?**

---

# 39. Engineering Constraints

Current architecture remains:

```text
Next.js
↓
NestJS
↓
Prisma
↓
Supabase PostgreSQL
```

Supabase Auth remains authentication.

Prisma remains migration authority.

Business rules remain server-side.

Do not move authorization or domain validation into React.

---

# 40. Data Principles

Prefer existing entities.

Do not introduce parallel concepts unnecessarily.

Prefer derived state when reliable.

But do not force derivation where a real operational event needs persistence.

Examples:

Job Category can be derived from Job.

Yard Phase may require a persisted/auditable event because Detailing or Quality Check cannot always be inferred from mechanical Jobs.

---

# 41. Migration Rules

All schema evolution must prefer:

- additive migration;
- backward compatibility;
- explicit transition;
- auditability.

Avoid:

- destructive rename;
- drop column during transition;
- enum replacement without migration;
- breaking historical records.

Legacy fields can be retired only after:

1. production migration;
2. stability;
3. documentation update.

---

# 42. Performance Rules

Follow existing engineering practices.

Targets remain:

- usable application <2s P75;
- authenticated navigation <1s;
- warm API <500ms.

Avoid:

- serial request waterfalls;
- broad cache invalidation;
- unnecessary refetch;
- loading entire operational datasets when pagination/search is appropriate.

---

# 43. Development Roadmap

## V1 — Stabilize and Ship Current Core

Goal:

Operate real Shop activity reliably.

Includes:

- production users;
- Standard workflow;
- PM workflow;
- Admin visibility;
- existing Yard Phase 1;
- production smoke testing;
- CI/build stability.

Do not expand major domain scope while V1 is unstable.

---

## V1.1 — Manager Planning Additive

Goal:

Introduce TARGET Manager workflow without removing CURRENT Mechanic behavior.

**Implementation status at normalization:** present at the audited commit and
pending V1 stabilization/real-user validation. The list below describes the
approved capability, not a new implementation backlog.

Capability:

- Manager Create Work Order;
- multi-category Job planning;
- Manager Priority ownership UI;
- Manager assignment UX;
- Work Plan grouped by Category.

Mechanic current flow remains temporarily available.

---

## V1.2 — Assignment & Mechanic UX

Build:

- My Assigned Work;
- clearer assignment;
- Job-oriented execution;
- Report Blocker;
- Manager operational visibility.

Validate with real users.

---

## V2 — Ownership Cutover

After Shop validation:

Manager becomes normal owner of:

- WO creation;
- Priority;
- assignment;
- operational pause/resume.

Mechanic becomes execution-focused.

Remove legacy controls only after backend authorization and migration are complete.

Approval artifact: `OWNERSHIP_CUTOVER_CONTRACT.md`. Implementation stays
gated until the Decision Log records Cristian’s §11 answers.

---

## V2.1 — Yard Operations Maturity

Build:

- persisted Yard Phase where required;
- stronger Readiness model;
- Quality Check;
- Detailing;
- Truck Detail;
- operational board;
- blockers.

---

## V3 — Integrations

Integrate when needed:

- Samsara;
- yard geofence;
- arrival/departure;
- McLeod / Dispatch;
- upcoming departures;
- readiness capacity.

---

# 44. Explicitly Not Now

Do not build without approved roadmap change:

- full TMS;
- multiple simultaneous Work Orders per Truck;
- generic workflow engine;
- generic rules engine;
- per-Job timers unless operationally validated;
- complex inventory/purchasing ERP;
- fake Samsara integration;
- fake McLeod integration;
- mechanic productivity rankings without valid data;
- Ninox dual-write.

---

# 45. Definition of Done

A development phase is not complete because UI exists.

Done requires:

- domain rule implemented;
- authorization implemented server-side;
- migration safe;
- UI complete;
- responsive behavior;
- loading/error states;
- activity/audit where required;
- tests;
- no regression in Standard;
- no regression in PM;
- CI green;
- documentation updated;
- production/staging acceptance where applicable.

---

# 46. Documentation Policy

The repository should progressively converge on:

## Canonical

`LIGHTNING_SHOP_MASTER_PRD.md`

## Operational current-state

`CURRENT_PRODUCT_STATUS.md`

## Engineering

`ENGINEERING_PRACTICES.md`

`PERFORMANCE.md`

`DEPLOY.md`

Everything else should be classified as either:

- historical;
- implementation plan;
- reference;
- deprecated.

Do not maintain multiple competing product PRDs.

---

# 47. Historical Documents

The following may remain in the repository for history but must not independently define product behavior:

- original Mechanic P0 PRD;
- old Ninox plans;
- prior ownership migration drafts;
- Yard expansion prompts;
- prototype specifications;
- old Shop Admin planning documents.

Add a header where appropriate:

> **Historical document. Do not use as current product authority. See `LIGHTNING_SHOP_MASTER_PRD.md`.**

---

# 48. Decision Log

Important product decisions must be recorded here rather than creating another competing PRD.

Format:

```text
YYYY-MM-DD
Decision:
Reason:
Impact:
Phase:
```

Current locked decisions:

### 2026-09-11 — Work Order meaning

A Work Order represents the complete Truck service intervention.

### 2026-09-11 — Multi-category Jobs

A Standard Work Order may contain Jobs from multiple Categories.

### 2026-09-11 — One open Work Order

Initially retain maximum one open Work Order per Truck.

### 2026-09-11 — Yard Phase separation

Yard Phase is separate from Category and Work Order status.

### 2026-09-11 — Ownership TARGET

Manager plans and controls the intervention; Mechanic executes assigned work.

### 2026-09-27 — One owner per Job (D11) and per-mechanic labor (D18)

Decision: Each Job has one owner (`assignedMechanicId`). The Work Order team is derived from Job assignments; there is no editable team and no "inherits the Work Order team". A mechanic sees a Work Order only through a Job assigned to them and completes only their own Jobs (403 otherwise). Labor is per mechanic (`work_sessions.user_id`): a mechanic's time stops when they finish their last pending Job on that Work Order ("You finished your part") and restarts with Continue; the Work Order labor total is the sum of all sessions. A Job is In Progress while its owner has an open session, Pending otherwise. An unassigned pending Job is a Dashboard attention reason.
Reason: A shared team made ownership and time ambiguous (anyone could complete anything; one clock for everyone). Flujo v3 review, `docs/ux/FLUJOS_Y_MEJORAS_2026-09-27.md` §12.
Impact: D11 replaces Q10/Q17 (team membership grants Job access; unassigned Jobs inherit the team). D18 replaces D7 (one labor session per Work Order).
Phase: Flujo v3 PR 4 (LTR-154).

### 2026-09-27 — Blockers belong to a Job; only the Manager resolves (D12, D17)

Decision: A mechanic blocks one of their own pending Jobs with a mechanic reason (waiting for parts, approval, vendor, equipment, bay, driver, other). The Standard mechanic never pauses the Work Order. Only the Manager resolves a blocker, with an optional note; the mechanic adds append-only notes. When a mechanic has no unblocked pending Job left, their labor stops; after resolution it restarts only when they tap Continue.
Reason: Blockers "resolved" by whoever reported them hid real waiting from the Manager, and one blocker could not say which Job was stopped. Flujo v3 review §12.
Impact: D17 replaces D3 (LTR-98, mechanic or Manager resolves). Break, End of Shift, Working on Another WO and Truck Unavailable stay Manager pause reasons only.
Phase: Flujo v3 PR 5 (LTR-155).

### 2026-09-11 — Ownership migration

Do not destructively cut over. Introduce Manager workflow additively, validate, then retire Mechanic planning controls.

### 2026-09-11 — V2-001 cutover contract drafted (not approved)

A product-approval contract is published at `OWNERSHIP_CUTOVER_CONTRACT.md`.
It documents CURRENT, post-cutover, migration, and rollback for every
Standard mechanic, PM, Manager, and Admin action, and lists decisions that
require Cristian’s answer. **This entry does not approve cutover and does
not authorize V2 implementation.**

### 2026-09-12 — V2 ownership cutover approved (direct TARGET)

Cristian approved the V2-001 contract. Lightning Shop V1 was never adopted as
a real Shop production flow, so the unused Standard mechanic-owned planning
workflow is not preserved. Backward compatibility remains mandatory for
existing data, historical Work Orders, PM, Activity Log, migrations, and
database integrity.

Approved answers:

- Q1: No W1 soak. Validate the complete TARGET model in staging/pilot, then
  production.
- Q2: Technical rollback is System Admin / authorized Engineering. The Shop
  Manager requests if there is a problem; Engineering tells the Shop.
- Q3: Work Order team add/remove requires `work_orders.manage`.
- Q4: Priority and operational notes require `work_orders.manage`.
  Historical/sensitive corrections stay elevated and audited.
- Q5: Manager completes/cancels the Standard Work Order. Mechanic completes
  Jobs.
- Q6: Reopen Work Order and time correction stay System Admin
  (`admin.access`).
- Q7: Manager may cancel a pending Job (reason + Activity Log). Job reopen
  stays System Admin initially.
- Q8: Manager Add Job after create is required. Mechanic reports additional
  work; Manager incorporates it. Mechanic does not add Jobs directly.
- Q9: No Standard-create exceptions. Create requires `work_orders.manage`.
  Do not hardcode users by name/email.
- Q10: An unassigned Job may be executed by any active Work Order team
  member. Job-specific assignment has priority.
- Q11: Keep mechanic execution notes.
- Q12: Manager owns Standard pause/resume.
- Q13: PM stays exactly as CURRENT (`mechanic.pm`, self-create/start,
  mileage, parts, pause/resume, finish).
- Q14: Grant `work_orders.manage` to the real Shop Manager roster and to
  System Admin for support. Not test users.
- Q15: Keep the shared `/admin` shell; capabilities distinguish Manager vs
  System Admin.
- Q16: Hide Create without `work_orders.manage` and 403 the API.
- Q17: Keep `MechanicAssignment` as the general team. Per-Job assignment is
  additive.
- Q18: Path is current code → TARGET implementation → tests/staging →
  production pilot → production. No two operating models in parallel.

### 2026-09-12 — V2.1-001 Yard Phase persistence (do not persist yet)

Decision: Do not add `YardPhaseEvent`. The board column is the **next
unresolved readiness gate**, derived from the six requirements and current
open Work Order state.

Cristian’s answers:

- Q1: Next unresolved gate. Do not persist an operator-claimed stage.
- Q2: All six resolved, Mark Ready not pressed → **Ready for Approval**.
  Ready to Go remains the explicit approval.
- Q3: Detailing required + Quality Check `not_evaluated` → **Detailing**.
  Later unevaluated gates do not send the Truck to Needs evaluation.
- Q4: A Truck may be in Detailing or Quality Check while the linked Work
  Order is still open.
- Q5: Close after Ready keeps **Ready to Go** until something invalidates
  it or a future presence/service event starts a new cycle.
- Q6: Editing only the waiver reason does not withdraw Ready. Withdraw
  only on unresolved/failed requirements, new open work, or an explicit
  authorized withdraw.

Reason: Master PRD §40 prefers derivation when reliable. Detailing and
Quality Check are already manual requirement outcomes.

Impact: Implemented as derived state + EN/ES copy. No `YardPhaseEvent`
schema. See `audit/V2_1_001_YARD_PHASE_PERSISTENCE_GAP.md`.

Phase: V2.1

---

# 49. Instructions for Cursor / Codex

Before implementing any Lightning Shop feature:

1. Read this entire document.
2. Read `CURRENT_PRODUCT_STATUS.md`.
3. Inspect the current code.
4. Identify whether the request belongs to CURRENT stabilization or a TARGET roadmap phase.
5. Do not implement a historical document when it conflicts with this Master PRD.
6. Do not silently refactor domain rules.
7. Do not remove backward compatibility until the corresponding migration phase authorizes removal.
8. Protect PM.
9. Protect Activity Log/history.
10. Protect existing Work Orders.
11. Use existing Design System and shadcn components.
12. Update documentation when behavior changes.

Before major implementation, report:

- Current behavior.
- Target behavior.
- Gap.
- Schema impact.
- API impact.
- UI impact.
- Permission impact.
- PM impact.
- Migration strategy.
- Tests required.

---

# 50. Product North Star

Lightning Shop must answer four questions clearly:

1. **What is happening with this Truck?**
2. **What work needs to be done?**
3. **Who is responsible for doing it?**
4. **What prevents this Truck from becoming Ready to Go?**

The product should evolve only when a proposed feature improves the ability to answer one of these questions or solves a validated operational need.