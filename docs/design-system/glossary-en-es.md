# Glossary (EN / ES)

**Classification:** CURRENT STATE
**Updated:** 2026-09-29 (LTR-170; retired readiness terms removed)

Domain words stay in English in much of the Admin ES catalog (Work Order,
Truck, Job, Jobs, Incoming Trucks, PM). Mechanic ES copy sometimes uses
*unidad* for Truck. Do not “fix” that in a UI polish pass; keep catalogs
consistent with `YARD_DATA_BOUNDARY_COPY` for Yard Phase 1 cards and with
`apps/web/src/lib/admin-messages.ts` / `apps/web/src/lib/locale-context.tsx`.

| English (UI) | Spanish (CURRENT catalogs) | Meaning |
|---|---|---|
| Shop | Shop | Lightning Shop operations product |
| Shop Admin | Shop Admin / Operaciones del Shop | Manager workspace at `/admin` |
| Standard Mechanic | Mecánico Standard / Mi trabajo asignado | Assigned Standard execution at `/mechanic/standard` |
| PM Mechanic | Mecánico de PM | Preventive-maintenance workspace at `/mechanic/pm` |
| PM / PM service | PM / servicio de PM | Mandatory PM Job inside the truck Work Order; the PM mechanic starts and finishes it |
| Work Order | Work Order (masculine: el Work Order, abierto, pausado) | One open intervention per Truck |
| Job | Job | Unit of work on a Standard Work Order |
| Category | Categoría | Job Catalog grouping (Brakes, PM, …). "Job Catalog" stays English |
| Alias | Alias | Other names a catalog Job is found by (plural stays "Alias") |
| Job Catalog | Job Catalog | Admin catalog (UI read-only; System Admin writes by API) |
| Truck | Truck (Admin, including the nav and page title) / unidad (mechanic ES) | Fleet asset |
| Mechanic | Mecánico | Assigned technician |
| Manager | Manager / Shop Manager | Plans Standard work; `work_orders.manage` |
| Yard Operations | Operaciones del patio | Board of trucks by Work Plan phase at `/admin/yard-operations` |
| Phase | Fase | Derived Work Plan step (not a persisted WO status) |
| Ready to close | Listo para cerrar | Every step resolved; Work Order still open |
| Ready to Go | Ready to Go / Listo para salir | Derived: every step resolved and Work Order completed (D1); lasts until Return to Service |
| Return to Service | Return to Service (ES keeps the English name) | Post-completion truck service event |
| Last reported location | Ubicación reportada | Display-only address (`location` / `locationUpdatedOn`). Not Presence. Never “in yard”. |
| Presence | Presencia | Physical in-yard evidence. CURRENT UI hides this (Phase 1 is always UNKNOWN). Do not rename Presence → Ubicación. |
| Incoming Trucks | Incoming Trucks | Canonical English in ES UI (same as nav). Phase 1 card via `YARD_DATA_BOUNDARY_COPY`. |
| Work location | Ubicación de trabajo | Yard Phase 1 card. Empty: “No work location yet.” / “Aún no hay ubicación de trabajo.” Not Presence. |
| Upcoming Departures | Salidas próximas | Yard Phase 1 card. Empty: “No upcoming departures.” / “No hay salidas próximas.” |
| Blocker | Bloqueo | Mechanic report on one Job; only the Manager resolves (D17) |
| Official pause | Pausa oficial | Manager pause; changes waiting time |
| Reported blocker | Bloqueo reportado | Mechanic report; does not pause the WO |
| Activity Log | Activity Log / Registro de actividad | Append-only audit trail |
| Priority | Prioridad | low / normal / high / critical; PM stays normal |
| Active labor | Mano de obra activa | Timed work sessions |
| Waiting time | Tiempo de espera | Official pause totals only |
| Read only | Solo lectura | Use only when the surface cannot mutate |

## Flujo v3 vocabulary (LTR-152)

Source: `docs/archive/ux/FLUJOS_Y_MEJORAS_2026-09-27.md` §7, consistent with the
glossary approved in LTR-118. Catalog keys live in both `admin-messages.ts` and
`locale-context.tsx`.

| Concept | UI word (EN / ES) | Key | Do not use |
|---|---|---|---|
| Job not started | Pending / Pendiente | `jobStatusPending` | "In Progress" for a Job that has not started |
| Job being worked | In progress / En curso | `jobStatusInProgress` | — |
| Job stopped by a problem | Blocked / Bloqueado (+ reason) | `jobStatusBlocked` | "paused", "waiting" |
| Work Order stopped by the Manager | Paused / Pausado (+ reason) | `woStatusPaused` | "blocked" |
| Arrival check | Inspection / Inspección (the step only) | `inspectionStep` | Inspection as a Work Order "category" |
| Truck ready | Ready to Go | — | — |
| Truck leaves the Shop | Return to Service | — | — |
| Job without an owner | Unassigned / Sin asignar | `jobUnassigned` | "inherits the Work Order team" |

## Work Order is masculine (LTR-170)

Decided 2026-09-29: in Spanish, Work Order is masculine everywhere, matching the
status catalog signed in LTR-23 (Creado, Pausado, Completado, Cancelado). Write
"el Work Order", "un Work Order", "este Work Order", "Nuevo Work Order", "Work
Order abierto / pausado / completado", "Los Work Orders abiertos", and pronouns
"ábrelo", "termínalo". Dashboard metrics that describe Work Orders agree with
it too ("Creados", "Completados hoy"). §7 of FLUJOS_Y_MEJORAS wrote "Pausada";
that is superseded.

## Mandatory step names (LTR-170)

The Truck, the Work Plan and New Work Order name the mandatory steps the same
way: Alineación, Detallado, Control de calidad (EN: Alignment, Detailing,
Quality Check). Catalog Job names stay as stored ("Job Alignment",
"Job Detailing"), because they are data.

Retired wording (removed from the UI): "inherits the Work Order team",
"Mandatory for every yard Truck" (now "Mandatory steps" / "Pasos
obligatorios"), "operational status from recorded service-status events…",
and "Under review" (the readiness filter reads "In the Shop" / "En el Shop").

Keep these terms in aria-labels and EmptyState copy so EN/ES users hear the
same domain objects.
