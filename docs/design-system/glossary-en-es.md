# Glossary (EN / ES)

**Classification:** CURRENT STATE
**Updated:** 2026-10-23 (D57 / LTR-304: areas, one truck at a time, the shop queue); before 2026-10-21 (LTR-273: menu names, Samsara place words D49–D52, Dispatch and Full screen); before 2026-09-29 (LTR-170; retired readiness terms removed)

Domain words stay in English in much of the Admin ES catalog (Work Order,
Truck, Job, Jobs, Incoming Trucks, PM). Mechanic ES copy sometimes uses
*unidad* for Truck. Do not “fix” that in a UI polish pass; keep catalogs
consistent with `YARD_DATA_BOUNDARY_COPY` for Yard Phase 1 cards and with
`apps/web/src/lib/admin-messages.ts` / `apps/web/src/lib/locale-context.tsx`.
API error codes have one EN/ES sentence each in `apps/web/src/lib/api-error-copy.ts`
(exposed as `apiError` by both catalogs and read by `apiErrorMessage()`, LTR-181).

| English (UI) | Spanish (CURRENT catalogs) | Meaning |
|---|---|---|
| Shop | Shop | Lightning Shop operations product |
| Shop Admin | Shop Admin / Operaciones del Shop | Manager workspace at `/admin` |
| Standard Mechanic | Mecánico Standard / Mi trabajo asignado | Assigned Standard execution at `/mechanic/standard` |
| PM Mechanic | Mecánico de PM | Preventive-maintenance workspace at `/mechanic/pm` |
| PM / PM service | PM / servicio de PM | Mandatory PM Job inside the truck Work Order; the PM mechanic starts and finishes it |
| Work Order | Work Order (masculine: el Work Order, abierto, pausado) | One open intervention per Truck |
| Job | Job | Unit of work on a Standard Work Order |
| Category | Categoría | Grouping in Setup → Jobs (Brakes, PM, …) |
| Alias | Alias | Other names a catalog Job is found by (plural stays "Alias") |
| Jobs (menu; page title "Jobs catalog") | Jobs | The Job catalog in Setup (`/admin/catalog`); was "Job Catalog" until LTR-248 |
| People | Personas | Setup → People (`/admin/mechanics`): mechanics, Safety, Managers and System Admins (D48) |
| Shop rates | Tarifas del taller | Setup → hourly labor rate and PM oil change price (`/admin/parts/labor-rate`); was "Labor rate" |
| Dashboard | Panel | `/admin`, the "Needs you" queue |
| Truck | Truck (Admin, including the nav and page title) / unidad (mechanic ES) | Fleet asset |
| Mechanic | Mecánico | Assigned technician |
| Manager | Manager / Shop Manager | Plans Standard work; `work_orders.manage` |
| Yard Operations | Patio | `/admin/yard-operations`. Tabs: **Shop** / Taller (the board by phase) and **Dispatch** / Dispatch (plan the week, D51); **Full screen** / Pantalla completa opens the board for the TV (D53) |
| Area (Shop areas · any order) | Área (Áreas del taller · en cualquier orden) | D57: PM, Alignment, Shop Work and Detailing, between the inspection and the QC, with no order between them. A Job's area (`area`) can differ from its step (`lane`): Tires and Flat Repair are Alignment's |
| Waiting for a mechanic | Esperando mecánico | D57 §3: Yard column and phase (`waiting_for_mechanic`) — work is left in the shop areas and nobody has the truck |
| {name} is here · {name} · {Job} | {name} lo tiene · {name} · {Job} | D57 §3: who has the truck now, on the Work Plan area and the Yard card |
| With {name} · {Job} · wait / Start when the truck is free | Con {name} · {Job} · espera / Empieza cuando se libere | D57 §3: the mechanic's card when another mechanic has the truck (`TRUCK_BUSY`) |
| Available in the shop | Disponibles en el taller | D57 §5: the shop queue on the mechanic's home — repairs nobody took yet; any Standard mechanic takes one |
| Shop queue (any mechanic) | Cola del taller (cualquier mecánico) | D57 §5: the inspection sheet's default owner for a repair; "Assign later" keeps it out of the queue |
| In yard | En la yard | Samsara sees the truck inside one of our yard geofences (D49), with "since {time}" |
| In shop | En el shop | In yard **and** with an open Work Order (D49) |
| In yard without a Work Order | En la yard sin Work Order | Shop board counter and Trucks filter (D51) |
| Arrived · Needs a Work Order | Llegó · Necesita Work Order | Dashboard group and Dispatch row: in yard, no WO; action **Create WO** / Crear WO (D51, LTR-261) |
| Arrived / Left | Llegó / Salió | Dispatch rows by Samsara (D50) |
| Not ready · N Jobs left | No está listo · N Jobs pendientes | Dispatch Departures: leaves soon with work left (D51) |
| Left the yard · Confirm Return to Service | Salió de la yard · Confirma Return to Service | Ready to Go truck Samsara sees outside the yard; the app asks, never does it alone (D52) |
| Add from Samsara | Agregar desde Samsara | Create and connect a truck Dispatch names but the app lacks (D50) |
| Phase | Fase | Derived Work Plan step (not a persisted WO status) |
| Ready to close | Listo para cerrar | Every step resolved; Work Order still open |
| Ready to Go | Ready to Go / Listo para salir | Derived: every step resolved and Work Order completed (D1); lasts until Return to Service |
| Return to Service | Return to Service (ES keeps the English name) | Post-completion truck service event |
| Last reported location | Ubicación reportada | Display-only address typed in Dispatch (`location` / `locationUpdatedOn`). It never decides "In yard": only Samsara geofences do (D49) |
| Presence | Presencia | Physical in-yard evidence. Since D49 it comes from Samsara geofences and shows as In yard / In shop; without Samsara, nothing is shown (never invented). Do not rename Presence → Ubicación. |
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
| On this device | En este dispositivo | Where an unsent draft waits (notes, PM entry, inspection). Never "this phone": mechanics use a phone or a tablet (LTR-275) |

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

## Tire states on the Truck (D57 / AP-4, LTR-303)

The Tires card, the inspection sheet and the Job row use the same three states.

| State | EN | ES | Notes |
|---|---|---|---|
| In range | OK | OK | Green, Check icon |
| To watch | Watch (no Job) | Vigilar (sin Job) | Amber, Eye icon; no Job is created |
| Makes a Job | Fix (creates a Job) · group "Job" | Arreglar (crea un Job) · grupo "Job" | Red, OctagonAlert icon |
| Reason: tread | `LF · tread 3/32 (min 4) · worn` | `LF · tread 3/32 (mín. 4) · gastada` | Tread at or under the minimum |
| Reason: pressure | `RRI · 158 PSI (should be 95) · high pressure` | `RRI · 158 PSI (debe ser 95) · presión alta` | `low` / `baja` when under |
| Count | `7/10 OK` | `7/10 OK` | The readings there are, not a fixed 10 |
