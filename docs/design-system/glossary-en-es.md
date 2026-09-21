# Glossary (EN / ES)

**Classification:** CURRENT STATE
**Updated:** 2026-09-21

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
| PM / PM service | PM / servicio de PM | Specialized Work Order: create starts work |
| Work Order | Work Order | One open intervention per Truck |
| Job | Job | Unit of work on a Standard Work Order |
| Category | Category / Categoría | Job Catalog grouping (Brakes, PM, …) |
| Job Catalog | Job Catalog | Read-only Admin catalog |
| Truck | Truck (Admin) / unidad (mechanic ES) | Fleet asset |
| Mechanic | Mecánico | Assigned technician |
| Manager | Manager / Shop Manager | Plans Standard work; `work_orders.manage` |
| Yard Operations | Operaciones del patio | Readiness board/list at `/admin/yard-operations` |
| Phase | Fase | Derived readiness column (not a persisted WO status) |
| Readiness | Preparación | Six-requirement assessment |
| Ready to Go | Ready to Go / Listo para salir | Explicit readiness approval |
| Ready for Approval | Listo para aprobación | All requirements resolved; not yet approved |
| Return to Service | Return to Service (ES keeps the English name) | Post-completion truck service event |
| Last reported location | Ubicación reportada | Display-only address (`location` / `locationUpdatedOn`). Not Presence. Never “in yard”. |
| Presence | Presencia | Physical in-yard evidence. CURRENT UI hides this (Phase 1 is always UNKNOWN). Do not rename Presence → Ubicación. |
| Incoming Trucks | Incoming Trucks | Canonical English in ES UI (same as nav). Phase 1 card via `YARD_DATA_BOUNDARY_COPY`. |
| Work location | Ubicación de trabajo | Yard Phase 1 card. Empty: “No work location yet.” / “Aún no hay ubicación de trabajo.” Not Presence. |
| Upcoming Departures | Salidas próximas | Yard Phase 1 card. Empty: “No upcoming departures.” / “No hay salidas próximas.” |
| Blocker | Bloqueo | Mechanic report or readiness gate |
| Official pause | Pausa oficial | Manager pause; changes waiting time |
| Reported blocker | Bloqueo reportado | Mechanic report; does not pause the WO |
| Activity Log | Activity Log / Registro de actividad | Append-only audit trail |
| Priority | Prioridad | low / normal / high / critical; PM stays normal |
| Active labor | Mano de obra activa | Timed work sessions |
| Waiting time | Tiempo de espera | Official pause totals only |
| Read only | Solo lectura | Use only when the surface cannot mutate |

Keep these terms in aria-labels and EmptyState copy so EN/ES users hear the
same domain objects.
