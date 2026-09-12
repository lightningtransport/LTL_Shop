# V2.1-001 — Yard Phase persistence gap

**Classification:** PRODUCT DECISION / AUDIT
**Task:** V2.1-001
**Audited commit:** `bbd315f` (latest `main`, V2-002 TARGET ownership cutover merged)
**Date:** 2026-09-12
**Owner:** Product (Cristian) for go/no-go; Engineering for derivation facts
**Status:** COMPLETE. No `YardPhaseEvent` schema. Cristian answered §8 on
2026-09-12. The approved derivation + EN/ES copy is implemented on this
branch.

## Recommendation

**Do not persist Yard Phase.** Board column = next unresolved readiness gate.

Cristian approved the derivation/copy follow-on the same day. Implemented
rules: Ready for Approval; Detailing while a later gate is unevaluated;
Detailing/QC with an open Work Order; residual Ready after close; waiver
text does not withdraw Ready.

A live Operational Yard pilot may still refine copy. It does not reopen
persistence unless operators later prove they need a manually claimed stage.

---

## 1. Scope and method

This audit answers: does derived Yard Phase fail to represent real manual
transitions (especially Detailing → Quality Check → Ready), or is a persisted
`YardPhaseEvent` still unjustified?

In scope:

- Trace API + web derivation: priority, inputs, edge cases.
- Walk Detailing / Quality Check / Ready-to-Go against that derivation.
- Produce concrete cases with observed phase, operator claim, evidence gap,
  and whether persistence would fix the gap.
- For each candidate gap: source owner, audit needs, and migration
  requirements **if** persistence is later approved.
- Explicit persist / do-not-persist / derivation-only recommendation.

Out of scope (honored):

- Creating `YardPhaseEvent` schema or code.
- Rebuilding Yard Phase 1 (already CURRENT on `main`; see
  `docs/YARD_OPERATIONS_PHASE_1_CONTRACT.md`).
- Samsara / McLeod / presence (V3).
- Inventing fake operational or production yard data.
- Changing mechanic ownership TARGET (V2-002 already merged).

Method:

- Read the Phase 1 contract, Master PRD §§12–14 and §40, Current Status, and
  `deriveReadiness` plus readiness mutations.
- Execute the derivation function against constructed requirement/WO
  combinations (labeled **derivation cases**, not operational observations).
- Treat Playwright `Y-10x` rows as **fixtures**, never as Shop evidence.

---

## 2. How Yard Phase is derived today

### 2.1 What is persisted vs what is displayed

Persisted today (Prisma, additive Phase 1):

- `TruckReadinessAssessment` (`under_review` | `ready` | `closed`) with
  `readyAt`, `approvedById`, close reason, version.
- Six `ReadinessRequirement` rows per assessment: Inspection, Required
  Repairs, PM, Alignment, Detailing, Quality Check.
- Outcomes: `not_evaluated` | `required` | `not_required` | `completed` |
  `waived`.
- Waiver reason, optional evidence Work Order, evaluator, `evaluatedAt`.
- `WorkOrder.readinessAssessmentId` (nullable link).
- Activity Log: assessment started/closed, requirement updated, Ready
  approved, approval invalidated.
- `ReadinessMutation` idempotency records.

**Not persisted:** a Yard Phase value, a phase-changed-at timestamp, or an
append-only `YardPhaseEvent`. `ReadinessPhase` exists only in
`packages/shared` and is computed per read.

Web does not re-derive. `/admin/yard-operations` and `/admin/trucks/[id]`
render `item.phase` from `GET /api/admin/yard-operations` and
`GET /api/admin/trucks/:id`. Board columns are the eight derived phases.
“Time in assessment” uses `assessment.startedAt`, not time in the current
derived phase.

### 2.2 Inputs to `deriveReadiness`

File: `apps/api/src/admin/yard-operations-derivation.ts`.

| Input | Source on the read path | Notes |
| --- | --- | --- |
| Active assessment | Latest `under_review` or `ready` assessment for the Truck | Closed assessments are excluded, so the Truck looks like “no assessment.” |
| Requirement outcomes | All six types, ordered as in `READINESS_REQUIREMENT_TYPES` | Missing row is treated as unevaluated. |
| Linked open Work Orders | Assessment `workOrders` in `created`, `in_progress`, or `waiting_paused` | Completed/cancelled linked WOs do not enter derivation. |
| Assessment status | `under_review` or `ready` | Used only for Ready-to-Go and the approval-conflict blocker. |

A Truck-level open Work Order is also shown as `activeWorkOrder`. Starting an
assessment links the existing open WO. Creating a new WO while an assessment
is active also sets `readinessAssessmentId`. Those two sets should stay
aligned under the one-open-WO rule. The Mark Ready **button** additionally
disables when `activeWorkOrder` is present (Truck-level), which is stricter
than derivation if a WO were ever unlinked.

Physical presence, work location, Incoming, and Departures are never inputs.
An open Work Order is not treated as in-yard.

### 2.3 Implemented priority (first match wins)

Exact code order:

1. **No assessment** → `needs_evaluation`, readiness `not_started`, no
   blockers. An open WO on the Truck does **not** change this.
2. **Any requirement missing or `not_evaluated`** → `needs_evaluation`.
   Unevaluated blockers are emitted for every such type. This is **stricter**
   than the Phase 1 contract, which says Needs evaluation when *no*
   requirement has been evaluated.
3. **Inspection is `required`** → `inspection`.
4. **Any linked open WO, or Required Repairs is `required`** →
   `required_work`.
5. **PM is `required`** → `pm`.
6. **Alignment is `required`** → `alignment`.
7. **Detailing is `required`** → `detailing`.
8. **Quality Check is `required`** → `quality_check`.
9. **Assessment `ready` AND no open linked WO AND no blockers** →
   `ready_to_go`.
10. **Otherwise** → `needs_evaluation` (fallthrough). This is the pending-
    approval and post-invalidation trap.

`completed`, `waived`, and `not_required` are equivalent for phase selection:
they are not “unresolved required.” Skip is expressed by marking an earlier
stage `not_required` or `waived`, not by moving a phase pointer.

### 2.4 Blockers (derived, parallel to phase)

Always collected before the phase return:

- `unevaluated_requirement` for each missing/`not_evaluated` type.
- `open_work_order` for each linked open WO (status, priority, category,
  current official pause reason).
- `required_requirement` for each `required` outcome.
- `approval_conflict` when status is `ready` and a linked WO is still open.

Ready to Go is refused while any of those remain, even if status is `ready`.

### 2.5 Mutations that change the evidence, not the phase

| Action | Capability | Effect on evidence | Effect on displayed phase |
| --- | --- | --- | --- |
| Start assessment | `yard.operations.manage` | Six `not_evaluated` rows; link open WO if any | `needs_evaluation` |
| Update requirement | `yard.operations.manage` | Outcome + waiver/evidence; Activity Log | Re-derived. If assessment was `ready`, status returns to `under_review` in the same transaction. |
| Mark Ready | `yard.operations.manage` | Status `ready`, `readyAt`, approver | `ready_to_go` only if rules still hold |
| Close assessment | `yard.operations.manage` | Status `closed` | Truck drops to `needs_evaluation` (no active assessment) |
| Create Work Order | `work_orders.manage` (Standard) or `mechanic.pm` (PM) | Link to active assessment; if assessment was `ready`, invalidate approval | Usually `required_work` |
| Reopen Work Order | `admin.access` | Restores open status; **does not** invalidate `ready` | `required_work` + `approval_conflict` if the WO is still linked |
| Complete Work Order | Manager / PM rules | WO leaves the open-linked set | Phase can advance if requirements are resolved |
| Returned to Service | `admin.access` | `TruckServiceStatusEvent` | **No** Yard Phase change |

Mark Ready server rules: every requirement evaluated and not `required`;
every waiver has a reason; no linked open WO; optimistic version; idempotency;
`READINESS_APPROVED` Activity Log.

Completed-evidence rules: PM, Alignment, and Required Repairs need a
completed, same-Truck, assessment-linked, category-relevant Work Order.
**Detailing, Quality Check, and Inspection do not.** They are already manual
persisted outcomes. That is the Master PRD §40 concern (“cannot always be
inferred from mechanical Jobs”), and Phase 1 already solved it without
`YardPhaseEvent`.

### 2.6 Contract vs code mismatches

| Topic | Phase 1 contract | Implemented code |
| --- | --- | --- |
| Needs evaluation | No active assessment, **or no requirement has been evaluated** | No assessment, **or any** requirement is unevaluated, **or** fallthrough |
| Ready to Go | Assessment is `READY` | Assessment is `ready` **and** no open linked WO **and** no blockers |
| New linked WO after Ready | Invalidate approval in the same transaction | Create-WO path does; **reopen** path does not |
| Detailing / QC evidence | Manual until canonical categories are verified | Manual: `COMPLETED` allowed with no evidence WO |

---

## 3. Detailing / Quality Check / Ready workflow

Intended presentation order (contract and Master PRD):

```text
Inspection → Required Work → PM? → Alignment? → Detailing → Quality Check → Ready to Go
```

Master PRD §14: this is **not** a rigid state machine. Stages may be skipped
by product rule (no heavy repair, PM not due, waiver).

What the operator can actually do today:

1. Start one active assessment.
2. Set each of the six outcomes independently, in any order, including
   marking Quality Check `required` or `completed` before Detailing.
3. Mark Detailing / Quality Check `completed` or `waived` with no Job and no
   Work Order.
4. Press Mark Ready only when every outcome is resolved and no open WO
   remains.
5. Change any outcome after Ready; approval is withdrawn.
6. Close the assessment for any audit reason; that is not departure.

What the **board** will show during that work:

| Operator action | Visible phase | Can it be skipped / reordered on the board? |
| --- | --- | --- |
| Start assessment | Needs evaluation | n/a |
| Evaluate some rows, leave any `not_evaluated` | Needs evaluation (stuck-looking) | Later `required` stages are hidden |
| Detailing `required`, QC `required`, earlier stages resolved | Detailing | QC cannot appear until Detailing is resolved |
| Detailing `not_required` or `waived`, QC `required` | Quality Check | Yes — skip is a requirement outcome, not a phase move |
| Detailing `completed`, QC `required` | Quality Check | Sequential display works if the checklist is updated |
| Both resolved, not yet Mark Ready | Needs evaluation (fallthrough) | Looks like the review restarted |
| Mark Ready | Ready to Go | Explicit approval; not inferred from green checks |
| Edit a requirement after Ready | Usually Needs evaluation or the first unresolved `required` | Approval disappears immediately |
| Close after Ready | Needs evaluation | Ready history leaves the board |
| Open or reopened linked WO | Required Work (wins over Detailing/QC) | Later stages hidden while work is open |

There is no drag-and-drop, no “move to Detailing,” and no mechanic control of
global Yard Phase (Master PRD Standard Mechanic TARGET). Phase is a read
model over the checklist plus open WO evidence.

---

## 4. Concrete cases

Each case is a derivation result from current `deriveReadiness` plus the
mutation rules above. “Operator would claim” is the **plausible yard claim**
if someone treats phase as “where the Truck is,” not a live Shop quote.

Legend for “Would persistence fix it?”:

- **No — derivation/UI** = fixable by changing `deriveReadiness` and/or copy.
- **No — process** = operators must update the checklist; a second model
  would duplicate it.
- **Only if product wants an independent claim** = persistence is the wrong
  default unless Cristian answers that phase ≠ next unresolved requirement.

### Case 1 — Open Work Order, no assessment

| | |
| --- | --- |
| Evidence | No active assessment. Truck has an open Standard WO. |
| Observed / derived phase | `needs_evaluation` |
| Operator would claim | Required Work / in shop |
| Evidence gap | Phase ignores Truck-level work until an assessment exists. Correct for “do not infer presence,” easy to misread on the board. |
| Persistence? | **No — derivation/UI.** Optional: a non-phase hint (“open WO, assessment not started”). Do not persist phase from WO status. |
| Source owner | Code / UX. Product already forbids inferring presence from a WO. |

### Case 2 — Fresh assessment, nothing evaluated

| | |
| --- | --- |
| Evidence | Assessment `under_review`. All six `not_evaluated`. Optional linked open WO. |
| Observed / derived phase | `needs_evaluation` + six unevaluated blockers (+ open-WO blocker if linked) |
| Operator would claim | Inspection starting, or already in Required Work if a WO is open |
| Evidence gap | Matches contract. Board time is assessment age, not “time in Inspection.” |
| Persistence? | **No — process.** Starting the assessment *is* the event. |
| Source owner | Product (checklist-first) aligned with code. |

### Case 3 — Detailing required, Quality Check still unevaluated

| | |
| --- | --- |
| Evidence | Inspection / Required Repairs / PM / Alignment resolved. Detailing `required`. Quality Check `not_evaluated`. No open WO. |
| Observed / derived phase | `needs_evaluation` (any unevaluated short-circuits) |
| Operator would claim | Detailing |
| Evidence gap | Contract wording would allow Detailing. Code hides it. Looks stuck. |
| Persistence? | **No — derivation/UI.** Evaluate remaining types in priority order, or treat “no requirement evaluated” as the only Needs-evaluation rule. |
| Source owner | **Code vs contract.** Engineering mismatch; product should confirm which rule is intended. |

### Case 4 — Detailing and Quality Check both required

| | |
| --- | --- |
| Evidence | Earlier stages resolved. Detailing `required`. Quality Check `required`. No open WO. |
| Observed / derived phase | `detailing` (QC is a blocker but not the column) |
| Operator would claim | Detailing, unless the yard started QC in parallel |
| Evidence gap | Board cannot show concurrent or out-of-order QC while Detailing is still `required`. |
| Persistence? | **Only if product wants an independent claim.** Otherwise keep first-unresolved-required and teach the board as “next gate.” |
| Source owner | **Product.** Master PRD says the sequence is not rigid; derivation is rigid. |

### Case 5 — Detailing completed, Quality Check required

| | |
| --- | --- |
| Evidence | Detailing `completed` (no WO). Quality Check `required`. Earlier stages resolved. No open WO. |
| Observed / derived phase | `quality_check` |
| Operator would claim | Quality Check |
| Evidence gap | None for a checklist-faithful operator. No Job/category proof that Detailing happened — by design. Activity Log + `evaluatedBy`/`evaluatedAt` already audit the manual mark. |
| Persistence? | **No — process.** A `YardPhaseEvent` would duplicate the requirement update. |
| Source owner | Product already accepted manual Detailing/QC in Phase 1. |

### Case 6 — All six resolved, Mark Ready not pressed

| | |
| --- | --- |
| Evidence | Every outcome `completed`, `waived`, or `not_required`. Status still `under_review`. No open WO. |
| Observed / derived phase | `needs_evaluation` (fallthrough) |
| Operator would claim | Quality Check done / waiting for Ready approval |
| Evidence gap | The board returns the Truck to the first column after the last gate is cleared. Mark Ready is the only path to Ready to Go, but the label says the review has not started. |
| Persistence? | **No — derivation/UI.** Add a pending-approval presentation (copy or a derived value such as “awaiting Ready approval”) without a new table. |
| Source owner | **Code.** Contract never named this fallthrough. |

### Case 7 — Explicit Ready to Go

| | |
| --- | --- |
| Evidence | Same as Case 6, plus `mark-ready` succeeded. |
| Observed / derived phase | `ready_to_go` |
| Operator would claim | Ready to Go (maintenance approval only; not departed) |
| Evidence gap | Ready is already an auditable event (`readyAt`, `approvedById`, `READINESS_APPROVED`). Presence remains `UNKNOWN`. |
| Persistence? | **No.** Do not add a second Ready event model. |
| Source owner | Aligned. |

### Case 8 — Requirement change invalidates Ready

| | |
| --- | --- |
| Evidence | Was `ready`. Operator changes any requirement (including a still-resolved waiver rewrite). Status → `under_review`; `readyAt` cleared. |
| Observed / derived phase | If all still resolved: Case 6 (`needs_evaluation`). If one becomes `required`: that stage. If one becomes `not_evaluated`: Case 3. |
| Operator would claim | “Was Ready; approval withdrawn” or still Ready if they only edited a reason |
| Evidence gap | Invalidation is audited (`READINESS_APPROVAL_INVALIDATED`), but the board does not say “approval withdrawn.” Fallthrough looks like a new, empty review. |
| Persistence? | **No — derivation/UI.** Keep invalidation; show previous Ready + reason, or first unresolved requirement. A phase event would still need the same invalidation rules. |
| Source owner | Code (label) + product (whether editing a waiver should withdraw Ready). |

### Case 9 — New Work Order after Ready

| | |
| --- | --- |
| Evidence | Create-WO links the new WO and invalidates Ready in the same transaction. |
| Observed / derived phase | `required_work` + open-WO blocker |
| Operator would claim | Back in Required Work (correct) or “still Ready, extra job appeared” |
| Evidence gap | None if new work should withdraw Ready. This is already the persisted approval event being undone, not a missing phase event. |
| Persistence? | **No.** |
| Source owner | Product (Phase 1 rule) aligned with create-WO code. |

### Case 10 — Reopen Work Order after Ready

| | |
| --- | --- |
| Evidence | Assessment remains `ready`. Linked WO is open again. Reopen does **not** write `READINESS_APPROVAL_INVALIDATED`. |
| Observed / derived phase | `required_work` + `open_work_order` + `approval_conflict` |
| Operator would claim | Required Work; Ready should be withdrawn |
| Evidence gap | Displayed phase and Ready status diverge. Contract said linking/creating an open WO invalidates approval. Reopen was missed. |
| Persistence? | **No — derivation/mutation fix.** Invalidate on reopen the same way as create. |
| Source owner | **Code.** |

### Case 11 — Close a Ready assessment

| | |
| --- | --- |
| Evidence | Close with reason. Assessment `closed` and dropped from the active read. |
| Observed / derived phase | `needs_evaluation` |
| Operator would claim | Still Ready to Go until the Truck leaves, or Off Duty / returned |
| Evidence gap | No presence/departure source (V3). Close is documented as “not departed.” The board nevertheless loses Ready. |
| Persistence? | **Not yet.** A phase event could remember “last Ready,” but so could reading the latest closed `ready` assessment. V3 presence is the real missing signal. |
| Source owner | **Product** (what Close means on the board) + V3. |

### Case 12 — Detailing/QC while a linked WO is still open

| | |
| --- | --- |
| Evidence | Detailing `required` or even `completed`. Linked WO `in_progress` or `waiting_paused`. |
| Observed / derived phase | `required_work` |
| Operator would claim | Detailing already started on the yard while paper/shop work is open |
| Evidence gap | Required Work always wins. Parallel yard work is invisible as a phase. |
| Persistence? | **Only if product wants an independent claim** that may coexist with an open WO. That would break the Phase 1 rule “Ready to Go must never show while an open WO remains linked” if abused; a persisted phase must still enforce that Ready rule. |
| Source owner | **Product.** |

---

## 5. Candidate gaps — owner, audit, migration

| ID | Gap | Source owner | Audit needs before implementation | If persistence is later approved — migration |
| --- | --- | --- | --- | --- |
| G1 | Any unevaluated requirement forces Needs evaluation | Code vs contract | Cristian: contract wording vs current short-circuit | None for a derivation fix. If persisting later, backfill current derived phase only as a labeled reconstruction, never as an observed event. |
| G2 | All-resolved + `under_review` fallthrough → Needs evaluation | Code | Confirm pending-approval label | Same: derivation/copy first. Persistence must not write a historical “Needs evaluation” for these rows. |
| G3 | Rigid first-`required` order vs PRD “not a rigid machine” | Product | Pilot: do Detailing and QC overlap? | Additive `YardPhaseEvent` (truckId, phase, occurredAt, actorId, reason, assessmentId, previousPhase). Do **not** reuse `WorkOrder.status` or `JobCategory`. Do **not** drop requirement rows. Dual-write: requirements remain source for Ready rules; events are the claim. Backfill = reconstructed + `provenance=derived_backfill`. |
| G4 | Open WO always hides Detailing/QC | Product | Pilot: is parallel yard work real? | If yes, events may record Detailing while WO is open, but Mark Ready must still refuse open WOs. |
| G5 | Reopen does not invalidate Ready | Code | None — defect vs existing contract | Mutation + Activity Log only. No new table. |
| G6 | Close removes Ready from the board | Product + V3 | What should Close mean before presence exists? | Prefer keeping last closed Ready as a **derived** residual. Persist only if Close must be a phase transition with its own actor/time independent of assessment close. |
| G7 | No time-in-phase | Product (board aging) | Is assessment age enough for the pilot? | If only aging is needed: use `evaluatedAt` of the requirement that currently drives the phase, or `readyAt`. `YardPhaseEvent.occurredAt` only if operators move phase without touching requirements. |
| G8 | Detailing/QC have no Job evidence | Product / Phase 1 (accepted) | Pilot: is the manual mark enough, or is a Detailing/QC category required? | Category/Job work is a catalog decision, not `YardPhaseEvent`. Do not invent categories in V2.1-001. |
| G9 | Mechanic cannot set global phase | Product (locked TARGET) | None | If events are added, writes stay on `yard.operations.manage` (or a later yard capability). Mechanics remain execution-only. |

Prisma remains the only migration authority. Any later event table is
additive, backward compatible, and must keep historical assessments,
requirements, Activity Log, and Work Order links readable.

---

## 6. Why `YardPhaseEvent` is not justified yet

Master PRD §40: prefer derived state when reliable; persist when a real
operational event cannot be represented otherwise. The example given is
Detailing / Quality Check not being inferable from mechanical Jobs.

Phase 1 already persists those as **manual requirement outcomes** with actor,
time, waiver, and Activity Log. Ready to Go is already an explicit approval
event. Invalidation is already an explicit event.

What is missing is not an event log. It is:

1. A derivation fallthrough and an unevaluated short-circuit that mislabel
   the board (G1, G2, G5).
2. A product decision on whether the board means “next unresolved gate” or
   “operator-claimed stage” (G3, G4, G6).
3. Live Operational Yard confirmation that operators actually move Trucks
   without updating the six requirements.

A second model now would dual-write the same checklist, invite drift
(requirement says Detailing `required`, event says Quality Check), and force
a backfill that cannot be honest about historical “observed” phases.

---

## 7. Recommendation (go / no-go)

| Option | Decision |
| --- | --- |
| Persist `YardPhaseEvent` now | **No-go** |
| Do not persist yet | **Go** |
| Narrow derivation + UI copy only | **Justified as a later small task**, after §8 answers. Not started here. |

Confidence: **high** for the no-go on persistence. **Medium** that the
derivation follow-on labels (pending approval, first unresolved even when
another type is unevaluated) will match the yard without further product
tweaks.

What a live Operational Yard pilot **must** still confirm:

1. Do yard users update the six requirements as they work, or do they expect
   to move a Truck on a board without touching the checklist?
2. Do Detailing and Quality Check ever run concurrently, or out of order,
   while an earlier requirement is still `required`?
3. After Mark Ready, is the Truck left in Ready to Go until dispatch, closed,
   or marked Returned to Service?
4. Is “Needs evaluation” after all checks are green (Case 6) confusing in
   Spanish and English?
5. Is assessment age enough, or do they need age-in-phase for the board?
6. When a new or reopened WO appears on a Ready Truck, is Required Work the
   expected column?

Pilot records must be real Shop assessments, labeled as such. Fixture
`Y-101`–`Y-108` rows are not evidence.

---

## 8. Questions Cristian must answer before any follow-on implementation

1. **Meaning of the board column.** Is displayed Yard Phase “the next
   unresolved readiness gate” (current intent) or “the operator-claimed
   operational stage of the Truck”?
2. **Pending approval.** When all six requirements are resolved and Mark
   Ready has not been pressed, what should the board show?
3. **Unevaluated vs first required.** If Quality Check is still
   `not_evaluated` but Detailing is `required`, should the Truck sit in
   Needs evaluation (current code) or Detailing (contract wording)?
4. **Open work vs later stages.** May a Truck appear in Detailing or Quality
   Check while a linked Work Order is open?
5. **Close after Ready.** Until V3 presence exists, should Close drop the
   Truck to Needs evaluation, keep a residual Ready, or require a different
   action?
6. **Waiver edits.** Should changing a waiver reason withdraw Ready, or only
   changing an outcome to unresolved / opening work?
7. **Follow-on scope.** If Q1 is “next gate,” authorize a **derivation + copy**
   task only. If Q1 is “operator-claimed stage,” authorize a **new**
   persistence-design task (still no silent schema). Do not mix them.

**Answered 2026-09-12.** Implemented as derived state + UI/copy. Do not
add `YardPhaseEvent` unless a later live pilot proves a claimed-stage
model is required.

---

## 9. Acceptance

| Criterion | Result |
| --- | --- |
| Concrete cases | 12 derivation cases in §4 (exceeds 6–8) |
| Source owner | §5 table |
| Audit needs | §5 and §7 pilot list |
| Migration requirements if later approved | §5 G3/G4/G6/G7 |
| No `YardPhaseEvent` implementation | Confirmed: docs only |
| Clear go/no-go on persistence | **No-go** (do not persist yet) |
