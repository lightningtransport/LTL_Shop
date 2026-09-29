> **ARCHIVADO (2026-09-29).** Documento histórico: no describe el sistema actual y no manda sobre el código. La fuente vigente es [`docs/README.md`](../README.md).

# LTR-34 Slice 1 — Work Plan API proposal

**Status:** awaiting PM + PD ack. Do not merge until ack.  
**Tickets:** [LTR-34](https://linear.app/ltransl/issue/LTR-34) (this) · [LTR-33](https://linear.app/ltransl/issue/LTR-33) (UX) · parent [LTR-32](https://linear.app/ltransl/issue/LTR-32)  
**CURRENT authority:** `docs/YARD_OPERATIONS_PHASE_1_CONTRACT.md` (six gates stay default)  
**TARGET:** Truck → Work Plan (jobs on the one open WO) → Ready **derived/automatic**

---

## Verified CURRENT (hypotheses)

| Hypothesis | Result |
| --- | --- |
| One open WO per Truck | **True.** `OPEN_WORK_ORDER_STATUSES` + create conflict `OPEN_WORK_ORDER_EXISTS`. |
| Job catalog + add-job already exist | **True.** `POST /api/admin/work-orders` (`createByManager`) and `POST /api/admin/work-orders/:id/jobs`. Manager catalog/custom + multi-category. Mechanic Standard create is 403. |
| Truck Detail admin endpoints | **True.** `GET /api/admin/trucks/:id` returns assessment, Phase 1 `phase`/`blockers`, `activeWorkOrder` **summary only** (job counts, not job rows). |
| Ready derivation from V2.1 | **Partial.** Phase 1 `deriveReadiness` is next unresolved **gate**, and Ready still requires **Mark Ready**. Do not extend that function for Slice 1. |
| Caps on Truck Detail | **Read** `admin.access`. **Gates / Mark Ready / close** `yard.operations.manage`. **Create WO / add job** `work_orders.manage`. |

Catalog gap: LTR-24 has job **Alignment** under `Suspension & Steering`, and **no Detailing category/job**. Phase 1 alignment evidence matches category name `alignment` (legacy), which LTR-24 remapped.

PM gap: Managers cannot create PM WOs; PM WOs have no jobs; adding a PM-category job to a Standard WO is rejected. Light path “PM + Alignment + Detailing” **cannot** sit on one Work Plan without a later product/rule change. One open WO means an open PM service blocks Standard Work Plan jobs.

---

## Reuse vs new

**Reuse (do not fork):** create WO, add job, catalog list (`GET /api/catalog/jobs` and admin catalog), truck lock, idempotency, one-open-WO, assessment link on create (`readinessAssessmentId`).

**New thin wrappers** (LTR-33 only):

| Method | Path | Cap | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/admin/trucks/:id/work-plan` | `admin.access` | Jobs of the open WO + derived phase/Ready. Always available. |
| `POST` | `/api/admin/trucks/:id/work-plan/jobs` | `admin.access` + `work_orders.manage` | If no open WO → `createByManager` (links Phase 1 assessment if active). If open Standard WO → `addJobByManager` (needs `expectedVersion`). |
| `POST` | `/api/admin/trucks/:id/work-plan/inspection` | `admin.access` + `yard.operations.manage` | `issues_found` \| `no_issues_found`. Dual-run: start assessment if none, set Inspection `required` / `completed`. |

Phase 1 routes **unchanged** (`updateRequirement`, `mark-ready`, `close`). No Presence. No gate deletion.

Flag `YARD_WORK_PLAN_SLICE1` (default **off**): when on, `GET /api/admin/trucks/:id` also includes `workPlan`. Board `phase` stays six-gate until a later cutover slice.

---

## Dual-run / feature flag

1. **Default = Phase 1.** Yard board and Truck Detail `phase` / `blockers` / `assessment` keep six gates and manual Mark Ready.  
2. **Hooks always on** so LTR-33 can build against `GET/POST …/work-plan`.  
3. Inspection discovery writes the existing Inspection requirement (no new table).  
4. Cutover (later ticket): switch board derivation to Work Plan phases; then delete `updateRequirement` / six gates. Not this PR.

---

## Cristian rules in derivation (Slice 1)

1. **Alignment + Detailing always required** — Ready is impossible until each lane has ≥1 **completed** job (cancelled-only does not count). Alignment lane = catalog job named `Alignment` (or category containing `alignment`). Detailing lane = display/category name containing `detailing` (catalog row does not exist yet; custom job is valid).  
2. **Ready is AUTO** — `readiness: ready` when inspection is resolved, no `to_do` jobs, Alignment complete, Detailing complete. QC is **not** required unless a QC job is on the plan. Mark Ready is **not** the Work Plan path (Phase 1 button remains for dual-run).  
3. **Shop Work is a phase** — `inspection → shop_work → alignment → detailing → quality_check? → ready_to_go`. Repair/PM-adjacent jobs are Shop Work on Truck Detail, not extra board columns. Board still uses Phase 1 columns until cutover.

Job UI map: `to_do` + WO `created` → `pending`; `to_do` + WO `in_progress`/`waiting_paused` → `in_progress`; `completed` / `cancelled` unchanged.

---

## Capability matrix (Truck Detail Work Plan)

| Action | CURRENT cap | Slice 1 |
| --- | --- | --- |
| Read Truck Detail / Work Plan | `admin.access` | same |
| Inspection No issues / Issues found | n/a (was gate dropdown) | `yard.operations.manage` |
| Add work / create open WO | `work_orders.manage` | same (wrapper) |
| Mark Ready (Phase 1) | `yard.operations.manage` | **unchanged**; not Work Plan UX |
| Update six gates | `yard.operations.manage` | **unchanged**; not Work Plan UX |

Seeded Admin has both mutate caps. A user with only `work_orders.manage` can add jobs; only `yard.operations.manage` can record inspection.

---

## Hooks for LTR-33 (shapes)

`GET /api/admin/trucks/:id/work-plan` → `TruckWorkPlanDto`:

```json
{
  "sliceEnabled": false,
  "inspection": { "outcome": "not_started" },
  "workOrder": { "id": "uuid", "displayId": "WO-1", "status": "created", "version": 3, "primaryCategoryName": "Air & Brake System" },
  "jobs": [{
    "id": "uuid", "catalogJobId": "uuid|null", "displayName": "Brake Inspection",
    "customDescription": null, "category": { "id": "uuid", "name": "Air & Brake System" },
    "status": "to_do", "uiStatus": "pending", "lane": "shop_work"
  }],
  "remainingJobCount": 1,
  "readiness": "not_ready",
  "readyReason": "jobs_remaining",
  "phase": "shop_work",
  "mandatory": {
    "alignment": { "required": true, "status": "pending", "jobCount": 0, "remainingCount": 0 },
    "detailing": { "required": true, "status": "pending", "jobCount": 0, "remainingCount": 0 },
    "qualityCheck": { "required": false, "status": "not_applicable", "jobCount": 0, "remainingCount": 0 }
  },
  "capabilities": { "canRead": true, "canAddWork": true, "canRecordInspection": true },
  "phase1": { "assessmentId": "uuid|null", "gatesRemainDefault": true }
}
```

`workOrder` is `null` when none is open. `readyReason`: `inspection_pending` | `jobs_remaining` | `alignment_pending` | `detailing_pending` | `qc_pending` | `plan_complete`.

`POST …/work-plan/inspection` `{ "outcome": "issues_found"|"no_issues_found", "idempotencyKey": "uuid" }` → same DTO.

`POST …/work-plan/jobs`:

```json
{
  "idempotencyKey": "uuid",
  "expectedVersion": 3,
  "jobs": [{ "catalogJobId": "uuid", "categoryId": "uuid", "displayName": "Brake Inspection", "customDescription": "optional" }]
}
```

`expectedVersion` required only when an open WO already exists (409 `VERSION_CONFLICT` / `WORK_ORDER_VERSION_REQUIRED` with current `version`). First create omits it. Catalog + custom reuse New WO job objects. Response = Work Plan DTO (includes new `version`).

FE still uses existing `GET /api/catalog/categories` + `GET /api/catalog/jobs?categoryId=&q=` for the picker.

---

## Risks / open questions (need PM+PD)

1. **Heavy-repair auto-Ready** — Slice 1 auto-Ready has no extra confirm. Confirm-once for heavy work?  
2. **QC always required?** — Slice 1: only if a QC job exists. Cristian listed QC as optional/open.  
3. **Detailing catalog** — no LTR-24 row; FE must add a custom Detailing job (or Ops seeds one) or Ready never fires.  
4. **PM on the Work Plan** — blocked by CURRENT PM rules + one-open-WO. Sequence PM WO then Standard, or allow PM jobs on Standard?  
5. **Board cutover** — Shop Work phase is on the Work Plan DTO only. Kanban still shows Required Work / PM until a later slice.  
6. **Open PM WO** — Add work returns 400 until that PM service is completed/cancelled.

**Ack needed before merge.**
