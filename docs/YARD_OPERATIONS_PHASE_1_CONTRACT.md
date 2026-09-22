# Yard Operations Phase 1 contract

Status: **CURRENT** on `main` as of 2026-09-09. The assessment aggregate,
requirements, Work Order linkage, Admin routes/UI, authorization, optimistic
concurrency, idempotency, and Activity Log behavior described here are
implemented. Presence and external movement integrations remain unavailable as
stated below.

This document is the implementation contract for the first Yard Operations
slice. It extends the existing Admin read-only operations without changing the
mechanic Work Order semantics. The current checkout is the source of truth:
`Truck` has identity and vehicle data, `WorkOrder` has category/status/priority,
and Admin already exposes the dashboard, global Work Order list, Work Order
detail, and completed repair history.

The screenshots and the separate Shop prototype are product references only.
They do not establish data availability, visual tokens, or domain rules. New
Admin UI must use the existing LTL Shop shadcn-style components and bilingual
message catalogs.

## Phase 1 boundaries

- Presence is an explicit `UNKNOWN` value. Phase 1 has no Samsara, telematics,
  gate, dispatch, or yard-check-in source and must not claim that a Truck is
  physically in the yard.
- Work location, Incoming Trucks, and Upcoming Departures on
  `GET /api/admin/yard-operations` stay `unavailable`
  (`reason: integration_not_connected`). That list does not read
  agent-reporting. Live `yard_location`, expected returns, and planned outs
  are exposed only on `GET /api/admin/yard/data-boundary` when the API has
  `AGENT_REPORTING_KEY`, and they are not Yard Presence. Schedule_Teams is
  not unioned. See `docs/YARD_DATA_BOUNDARY.md`.
- A Work Order being open means work is recorded in the Shop system. It is not
  evidence of physical presence, arrival, departure, or readiness.
- Prisma and `apps/api/prisma/migrations` remain the only schema migration
  authority. Do not add a parallel history under `supabase/migrations`.

## Readiness assessment

An assessment is a manually started operational review for one Truck. It is
not a visit, a yard-presence record, or a replacement for a Work Order. Only
one assessment may be active for a Truck at a time.

Assessment lifecycle:

| State | Meaning | Ready to dispatch? |
| --- | --- | --- |
| `UNDER_REVIEW` | Review exists and one or more requirements are not resolved. | No decision yet |
| `READY` | All requirements are resolved, required work is complete, no linked Work Order is open, and an authorized user approved it. | Yes, based on maintenance evidence only |
| `CLOSED` | Review was ended with an audit reason. Closing does not imply departure or presence. | No active assessment |

Every assessment has these six requirements, each beginning as `NOT_EVALUATED`:

- Inspection
- Required Repairs
- PM
- Alignment
- Detailing
- Quality Check

Requirement outcomes are `NOT_EVALUATED`, `REQUIRED`, `NOT_REQUIRED`,
`COMPLETED`, or `WAIVED`. A `WAIVED` outcome requires a non-empty reason and
the approving user. `COMPLETED` requires evidence from a completed linked Work
Order for requirements that are represented by existing categories; Inspection,
Detailing, and Quality Check remain manual until canonical categories are
verified. PM and Alignment use the existing category data where available.

Readiness rules:

1. `READY` requires every requirement to be evaluated.
2. Each `REQUIRED` requirement must become `COMPLETED` or `WAIVED`.
3. No linked Work Order may have an open status (`created`, `in_progress`, or
   `waiting_paused`).
4. Approval is explicit, identifies the real user, and is recorded in
   `ActivityLog`; it is not inferred from a green UI card.
5. A prior approval is invalidated in the same transaction when a requirement
   becomes unresolved, a new blocking Work Order is created, or an authorized
   user reopens work. Editing only a waiver reason is an audited metadata
   change and does not withdraw Ready.
6. Closing an assessment never marks a Truck as departed, returned, or
   physically present.

## Derived operational view

The API may derive a current phase for display; phase is not a second persisted
Work Order status. The board column is the **next unresolved readiness gate**.
`not_required`, `completed`, and `waived` gates are skipped. An open Work Order
is a blocker, not a phase, so a Truck may sit in Detailing or Quality Check
while linked work remains open.

Use the first applicable phase in this order:

1. `Needs evaluation` — no assessment and no residual Ready result.
2. `Inspection` — Inspection is `required` or `not_evaluated`.
3. `Required Work` — Required Repairs is `required` or `not_evaluated`.
4. `PM` — PM is `required` or `not_evaluated`.
5. `Alignment` — Alignment is `required` or `not_evaluated`.
6. `Detailing` — Detailing is `required` or `not_evaluated`.
7. `Quality Check` — Quality Check is `required` or `not_evaluated`.
8. `Ready for Approval` — every required gate is resolved and Mark Ready has
   not been approved, or Ready was withdrawn by new open work.
9. `Ready to Go` — Mark Ready has been approved, or a closed assessment still
   has a valid Ready result (`readyAt`) and no new open work has started.

Blockers are derived and should include only actionable evidence:

- an open linked Work Order, including its status, priority, category, and
  current active pause when present;
- an unresolved required assessment requirement;
- an unevaluated requirement while the assessment is under review;
- a recorded waiver reason or approval conflict when it needs attention.

Do not derive a blocker from an assumed location, a missing telematics value,
or an unverified prototype label. `Ready to Go` must never be shown while an
open Work Order remains on the Truck. Editing only a waiver reason does not
withdraw Ready.

The existing invariant remains unchanged: a Truck can have only one open Work
Order. New readiness logic must reuse `OPEN_WORK_ORDER_STATUSES` and existing
creation conflict handling rather than introducing a second interpretation.

## Authorization and audit

`admin.access` remains the read capability for Admin operations. Additive
readiness mutation work should use a separate `yard.operations.manage`
capability:

- `admin.access`: read Yard Operations, Truck detail, derived phases, blockers,
  Work Orders, and history.
- `yard.operations.manage`: start/close assessments, update requirements,
  waive with reason, and approve Ready.

The new capability must not silently grant mechanic Standard or PM access. Every
mutation must use the authenticated application user, optimistic version
checks, idempotency where the existing API requires it, and an Activity Log
entry with the previous and new values. Read-only users see the same evidence
without mutation controls.

## API and route intent

These are the implemented Phase 1 public contracts. DTOs and validation schemas
live in `packages/shared`.

| Method and route | Purpose | Availability |
| --- | --- | --- |
| `GET /api/admin/yard-operations` | Cursor-paginated Truck rows with search, readiness/phase/WO/priority/mechanic/blocked filters. Work location, Incoming, and Departures remain `unavailable` until FE cutover to data-boundary. | `admin.access` |
| `GET /api/admin/yard/data-boundary` | Server-side agent-reporting proxy for Work location, Incoming Trucks, and Upcoming Departures. HTTP 200 with per-section `ok` / `unavailable` / `error`. Presence is not included. | `admin.access` |
| `GET /api/admin/trucks/:id` | Canonical Truck detail with presence provenance, active assessment, derived phase, blockers, active Work Order, and existing history link/data. | `admin.access` |
| `POST /api/admin/trucks/:id/readiness-assessments` | Start the one active assessment and link the existing open Work Order when present. | `yard.operations.manage` |
| `PATCH /api/admin/readiness-assessments/:id/requirements/:type` | Set a requirement outcome and required waiver/evidence fields. | `yard.operations.manage` |
| `POST /api/admin/readiness-assessments/:id/mark-ready` | Explicitly approve a rule-valid assessment. | `yard.operations.manage` |
| `POST /api/admin/readiness-assessments/:id/close` | Close with an audit reason. | `yard.operations.manage` |

Presence responses must include provenance and use `UNKNOWN` in Phase 1. The
existing `/api/work-orders`, `/api/trucks`, mechanic Standard/PM flows, and
Admin Work Order contracts retain their current semantics.

## Persistence and migration boundary

Phase 1 added the assessment aggregate, requirement records, a nullable
readiness-assessment link on Work Orders, indexes, idempotency records, and
audit event values through additive Prisma migrations. No `Truck`
presence/location fields, departure fields, Samsara IDs, or prototype-only
categories may be added until their source and ownership are approved. Seed
data may exercise assessments locally, but must be labelled as fixtures and
never presented as production evidence.

## Canonical bilingual terminology

Keep these domain terms stable in both locales: **Truck**, **Work Order**,
**Job**, and **Off Duty**. Use complete intent-equivalent copy rather than
translating enum values ad hoc:

| English | Spanish UI wording |
| --- | --- |
| Yard Operations | Operaciones del patio |
| Under review | En revisión |
| Ready to Go | Listo para salir |
| Ready for Approval | Listo para aprobación |
| Needs evaluation | Requiere evaluación |
| Required Work | Trabajo requerido |
| Inspection | Inspección |
| Required Repairs | Reparaciones requeridas |
| Alignment | Alineación |
| Detailing | Detallado |
| Quality Check | Control de calidad |
| Presence unknown | Presencia desconocida |
| Physical presence is not connected | La presencia física aún no está conectada |
| Incoming Trucks unavailable | Llegadas de Trucks no disponibles |
| Upcoming Departures unavailable | Próximas salidas no disponibles |
| Waive requirement | Eximir requisito |
| Waiver reason | Motivo de la exención |

Loading, empty, no-results, permission, validation, confirmation, success,
recoverable-error, and accessibility-announcement states are required in both
catalogs. Spanish copy must not imply that `UNKNOWN` means “not in yard” or
that `Ready to Go` is a confirmed departure.
