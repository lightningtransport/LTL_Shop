# Ownership Cutover Contract — Lightning Shop

**Classification:** PRODUCT DECISION CONTRACT
**Task:** V2-001
**Status:** PENDING CRISTIAN APPROVAL — this document does **not** authorize
implementation, schema changes, or endpoint removal
**Date:** 2026-09-11
**Owner:** Product (Cristian)
**Product:** Lightning Shop (`LTL_Shop`)

---

# 0. How to read this document

This is the V2 ownership cutover contract. Product can approve or reject it
before any V2 implementation starts.

| Label | Meaning |
|---|---|
| **CURRENT** | Audited behavior of the running product (code + V1.2 validation). |
| **Post-cutover** | Intended behavior after Phase C. Copied from locked Master PRD TARGET when TARGET is explicit. Marked **PROPOSED** or **UNDECIDED** when TARGET is silent. |
| **Migration / compatibility window** | What happens between “UI no longer offers the action” and “API no longer accepts it.” |
| **Rollback** | How to restore the previous operating model without rewriting history. |
| **LOCKED TARGET** | Already decided in `LIGHTNING_SHOP_MASTER_PRD.md`. This contract does not reopen it. |
| **NEEDS CRISTIAN** | Implementation must not guess. Listed again in §11. |

**Precedence**

1. `LIGHTNING_SHOP_MASTER_PRD.md` remains TARGET authority.
2. `CURRENT_PRODUCT_STATUS.md` plus tested code remain CURRENT authority.
3. This contract is the cutover *proposal*. Approved answers must be copied
   into the Master PRD decision log before V2 code work starts.
4. Historical ownership docs (`WORK_ORDER_OWNERSHIP_MIGRATION.md`,
   `audits/WORK_ORDER_OWNERSHIP_AUDIT_2026-09-11.md`) are not authority.

**This task did not change application code or schema.**

---

# 1. Problem and outcome

## Problem

Legacy Standard mechanic planning (create, choose Priority, globally
pause/resume) cannot be removed safely without:

- a complete UI **and** API authorization matrix;
- a compatibility window for in-flight work and any client still calling
  legacy endpoints;
- a rollback path that does not destroy Activity Log, PM, or history;
- explicit product answers where TARGET is silent.

## Outcome required by V2-001

Product can approve:

1. the action-by-action cutover matrix in §6;
2. the compatibility window in §4;
3. the rollback plan in §5;
4. the acceptance / test plan in §10;
5. the open decisions in §11.

No V2 implementation slice may start until those approvals are recorded.

---

# 2. Evidence baseline

| Source | What it proves |
|---|---|
| `main` at `9121df9` (PR #76) | V1 Stable Shop Core on the default branch when this contract was written. |
| PRs #77 (V1.2-001) and #78 (V1.2-002) | Assigned-work presentation and blocker lifecycle validation. Merged to `main` (`a56344a`). This contract treats that V1.2 behavior as accepted CURRENT. |
| `audit/CAPABILITY_BOUNDARY_AUDIT.md` (V1-004) | Declared vs HTTP-enforced vs V1-expected capabilities. |
| `CURRENT_PRODUCT_STATUS.md` | Soft-cutover hybrid: Manager planning exists; Standard Create and legacy pause APIs remain. |
| Master PRD §§3, 29–30, 43 (V2) | TARGET: Manager plans; mechanic executes; UI and API change together; PM stays specialized. |

**CURRENT snapshot (hybrid, not cut over)**

- Standard mechanic with `mechanic.standard` can still `POST /work-orders`,
  choose Priority on create, Add Job, Start, Complete Job, Finish Work Order,
  update notes, and Report Blocker.
- Standard UI offers Report Blocker while `in_progress`. Resume and Change
  Pause Reason still appear when the Work Order is `waiting_paused`. Legacy
  `POST /work-orders/:id/pause|pause-reason|resume` remain authorized for an
  assigned Standard mechanic.
- Manager with `admin.access` + `work_orders.manage` can create Standard Work
  Orders, officially pause/resume, and assign/unassign Jobs.
- Users with only `admin.access` can still patch Priority/notes, mutate the
  Work Order team, and perform V1 corrections (cancel/complete/reopen, Job
  cancel/reopen, time correction, Returned to Service).
- PM with `mechanic.pm` still self-creates, auto-starts, pauses, and finishes.
- One open Work Order per Truck, Activity Log, and Prisma-only migrations are
  locked.

Yard Operations, Ready to Go, Samsara, McLeod, and Dispatch are **out of
scope** for this cutover. They stay as CURRENT Phase 1.

---

# 3. Locked direction (do not re-decide)

Already recorded in the Master PRD decision log. This contract implements
them; it does not replace them.

| Locked rule | Implication for V2 |
|---|---|
| Manager plans and controls the intervention; Mechanic executes assigned work | Standard planning leaves the mechanic workspace. |
| Do not destructively cut over | Additive first; retire only after a window and evidence. |
| One open Work Order per Truck | Cutover does not allow a second open Work Order. |
| A Work Order is the complete Truck intervention | Jobs stay on that Work Order. |
| Multi-category Jobs | Keep `WorkOrderJob.categoryId`; do not drop `primaryCategoryId`. |
| Yard Phase is separate from Category and Work Order status | Do not encode ownership in Yard Phase. |
| PM is specialized and authorized only by `mechanic.pm` | V2 must not convert PM into generic Jobs. |
| Prisma is the sole migration authority | No `supabase/migrations` writes. |
| Authorization is enforced on the API, not only by hiding UI | UI hide without API 403 is not cutover complete. |

Master PRD Phase C (operational cutover) already says the mechanic no longer:

- creates a normal Work Order;
- changes Priority;
- performs global Pause;

and that **backend permission enforcement changes together with UI**.

---

# 4. Compatibility window — PROPOSED, needs approval

V2 is not a single deploy. Cristian must approve the window shape (Q1, Q2).

## Proposed stages

| Stage | Name | UI | Standard legacy APIs | Who can operate |
|---|---|---|---|---|
| **W0** | Soft hybrid (CURRENT) | Standard Create demoted; Report Blocker on `in_progress`; Resume/Change Reason still shown when paused | `POST /work-orders`, `pause`, `pause-reason`, `resume` still succeed for assigned Standard mechanics | Shop as today |
| **W1** | UI cutover + live APIs | Hide Standard Create, Priority editor, and Standard global pause/resume/change-reason. Keep Report Blocker, Start, Jobs, Add Job (unless Q8 removes it), Finish. PM unchanged. | Same endpoints remain callable. Log actor, path, Work Order id, and outcome for usage evidence. Do **not** delete routes. | Mechanics use assigned-work UX. Any leftover script/old tab can still call legacy APIs. |
| **W2** | API enforcement | Same as W1 | Standard `POST /work-orders`, `pause`, `pause-reason`, and `resume` return **403** for `mechanic.standard`. PM equivalents stay authorized. | Cutover complete for Standard planning. |

`W2` is the only stage that satisfies “UI and API change together” as a
*finished* state. `W1` is the compatibility window.

## Proposed W1 exit rule (needs duration — Q1)

Leave `W1` only after **all** of the following:

1. Cristian has approved §11 decisions that affect W2.
2. Acceptance tests in §10 pass on a seeded environment.
3. Production/staging smoke shows Manager can plan and assign without using
   mechanic Create.
4. Legacy-endpoint usage log is reviewed. If Standard create/pause calls
   still occur, Product decides extend `W1` vs accept and enforce.
5. Rollback target (previous production web + API deployments) is recorded.

## What must not happen in the window

- No destructive schema change.
- No deletion of `MechanicAssignment`, `primaryCategoryId`, `PauseEvent`
  history, or `pmAuthorized`.
- No change to PM create-start, PM pause, parts, or mileage audit.
- No Yard, Samsara, or catalog-write work bundled into V2.
- Do not silently move `admin.access` corrections onto `work_orders.manage`
  without Q3–Q7.

---

# 5. Rollback — PROPOSED, needs approval

Rollback is a product operation, not a data rewrite.

| If this stage is live | Rollback action | Data effect |
|---|---|---|
| **W1 only** | Redeploy previous web (and any web-only flag). Restore Standard Create CTA and Standard resume/change-reason controls. | None. APIs never changed. In-flight Manager-created Work Orders stay valid. |
| **W2** | Re-open the four Standard legacy endpoints for assigned `mechanic.standard` (feature flag or revert the API slice). Restore W1 or W0 UI as Product chooses. | No Activity Log delete. No Job/WO rewrite. Calls that 403'd during W2 can be retried. |
| **Capability grants** | If Product granted `work_orders.manage` to additional users for cutover, revoke only those additive grants. Do not strip `admin.access` or mechanic capabilities as a rollback. | Users return to pre-grant authority. |
| **Schema** | V2-001 authorizes **no** schema change. Later V2 slices must stay additive (nullable columns, new enum values). Rollback = stop using the new field; do not drop enums. | Historical rows remain readable. |

**Forbidden rollback behaviors**

- Deleting Work Orders, Jobs, Pause Events, or Activity Log rows.
- Recreating mechanic planning by weakening Manager create.
- Changing PM authorization or mileage audit to “undo” Standard cutover.
- Inferring presence, Ready to Go, or Off Duty as part of rollback.

**Rollback owner (Q2):** Cristian names the person who may flip W1/W2 and the
communication path to the Shop.

---

# 6. Action matrix

Every operational action a Standard mechanic, PM mechanic, Shop Manager, or
System Admin can take today. Reads that only display state are included when
they change after cutover.

**Post-cutover cells**

- Unmarked prose = locked Master PRD TARGET.
- **PROPOSED** = recommended default so the matrix is complete; still
  **NEEDS CRISTIAN** if listed in §11.
- **UNDECIDED** = TARGET is silent; do not implement a guess.

Legend for Approval: `LOCKED` · `PROPOSED` · `UNDECIDED`

---

## 6.1 Standard Mechanic (`mechanic.standard`)

### SM-01 — Sign in and land on Home

| Dimension | Behavior |
|---|---|
| **CURRENT** | Supabase Auth. Role sends Admin users to `/admin`. Standard mechanics land on Home titled “My Assigned Work.” |
| **Post-cutover** | Unchanged landing. Home remains assignment-centered. |
| **Migration** | No auth change. |
| **Rollback** | Restore previous web if landing copy/CTA changes. |
| **Approval** | LOCKED (auth model stays). |

### SM-02 — View My Assigned Work list

| Dimension | Behavior |
|---|---|
| **CURRENT** | `GET /work-orders` returns Work Orders the mechanic created or where they are an active `MechanicAssignment`. Sections: Ready to Start, active, paused, completed. V1.2 labels assigned vs inherited-team Jobs (PR #77). On `main` today, list membership is creator or team, not per-Job assignee alone. |
| **Post-cutover** | Mechanic continues to see Work Orders they must execute. **PROPOSED:** keep creator + active team; if Q10 keeps per-Job-only assignees, list must include those Work Orders (V1.2-001 already moved this way on the validation branch). |
| **Migration** | W1 may tighten labels only. Do not hide a Work Order the mechanic is actively executing. |
| **Rollback** | Restore previous list query. |
| **Approval** | PROPOSED / Q10. |

### SM-03 — Open Standard Create (CTA + `/mechanic/standard/new`)

| Dimension | Behavior |
|---|---|
| **CURRENT** | Secondary “Create new Work Order” CTA on Home. Form selects Truck, Category, Jobs/Custom Job, optional collaborators, Priority, notes. |
| **Post-cutover** | Mechanic no longer creates a normal Work Order. CTA and Standard create route are removed or return a clear “ask your Manager” empty state. |
| **Migration** | W1: hide CTA and route. W2: `POST /work-orders` Standard body returns 403. Deep links to `/mechanic/standard/new` do not create. |
| **Rollback** | Restore CTA/route (W1) and/or allow Standard POST (W2). |
| **Approval** | LOCKED TARGET. Emergency-create exception is Q9. |

### SM-04 — `POST /work-orders` Standard create (API)

| Dimension | Behavior |
|---|---|
| **CURRENT** | Auth only on controller. Service requires `mechanic.standard`, ≥1 Job, non-PM Category, advisory lock, one-open-per-Truck, idempotency. Creator is assigned. Priority comes from the body (default `normal`). |
| **Post-cutover** | Standard create through this endpoint is forbidden (403). Manager create remains `POST /admin/work-orders`. |
| **Migration** | W1: endpoint still succeeds; usage logged. W2: 403 for Standard. Rejecting only in UI is not enough. |
| **Rollback** | Re-enable Standard create for `mechanic.standard`. Existing Manager-created rows stay. |
| **Approval** | LOCKED TARGET. |

### SM-05 — Choose Priority at Standard create

| Dimension | Behavior |
|---|---|
| **CURRENT** | Create form exposes Low/Normal/High/Critical. Stored on the Work Order. Mechanic has no later Priority PATCH. |
| **Post-cutover** | Mechanic does not set Priority. Mechanic **sees** Manager-set Priority on list/detail. |
| **Migration** | W1: control gone with the create form. W2: if a Standard create body is still accepted in W1, Priority in that body is legacy; after W2 the body is rejected entirely. |
| **Rollback** | Restoring create restores Priority on create. |
| **Approval** | LOCKED TARGET. |

### SM-06 — Choose collaborators at Standard create

| Dimension | Behavior |
|---|---|
| **CURRENT** | Optional `mechanicIds`. Never defaults to the creator. Creates `MechanicAssignment` rows. |
| **Post-cutover** | Gone with mechanic create. Manager owns the general team and per-Job assignees. |
| **Migration** | Same as SM-03/SM-04. |
| **Rollback** | Same as SM-04. |
| **Approval** | LOCKED as part of removing mechanic create. |

### SM-07 — Start Work

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /work-orders/:id/start` for assigned Standard mechanic when status is `created`. Manager-created work starts `created` (not auto-started). |
| **Post-cutover** | Unchanged. Mechanic starts assigned work. |
| **Migration** | Keep through W1 and W2. |
| **Rollback** | No change required. |
| **Approval** | LOCKED (execution stays). |

### SM-08 — Complete Job

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /work-orders/:id/jobs/:jobId/complete` while `in_progress` and assigned. Completing a Job does not complete the Work Order. |
| **Post-cutover** | Unchanged. Mechanic completes assigned (or inherited-team) Jobs. **PROPOSED:** do not require a persisted per-Job assignee if the Job inherits the team (Q10). |
| **Migration** | Keep. |
| **Rollback** | No change required. |
| **Approval** | LOCKED execution; assignee rule is Q10. |

### SM-09 — Add Job on an open Standard Work Order

| Dimension | Behavior |
|---|---|
| **CURRENT** | Detail “Add job +” → `POST /work-orders/:id/jobs` with `expectedVersion` + `idempotencyKey`. Multi-category allowed. PM Category rejected. There is **no** Admin Add Job endpoint. |
| **Post-cutover** | **UNDECIDED (Q8).** TARGET says discovered work is added to the existing Work Order, but does not say *who* adds it. If mechanics lose Add Job, Manager needs an Add Job API/UI before W2. If mechanics keep Add Job, that is execution/discovery, not planning-create. |
| **Migration** | W1 default **PROPOSED:** keep mechanic Add Job so the Shop can record discovered work. Do not remove the endpoint in W1. |
| **Rollback** | If a later slice adds Manager Add Job and removes mechanic Add Job, rollback re-enables the mechanic endpoint. |
| **Approval** | UNDECIDED — Q8. |

### SM-10 — Update Work Order notes

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /work-orders/:id/notes` for assigned mechanic. Admin can also PATCH notes. |
| **Post-cutover** | **PROPOSED:** mechanic may still add execution notes. Manager remains able to edit operational notes (Q4). |
| **Migration** | Keep mechanic notes in W1/W2 unless Q11 says otherwise. |
| **Rollback** | Re-enable if later restricted. |
| **Approval** | PROPOSED / Q11. |

### SM-11 — Report Blocker

| Dimension | Behavior |
|---|---|
| **CURRENT** | Standard detail while `in_progress` and Jobs remain. `POST /work-orders/:id/blockers`. Does **not** change Work Order status or waiting totals. Stored as a closed, zero-duration non-official `PauseEvent`; Activity Log `blocker_reported`. V1.2-002: Admin list/detail show the latest report separately from official pause. |
| **Post-cutover** | Unchanged. This is the mechanic’s escalation path. |
| **Migration** | Keep. Do not replace with a generic blocker entity. |
| **Rollback** | No change required. |
| **Approval** | LOCKED TARGET. |

### SM-12 — Global pause (`POST /work-orders/:id/pause`)

| Dimension | Behavior |
|---|---|
| **CURRENT** | API still authorized for assigned Standard mechanic. Standard UI no longer offers Pause while `in_progress` (Report Blocker instead). A direct API call still sets `waiting_paused`, opens an official `PauseEvent`, and stops labor. |
| **Post-cutover** | Mechanic must not perform global Standard pause. Manager official pause remains. |
| **Migration** | W1: UI already hidden; log API use. W2: 403 for Standard. PM pause stays (PM-07). |
| **Rollback** | Re-allow Standard pause API; optionally restore UI. Historical pauses remain. |
| **Approval** | LOCKED TARGET. |

### SM-13 — Resume paused Standard Work Order

| Dimension | Behavior |
|---|---|
| **CURRENT** | Home “Resume Work” and detail Resume call `POST /work-orders/:id/resume` for assigned Standard mechanic. Manager also has official resume. |
| **Post-cutover** | Mechanic must not globally resume. Manager resumes. **PROPOSED for W1:** hide Standard Resume CTA even if the API still works, so the Shop practices the TARGET path. |
| **Migration** | W1: hide Resume/Change Reason on Standard. W2: 403. If a Work Order is already `waiting_paused` at W1, Manager must resume it (Q12). |
| **Rollback** | Restore Standard resume UI/API. |
| **Approval** | LOCKED TARGET; in-flight paused WOs are Q12. |

### SM-14 — Change pause reason

| Dimension | Behavior |
|---|---|
| **CURRENT** | Standard detail when `waiting_paused` calls `POST /work-orders/:id/pause-reason`. |
| **Post-cutover** | Mechanic must not change the official pause reason. Manager owns official pause metadata. |
| **Migration** | W1 hide; W2 403. |
| **Rollback** | Restore endpoint/UI. |
| **Approval** | LOCKED as part of global pause ownership. |

### SM-15 — Finish / complete Standard Work Order

| Dimension | Behavior |
|---|---|
| **CURRENT** | Assigned mechanic `POST /work-orders/:id/complete` after all required Jobs are complete. Manager with `admin.access` can complete from Admin (same finish rules). Completion ≠ Ready to Go ≠ Returned to Service. |
| **Post-cutover** | **PROPOSED:** mechanic may still finish a Work Order when all Jobs are complete (execution). Manager complete remains as operational backup / correction (Q5). |
| **Migration** | Keep mechanic complete through W2 unless Q5 makes it Manager-only **and** Manager complete is verified. |
| **Rollback** | Re-enable mechanic complete if it was removed. |
| **Approval** | PROPOSED / Q5. |

### SM-16 — View Priority, Truck info, repair history

| Dimension | Behavior |
|---|---|
| **CURRENT** | Priority badge on list/detail. Truck panel and repair-history link. |
| **Post-cutover** | Unchanged reads. Mechanic still sees Priority. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### SM-17 — Password reset and sign out

| Dimension | Behavior |
|---|---|
| **CURRENT** | Profile menu; reset email uses production site URL. |
| **Post-cutover** | Unchanged. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED (out of cutover). |

---

## 6.2 PM Mechanic (`mechanic.pm`)

Master PRD and the historical ownership plan say **PM is untouched**. This
contract treats that as locked TARGET unless Cristian reopens it (Q13).

### PM-01 — Sign in and PM Home

| Dimension | Behavior |
|---|---|
| **CURRENT** | PM Home title remains “PM Mechanic,” not the Standard assignment labels. Primary CTA is Create PM service. |
| **Post-cutover** | Unchanged. |
| **Migration** | V2 slices must not reuse Standard Home cutover on the PM workspace. |
| **Rollback** | Restore PM Home if a slice regresses it. |
| **Approval** | LOCKED. |

### PM-02 — Create PM Work Order (auto-start)

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /work-orders` with PM Category. Requires `mechanic.pm`. Starts immediately: `in_progress`, creator assignment, open Work Session. No Jobs, collaborators, or Priority form. Priority forced `normal`. Manager Admin create **cannot** create PM. |
| **Post-cutover** | Unchanged. PM self-create remains. |
| **Migration** | W2 Standard 403 must be Category/capability-specific. A `mechanic.pm` body must still succeed. Users with both capabilities keep both workspaces. |
| **Rollback** | Do not disable PM create as part of Standard rollback. |
| **Approval** | LOCKED. |

### PM-03 — Observed mileage

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /work-orders/:id/pm` draft. Required before finish. |
| **Post-cutover** | Unchanged. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PM-04 — Select parts / “No part used”

| Dimension | Behavior |
|---|---|
| **CURRENT** | Server-side PM catalog + fitment. At least one part required to finish. |
| **Post-cutover** | Unchanged. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PM-05 — PM notes

| Dimension | Behavior |
|---|---|
| **CURRENT** | Saved with the PM draft while open. |
| **Post-cutover** | Unchanged. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PM-06 — View Truck information

| Dimension | Behavior |
|---|---|
| **CURRENT** | Same truck panel; used to confirm mileage. |
| **Post-cutover** | Unchanged. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PM-07 — Pause PM

| Dimension | Behavior |
|---|---|
| **CURRENT** | Home and detail expose Pause. `POST /work-orders/:id/pause` sets official pause. This is **not** Report Blocker. |
| **Post-cutover** | Unchanged. PM keeps specialized pause. |
| **Migration** | W2 must not 403 PM pause. Guard on Category/`mechanic.pm`, not on “any mechanic pause.” |
| **Rollback** | None if left intact. |
| **Approval** | LOCKED; confirm Q13. |

### PM-08 — Change PM pause reason

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /work-orders/:id/pause-reason` on paused PM. |
| **Post-cutover** | Unchanged. |
| **Migration** | Keep for PM in W2. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PM-09 — Resume PM

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /work-orders/:id/resume`. |
| **Post-cutover** | Unchanged. |
| **Migration** | Keep for PM in W2. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PM-10 — Finish PM

| Dimension | Behavior |
|---|---|
| **CURRENT** | Requires saved observed mileage and ≥1 part. May write immutable truck-mileage audit. Completes the Work Order. Manager can complete with the same rules. |
| **Post-cutover** | Unchanged for the PM mechanic. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PM-11 — Read completed PM

| Dimension | Behavior |
|---|---|
| **CURRENT** | Completed PM is read-only. |
| **Post-cutover** | Unchanged. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PM-12 — Manager visibility of PM

| Dimension | Behavior |
|---|---|
| **CURRENT** | Admin can read PM, officially pause/resume if they have `work_orders.manage`, complete/cancel/reopen with `admin.access`. Team assignment on PM is locked in UI (creator-only). Per-Job assign does not apply (no Jobs). |
| **Post-cutover** | **PROPOSED:** Manager continues to observe PM and may officially pause/complete as today. Manager still cannot create PM. Do not add PM Jobs. |
| **Migration** | No PM schema bridge. |
| **Rollback** | None. |
| **Approval** | PROPOSED / Q13. |

---

## 6.3 Shop Manager (`admin.access` + `work_orders.manage`)

Manager today still shares the Admin shell. `work_orders.manage` is additive
and does not replace `admin.access`. Seeded `ibrain@` / Cristian admin users
have `admin.access` **without** `work_orders.manage` (V1-004). Granting
Manager planning to real Shop Managers is Q14.

### MG-01 — Enter Admin shell and read operational screens

| Dimension | Behavior |
|---|---|
| **CURRENT** | `admin.access` required for `/admin`, dashboard, WO list/detail, trucks, mechanics, history, catalog, Yard reads. |
| **Post-cutover** | Unchanged unless Q15 creates a Manager-only shell. **PROPOSED:** keep the shared Admin shell for V2; do not build a new Manager app. |
| **Migration** | None in W1/W2. |
| **Rollback** | None. |
| **Approval** | PROPOSED / Q15. |

### MG-02 — Create Standard Work Order (`POST /admin/work-orders` + `/admin/work-orders/new`)

| Dimension | Behavior |
|---|---|
| **CURRENT** | Requires both capabilities. Truck, multi-category Jobs/Custom Jobs, Priority, notes, optional per-Job assignees. Status `created`, not auto-started. Unions Job assignees into the general team. PM Category rejected. One-open-per-Truck 409. Create CTA on the Admin list is **not** capability-filtered (V1-004 F4): `admin.access` without manage can open the form and get API 403. |
| **Post-cutover** | This is the normal Standard create path. **PROPOSED:** hide the Create CTA without `work_orders.manage` (F4). |
| **Migration** | Already live. W1 depends on it. Do not remove mechanic create until this path is the Shop’s daily path (Q1). |
| **Rollback** | Do not remove Manager create as Standard rollback. |
| **Approval** | LOCKED as Manager create; CTA filter is Q16. |

### MG-03 — Set Priority at Manager create and later

| Dimension | Behavior |
|---|---|
| **CURRENT** | Manager sets Priority on create. Later edits use `PATCH /admin/work-orders/:id`, which requires **only** `admin.access` (not `work_orders.manage`). PM Priority stays `normal`. |
| **Post-cutover** | Manager owns Standard Priority. Mechanic never sets it. **UNDECIDED (Q4):** whether PATCH Priority stays `admin.access` (System Admin correction) or moves to `work_orders.manage`. |
| **Migration** | W1/W2 must not leave a Shop with no one who can change Priority. If PATCH moves to manage, grant manage first. |
| **Rollback** | Restore previous capability on PATCH. |
| **Approval** | Ownership LOCKED; capability home is Q4. |

### MG-04 — Official pause

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/work-orders/:id/pause` with both capabilities. Sets `waiting_paused`, official `PauseEvent`, labor stop, Activity Log. Distinct from Report Blocker. |
| **Post-cutover** | This is the only Standard global pause. |
| **Migration** | Already live. Must remain through W1/W2. |
| **Rollback** | Keep Manager pause even if Standard pause returns. |
| **Approval** | LOCKED. |

### MG-05 — Official resume

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/work-orders/:id/resume` with both capabilities. |
| **Post-cutover** | This is the only Standard global resume. |
| **Migration** | Required before hiding mechanic Resume (W1) so paused work is not stranded (Q12). |
| **Rollback** | Keep. |
| **Approval** | LOCKED. |

### MG-06 — Assign / unassign a Job

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/work-orders/:id/jobs/:jobId/assign` and `/unassign`. Both capabilities. Version + idempotency. Unassigned Jobs inherit the general team in UI. V1.2-001: assign also unions the mechanic onto the team. |
| **Post-cutover** | Manager continues to assign Jobs. Mechanic does not self-assign. |
| **Migration** | Already live. Keep `MechanicAssignment`; do not delete it in V2 (Q17). |
| **Rollback** | Keep rows; unassign is additive. |
| **Approval** | LOCKED. Eventual role of the general team is Q17. |

### MG-07 — Add / remove Work Order team (`MechanicAssignment`)

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST/DELETE /admin/work-orders/:id/mechanics[/:mechanicId]` requires **only** `admin.access`. At least one active mechanic. PM team locked to creator. |
| **Post-cutover** | TARGET treats assignment as Manager work. **UNDECIDED (Q3):** move these routes to `work_orders.manage` or leave as Admin correction. |
| **Migration** | If moved, grant `work_orders.manage` to every Shop Manager who currently uses team assignment **before** the guard changes. |
| **Rollback** | Restore `admin.access`-only guard. |
| **Approval** | UNDECIDED — Q3. |

### MG-08 — See and act on reported blockers

| Dimension | Behavior |
|---|---|
| **CURRENT** | V1.2-002: Admin list/detail show latest report (actor/reason) separate from current official pause. Manager then pauses/resumes. No generic “resolve blocker” entity. |
| **Post-cutover** | Same: report is information; official pause/resume is the operational action. **PROPOSED:** do not add a workflow engine in V2. |
| **Migration** | Keep the V1.2 presentation. |
| **Rollback** | None. |
| **Approval** | PROPOSED (no new entity). |

### MG-09 — Add Job after create

| Dimension | Behavior |
|---|---|
| **CURRENT** | Manager cannot Add Job on an existing Work Order except by asking a mechanic (SM-09) or cancelling/reopening Jobs. |
| **Post-cutover** | **UNDECIDED (Q8).** If mechanics keep Add Job, Manager may remain create-time-only. If mechanics lose Add Job, Manager Add Job is a **prerequisite** for W2. |
| **Migration** | Do not disable mechanic Add Job until a Manager path exists. |
| **Rollback** | Keep mechanic Add Job. |
| **Approval** | UNDECIDED — Q8. |

### MG-10 — Open mechanic workspace from Admin cards

| Dimension | Behavior |
|---|---|
| **CURRENT** | Capability-filtered Standard/PM workspace cards. Work uses the signed-in identity (not impersonation). |
| **Post-cutover** | Unchanged. A Manager who also holds mechanic capabilities can still execute under their own user. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

---

## 6.4 System Admin and shared Admin mutations

These are V1 `admin.access` corrections. TARGET wants Shop Manager to operate
without System Admin, and System Admin to keep elevated corrections. The
**split is not decided** (V1-004 F1). Each row is therefore UNDECIDED on
capability home even when the *action* stays.

### SA-01 — PATCH Priority and notes

| Dimension | Behavior |
|---|---|
| **CURRENT** | `PATCH /admin/work-orders/:id`, `admin.access` only. Open WOs; PM Priority stays `normal`; closed WOs read-only. |
| **Post-cutover** | Action remains. Capability home is Q4. |
| **Migration** | Do not remove PATCH in W1. |
| **Rollback** | Restore previous capabilities. |
| **Approval** | UNDECIDED — Q4. |

### SA-02 — Cancel Work Order

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/work-orders/:id/cancel`, `admin.access`, required reason. Stops open labor/wait; status `cancelled`; `manager_correction`. Jobs are not cancelled separately. |
| **Post-cutover** | Action remains. **UNDECIDED (Q5)** whether this is Manager operational or elevated Admin. |
| **Migration** | Keep available through W2. |
| **Rollback** | Restore previous capabilities. |
| **Approval** | UNDECIDED — Q5. |

### SA-03 — Complete Work Order from Admin

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/work-orders/:id/complete`, `admin.access`. Same finish rules as mechanic. |
| **Post-cutover** | Action remains as backup/correction. Whether it is the *primary* complete path is Q5 (with SM-15). |
| **Migration** | Keep. |
| **Rollback** | Restore previous capabilities. |
| **Approval** | UNDECIDED — Q5. |

### SA-04 — Reopen Work Order

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/work-orders/:id/reopen`, `admin.access`, reason, only if the Truck has no other open Work Order. Restores `in_progress` or `created`. |
| **Post-cutover** | **PROPOSED:** remains elevated System Admin (correction), not daily Manager planning. |
| **Migration** | Keep `admin.access` unless Q6 says otherwise. |
| **Rollback** | Restore previous capabilities. |
| **Approval** | PROPOSED / Q6. |

### SA-05 — Cancel / reopen Job

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/jobs/:id/cancel` and `/reopen`, `admin.access`, reason, open Standard only. Completed Jobs stay. |
| **Post-cutover** | **PROPOSED:** Manager operational if Shop Managers do this daily; otherwise elevated Admin. Cristian must say which (Q7). |
| **Migration** | Keep available. |
| **Rollback** | Restore previous capabilities. |
| **Approval** | UNDECIDED — Q7. |

### SA-06 — Time correction

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/time-corrections`, `admin.access`, reason. Recalculates totals from segments. Report-only blocker events are not official wait (V1.2-002). |
| **Post-cutover** | **PROPOSED:** remains elevated System Admin. |
| **Migration** | Keep. |
| **Rollback** | Restore previous capabilities. |
| **Approval** | PROPOSED / Q6. |

### SA-07 — Returned to Service

| Dimension | Behavior |
|---|---|
| **CURRENT** | `POST /admin/work-orders/:id/return-to-service` after complete, `admin.access`, reason. Append-only `TruckServiceStatusEvent`. Does not set Ready to Go, presence, or Off Duty. |
| **Post-cutover** | Out of ownership-planning core. **PROPOSED:** unchanged capability until a later readiness task. Not part of W2. |
| **Migration** | Do not bundle into V2 cutover. |
| **Rollback** | None. |
| **Approval** | PROPOSED (leave as-is). |

### SA-08 — Catalog, Trucks, Mechanics, History reads

| Dimension | Behavior |
|---|---|
| **CURRENT** | `admin.access` reads. Catalog is read-only. No permission-management UI. |
| **Post-cutover** | Unchanged in V2. Catalog writes stay LATER. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED deferred. |

### SA-09 — Yard / Ready to Go mutations

| Dimension | Behavior |
|---|---|
| **CURRENT** | Reads: `admin.access`. Mutations: `admin.access` + `yard.operations.manage`. Presence always `UNKNOWN`. |
| **Post-cutover** | **Out of scope.** V2 cutover must not change Yard guards or Ready to Go. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED out of scope. |

---

## 6.5 Shared platform actions (all roles)

### PL-01 — Authentication and capability resolution

| Dimension | Behavior |
|---|---|
| **CURRENT** | JWT + persisted capabilities per request. Role does not grant mechanic mutations. Dev bypass local only. |
| **Post-cutover** | Unchanged model. W2 adds Standard create/pause denials inside existing service/HTTP checks. |
| **Migration** | No JWT-claim cutover. |
| **Rollback** | Revert the denial checks. |
| **Approval** | LOCKED. |

### PL-02 — Activity Log and history

| Dimension | Behavior |
|---|---|
| **CURRENT** | Create, pause, resume, blocker, assignment, corrections, completion all write audit events. |
| **Post-cutover** | Existing events remain readable. New W2 403s write no domain event (failed auth is not an Activity Log row). |
| **Migration** | Do not backfill or delete events. |
| **Rollback** | Do not rewrite history. |
| **Approval** | LOCKED. |

### PL-03 — One open Work Order per Truck

| Dimension | Behavior |
|---|---|
| **CURRENT** | Advisory lock on create (mechanic and Manager). |
| **Post-cutover** | Unchanged. |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED. |

### PL-04 — Versioning and idempotency

| Dimension | Behavior |
|---|---|
| **CURRENT** | Manager create/assign/pause and mechanic Add Job use `expectedVersion` / `idempotencyKey` where specified. |
| **Post-cutover** | Keep. Any new Manager Add Job (Q8) must use the same contract (`ENGINEERING_PRACTICES.md`). |
| **Migration** | None. |
| **Rollback** | None. |
| **Approval** | LOCKED engineering rule. |

### PL-05 — EN/ES message parity

| Dimension | Behavior |
|---|---|
| **CURRENT** | Shared component tree; Admin parity tested. |
| **Post-cutover** | Any W1 copy (“ask your Manager”, removed CTA) must ship EN and ES together. |
| **Migration** | W1 UI slice includes both locales. |
| **Rollback** | Restore both locales. |
| **Approval** | LOCKED engineering rule. |

---

# 7. API / UI pairing (what must change together)

Cutover is incomplete if only one column changes.

| Action | CURRENT UI | CURRENT API | W1 UI | W2 API |
|---|---|---|---|---|
| Standard create | Demoted CTA + `/mechanic/standard/new` | `POST /work-orders` allowed | Hidden / blocked route | 403 for Standard |
| Standard Priority write | Create-form only | Body field on create | Gone with create | Create rejected |
| Standard global pause | Hidden on `in_progress` | `POST .../pause` allowed | Stay hidden | 403 for Standard |
| Standard resume | Shown when paused | `POST .../resume` allowed | Hidden | 403 for Standard |
| Standard change reason | Shown when paused | `POST .../pause-reason` allowed | Hidden | 403 for Standard |
| Report Blocker | Shown | `POST .../blockers` | Shown | Stay allowed |
| Start / complete Job / finish WO | Shown | corresponding POSTs | Shown | Stay allowed unless Q5/Q8/Q11 |
| PM create/pause/resume/finish | Shown | same mechanic routes | Shown | Stay allowed |
| Manager create/pause/assign | Shown | Admin routes + manage | Shown | Stay allowed |

Service-layer Manager methods (`createByManager`, `pauseByManager`,
`resumeByManager`) currently trust the HTTP guard (V1-004 F2).
**PROPOSED:** a later V2 hardening slice may re-assert `work_orders.manage`
inside those methods without changing the HTTP matrix. That is not required
to start W1.

---

# 8. In-flight and historical data

| Record | During W1/W2 | After rollback |
|---|---|---|
| Mechanic-created open Standard WO | Remains operable. Assigned mechanic can Start, complete Jobs, Report Blocker, Add Job (if Q8 keeps it), Finish (if Q5 keeps it). They cannot create *another* Standard WO after W2. | Same rows remain. |
| Manager-created `created` WO | Mechanic starts it. | Unchanged. |
| Standard WO already `waiting_paused` | After W1 hide, only Manager resume (Q12). | Mechanic resume can return. |
| Historical official `PauseEvent` | Readable; counts in waiting totals. | Unchanged. |
| Historical / V1.2 report-only blockers | Readable; excluded from waiting totals. | Unchanged. |
| Per-Job `assignedMechanicId` null | Inherits team. | Unchanged. |
| `primaryCategoryId` | Required; compatibility. | Do not drop. |
| `pmAuthorized` column | Unused for auth; keep. | Keep. |
| Completed / cancelled WOs | Read-only except Admin reopen/return-to-service. | Unchanged. |
| Repair history | Readers keep rendering single- and multi-category rows. | Unchanged. |

---

# 9. Explicitly out of scope

Do **not** attach these to V2 implementation:

- Yard Phase persistence, Detailing, Quality Check maturity (V2.1).
- Samsara, McLeod, Dispatch, Incoming, Departures, presence (V3).
- Catalog writes, Custom Job review, permission-management UI.
- Multiple open Work Orders per Truck.
- Generic workflow/blocker engine or per-Job timers.
- Ninox dual-write.
- Removing `MechanicAssignment` or `primaryCategoryId`.
- Changing PM into Standard Jobs.

---

# 10. Acceptance and test plan (no code in V2-001)

This is the plan later V2 slices must execute. V2-001 does not run it against
production writes.

## 10.1 Product acceptance (Cristian)

- [ ] §11 decisions recorded in the Master PRD decision log (approve / reject /
      defer with owner).
- [ ] Compatibility window (W1 duration and W2 go/no-go owner) named.
- [ ] Rollback owner and communication path named.
- [ ] Real Shop Manager roster that must receive `work_orders.manage` named
      (Q14). Temporary V1 test users are not the roster.

## 10.2 Authorization tests (W1 and W2)

Positive and negative for every mutation in `CAPABILITY_BOUNDARY_AUDIT.md`,
plus the W2 denials:

| Actor | Standard create | Standard pause/resume/reason | Blocker | Start / Job complete | PM create/pause | Manager create/pause/assign |
|---|---|---|---|---|---|---|
| Standard only | W1 allow / W2 403 | W1 allow / W2 403 | 200 | 200 if assigned | 403 | 403 |
| PM only | 403 | 403 on Standard; 200 on PM | 403 on Standard | 403 on Standard | 200 | 403 |
| Manager (access+manage) | 403 on mechanic create | 403 on mechanic pause | 403 on mechanic route | 403 unless also mechanic+assigned | 403 unless also PM | 200 |
| Admin access without manage | 403 Manager create/pause/assign | n/a | n/a | n/a | n/a | 403 |
| Unassigned mechanic | 403 on that WO | 403 | 403 | 403 | 403 | 403 |

## 10.3 UI tests

- Standard Home: no Create CTA at W1; assigned work still listed; EN/ES.
- Standard detail `in_progress`: Report Blocker present; no Pause.
- Standard detail `waiting_paused` at W1: no Resume/Change Reason (Q12).
- PM Home/detail: Create, Pause, Resume, Finish unchanged.
- Admin: Create hidden without manage (if Q16 approved); pause/assign still
  work with manage.
- Mobile 390 and desktop 1440 for mechanic Home/detail.

## 10.4 Data and timing tests

- Report Blocker does not change status or `totalWaitingMs`.
- Official pause does; resume restores `in_progress`.
- One-open-per-Truck still 409 from both create paths (while both exist).
- Historical single-category WOs still render.
- Mileage audit and PM parts rules unchanged.
- Idempotent replay of Manager assign/create still no-ops.

## 10.5 Release / rollback drill (staging or approved production read + flagged write)

- Record current web and API deployment ids before W1 and before W2.
- Prove W1 rollback = previous web, APIs still hybrid.
- Prove W2 rollback = previous API (or flag off), no data rewrite.
- No production write in V2-001. Later slices follow `DEPLOY.md`.

## 10.6 Commands later slices must run

```bash
npm run lint --workspace=@ltl-shop/api
npm run lint --workspace=@ltl-shop/web
npm run test --workspace=@ltl-shop/api
npm run test --workspace=@ltl-shop/web
npm run build
```

Playwright with `ADMIN_E2E_FIXTURE=1`, one browser / one worker, for visible
W1/W2 slices. Update the V1-004 matrix test when HTTP expected capabilities
change.

---

# 11. Decisions Cristian must make before V2 implementation

Do not treat recommendations as approvals. Implementation starts only after
these are written into the Master PRD decision log.

### Q1 — How long is W1?

How many Shop operating days (or what usage evidence) before W2 403s Standard
create/pause/resume/change-reason?

### Q2 — Who may roll back, and how is the Shop told?

Name the rollback owner and the communication path (Shop group, radio, etc.).

### Q3 — Work Order team add/remove capability

Keep `POST/DELETE .../mechanics` on `admin.access`, or require
`work_orders.manage` (and therefore grant manage to everyone who assigns the
team today)?

### Q4 — PATCH Priority / notes capability

Keep on `admin.access`, move to `work_orders.manage`, or split (Priority =
manage, notes = either)?

### Q5 — Who completes or cancels a Standard Work Order?

Options: mechanic finish stays + Admin complete/cancel stay; Manager becomes
the only completer/canceller; cancel is Admin-only and complete stays with
the mechanic.

### Q6 — Which corrections stay System Admin-only?

Confirm or reject the recommendation that **reopen Work Order** and **time
correction** stay `admin.access` and are not required for daily Manager
planning.

### Q7 — Job cancel / reopen

Daily Manager tool (`work_orders.manage`) or elevated Admin correction?

### Q8 — Who adds a Job after create?

Mechanics keep Add Job; Manager gains Add Job and mechanics lose it; or both
keep it. If mechanics lose it, Manager Add Job is a W2 prerequisite.

### Q9 — Is there any Standard create exception?

Road service, after-hours, or a named mechanic who may still create? If yes,
name the capability/exception. If no, W2 is a hard 403.

### Q10 — May a mechanic execute an unassigned (team-inherited) Job?

CURRENT yes. TARGET says “assigned work.” Decide: inherited team is enough,
or every executable Job must have `assignedMechanicId`.

### Q11 — Mechanic notes after cutover?

Keep `POST /work-orders/:id/notes` or Manager-only notes?

### Q12 — Who resumes Standard Work Orders already paused at W1?

Recommendation: Manager only, as soon as Resume is hidden. Confirm, and
confirm Managers will be on shift when W1 deploys.

### Q13 — Reconfirm PM is out of V2

Confirm PM self-create, pause, resume, parts, and mileage stay exactly as
CURRENT. A “no” is a different project, not a silent V2 slice.

### Q14 — Who receives `work_orders.manage` in production?

List real Shop Managers. Temporary V1 test users are insufficient. Also
decide whether Cristian/ibrain admin accounts that lack manage should gain
it, stay Admin-only, or lose operational CTAs (Q16).

### Q15 — Shared Admin shell in V2?

Recommendation: keep one `/admin` shell. A separate Manager app is out of
scope unless Cristian orders it.

### Q16 — Hide Admin Create without `work_orders.manage`?

V1-004 F4. Recommendation: yes, as part of W1 (UI only; API already 403s).

### Q17 — Keep `MechanicAssignment` as the general team?

Recommendation: yes for V2. Do not delete. Per-Job assignee stays optional.

### Q18 — Is V1.2 evidence enough to enter W1?

V1.2-001/002 validated fixtures and seeded local flows. Production Safari
mobile remains OPERATOR_REQUIRED (V1-003). Real Shop roster is still
pending. Cristian must say whether that is enough to start W1 or whether a
production mechanic+Manager day on the real roster is a gate.

---

# 12. Recommended sequence after approval (not authorized)

Only after §11 is recorded:

1. **Docs:** copy approved answers into the Master PRD decision log and this
   contract’s status line.
2. **Grants (ops):** Q14 capability grants in production. No code.
3. **W1 UI slice:** hide Standard planning controls; optional Q16 CTA filter;
   EN/ES; tests in §10.3. Legacy APIs stay.
4. **W1 soak:** usage log + Shop validation for Q1.
5. **W2 API slice:** 403 Standard create/pause/resume/pause-reason; PM
   untouched; matrix tests updated.
6. **Optional hardening:** service-layer re-assert (F2); Q3–Q7 capability
   moves as separately approved slices.
7. **Never in this sequence:** Yard, Samsara, schema drops, PM rewrite.

Each slice is its own queue task. This contract is not a combined
implementation ticket.

---

# 13. Sign-off block

Copy into the Master PRD decision log when Product decides.

```text
YYYY-MM-DD
Decision: V2 ownership cutover contract
Approved window: W1 duration = ___ ; W2 owner = ___
Rollback owner: ___
Answers: Q1…Q18 (approve / reject / defer)
Reason:
Impact: Authorizes / does not authorize W1 implementation
Phase: V2
```

Until that entry exists, V2 implementation remains **GATED**.
