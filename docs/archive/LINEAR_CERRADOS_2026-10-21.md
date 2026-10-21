> **ARCHIVADO** — respaldo de Linear, no se edita. Lo vigente está en `../PRD.md`, `../SYSTEM.md`, `../DECISIONS.md` y Linear.

# Linear LTR: issues cerrados (respaldo 2026-10-21)

Copia de los 257 issues cerrados (Done, Canceled, Duplicate) del equipo LTR, tomada el 2026-10-21 antes de borrarlos de Linear para bajar del límite de 250 del plan gratis. Cada uno trae su título, estado, proyecto, etiquetas, fechas, adjuntos (PR) y la descripción completa. Las imágenes quedan como `[imagen]`.

Los enlaces `linear.app/...` dejan de abrir cuando el issue se borra para siempre (30 días después). Las referencias `LTR-n` en `docs/` y en los PR se buscan aquí.

## Índice

| Issue | Estado | Proyecto | Título |
|---|---|---|---|
| [LTR-1](#ltr-1) | Canceled | — | Get familiar with Linear |
| [LTR-2](#ltr-2) | Canceled | — | Connect your tools |
| [LTR-3](#ltr-3) | Canceled | — | Import your data |
| [LTR-4](#ltr-4) | Canceled | — | Set up your teams |
| [LTR-5](#ltr-5) | Done | Trucks & Inspección | [PR #84] Protect Truck Samsara/VIN columns (Prisma) |
| [LTR-6](#ltr-6) | Done | Plataforma y Go-live | [PR #83] UI audit fixes + design-system docs |
| [LTR-7](#ltr-7) | Done | Trucks & Inspección | [PR #82] Truck identity / miles / owners audit |
| [LTR-8](#ltr-8) | Done | Yard | [PR #81] V2.1-001 Yard Phase persistence gap |
| [LTR-9](#ltr-9) | Done | Setup, People & Permisos | [PR #79] V2-001 Ownership cutover contract |
| [LTR-10](#ltr-10) | Done | Setup, People & Permisos | [PR #80] V2-002 Ownership TARGET cutover |
| [LTR-11](#ltr-11) | Done | Work Orders & Jobs | Pilot: Work Plan / Ready derived (post Slice 1) |
| [LTR-12](#ltr-12) | Done | Plataforma y Go-live | Ops: Q14 roster grants (post ownership cutover) |
| [LTR-13](#ltr-13) | Done | Yard | UI: ocultar Yard Presence; solo ubicación reportada |
| [LTR-14](#ltr-14) | Done | Plataforma y Go-live | API: fix 3 load errors (Yard Ops / Mechanics Admin / PM service) |
| [LTR-15](#ltr-15) | Done | Plataforma y Go-live | UI audit follow-up: chips ES, CTAs vs caps, shadcn/density |
| [LTR-16](#ltr-16) | Done | Plataforma y Go-live | UI: Admin nav mobile usable (no grid 2 cols) |
| [LTR-17](#ltr-17) | Done | Trucks & Inspección | Fix: truck search ranking (exact/prefix unit first) |
| [LTR-18](#ltr-18) | Done | Work Orders & Jobs | Fix: Admin Work Orders search/filter (query 9) |
| [LTR-19](#ltr-19) | Done | Plataforma y Go-live | Perf: PWA iOS home screen hang + web carga lenta |
| [LTR-20](#ltr-20) | Done | Work Orders & Jobs | UI: densificar filtros WO (mobile collapse + desktop compact) |
| [LTR-21](#ltr-21) | Done | Work Orders & Jobs | Product: jobs asociados por categoría en New WO |
| [LTR-22](#ltr-22) | Done | Yard | UI: Dashboard Admin densificar cards (sin sync/source por card) |
| [LTR-23](#ltr-23) | Done | Plataforma y Go-live | UI: consistency pass (badges, buttons, inputs, cards, empties) |
| [LTR-24](#ltr-24) | Done | Setup, People & Permisos | Ops: seed catálogo categorías/jobs (tabla Cristian) |
| [LTR-25](#ltr-25) | Canceled | Setup, People & Permisos | Ops/Data: seed Job Catalog TARGET (15 categorías Cristian) |
| [LTR-26](#ltr-26) | Done | Yard | UI: densificar Yard Kanban / filters |
| [LTR-27](#ltr-27) | Done | Trucks & Inspección | UI: Truck Information VIN no overlap mobile |
| [LTR-28](#ltr-28) | Duplicate | Plataforma y Go-live | UI: iOS PWA safe-area — top nav bajo Dynamic Island |
| [LTR-29](#ltr-29) | Canceled | Plataforma y Go-live | P0: PWA iOS safe-area — top nav bajo Dynamic Island |
| [LTR-30](#ltr-30) | Done | Plataforma y Go-live | UI: PWA iOS standalone safe-area header (Dynamic Island) |
| [LTR-31](#ltr-31) | Done | Yard | UX: clarity journey Readiness Admin (Required → next step) |
| [LTR-32](#ltr-32) | Done | Work Orders & Jobs | Epic: Truck Work Plan / Ready derived (Yard) |
| [LTR-33](#ltr-33) | Done | Trucks & Inspección | Slice 1 UX: Inspection → Add work → Work Plan (Truck Detail) |
| [LTR-34](#ltr-34) | Done | Trucks & Inspección | Slice 1 API: Work Plan from Truck Detail (feasibility + hooks) |
| [LTR-35](#ltr-35) | Done | Setup, People & Permisos | Ops: seed Detailing catalog job (Work Plan mandatory) |
| [LTR-36](#ltr-36) | Done | Plataforma y Go-live | Fix: Admin first-load Unable to load (WO list + Truck Yard) |
| [LTR-37](#ltr-37) | Done | Yard | UI: Yard/Work Plan polish (truncate, ES, ymm dup, empties) |
| [LTR-38](#ltr-38) | Done | Work Orders & Jobs | Admin: Complete / mark-done control on Work Plan jobs |
| [LTR-39](#ltr-39) | Done | Yard | Slice 2 API: Yard board / list phase from Work Plan (gate cutover) |
| [LTR-40](#ltr-40) | Done | Yard | Slice 2 UI: Cutover Admin Yard + Truck Detail off six-gate checklist |
| [LTR-41](#ltr-41) | Done | Work Orders & Jobs | Slice 3: QC catalog + Ready polish on Work Plan |
| [LTR-42](#ltr-42) | Canceled | Work Orders & Jobs | BLOCKER: WO create missing from Manager list + finish notes + no refresh |
| [LTR-43](#ltr-43) | Done | Work Orders & Jobs | Fix: WO creada no visible en Manager list + comentario mechanic finish + UI stale |
| [LTR-44](#ltr-44) | Done | Work Orders & Jobs | UX: feedback visible after create WO / finish (no silent no-op) |
| [LTR-47](#ltr-47) | Done | Plataforma y Go-live | Producto: lanzar Shop sin Ninox en vivo |
| [LTR-48](#ltr-48) | Done | Plataforma y Go-live | Producto: quién da de alta un camión nuevo |
| [LTR-49](#ltr-49) | Done | Plataforma y Go-live | Producto: flags Work Plan encendidos en producción |
| [LTR-50](#ltr-50) | Done | Plataforma y Go-live | Producto: lanzar sin mutación Off Duty |
| [LTR-51](#ltr-51) | Done | Plataforma y Go-live | Ops: smoke producción del Flujo v3 con cuentas de prueba (Manager + mecánicos) |
| [LTR-53](#ltr-53) | Done | Plataforma y Go-live | Ops: Auth bypass off + env Vercel de producción |
| [LTR-55](#ltr-55) | Done | Trucks & Inspección | "In shop" desde el geofence de Samsara (D49) |
| [LTR-57](#ltr-57) | Done | Setup, People & Permisos | Bandeja para revisar los Custom Jobs (unir, agregar al catálogo o dejar como único) |
| [LTR-58](#ltr-58) | Duplicate | Setup, People & Permisos | Diferido: UI general de permisos / capabilities |
| [LTR-59](#ltr-59) | Done | Trucks & Inspección | V2.1: validar Truck Detail canónico (overview / work / history) |
| [LTR-60](#ltr-60) | Done | Work Orders & Jobs | V2.1: validar Ready to Go vs Complete vs Returned to Service |
| [LTR-61](#ltr-61) | Done | Mecánicos | Home mecánico: Iniciar trabajo / Start Work debe iniciar labor (Ready to Start) |
| [LTR-62](#ltr-62) | Done | Yard | Admin: click Work Orders en Dashboard a veces no navega al primer intento |
| [LTR-63](#ltr-63) | Done | Plataforma y Go-live | Nav Admin bilingüe: alinear Dashboard / Work Orders con catálogo ES |
| [LTR-64](#ltr-64) | Done | Plataforma y Go-live | Login: flash de locale EN→ES al hidratar (cookie ltl_shop_locale) |
| [LTR-65](#ltr-65) | Done | Work Orders & Jobs | Detalle Admin WO: sticky next action para Confirm completion / Complete WO |
| [LTR-66](#ltr-66) | Done | Mecánicos | Home PM: empty de pausados aún dice Jobs (alinear con pmPausedTitle) |
| [LTR-67](#ltr-67) | Done | Work Orders & Jobs | QA: e2e Work Plan + pausa oficial vs blocker + reopen (sin rewrite) |
| [LTR-68](#ltr-68) | Done | Plataforma y Go-live | Copy EN residual: pause Other / Unable to save notes (detail-client, pm-service-card) |
| [LTR-69](#ltr-69) | Done | Work Orders & Jobs | Admin: official pause 400 shows assignment copy when Jobs n/n |
| [LTR-70](#ltr-70) | Done | Yard | API: proxy Yard data boundary → agent-reporting (Incoming/Upcoming/Work location) |
| [LTR-71](#ltr-71) | Done | Plataforma y Go-live | UI: destacar Truck # sobre Work Order # en cards y listas |
| [LTR-72](#ltr-72) | Done | Plataforma y Go-live | Docs: alinear CURRENT a Work Plan live (00/01/03/11/12) |
| [LTR-74](#ltr-74) | Done | Yard | FE: cutover Yard Movement cards a data-boundary (LTR-70) |
| [LTR-75](#ltr-75) | Done | Yard | API: Readiness board inclusion — solo engagement patio (opción A) |
| [LTR-76](#ltr-76) | Done | Plataforma y Go-live | UI: AdminShell header/aside — layout full viewport |
| [LTR-77](#ltr-77) | Done | Setup, People & Permisos | Admin: catalog write — add jobs (System Admin only) |
| [LTR-78](#ltr-78) | Done | Setup, People & Permisos | Admin: roster mecánicos write (System Admin only) |
| [LTR-79](#ltr-79) | Duplicate | Work Orders & Jobs | Bug: completion note de job desaparece tras save/reload |
| [LTR-80](#ltr-80) | Duplicate | Work Orders & Jobs | UX: deshabilitar Pause en WO Created |
| [LTR-81](#ltr-81) | Duplicate | Plataforma y Go-live | UX: no forzar Update password sheet tras login |
| [LTR-82](#ltr-82) | Duplicate | Yard | UX: Yard Work location — no flash UNAVAILABLE al cargar |
| [LTR-83](#ltr-83) | Done | Plataforma y Go-live | UI: MPM — no reabrir Update password sheet si ya no es obligatorio |
| [LTR-84](#ltr-84) | Done | Yard | UI: Yard boundary — skeleton/loading sin flash Data unavailable |
| [LTR-85](#ltr-85) | Done | Work Orders & Jobs | UI: Pause disabled until WO In Progress (no pause on Created) |
| [LTR-86](#ltr-86) | Done | Work Orders & Jobs | Fix: completion note del job desaparece tras save Notes / reload |
| [LTR-87](#ltr-87) | Done | Work Orders & Jobs | Product: validar Ready for Approval / Ready to Go con Blocked + Pending gates |
| [LTR-88](#ltr-88) | Done | Work Orders & Jobs | UI: Work Plan Alignment/Detailing como badges |
| [LTR-89](#ltr-89) | Done | Work Orders & Jobs | Work Plan: jobs de Inspection se clasifican como Shop Work (salta fase Inspection) |
| [LTR-90](#ltr-90) | Done | Work Orders & Jobs | Work Plan: Ready to Go con WO aún In Progress y blocker activo |
| [LTR-91](#ltr-91) | Done | Yard | Work Plan: WO de PM aparecen en Inspection · Blocked en Yard |
| [LTR-92](#ltr-92) | Done | Yard | Yard: badge "Blocked" en todo truck con WO abierta (no hay blocker real) |
| [LTR-93](#ltr-93) | Done | Yard | Yard: "Upcoming Departures" muestra salidas pasadas (toda la semana) |
| [LTR-94](#ltr-94) | Done | Work Orders & Jobs | Tiempos: "Active labor 0m" en WO In Progress (total no se calcula en vivo) |
| [LTR-95](#ltr-95) | Done | Mecánicos | PM: un mecánico puede tener varios PM In Progress a la vez (labor en paralelo) |
| [LTR-96](#ltr-96) | Done | Work Orders & Jobs | Admin WO detail: dice "closed Work Order" cuando el motivo es falta de work_orders.manage |
| [LTR-97](#ltr-97) | Done | Yard | Dashboard: "Needs attention" no respeta su orden (ready-to-close y critical quedan abajo) |
| [LTR-98](#ltr-98) | Done | Work Orders & Jobs | Blocker sin ciclo de vida: nunca se resuelve y sigue como "Latest reported blocker" |
| [LTR-99](#ltr-99) | Done | Plataforma y Go-live | Ops: roster prod sin Shop Manager visible, mecánicos @pending y usuarios QA |
| [LTR-100](#ltr-100) | Done | Yard | UX Yard: contadores superiores no cuadran (Under review + Ready + Blocked > trucks) |
| [LTR-101](#ltr-101) | Done | Yard | UX Yard: cards no dicen qué falta ni el siguiente paso (JTBD-5) |
| [LTR-102](#ltr-102) | Done | Yard | UX Yard: estados externos ("Ready To Go", "Heavy Work No ETA") mezclados con el Ready del Shop y dentro de Incoming |
| [LTR-103](#ltr-103) | Done | Yard | UX Yard: "Yard movement" con 3 cajas de scroll anidado de 50+ filas |
| [LTR-104](#ltr-104) | Done | Yard | Copy Yard: subtítulo "readiness view for every Truck" contradice board engagement-only |
| [LTR-105](#ltr-105) | Done | Work Orders & Jobs | UX WO detail: no explica quién debe cerrar la WO ni por qué no puedo actuar |
| [LTR-106](#ltr-106) | Done | Work Orders & Jobs | UX WO detail: campo "Reason for this Job change" visible con jobs bloqueados |
| [LTR-107](#ltr-107) | Done | Work Orders & Jobs | UX WO detail: "Current pause" duplicado (summary + sección propia) |
| [LTR-108](#ltr-108) | Done | Work Orders & Jobs | UX: blocker muestra rango "10:56 → 10:56 · 0m" |
| [LTR-109](#ltr-109) | Done | Work Orders & Jobs | UX WO detail: página muy larga en 1 columna; acción principal no visible |
| [LTR-110](#ltr-110) | Done | Trucks & Inspección | UX Truck detail: desde Trucks dice "Back to Yard Operations" y eyebrow YARD OPERATIONS |
| [LTR-111](#ltr-111) | Done | Trucks & Inspección | UX Trucks: columna "Operational status" = Unknown en todos los trucks |
| [LTR-112](#ltr-112) | Done | Trucks & Inspección | UX Truck detail: sección Inspection muestra "Ready to Go" y badge Ready junto a WO In Progress |
| [LTR-113](#ltr-113) | Done | Trucks & Inspección | Datos: Make / Model invertidos o duplicados en trucks (CASCADIA/Freightliner, Mack Anthem) |
| [LTR-114](#ltr-114) | Done | Work Orders & Jobs | UX mobile: buscador WO sin placeholder y contador "Under revi…" truncado |
| [LTR-115](#ltr-115) | Done | Setup, People & Permisos | UX Mechanics: texto suelto "en" al final de /admin/mechanics |
| [LTR-116](#ltr-116) | Done | Yard | UX Dashboard: PM con "Jobs 0/0" en Needs attention sin nada que atender |
| [LTR-117](#ltr-117) | Done | Plataforma y Go-live | Epic: IA v2 — Truck como hub, taxonomía cerrada y nav por trabajo |
| [LTR-118](#ltr-118) | Done | Plataforma y Go-live | IA: glosario cerrado — Blocked, Ready To Go, Inspection, Under review |
| [LTR-119](#ltr-119) | Done | Trucks & Inspección | IA: Truck detail como hub (Work Plan + WO + historial) y fuente canónica de jobs |
| [LTR-120](#ltr-120) | Done | Yard | IA: separar Yard en "Readiness del Shop" y "Movimiento (fuente externa)" |
| [LTR-121](#ltr-121) | Done | Yard | IA: una sola definición de "atención" (Dashboard, Yard, WO list) |
| [LTR-122](#ltr-122) | Done | Plataforma y Go-live | IA: nav Admin agrupada (Operación / Configuración / Auditoría) y por capability |
| [LTR-123](#ltr-123) | Done | Work Orders & Jobs | IA: "acción de este usuario ahora" above the fold en detalles (doc 10) |
| [LTR-124](#ltr-124) | Done | Mecánicos | Labor: sesión sigue abierta tras completar todos los jobs (y es por WO, no por mecánico) |
| [LTR-125](#ltr-125) | Canceled | Mecánicos | Mechanic: puede iniciar varias WO Standard a la vez (sin guard) |
| [LTR-126](#ltr-126) | Done | Work Orders & Jobs | Notes: campo único compartido con autosave — mecánico sobrescribe notas del Manager; "pedir trabajo" no es estructurado |
| [LTR-127](#ltr-127) | Done | Mecánicos | Mechanic: jobs completados muestran asignación en vez de quién los completó |
| [LTR-128](#ltr-128) | Done | Mecánicos | Mechanic: no ve los blockers ya reportados en la WO (riesgo de duplicados) |
| [LTR-129](#ltr-129) | Done | Mecánicos | Mechanic Home: "Ready to start" no ordena por prioridad (Critical debajo de Normal) |
| [LTR-130](#ltr-130) | Done | Mecánicos | UX Mechanic: cards y detalle sin identidad del truck (solo "#907"); categoría principal engaña |
| [LTR-131](#ltr-131) | Done | Mecánicos | UX Mechanic: jobs deshabilitados antes de Start sin explicar por qué; sin tiempo visible |
| [LTR-132](#ltr-132) | Done | Mecánicos | Copy Mechanic Home: subtítulo duplicado ("Work Orders and Jobs the Manager assigned…" + "Managers plan Standard work…") |
| [LTR-133](#ltr-133) | Done | Mecánicos | IA Mechanic: workspace = solo Home + WO; sin búsqueda de truck, sin "mi trabajo de hoy / completado" |
| [LTR-134](#ltr-134) | Done | Mecánicos | IA Mechanic Home: secciones mezclan nivel WO y nivel Job ("Active jobs 0" con WO en curso) |
| [LTR-135](#ltr-135) | Done | Trucks & Inspección | PM: observed mileage sin validación — puede bajar el odómetro del truck al finalizar |
| [LTR-136](#ltr-136) | Done | Mecánicos | PM: no se puede hacer PM a un truck con WO Standard abierta (callejón sin salida) |
| [LTR-137](#ltr-137) | Done | Mecánicos | PM completado: "Current mileage" y "Last completed PM" muestran datos de hoy, no del servicio |
| [LTR-138](#ltr-138) | Done | Mecánicos | UX PM Home: botón "Finish Work" solo navega; cards sin tiempo, progreso ni modelo |
| [LTR-139](#ltr-139) | Done | Mecánicos | UX PM detalle: completado muestra 9 selects deshabilitados; datos RO con estilo de input; "Saved" en vista cerrada |
| [LTR-140](#ltr-140) | Done | Mecánicos | UX Create PM: placeholder truncado y resultados no marcan trucks con WO abierta |
| [LTR-141](#ltr-141) | Done | Work Orders & Jobs | Epic: PM dentro del Work Plan — una WO por truck con Inspection → Shop Work → PM → Alignment → Detailing |
| [LTR-142](#ltr-142) | Done | Plataforma y Go-live | Release: aplicar migraciones LTR-98 + LTR-126 y re-sincronizar API/web en producción |
| [LTR-143](#ltr-143) | Done | Work Orders & Jobs | LTR-141 · Slice 0: migración — WorkOrderJob.startedAt + PmService.workOrderJobId |
| [LTR-144](#ltr-144) | Done | Work Orders & Jobs | LTR-141 · Slice 1: derivación + Yard — fase PM, QC obligatorio, "No aplica" (flag WORK_PLAN_PM_PHASE) |
| [LTR-145](#ltr-145) | Done | Work Orders & Jobs | LTR-141 · Slice 2: jobs obligatorios automáticos (PM A, Alignment, Detailing, QC) + PM permitido en WO Standard |
| [LTR-146](#ltr-146) | Done | Mecánicos | LTR-141 · Slice 3: ejecución del job PM por mechanic.pm dentro de la WO Standard |
| [LTR-147](#ltr-147) | Done | Work Orders & Jobs | LTR-141 · Slice 4: "Create PM service" se une a la WO abierta o crea la WO completa |
| [LTR-148](#ltr-148) | Done | Yard | LTR-141 · Slice 5: Dashboard PM (LTR-116), docs superseded y e2e |
| [LTR-149](#ltr-149) | Done | Work Orders & Jobs | Epic: Flujo v3 — un responsable por job, bloqueo por job, flujo del taller preconfigurado y Truck como lugar de trabajo (D11–D18) |
| [LTR-150](#ltr-150) | Done | Work Orders & Jobs | Flujo v3 · PR 0: flags Work Plan / PM phase como único modo (retirar código flag-off) |
| [LTR-151](#ltr-151) | Done | Plataforma y Go-live | Flujo v3 · PR 1: errores rápidos de la sección 8 (copy, a11y, picker de mecánicos, PM "Saved") |
| [LTR-152](#ltr-152) | Done | Plataforma y Go-live | Flujo v3 · PR 2: vocabulario común EN/ES (§7) y retiro de "inherits the Work Order team" |
| [LTR-153](#ltr-153) | Done | Work Orders & Jobs | Flujo v3 · PR 3: migración A — work_sessions.user_id, pause_events.job_id, enum blocker_reason |
| [LTR-154](#ltr-154) | Done | Work Orders & Jobs | Flujo v3 · PR 4: dueño de cada job (D11) y labor por mecánico (D18) — "Terminaste tu parte" |
| [LTR-155](#ltr-155) | Done | Work Orders & Jobs | Flujo v3 · PR 5: reglas del bloqueo por job (D12, D17) — solo el Manager resuelve, el tiempo se detiene, "Continuar" |
| [LTR-156](#ltr-156) | Done | Setup, People & Permisos | Flujo v3 · PR 6: migración B — tabla shop_workflow_steps (paso → job de catálogo → responsable por defecto) |
| [LTR-157](#ltr-157) | Done | Setup, People & Permisos | Flujo v3 · PR 7: pantalla "Flujo del taller" en Setup (D16), responsables por defecto (D15) y crear WO solo con truck (D13) |
| [LTR-158](#ltr-158) | Done | Trucks & Inspección | Flujo v3 · PR 8: Truck como lugar de trabajo (D14) — Siguiente paso arriba, inspección primero, cerrar y Return to Service en el Truck |
| [LTR-159](#ltr-159) | Done | Work Orders & Jobs | Flujo v3 · PR 9: una sola regla de "siguiente paso" en Dashboard, Yard, Truck y WO; motivos y botones en Needs attention |
| [LTR-160](#ltr-160) | Done | Plataforma y Go-live | Roster de prueba en prod: dejar 4 usuarios activos y ocultar inactivos |
| [LTR-162](#ltr-162) | Done | Plataforma y Go-live | E2E en verde: arreglar los specs que ya fallan en main y la carrera del Dev Login |
| [LTR-163](#ltr-163) | Done | Plataforma y Go-live | E2E contra build de producción en vez de next dev |
| [LTR-164](#ltr-164) | Done | Plataforma y Go-live | Fix: hallazgos del smoke prod Flujo v3 (LTR-51) |
| [LTR-165](#ltr-165) | Done | Plataforma y Go-live | Épica: revisión de UI mobile (PWA): jerarquía, espaciado y consistencia |
| [LTR-166](#ltr-166) | Done | Plataforma y Go-live | UI mobile 1: escala tipográfica, escala de espaciado y un solo encabezado de página |
| [LTR-167](#ltr-167) | Done | Plataforma y Go-live | UI mobile 2: header de la app instalada y áreas táctiles de 44px |
| [LTR-168](#ltr-168) | Done | Plataforma y Go-live | UI mobile 3: aplanar pantallas (sin cards anidadas, menos texto) y acortar el detalle de WO del Manager |
| [LTR-169](#ltr-169) | Done | Plataforma y Go-live | UI mobile 4: tablas responsive (Trucks, Mechanics, Catalog, Yard board) y patrones unificados (filtros, Back, Save, disabled) |
| [LTR-170](#ltr-170) | Done | Plataforma y Go-live | UI mobile 5: copy en español: género de Work Order, términos fuera del glosario y pantalla de error sin traducir |
| [LTR-171](#ltr-171) | Done | Plataforma y Go-live | UI mobile 6: PWA instalada: íconos maskable/512, theme-color por tema y validación en iPhone real |
| [LTR-172](#ltr-172) | Done | Plataforma y Go-live | E2E fixture: rutas faltantes (historial admin, notas del mecánico) y script de auditoría visual en el repo |
| [LTR-173](#ltr-173) | Done | Plataforma y Go-live | Epic: Plan de cierre — auditoría única de flujos, defectos B/C, limpieza y salida en vivo |
| [LTR-174](#ltr-174) | Done | Plataforma y Go-live | Fase A: auditoría única de los 28 flujos contra la API real (matriz de OPEN_ISSUES §0) |
| [LTR-175](#ltr-175) | Done | Work Orders & Jobs | B: Work Order atorado en `created` — el PM y el Manager no lo pasan a `in_progress` (WO-009, Truck 607) |
| [LTR-176](#ltr-176) | Done | Work Orders & Jobs | B: bloqueos huérfanos — cancelar WO/Job o completar un Job bloqueado deja el bloqueo activo |
| [LTR-177](#ltr-177) | Done | Work Orders & Jobs | B: el Work Order nuevo hereda la inspección de la visita anterior (al cancelar, o al abrir otro sin Return to Service) |
| [LTR-178](#ltr-178) | Done | Safety / QC | C: textos de QC dicen que Quality Check es opcional (contradice D15) y usan "Quality Check" en español |
| [LTR-179](#ltr-179) | Done | Plataforma y Go-live | C/E: pendientes menores de la revisión de UI móvil (LTR-165): U1–U10 |
| [LTR-180](#ltr-180) | Done | Plataforma y Go-live | Fase C: borrar código heredado (readiness de 6 requisitos, equipo por WO, pausa del mecánico, formulario Standard muerto, supabase/migrations) |
| [LTR-181](#ltr-181) | Done | Plataforma y Go-live | Fase C: idioma — 62 textos fuera de catálogo, inglés fijo en pantallas PM/nuevo WO, 29 errores de API mostrados en inglés |
| [LTR-182](#ltr-182) | Done | Work Orders & Jobs | C: las listas de Trucks y de Work Orders no dicen "Return to Service" para un camión Ready to Go |
| [LTR-183](#ltr-183) | Duplicate | Safety / QC | Solo una persona de Safety puede ser dueño del Quality Check (antes: QC no acepta dueño) |
| [LTR-184](#ltr-184) | Done | Work Orders & Jobs | C: el detalle Admin del Work Order no dice de qué mecánico es cada sesión de tiempo |
| [LTR-185](#ltr-185) | Done | Safety / QC | Quality Check de Safety: cuenta propia, lista de camiones por revisar, aprobar o devolver con nota (D19) |
| [LTR-186](#ltr-186) | Done | Mecánicos | D20 cierre del día a las 5:00 p.m. + D21 un reloj por mecánico |
| [LTR-187](#ltr-187) | Done | Setup, People & Permisos | Hueco de operación: el Manager da de alta camiones y mecánicos desde la app (hoy no hay pantalla) |
| [LTR-188](#ltr-188) | Done | Work Orders & Jobs | Decisiones de operación pendientes: dos mecánicos en una tarea, taller externo, tiempo solapado, PM sin partes, trailers |
| [LTR-189](#ltr-189) | Done | Work Orders & Jobs | Recorrido de pantallas: 17 hallazgos C/E (W1–W17), empezar por la tarjeta Jobs |
| [LTR-190](#ltr-190) | Done | Work Orders & Jobs | Rediseño UI Admin: Work Order, Truck, Dashboard y Yard (Etapas 1–8) |
| [LTR-191](#ltr-191) | Done | Plataforma y Go-live | Revisión de producción tras el rediseño (G1–G10), loader de login y datos demo |
| [LTR-192](#ltr-192) | Done | Mecánicos | Roles de campo: auditoría UX (Safety, mecánico General, PM) y bloque A de arreglos |
| [LTR-193](#ltr-193) | Done | Safety / QC | Rediseño de la pantalla de Safety (Quality Check), bloque B |
| [LTR-195](#ltr-195) | Done | Plataforma y Go-live | Roles de campo, bloque C: aviso único de sin conexión y primitivas de la Etapa 8 |
| [LTR-196](#ltr-196) | Done | Setup, People & Permisos | Setup del Admin, etapa 0: arreglos sin rediseño (SW1–SW4, JC3–JC6, ME1–ME4) |
| [LTR-197](#ltr-197) | Done | Setup, People & Permisos | Setup S1: equipo y cola por paso, QC del Manager, paso "PM" (D28, D29) |
| [LTR-198](#ltr-198) | Done | Setup, People & Permisos | Setup S2: catálogo con categorías, aliases y Jobs del sistema (D30) |
| [LTR-199](#ltr-199) | Done | Setup, People & Permisos | Setup S3: People, "Quitar del Shop" y detalle de la persona (D31) |
| [LTR-200](#ltr-200) | Done | Parts, Costs & Finance | Partes y costos por camión, etapa 1 (D32) |
| [LTR-201](#ltr-201) | Done | Parts, Costs & Finance | Mano de obra y factura interna a Finanzas (D34) |
| [LTR-202](#ltr-202) | Done | Samsara | Samsara: millaje de referencia, ubicación, luces y fallas en la ficha; fallas → Jobs recomendados (D35, D42) |
| [LTR-204](#ltr-204) | Done | Demo & Landing | Modo demo local: cambio de usuario y historias guiadas (D36) |
| [LTR-205](#ltr-205) | Done | Work Orders & Jobs | Add work: tarjeta dentro de tarjeta en CategoryJobList |
| [LTR-206](#ltr-206) | Done | Yard | Yard: textos 'UNAVAILABLE' y 'Unable to load current administrative data.' |
| [LTR-207](#ltr-207) | Done | Yard | Yard: la pestaña Dispatch se llama `movement` en la URL |
| [LTR-208](#ltr-208) | Done | Mecánicos | Mecánico: la pestaña Trucks es solo un buscador; mostrar 'Trucks with your Jobs' |
| [LTR-209](#ltr-209) | Done | Mecánicos | Mecánico: 'Loading work order' en texto plano; usar PageSkeleton |
| [LTR-210](#ltr-210) | Done | Setup, People & Permisos | Shop workflow: 'Add to team' no guarda hasta 'Save steps' |
| [LTR-211](#ltr-211) | Done | Demo & Landing | Demo: avisar que una historia ya se ejecutó en esta base |
| [LTR-212](#ltr-212) | Done | Plataforma y Go-live | Rendimiento: polling superpuesto (Dashboard, Yard, WO, mecánico) |
| [LTR-213](#ltr-213) | Done | Plataforma y Go-live | CI: correr vitest de la web y test:real en GitHub Actions |
| [LTR-214](#ltr-214) | Done | Trucks & Inspección | Trucks 876 y 877: corregir VIN (espera alta/edición de camiones) |
| [LTR-215](#ltr-215) | Done | Trucks & Inspección | Crear, editar y desactivar camiones desde el Shop; conectar Samsara desde la ficha |
| [LTR-216](#ltr-216) | Done | Safety / QC | El Manager puede completar con un toque el QC que Safety devolvió, sin ver el motivo |
| [LTR-217](#ltr-217) | Done | Safety / QC | Un camión devuelto por Safety: "Resolve" debería llevar a agregar o reabrir el trabajo |
| [LTR-218](#ltr-218) | Done | Yard | Acciones de un toque que no dicen qué hicieron: Mark handled, Assign, costo de mano de obra en $0 |
| [LTR-219](#ltr-219) | Done | Work Orders & Jobs | "Add work" abre en la categoría PM y el error dice "open PM Work Order" aunque no la haya |
| [LTR-220](#ltr-220) | Done | Parts, Costs & Finance | Repuestos, stock y llantas en Parts & costs (D45) |
| [LTR-221](#ltr-221) | Done | Parts, Costs & Finance | ST-1 · Al cargar una compra, cada línea se puede atar al Job de su camión |
| [LTR-222](#ltr-222) | Done | Parts, Costs & Finance | ST-2 · El catálogo de partes tiene repuestos y llantas, no solo el PM |
| [LTR-223](#ltr-223) | Done | Parts, Costs & Finance | ST-3 · Stock del taller: entra con la compra y sale a un Job |
| [LTR-224](#ltr-224) | Done | Parts, Costs & Finance | ST-4 · La inspección deja en el Job qué llanta poner (delantera nueva, trasera recap) |
| [LTR-225](#ltr-225) | Done | Parts, Costs & Finance | ST-5 · Las partes que se eligen en el PM salen del stock |
| [LTR-226](#ltr-226) | Done | Parts, Costs & Finance | ST-6 · Subir la factura del proveedor y que la app proponga las líneas |
| [LTR-227](#ltr-227) | Done | Yard | Con mouse no se puede mover el tablero del Yard de lado |
| [LTR-228](#ltr-228) | Done | Yard | Full screen del Yard debe abrir el tablero en otra pestaña |
| [LTR-229](#ltr-229) | Done | Safety / QC | Ajustes de Safety que pidió el equipo: nombre oculto, ver la inspección, hallazgos → Jobs (D46) |
| [LTR-230](#ltr-230) | Done | Safety / QC | SQ-1 · El Manager ve "Safety" en vez del nombre de quien hizo el QC, y ya no asigna el QC |
| [LTR-231](#ltr-231) | Done | Safety / QC | SQ-2 · Safety ve la inspección (hoja D41) del camión que revisa |
| [LTR-232](#ltr-232) | Done | Safety / QC | SQ-3 · Safety deja hallazgos y el Manager los agrega como Job o los suma a uno |
| [LTR-234](#ltr-234) | Done | Plataforma y Go-live | En el teléfono, el teclado tapa los campos y botones de las hojas (inspección de llantas, Asignar, diálogos) |
| [LTR-235](#ltr-235) | Done | Trucks & Inspección | "Desconectar" de Samsara arriba de todo en la ficha del camión: un toque sin querer corta el camión |
| [LTR-236](#ltr-236) | Done | Plataforma y Go-live | Pruebas de teléfono que ya fallaban en main: filtros de Work Orders y arrastrar el tablero del Yard |
| [LTR-237](#ltr-237) | Done | Plataforma y Go-live | Epic: Rendimiento ronda 2026-10 — over-fetching en API, bundle web y limpieza (PF15–PF26) |
| [LTR-238](#ltr-238) | Done | Plataforma y Go-live | Rendimiento PR-A: la API deja de cargar de más (home del mecánico, Dashboard, detalle de WO, cola de equipo, PM, stock) — PF15–PF21 |
| [LTR-239](#ltr-239) | Done | Plataforma y Go-live | Rendimiento PR-B: índice para los hallazgos de QC del Dashboard — PF22 |
| [LTR-240](#ltr-240) | Done | Plataforma y Go-live | Rendimiento PR-C: bundle de la web y limpieza de dependencias — PF23–PF26 |
| [LTR-242](#ltr-242) | Done | Parts, Costs & Finance | Completar una WO con PM cobra dos veces una parte que ya se cargó al camión (filas A133, A134) |
| [LTR-243](#ltr-243) | Done | Parts, Costs & Finance | Epic: Parts & costs IA v2 — Parts como inventario, cuidar el stock, un solo "Parts…" en el Job y retoques del menú (P32–P36) |
| [LTR-244](#ltr-244) | Done | Parts, Costs & Finance | Textos de Parts & costs que dicen lo contrario de lo que hace la app ("las partes del PM", "shop stock", "Parts → Tires", "1 parts") |
| [LTR-245](#ltr-245) | Done | Plataforma y Go-live | Volver desde un camión o una WO pierde los filtros; el breadcrumb del camión dice "Yard Operations" sin venir del Yard |
| [LTR-246](#ltr-246) | Done | Parts, Costs & Finance | HU-M20 · Cuidar el stock: Parts como inventario único, Count stock en lote, Add to stock y Remove from stock (D47) |
| [LTR-247](#ltr-247) | Done | Parts, Costs & Finance | Un solo "Parts…" en el menú del Job, con las llantas adentro (Tires from the inspection, lo que tiene, From stock, Buy for this Job) (D47) |
| [LTR-248](#ltr-248) | Done | Plataforma y Go-live | Retoques del menú del panel: History → filtro "Closed" de Work Orders, "Jobs", "Shop rates", Internal invoices al final (P34, P36) |
| [LTR-249](#ltr-249) | Done | Plataforma y Go-live | test:real: las filas de tarifa de mano de obra (A67, A70, A71, A77) fallan según la hora del día |
| [LTR-250](#ltr-250) | Done | Plataforma y Go-live | En el navegador del iPhone el panel se ve cortado y el menú se va de la pantalla (la PWA se ve bien) |
| [LTR-251](#ltr-251) | Done | Plataforma y Go-live | Mobile UI de mecánicos (General y PM) y Safety: toques chicos y detalles inconsistentes |
| [LTR-252](#ltr-252) | Done | Plataforma y Go-live | Botones de mecánicos y Safety: solo la primera palabra con mayúscula |
| [LTR-253](#ltr-253) | Done | Setup, People & Permisos | People muestra a Managers y System Admins; alta y desactivación desde la app según quién eres |
| [LTR-254](#ltr-254) | Done | Yard | Yard Dispatch: "Incoming Trucks" no coincide con Ninox "Truck returning" ni con el correo de Dispatch |
| [LTR-257](#ltr-257) | Done | Trucks & Inspección | D49 ajuste: "In yard" por los geofences de nuestra yard; "In shop" solo con Work Order abierta |
| [LTR-258](#ltr-258) | Done | Trucks & Inspección | D51: Dispatch para planear la semana (por día, primero lo que pide acción); contadores de Samsara en el tablero Shop |
| [LTR-259](#ltr-259) | Done | Plataforma y Go-live | Admin en iPad Pro 11": huecos laterales, filtros solapados y textos de maqueta |
| [LTR-260](#ltr-260) | Done | Yard | Un camión en Ready to Go que ya salió de la yard sigue en el tablero, y al volver no pide Work Order |
| [LTR-261](#ltr-261) | Done | Yard | El Dashboard no avisa que llegó a la yard un camión sin Work Order |
| [LTR-263](#ltr-263) | Done | Mecánicos | Mecánicos en iPad se ven como teléfono y ven el tiempo que llevan |
| [LTR-264](#ltr-264) | Done | Parts, Costs & Finance | En iPad las fechas se montan sobre el campo de al lado y el checkbox se ve distinto |
| [LTR-265](#ltr-265) | Done | Trucks & Inspección | Los Jobs de llantas de la inspección no dicen qué llanta ni por qué, y deben ir al mecánico de Alignment |
| [LTR-266](#ltr-266) | Done | Yard | En la TV del taller el tablero del Yard no se ve completo: pide scroll de lado y hacia abajo |
| [LTR-271](#ltr-271) | Done | Mecánicos | Mecánicos en iPad: franjas vacías a los lados y una tarjeta sola ocupa media fila |
| [LTR-272](#ltr-272) | Done | Mecánicos | Safety (Quality Check) en iPad se ve como teléfono: columna angosta con franjas vacías |
| [LTR-273](#ltr-273) | Done | LTL Shop | Docs desalineados tras D49–D54: PRD, sistema de diseño, nombres de menú, IA y recorrido del camión |
| [LTR-274](#ltr-274) | Done | Plataforma y Go-live | Textos de UI de menos de 12px y colores fijos fuera de tokens |
| [LTR-275](#ltr-275) | Done | Mecánicos | En la tablet la app dice "Kept on this phone" / "este teléfono" |

---

## LTR-1

**Get familiar with Linear**

- **Estado:** Canceled · **Proyecto:** — · **Etiquetas:** —
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: —**

(ejemplo que Linear crea con la cuenta; sin contenido del proyecto)

---

## LTR-2

**Connect your tools**

- **Estado:** Canceled · **Proyecto:** — · **Etiquetas:** —
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: —**

(ejemplo que Linear crea con la cuenta; sin contenido del proyecto)

---

## LTR-3

**Import your data**

- **Estado:** Canceled · **Proyecto:** — · **Etiquetas:** —
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: —**

(ejemplo que Linear crea con la cuenta; sin contenido del proyecto)

---

## LTR-4

**Set up your teams**

- **Estado:** Canceled · **Proyecto:** — · **Etiquetas:** —
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: —**

(ejemplo que Linear crea con la cuenta; sin contenido del proyecto)

---

## LTR-5

**[PR #84] Protect Truck Samsara/VIN columns (Prisma)**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** API
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/84**

#### Contexto

Proteger columnas de identidad de truck (Samsara/VIN) en Prisma / DB.

#### Links

* PR: [https://github.com/lightningtransport/LTL_Shop/pull/84](<https://github.com/lightningtransport/LTL_Shop/pull/84>)
* Agent: Developer (running)

#### Scope

* Protect Truck Samsara/VIN DB columns
* Docs CURRENT VIN / last-reported location (no Yard Presence)
* Branch `cursor/protect-truck-identity-columns-642a`

---

## LTR-6

**[PR #83] UI audit fixes + design-system docs**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Docs
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/83**

#### Contexto

UI audit fixes + design-system docs para `apps/web`.

#### Links

* PR: [https://github.com/lightningtransport/LTL_Shop/pull/83](<https://github.com/lightningtransport/LTL_Shop/pull/83>)
* Agent: Design (running)

#### Scope

* Fixes de UI audit
* Inventario / docs del design system (tokens, empty/loading, EN/ES)
* Preview Vercel en branch `cursor/design-ui-audit-fixes-bfbf`

---

## LTR-7

**[PR #82] Truck identity / miles / owners audit**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** Docs
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/82**

#### Done (merged to main)

Audit CURRENT de truck search, miles y owners. V3 Samsara/McLeod deferred.

* PR: [https://github.com/lightningtransport/LTL_Shop/pull/82](<https://github.com/lightningtransport/LTL_Shop/pull/82>)
* Merged en prod (web + api READY)

---

## LTR-8

**[PR #81] V2.1-001 Yard Phase persistence gap**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** API
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/81**

#### Done (merged to main)

Validación del gap de persistencia de Yard Phase. No persistir YardPhaseEvent; gaps restantes son derivation/copy + pilot Operational Yard.

* PR: [https://github.com/lightningtransport/LTL_Shop/pull/81](<https://github.com/lightningtransport/LTL_Shop/pull/81>)

---

## LTR-9

**[PR #79] V2-001 Ownership cutover contract**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Epic
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/79**

#### Done (merged to main)

Contrato de cutover ownership aprobado por Cristian (Q1–Q18, sin W1 soak).

* PR: [https://github.com/lightningtransport/LTL_Shop/pull/79](<https://github.com/lightningtransport/LTL_Shop/pull/79>)

---

## LTR-10

**[PR #80] V2-002 Ownership TARGET cutover**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** API
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/80**

#### Done (merged to main)

Cutover de ownership TARGET (auth Standard create, Manager-owned, etc.).

* PR: [https://github.com/lightningtransport/LTL_Shop/pull/80](<https://github.com/lightningtransport/LTL_Shop/pull/80>)

---

## LTR-11

**Pilot: Work Plan / Ready derived (post Slice 1)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Feature
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-16
- **Adjuntos: —**

#### Rewrite PO (2026-09-14) — ya NO es pilot de Phase 1 gates

**Antes:** pilot live de Operational Yard sobre 6 gates / derivation/copy post V2.1-001.

**Ahora:** pilot ops del **Truck Work Plan / Ready derived** post Slice 1. Parent: [LTR-32](#ltr-32). [LTR-33](#ltr-33) **Done** + **flag ON**. [LTR-35](#ltr-35) **Done** + smoke Truck **277** OK (2026-09-15: Work Plan + Detailing). Checklist pilot en curso.

Gap review: un pilot de checklist Phase 1 es **dead-end** vs Decision firmada.

---

#### Objetivo

Validar en vivo (1–N trucks) que el Shop Manager puede:

1. Inspection → Issues → **Add work** (catálogo) en Truck Detail
2. Ver **Work Plan** / trabajo pendiente (“qué falta para salir”)
3. Entender Ready como **resultado del plan** (no administrar 6 dropdowns)

Mismo Shop Manager — sin rol inspector (decisión Cristian).

---

#### CURRENT vs TARGET

|  |  |
| -- | -- |
| **CURRENT (no pilotizar)** | Phase 1: 6 gates + Mark Ready en `/admin/yard-operations` |
| **TARGET (este pilot)** | Work Plan Slice 1+ ; Ready derivado; Alignment + Detailing obligatorios |

---

#### In scope

* Checklist de pilot post–[LTR-33](#ltr-33) (pasos + trucks — Cristian confirma)
* Validar JTBD-5 TARGET en manos del Manager
* Confirmar Detailing seed ([LTR-35](<https://linear.app/ltransl/issue/LTR-35>)) si hace falta para Ready fiable
* Roster correcto System Admin ≠ Shop Manager ([LTR-12](<https://linear.app/ltransl/issue/LTR-12>)) para personas del pilot

#### Out of scope

* Polish / pilot de los **6 gates** Phase 1
* Persistencia YardPhaseEvent (R3)
* Presence geofence / Incoming/Departures (V3)
* Rediseño Kanban completo / slices 2–3 cutover (salvo hallazgos del pilot)

---

#### Owners

| Rol | Owner |
| -- | -- |
| Alcance pilot + aceptación | Product Owner |
| UX Slice 1 | Product Designer + Frontend ([LTR-33](<https://linear.app/ltransl/issue/LTR-33>)) |
| API hooks | Engineering Lead ([LTR-34](<https://linear.app/ltransl/issue/LTR-34>) Done) |
| Ops trucks / quién pilota | PM + Cristian |

---

#### Criterios de aceptación

- [X] [LTR-33](#ltr-33) Slice 1 usable en preview/prod acordada
- [ ] Checklist pilot (pasos + trucks) escrito y firmado
- [ ] Manager completa Inspection → Add work → ve plan pendiente sin usar 6 gates como flujo principal
- [ ] Hallazgos → tickets bajo [LTR-32](#ltr-32) (no tickets de polish gates)
- [ ] Spec doc 07 actualizado o marcado superseded

#### Spec antigua

[07 — Spec: LTR-11 Operational Yard pilot](<https://linear.app/ltransl/document/07-spec-ltr-11-operational-yard-pilot-2168211cf1d4>) = **superseded** (Phase 1). Este issue es la autoridad.

*Rewritten by Product Owner 2026-09-14.*

---

#### Checklist pilot (BORRADOR PO — 2026-09-14)

**Precondiciones**

- [X] [LTR-33](#ltr-33) Done + flag `YARD_WORK_PLAN_SLICE1=true` en Production (smoke web)
- [X] [LTR-35](#ltr-35) Detailing en catálogo + smoke 277 OK (2026-09-15)
- [ ] Persona Shop Manager con caps correctas ([LTR-12](#ltr-12) puede quedar parcial)
- [X] Truck de prueba → **277** (PM 2026-09-14)

**Script (Shop Manager)**

1. Abrir Truck Detail del truck de prueba (no ir primero a administrar 6 gates).
2. Inspection → **Issues found** → Add work (≥1 job catálogo; ideal incluir / ver Detailing o Alignment según plan).
3. Confirmar Work Plan lista jobs + estados; ver **N jobs remaining** / Not Ready.
4. Completar o avanzar jobs (o simular) hasta plan limpio + Alignment + Detailing.
5. Verificar que Ready se entiende como **resultado del plan** (no Mark Ready como paso mental principal).
6. Caso paralelo: Inspection → **No issues found** → Inspection resuelta sin inventar Required Work.

**Pass / fail**

- [ ] Manager no necesita el checklist de 6 gates para el happy path Slice 1
- [ ] Hallazgos → tickets hijos de [LTR-32](#ltr-32) (no polish gates)
- [ ] Cristian firma trucks + fecha del pilot

*Borrador — firmar cuando* [LTR-33](#ltr-33) *esté listo.*

---

## LTR-12

**Ops: Q14 roster grants (post ownership cutover)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-22
- **Adjuntos: —**

#### Matriz día 1 (Q14)

Grants = ops. No Permissions UI.

##### Cargos → caps

| Cargo | Caps |
| -- | -- |
| System Admin | `admin.access` |
| Shop Manager | `admin.access` + `work_orders.manage` + `yard.operations.manage` |
| Standard Mechanic | `mechanic.standard` |
| PM Mechanic | `mechanic.pm` |

##### Target aplicado 2026-09-22 (Eng Lead) — DONE

| Email | Cargo | Status |
| -- | -- | -- |
| `crixcrox@outlook.com` | System Admin | applied |
| `cristian@ltransl.com` | Shop Manager | applied |
| `cristian240588@hotmail.com` | Standard | applied |
| `cris240588@gmail.com` | PM | applied (cuenta nueva) |

Passwords: aplicadas (no documentar). Pedir cambio tras primer login.

Wipe WOs keep trucks: **DONE** 2026-09-22 — trucks 162, work_orders 0 (WO-linked mileage adjustments cleared; trucks intact).

Siguiente: smoke [LTR-51](<https://linear.app/ltransl/issue/LTR-51>).

---

## LTR-13

**UI: ocultar Yard Presence; solo ubicación reportada**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/85**

#### Decisión PM/Cristian (2026-09-12)

Ocultar **Yard Presence** en UI (Admin truck detail / Yard cards stub).
Mantener solo **Última ubicación reportada** (`location` / `locationUpdatedOn` de #84).

##### CURRENT vs TARGET

* **CURRENT UI:** no mostrar Presence UNKNOWN (ruido).
* **TARGET V3:** reintroducir Presence cuando geofence sea real.
* **R1 se mantiene:** location ≠ Presence en modelo/API; solo se oculta el display de Presence.

##### Scope

* Frontend: quitar/ocultar filas/chips de Presencia desconocida donde confundan.
* Eng Lead: sin cambio DTO salvo que algo exponga Presence como location (no debe).
* PD: actualizar Rules/docs (R1 nota de display).

##### Criterios

- [ ] Admin truck detail: ubicación visible; sin fila Presencia
- [ ] Yard cards: sin Presence stub confuso
- [ ] Mechanic: sin regresión (ya solo location)
- [ ] Copy EN/ES: ubicación reportada, nunca “in yard”

---

## LTR-14

**API: fix 3 load errors (Yard Ops / Mechanics Admin / PM service)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** API, Bug
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-12
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/86, https://cursor.com/agents/bc-eaf2b7fc-2c28-5acc-a540-202eb5c03a2c**

#### Problema

En prod, load failures reportados:

1. Admin Truck detail — Unable to load Yard Operations
2. Mechanics Admin — load error
3. PM service details — Unable to load PM service details

#### Objetivo

Una ronda de fixes API (auth/DTO/500s) + deploy; v1 operable sin roturas percibidas.

#### CURRENT vs TARGET

CURRENT: pantallas existen; fallan al cargar datos.

#### Owner

Engineering Lead

#### Criterios

- [ ] Repro documentado por superficie
- [ ] Fix(es) merged + API/web READY
- [ ] Smoke: truck detail Yard Ops, Mechanics Admin, PM service details OK

---

## LTR-15

**UI audit follow-up: chips ES, CTAs vs caps, shadcn/density**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX
- **Creado:** 2026-09-12 · **Cerrado:** 2026-09-13
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/87, https://github.com/lightningtransport/LTL_Shop/pull/85**

#### Problema

Findings de Product Designer (docs 13/14/R1) + audit UI pendiente, fuera de [LTR-13](#ltr-13) (Presence).

#### Scope (Frontend + priorización PD)

1. Status chips EN-only en Mechanic ES (Created / In Progress sin paridad)
2. CTAs vs capabilities — Standard sin Create; EmptyState; dead form en `/work-orders/new`
3. Location never labeled “in yard” (refuerzo copy EN/ES)
4. shadcn/ui.tsx composition, densidad mobile/desktop (audit mañana)

#### Out

[LTR-13](#ltr-13) Presence hide (ticket aparte)
Load errors API (LTR Eng Lead)

#### Owners

Frontend implementa; Product Designer prioriza findings.

#### Prioridad PD (2026-09-12) — ship en este PR si cabe

**P0 (mismo PR que** [LTR-13](#ltr-13) **si posible)**

1. Location nunca label “in yard” / Presence confusa (refuerzo copy; Presence hide = [LTR-13](#ltr-13))
2. CTAs vs capabilities: Standard sin Create; unauthorized = EmptyState; quitar/aislar dead Standard create form en `/work-orders/new`
3. Status chips Mechanic ES: Created / In Progress (+ pares usados en home/detail) con paridad EN/ES vía catalogs — no inventar; actualizar design-system glossary si falta clave

**P1 (mismo audit o follow-up rápido)**
4\. Densidad: Admin tables vs Mechanic cards; tap targets \~44px en Mechanic
5\. One-offs vs `ui.tsx` / patterns EmptyState|LoadFailure|CompactEmpty

**P2 (no bloquea)**
6\. Polish visual / spacing sin cambio de copy

Refs: [14 UX Writing](<https://linear.app/ltransl/document/14-ux-writing-enes-6bb878dd301f>) · [13 Edges](<https://linear.app/ltransl/document/13-edge-border-cases-3e1e666b3ae4>) · R1

#### Criterios

- [ ] Lista findings post-audit en el issue
- [ ] PR(s) merged para P0/P1
- [ ] PD sign-off copy EN/ES

#### Status 2026-09-12

* P0 shipped in [#85](<https://github.com/lightningtransport/LTL_Shop/pull/85>) (`235e7f5`) — chips ES, CTAs/EmptyState, location copy + [LTR-13](#ltr-13) Presence hide.
* P1 residual (open): Yard Phase 1 banner “in the yard/en el patio”; Start Work/Pause + pause reasons EN-only.

---

## LTR-16

**UI: Admin nav mobile usable (no grid 2 cols)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX
- **Creado:** 2026-09-13 · **Cerrado:** 2026-09-13
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/88**

#### Problema

Admin shell en mobile: el nav se abre como **grid 2 columnas** encima del dashboard. No es usable (tapa contenido, no es drawer/lista vertical).

Evidencia: captura Cristian (ES, user Daniel) — Dashboard | Work Orders grid sobre cards Completed today.

#### Objetivo

Nav mobile usable con una mano.

#### Spec UX

**Mobile (< md / touch):**

* Menú = **lista vertical** (sheet/drawer o dropdown full-width 1 col), no grid 2 cols
* Items full-width, tap \~44px, cierra al elegir ruta
* No tapar métricas críticas sin poder scrollear/dismiss claro

**Desktop:** puede mantener layout actual (sidebar/grid) si ya funciona.

#### Criterios

- [ ] < md: nav 1 columna / drawer; sin grid 2 cols
- [ ] Todos los links Admin accesibles (Dashboard, WO, Yard, Trucks, Mechanics, Catalog, History)
- [ ] Abrir/cerrar claro; focus trap razonable
- [ ] Desktop sin regresión

#### Owner

Frontend

#### Out

Rediseño visual completo; IA de rutas.

---

## LTR-17

**Fix: truck search ranking (exact/prefix unit first)**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** Bug
- **Creado:** 2026-09-13 · **Cerrado:** 2026-09-13
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/88**

#### Problema

Regresión búsqueda Select Truck (New Work Order): al escribir `9`, salen `#609`, `#612`… (match substring) **antes** del unit más cercano a `9`.

Cristian: ya se había corregido ranking y se rompió.

Ref: audit truck search [LTR-7](#ltr-7) / #82 — revalidar ranking CURRENT.

#### Objetivo

Query numérica prioriza **unit number** por relevancia, no “contiene dígito en cualquier lado” primero.

#### Spec ranking (aceptación)

Para query `Q` (trim):

1. **Exact** unit number = `Q` (ej. `#9`)
2. **Prefix** unit number starts with `Q` (ej. `#90`, `#91`, `#9xx`)
3. Luego otros matches (contains en unit / make / model) — nunca por encima de 1–2

Escribir `9` → `#9` primero si existe; luego prefix `#9…`; **no** `#609` / `…579` por encima de exact/prefix.

Misma lógica en Admin trucks search si comparte helper.

#### Criterios

- [ ] Test/e2e o unit: query `9` orden exact → prefix → rest
- [ ] Repro New WO Select Truck en mobile
- [ ] Sin romper búsqueda por make/model cuando no es numérico puro

#### Owner

Frontend (si ranking solo UI) · Eng Lead si el sort viene de API

#### Priority

High — regresión reportada por Cristian

---

## LTR-18

**Fix: Admin Work Orders search/filter (query 9)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Bug
- **Creado:** 2026-09-13 · **Cerrado:** 2026-09-13
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/89**

#### Problema

Cristian: filtro/search en **Admin Work Orders** no funciona (query `9`, captura). Distinto de [LTR-17](#ltr-17) (Select Truck ranking — ya Done).

#### Objetivo

Search + Apply filtran la lista Admin WO de forma predecible.

#### Spec (aceptación)

Query `Q` (trim) debe matchear (OR), case-insensitive:

1. **WO id / número** (exact o prefix preferido; contains OK si no hay exact)
2. **Truck unit number** — misma relevancia que [LTR-17](#ltr-17) si aplica: exact → prefix → contains
3. Otros campos CURRENT del search (mechanic name, etc.) si ya existen en el filtro

**Apply** debe aplicar search + filtros activos; vacío = clear o mostrar todos según CURRENT.

Si el bug es “Apply no dispara” / state no se manda a API → fix de wiring (Frontend).
Si API ignora `search` → Eng Lead.

#### Criterios

- [ ] Repro documentado (search `9` + Apply)
- [ ] Resultados coherentes (WO/truck con `9` relevantes)
- [ ] EmptyState si 0 matches
- [ ] Desktop + mobile

#### Owner

Frontend primero; Eng Lead si confirmáis que el sort/filter es API.

#### Priority

High — bloquea operación Admin

---

## LTR-19

**Perf: PWA iOS home screen hang + web carga lenta**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Bug
- **Creado:** 2026-09-13 · **Cerrado:** 2026-09-14
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/97**

#### Problema

Cristian (iPhone): instalar en home screen → app se queda pegada cargando; a veces también lento en web Chrome.

#### Objetivo

First paint / shell usable en PWA iOS y web sin hang percibido.

#### Hallazgos iniciales

* Eng Lead: API warm `/api/health` \~170–180 ms TTFB — no explica hang largo.
* Sospecha: PWA/iOS shell (SW, splash, session gate) → Frontend.
* Cold start Vercel API (2–5s post-idle) posible en algunos casos; cruzar si aplica.

#### Scope

**Frontend:** splash, service worker/cache, first paint, session gate en `apps/web`.
**Eng Lead:** solo si confirman cold start / TTFB alto o Sentry status 0.

#### Criterios

- [ ] Repro documentado (iOS home screen + web)
- [ ] Sin hang indefinido al abrir desde icono
- [ ] Mejora perceptible de carga inicial (métrica o smoke cualitativo)
- [ ] Desktop/web sin regresión

#### Owner

Frontend primero

#### PD sign-off (2026-09-14)

**APPROVE** [PR #97](<https://github.com/lightningtransport/LTL_Shop/pull/97>) tip `e896141`.

Hang framing: session gate `/` + restore sin deadline (UI-only, no SW).

* Profile restore deadline 8s + Retry — Pass
* Login first paint sin token — Pass
* Standalone `location.replace` — Pass
* No indefinite spinner on `/` — Pass

**Non-blocking:** timeout body EN; Sign-in fallback usa `<Link>`.

##### Smoke iOS (Cristian post-merge)

1. Logged out: icon → login/Sign in, no stuck restore
2. Saved token + hung `/api/auth/me`: Retry ≤\~8s
3. Happy path: sign-in → workspace, no loop
4. Desktop Chrome: login/Home OK

---

## LTR-20

**UI: densificar filtros WO (mobile collapse + desktop compact)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX
- **Creado:** 2026-09-13 · **Cerrado:** 2026-09-13
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/90**

#### Problema

Cristian: filtros Admin/WO ocupan demasiado espacio en **mobile** (casi toda la pantalla) y también mucho en **desktop**. Evidencia: capturas WO list (Search + Status/Priority/Sort/Direction stacked; Apply abajo; lista casi fuera de viewport).

#### Objetivo

Filtros usables sin tapar la lista; densidad mobile-first.

#### Spec UX (PD a refinar)

#### Spec UX firmada (PD 2026-09-13)

**Mobile (< md)**

1. Por defecto: barra compacta = Search (1 línea) + botón **Filtros** (badge con # activos si >0).
2. Lista WO visible **above the fold** (≥1 card) con filtros colapsados.
3. Tap Filtros → **sheet/drawer** con Status, Priority, Sort, Direction + Apply / Clear.
4. Tras Apply: cierra sheet y aplica (coordinar con [LTR-18](#ltr-18)).
5. No stack permanente de 5 controles full-width en el viewport.

**Desktop (≥ md)**

1. Toolbar 1 fila: Search + Status + Priority + Sort/Direction + Apply/Clear (wrap solo si hace falta).
2. Altura filtros < \~120px por defecto; lista dominante.

**Copy:** botón `Filters` / `Filtros`; badge = count de filtros ≠ default.

**Mobile:**

* Panel **collapsed by default** (chip resumen / “Filters”)
* Expand = drawer/sheet o sección compacta; no stack de 5 controles full-width permanentes
* Apply/Clear accesibles sin scrollear la lista fuera

**Desktop:**

* Fila compacta / toolbar; no bloquear >\~30% viewport por defecto

#### Criterios

- [ ] Mobile: ≥1 WO card visible above fold con filters collapsed
- [ ] Expand/collapse claro; Apply funciona (ver [LTR-18](#ltr-18) search)
- [ ] Desktop sin regresión de usabilidad
- [ ] PD sign-off layout

#### Owner

Product Designer (spec) → Frontend (apps/web)

#### Relacionado

[LTR-18](#ltr-18) (search/filter wiring) — distinto: este ticket es densidad/layout

---

## LTR-21

**Product: jobs asociados por categoría en New WO**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Feature
- **Creado:** 2026-09-13 · **Cerrado:** 2026-09-13
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/91**

#### Problema

Cristian: en New WO / Work required, al elegir Category no ve **jobs asociados** — solo Search/Add job manual. Cree que ya estaba definido.

#### CURRENT (Eng Lead)

New WO = Category → search/add vía catalog/aliases. **No** es lista browsable de jobs por categoría. No es gap de data API.

#### Objetivo

Alinear CURRENT vs TARGET: si TARGET era lista de jobs por categoría (select de jobs del catálogo filtrados), PD confirma y Frontend implementa; Eng Lead solo si falta endpoint list-by-category.

#### Spec (PD)

#### Decisión PD (2026-09-13) — CURRENT vs TARGET

|  |  |
| -- | -- |
| **CURRENT** | Category → Search jobs / Custom job name + Add. No lista browsable. |
| **TARGET (firmado)** | Al elegir **Category**, mostrar **lista de Jobs del catálogo** de esa categoría (selección multi) + **Custom job** como escape + Search como filtro de la lista. |

Rationale: Cristian recuerda el flujo catalog-first; search-only es fricción para planificar Standard WOs.

##### Flujo TARGET

1. Select Category → carga jobs asociados (catalog/aliases CURRENT data).
2. UI: checklist o chips seleccionables (tap add); EmptyState si categoría sin jobs.
3. Search filtra la lista de esa categoría (no reemplaza la lista).
4. Custom job name + Add sigue disponible.
5. EN/ES labels desde catalog.

##### API

Eng Lead: solo si falta endpoint list-by-category; si catalog ya viene en client, Frontend filtra en UI.

##### Out

Catalog write UI; mapping review de Custom Job (LATER).

Confirmar en docs/catalog:

1. ¿TARGET = al elegir Category, mostrar jobs asociados (checklist/lista) + opcional Other/search?
2. ¿O CURRENT search/add es intencional?

Si TARGET lista:

* Al select Category → lista jobs de esa categoría (EN/ES)
* Multi-add; Search como fallback
* EmptyState si categoría sin jobs

#### Criterios

- [X] PD: CURRENT vs TARGET escrito en el issue
- [X] Si TARGET lista: UI + catalog wiring; test New WO mobile
- [X] Sin romper Add job manual / aliases

#### PD sign-off (2026-09-13)

**APPROVE** [PR #91](<https://github.com/lightningtransport/LTL_Shop/pull/91>). Checklist TARGET OK. P1 no bloqueantes: e2e assertion, `jobPickerCategoryLabel` ES, chip=`displayName`.

#### Owner

Product Designer (decisión) → Frontend; Eng Lead solo si falta API

---

## LTR-22

**UI: Dashboard Admin densificar cards (sin sync/source por card)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX
- **Creado:** 2026-09-13 · **Cerrado:** 2026-09-13
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/90**

#### Problema

Cristian (captura Dashboard Admin): cards saturadas e inconsistentes — cada KPI repite **Updated** + **Source: supabase_postgres**; header también dice Generated/Source. Textos de sync/infra (Supabase/PostgreSQL) no deberían verse en UI de ops.

#### Objetivo

Dashboard legible: métricas primero, meta mínima, sin ruido de infra.

#### Spec UX (PD a refinar; baseline PM)

**Header:**

* Título de ops + **una** línea meta: última actualización (hora local) — sin “supabase” / “postgres” en copy de usuario.

**Cards:**

* Título + número grande + **1** línea helper (qué mide).
* **Sin** Updated/Source por card.
* Iconografía consistente; densidad mobile 2-col OK si el helper es corto.

**API:** puede seguir mandando `generatedAt`/`source` una vez en payload (Eng Lead OK) — UI no lo pinta por card ni expone source interno.

#### Criterios

- [ ] Cero copy “supabase” / “postgres” / “Source:” en Dashboard visible
- [ ] Meta sync ≤1 vez (header)
- [ ] Cards: title + value + 1 helper; PD sign-off densidad
- [ ] Mobile + desktop

#### Owner

Product Designer (copy/layout) → Frontend

#### Priority

Medium/High polish — tras [LTR-20](#ltr-20) o mismo PR si Frontend confirma que cabe

---

## LTR-23

**UI: consistency pass (badges, buttons, inputs, cards, empties)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX
- **Creado:** 2026-09-13 · **Cerrado:** 2026-09-14
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/92**

#### Problema

Cristian: UI poco consistente (badges y patrones relacionados) — densidad/variantes no alineadas al design system.

#### Objetivo

Consistency pass Admin + Mechanic: componentes canónicos EN/ES, mobile/desktop, según `docs/design-system/*` + `ui.tsx`.

#### Scope ampliado (PM 2026-09-13 — **no** LTR-24)

1. **Badge / status chips / priority chips**
2. **Button** (sizes, variants, 44px)
3. **Input / Select**
4. **Card** density
5. **EmptyState / LoadFailure / PageSkeleton / CompactEmpty**

PD entrega inventario **P0/P1** + variantes target en este issue → Frontend implementa → PD sign-off visual.

#### Out

[LTR-21](#ltr-21) jobs browsable · [LTR-19](#ltr-19) PWA · rediseño IA · reglas de negocio

#### Criterios

- [X] PD: inventario findings P0/P1 + variantes target EN/ES (2026-09-13)
- [X] Frontend: PR alineado a `ui.tsx` / design-system ([#92](<https://github.com/lightningtransport/LTL_Shop/pull/92>) merged)
- [ ] PD sign-off visual

#### Priority

Medium — **después de** [LTR-21](#ltr-21); paralelo suave con [LTR-19](#ltr-19) OK.

#### Owner

Product Designer (spec) → Frontend

---

#### Inventario PD (2026-09-13) — P0 / P1 + variantes target

Fuente: audit `main` vs `docs/design-system/*` + `ui.tsx`. **Sin** tocar [LTR-21](#ltr-21) / reglas de negocio.

##### Decisión PD (firmada)

* Un solo primitive: `Badge`. `PriorityBadge` = wrapper de `Badge` (retirar span ad-hoc / `LocalizedPriority` / `priorityLabel` UPPERCASE).
* **No** `humanize()` en chips de status/priority/pause reason.
* WO `in_progress` → `default` (trabajo activo debe destacar).
* Phase chip → color por **fase**, no por blockers (blocker = texto/icono aparte).
* `Button` size `sm` en chrome desktop OK; controles táctiles / mobile → `min-h-11` (44px). Compact WO toolbar desktop: excepción documentada o volver a 44px en touch.
* In-card vacíos → `CompactEmpty` (no `EmptyState` grande).

##### P0 (hacer primero en el PR)

1. **WO status chip** — un helper + catálogo singular (Created/Creado… Paused/Pausado). Admin lista/detail/dashboard/trucks dejan `humanize`.
2. **Job status chip** — keys `to_do` → To do / Por hacer.
3. **Priority** — Low/Baja · Normal/Normal · High/Alta · Critical/Crítica → `secondary` / `outline` / `warning` / `destructive`.
4. **Yard/Truck phase** — variant por `ReadinessPhase` (ready_to_go=`success`, ready_for_approval=`warning`, gates mid=`outline`, needs_evaluation=`warning`).
5. **Mechanic Home CTAs** — migrar `.btn-*` → `Button` + i18n (`locale-context`).
6. **Mechanic WO load/empty** — PageSkeleton/LoadFailure/EmptyState EN → catalogs.
7. **EmptyState in-card** → CompactEmpty (Truck detail + WO detail notes/jobs/mechanics/history).

##### P1 (mismo PR o follow-up corto)

* Unificar Button API (deprecar `.btn-*`); WorkspaceNav / MultiSelect “Done” i18n.
* Labels: un patrón `Label` `text-sm`.
* Card densidades: list/metric `p-3`, detail `p-4`.
* Count chips → `Badge secondary`; mileage = texto.
* History job names → `Badge outline`.
* CardListSkeleton en loads in-card; PM card copy EN → locale.
* Dashboard item pause/activity: pause → `adminPauseReasonLabel` (cubre residual humanize lista).
* Titles ScreenHeader consistency.

##### Matriz token → Badge variant

| Token | variant | EN | ES |
| -- | -- | -- | -- |
| WO created | outline | Created | Creado |
| WO in_progress | default | In Progress | En progreso |
| WO waiting_paused | warning | Paused | Pausado |
| WO completed | success | Completed | Completado |
| WO cancelled | secondary | Cancelled | Cancelado |
| Job to_do | outline | To do | Por hacer |
| Job completed | success | Completed | Completado |
| Job cancelled | secondary | Cancelled | Cancelado |
| Priority low | secondary | Low | Baja |
| Priority normal | outline | Normal | Normal |
| Priority high | warning | High | Alta |
| Priority critical | destructive | Critical | Crítica |
| Phase needs_evaluation | warning | Needs evaluation | Requiere evaluación |
| Phase mid-gates | outline | (keys admin-messages) | (keys) |
| Phase ready_for_approval | warning | Ready for Approval | Listo para aprobación |
| Phase ready_to_go | success | Ready to Go | Listo para salir |

Filtros `<option>` = mismas keys que el chip.

##### Criterios sign-off PD

- [ ] Chips Admin+Mechanic: sin `humanize` / enum crudo / UPPERCASE
- [ ] Priority visual distinto low≠normal≠high≠critical
- [ ] Phase ≠ blocker color hack
- [ ] Mechanic Home CTAs i18n + `Button`
- [ ] CompactEmpty in-card donde aplica
- [ ] DS `components.md` / `patterns.md` actualizados si cambia API

**Cola:** tras merge [LTR-21](#ltr-21). Frontend no inventa variants fuera de esta tabla.

---

#### Findings Cristian — Admin WO detail (2026-09-13)

Capturas → decisión PD. Entran en este consistency pass.

##### 1. Back link — **P0**

* **Problem:** `<- Back to Work Orders` texto ASCII, no control canónico.
* **Target:** `Button` `variant="ghost"` (o link pattern DS) + chevron Lucide (`ChevronLeft`), sin `<-` ASCII.
* **Copy EN/ES:** `Back to Work Orders` / `Volver a Work Orders` (keys en `admin-messages`).
* **Owner:** Frontend.

##### 2. Jobs card densidad — **P0**

* **Problem:** “3 en 1” — Select + Assign + badge COMPLETED apilados; whitespace / jerarquía rota.
* **Target layout:**
  * Job **completed/cancelled:** fila read-only — nombre + `Badge` status (matriz §). Sin Select/Assign.
  * Job **to_do:** nombre + assignee `Select` + acción Assign (o auto-save si ya es el patrón CURRENT) en **una fila** desktop; mobile: nombre → Select full-width → Assign.
  * Separar “planificar” de “estado terminal”; no mezclar controles mutables con badge COMPLETED en el mismo stack.
* **Owner:** Frontend (layout). PD sign-off visual.

##### 3. Activity Log JSON crudo — **P0 UX**

* **Problem:** dump JSON/payload en UI — no usable.
* **Target:**
  1. Nunca renderizar raw JSON al operador.
  2. Línea = **event label EN/ES** + timestamp (+ actor si existe).
  3. Si hay reason/pause: `adminPauseReasonLabel` / catalogs; no `humanize` snake_case.
  4. Detalle extra (si hace falta) = 1–2 campos conocidos (job name, from→to), no blob.
* **Owner:** Frontend para event types ya conocidos en client. Si el API solo manda metadata sin `eventType` usable → **Eng Lead** añade campo display-safe o tipado; no bloquear ocultar el dump ahora.
* **Out:** no rediseñar Activity como feed social.
* **Eng Lead (2026-09-13):** UI-only — `eventType` ya tipado; **sin DTO nuevo**. Frontend mapea `eventType` → labels EN/ES en catalogs; oculta payload/JSON.

#### PD sign-off (2026-09-14)

**APPROVE** [PR #92](<https://github.com/lightningtransport/LTL_Shop/pull/92>). P0 checklist OK. Yard densify = [LTR-26](#ltr-26).

---

## LTR-24

**Ops: seed catálogo categorías/jobs (tabla Cristian)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Improvement
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/93**

#### Problema

Cristian pasó tabla categorías/jobs para alinear catálogo (seed) con lo que debe verse en New WO ([LTR-21](#ltr-21)).

#### Objetivo

Seed/actualizar `catalog_jobs` (y categorías si aplica) según tabla de Cristian; PD confirma nombres EN/ES y mapping.

#### Scope

* **Eng Lead:** seed/migración datos según tabla (fuente = Cristian).
* **Product Designer:** confirmar labels EN/ES + categorías vs TARGET [LTR-21](#ltr-21).
* **Frontend:** no bloquea — ya consume `GET /api/catalog/jobs?categoryId=`.

#### Criterios

- [ ] Tabla de Cristian reflejada en prod (o staging → prod)
- [X] PD sign-off nombres EN/ES + jobs discretos (2026-09-14)
- [ ] New WO lista jobs coherente por categoría

#### Owner

Engineering Lead (seed) + Product Designer (confirm)

#### Priority

High — datos de producto

---

#### PD sign-off labels (2026-09-14)

##### (a) EN — confirmados (sin cambio)

 1. Preventive Maintenance (PM)
 2. Inspection
 3. Engine & Emissions
 4. Fuel System
 5. Cooling System
 6. Electrical & Starting
 7. Air & Brake System
 8. Suspension & Steering
 9. Transmission & Drivetrain
10. Tires & Wheels
11. HVAC / A/C
12. Cab, Body & Glass
13. Trailer
14. Road Service & Towing
15. Other

##### (b) ES — labels cortos (display / alias categoría)

| \# | EN | ES |
| -- | -- | -- |
| 1 | Preventive Maintenance (PM) | Mantenimiento preventivo (PM) |
| 2 | Inspection | Inspección |
| 3 | Engine & Emissions | Motor y emisiones |
| 4 | Fuel System | Sistema de combustible |
| 5 | Cooling System | Sistema de enfriamiento |
| 6 | Electrical & Starting | Eléctrico y arranque |
| 7 | Air & Brake System | Aire y frenos |
| 8 | Suspension & Steering | Suspensión y dirección |
| 9 | Transmission & Drivetrain | Transmisión y tren motriz |
| 10 | Tires & Wheels | Llantas y rines |
| 11 | HVAC / A/C | Clima / A/C |
| 12 | Cab, Body & Glass | Cabina, carrocería y vidrios |
| 13 | Trailer | Trailer |
| 14 | Road Service & Towing | Servicio en ruta y grúa |
| 15 | Other | Otro |

Nota glossary: Admin ES puede seguir mostrando **PM** / **Trailer** / **Job** como términos de producto; el ES de arriba es para UI locale Mechanic/Admin cuando haya `displayNameEs` o alias.

##### (c) “Para qué se usa” / ámbitos

**Jobs discretos en catálogo** (1+ `catalogJob` por bullet de la tabla Cristian). No un solo job-blob por categoría. No son solo guía de docs.

Ej. Engine & Emissions → jobs tipo `Oil leak repair`, `EGR service`, `Turbo inspect`, `DPF/DEF service`, `Derate diagnose` (nombres EN canónicos; aliases ES opcionales en follow-up).

Custom job + categoría Other siguen ([LTR-21](#ltr-21)).

##### Relacionado

[LTR-25](#ltr-25) duplica scope → preferir **este** [LTR-24](#ltr-24) como issue canónico de seed; cerrar/merge [LTR-25](#ltr-25) si PM quiere.

##### Naming PM (CRITICAL)

CURRENT API: `category.name === 'PM'`. Seed debe conservar **name=**`PM` (sortOrder 0). Display EN/ES = Preventive Maintenance (PM) / Mantenimiento preventivo (PM) vía campo display o convención UI — **no** renombrar el string `PM` sin PR API.

CURRENT seed hoy (10): PM, Suspension, Brakes, Electrical, Engine, Alignment, Air System, Tires, Transmission, Other.

#### PD sign-off (2026-09-14)

**APPROVE** [PR #93](<https://github.com/lightningtransport/LTL_Shop/pull/93>). 15 cats + 79 jobs; `name=PM` intacto. Residual: Category chips UI usan `name` EN — displayNameEs follow-up Frontend.

---

## LTR-25

**Ops/Data: seed Job Catalog TARGET (15 categorías Cristian)**

- **Estado:** Canceled · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Improvement
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14
- **Adjuntos: —**

#### Objetivo

Seed Job Catalog TARGET según taxonomía firmada por Cristian + PD (2026-09-14).

#### TARGET — 15 categorías (orden)

 1. Preventive Maintenance (PM)
 2. Inspection
 3. Engine & Emissions
 4. Fuel System
 5. Cooling System
 6. Electrical & Starting
 7. Air & Brake System
 8. Suspension & Steering
 9. Transmission & Drivetrain
10. Tires & Wheels
11. HVAC / A/C
12. Cab, Body & Glass
13. Trailer
14. Road Service & Towing
15. Other

#### Jobs

Ámbitos de la lista Cristian → **catalog jobs discretos** (1+ por bullet), no un job-blob. Aliases ES opcionales.

#### Reglas producto

* PM category en catálogo; Admin New WO Standard **excluye** PM (flujo `mechanic.pm`).
* Other + Custom job escape ([LTR-21](#ltr-21)) siguen.
* UI [LTR-21](#ltr-21) por `categoryId` sin cambio.
* Catalog write UI = LATER.

#### Owner

Eng Lead (seed) · PD (contenido firmado) · Frontend no bloqueado

#### Criterios

- [ ] 15 categorías seeded activas
- [ ] Jobs discretos por categoría (cobertura de ámbitos Cristian)
- [ ] New WO Admin lista chips por categoryId
- [ ] PM create path intacto

---

## LTR-26

**UI: densificar Yard Kanban / filters**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/94**

#### Feedback Cristian (2026-09-14) + capturas

1. **Filters:** ocupan demasiado (2 filas de selects) — target: 1 fila / collapse como [LTR-20](#ltr-20) (Search + Filtros sheet mobile).
2. **Kanban cards:** saturadas de texto, muy altas → pocas cards visibles → scroll “infinito” en columnas con muchos trucks (Needs evaluation).
3. **Empty fields:** “No active WO / No mechanics / No blocker / —” pesan igual que datos reales.
4. **Phase 1 unavailable:** banner OK; placeholders más claros para Work location / Incoming / Departures si PD lo define.

##### Target card (baseline PM → PD refina)

* Compact: unit # + phase badge + make/model (1 línea)
* Meta secundaria colapsable o 1–2 campos con dato real (location / WO link)
* Empty = omitir fila o “—” sin prosa larga
* Objetivo: ≥3–4 cards visibles por columna en viewport típico

##### Priority

High — usabilidad Yard bloqueada visualmente

---

#### Problema

Frontend: Yard Kanban / filters density — aparte de [LTR-23](#ltr-23) / PR #92.

#### Objetivo

Densificar filtros/layout Yard (mobile + desktop) alineado a patrón [LTR-20](#ltr-20) (collapse/sheet / toolbar).

#### Owner

Product Designer (spec) → Frontend

#### Priority

Medium — tras [LTR-23](#ltr-23) o en cola post #92

---

#### Spec UX PD (2026-09-14) — draft firmado para implementar post-#92

**Problema Cristian/Frontend:** filters Yard en **2 filas**; cards Kanban **saturadas** (demasiada info / jerarquía débil).

##### Mobile (< md)

1. Barra compacta: Search + botón **Filters** (badge # activos).
2. Board/list visible above the fold con ≥1 card/columna peek.
3. Tap Filters → sheet: readiness, phase, WO status, priority, blocked (+ Apply/Clear).
4. No stack permanente de todos los filtros full-width.

##### Desktop (≥ md)

1. Toolbar **1 fila** nowrap (patrón [LTR-20](#ltr-20)): Search + filtros clave + Apply/Clear.
2. Si no caben: overflow a “More filters” / sheet — no wrap a 2 filas por defecto.
3. Altura chrome filtros \~<120px.

##### Cards Kanban (densidad)

**Por card, máximo:**

* Truck `#` + year/make/model (1 línea truncate)
* Phase `Badge` (matriz [LTR-23](#ltr-23) — color por fase)
* Open WO id o CompactEmpty “No open WO” (1 línea)
* Priority badge solo si ≠ normal **o** blocker flag (1)

**Fuera de la card (van a detail):** Presence, VIN, location larga, multi-métricas, sync/source, lists de requirements.

**Capturas Cristian (2026-09-14):** cards muestran siempre Time/WO/Priority/Mechanics/Blocker/Location aunque vacíos → \~1.5 cards/viewport. **Regla:** omitir filas vacías (`—`, “No active…”, “No mechanics…”, “No blocker…”). Location solo 1 línea truncate o solo en detail. Objetivo **≥3–4 cards visibles** por columna sin scroll. Phase badge sentence case vía [LTR-23](#ltr-23) (no ALL CAPS).

**Above-the-fold:** banner Phase 1 Compact/collapsible OK; summary 3 métricas no deben empujar el board fuera de viewport.

Tap card → `/admin/trucks/[id]`.

##### Copy

`Filters` / `Filtros`; keys existentes `admin-messages` donde haya.

##### Out

[LTR-23](#ltr-23) badges (PR #92) · Presence geofence · Incoming/Departures · cambiar Phase model

##### Criterios

- [ ] Mobile: filters collapsed by default; sheet Apply
- [ ] Desktop: 1 fila filtros (768–1440 sin wrap forzado a 2)
- [ ] Cards: ≤4 líneas de info; sin saturación
- [ ] PD sign-off visual

#### PD sign-off (2026-09-14)

**APPROVE** [PR #94](<https://github.com/lightningtransport/LTL_Shop/pull/94>) tip `eff462e` (draft).

* Mobile: Search + Filters sheet Apply/Clear — Pass
* Desktop: 1-row nowrap + More filters — Pass
* Cards: empty rows omitted; ≤4 lines; tap → truck detail — Pass

**Non-blocking:** `#` + ymm = 2 líneas (TARGET decía 1; densidad OK); CompactEmpty wording largo; unused yard\* strings.

---

## LTR-27

**UI: Truck Information VIN no overlap mobile**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/95**

#### Problema

Cristian: VIN overlap en mobile en **Truck Information** (grid 3-col).

#### Objetivo

VIN legible en mobile: stack o truncate; sin overlap.

#### Scope

Frontend: layout Truck Information < md.

#### Criterios

- [ ] Mobile: VIN sin overlap/corte ilegible
- [ ] Desktop sin regresión

#### Owner

Frontend

#### Note

Si #94 aún open → tip ahí; si no → PR hotfix aparte.

#### PD acceptance (light)

**P0 mobile** — aparte de [LTR-26](#ltr-26)/#94.

* Truck Information `< md`: VIN no se monta sobre “Last reported” / otros campos.
* Preferir stack 1-col o `truncate` + `min-w-0` / `break-all` en VIN; no grid 3-col forzado en mobile.
* Desktop ≥ md: sin regresión de layout.
* Copy: seguir `admin-messages` (VIN / Last reported) — no new strings salvo gap.

PD: light review cuando tip/PR.

#### PD sign-off (2026-09-14)

**APPROVE** [PR #95](<https://github.com/lightningtransport/LTL_Shop/pull/95>) tip `c5258c8`.

* Mobile: VIN full-width + break-all; no overlap Last reported — Pass
* No forced 3-col `< md` — Pass
* Desktop 3-col — Pass

**Non-blocking:** short fields stay 2-col on mobile; section title chrome still hardcoded EN in places.

---

## LTR-28

**UI: iOS PWA safe-area — top nav bajo Dynamic Island**

- **Estado:** Duplicate · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14
- **Adjuntos: —**

#### Problema

Post [LTR-19](#ltr-19) / #97: en iPhone 15 Pro (home screen PWA), el top nav queda **bajo el Dynamic Island** — header inaccesible.

Smoke [LTR-19](#ltr-19) carga: OK. Residual: layout `safe-area-inset-top`.

#### Objetivo

Header usable en standalone iOS (notch / Dynamic Island / home indicator).

#### Scope

Frontend: `env(safe-area-inset-*)` en shell/header (y bottom si aplica). UI-only.

#### Criterios

- [ ] iOS PWA standalone: top nav no queda bajo Dynamic Island / status bar
- [ ] Header tappable (nav items accesibles)
- [ ] Desktop/web browser sin regresión de padding
- [ ] Smoke: icon home screen iPhone 15 Pro (o equiv.)

#### Owner

Frontend

#### Relacionado

[LTR-19](#ltr-19) Done (#97 `b037892`) — hang fix OK; este es layout safe-area.

---

## LTR-29

**P0: PWA iOS safe-area — top nav bajo Dynamic Island**

- **Estado:** Canceled · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14
- **Adjuntos: —**

Duplicate of [LTR-28](#ltr-28). Canonical: [https://linear.app/ltransl/issue/LTR-28/ui-ios-pwa-safe-area-top-nav-bajo-dynamic-island](<https://linear.app/ltransl/issue/LTR-28/ui-ios-pwa-safe-area-top-nav-bajo-dynamic-island>)

---

## LTR-30

**UI: PWA iOS standalone safe-area header (Dynamic Island)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/98**

#### Problema

Cristian iPhone 15 Pro (home screen / standalone): header/nav superior bajo Dynamic Island + status bar. Hamburger + logo + user inaccesibles/solapados.

Relacionado: post [LTR-19](#ltr-19) (`viewport-fit=cover`).

#### Objetivo

Chrome superior usable en PWA iOS standalone — controles visibles y tappeables.

#### PD TARGET (firmado 2026-09-14)

1. Sticky/fixed top chrome (Admin shell + Mechanic/shop shells): `padding-top: env(safe-area-inset-top)` (Tailwind `pt-[env(safe-area-inset-top)]` o spacer equivalente).
2. Controles (hamburger, logo, user) **≥44px** tappable y **totalmente visibles** bajo notch/island.
3. Mantener `viewport-fit=cover` (#97) — no quitar.
4. Bottom: si hay bar fixed → `env(safe-area-inset-bottom)`.
5. Browser (no standalone) + desktop/web sin regresión.

**Out:** rediseño nav; solo inset.

#### Criterios

- [ ] Screenshot Cristian resuelto (header bajo island)
- [ ] Smoke standalone iPhone: hamburger/logo/user tappeables
- [ ] Desktop/web sin regresión
- [ ] PD light APPROVE tip/PR

#### Owner

Frontend (hotfix) · PD light review

#### PD sign-off (2026-09-14)

**APPROVE** [PR #98](<https://github.com/lightningtransport/LTL_Shop/pull/98>) tip `2aa3c52`.

* `env(safe-area-inset-top)` Admin sticky + Mechanic `.app-shell` — Pass
* Hamburger/profile ≥44px; layout guard y≥59 under island — Pass
* `viewport-fit=cover` intact — Pass
* Bottom inset where fixed CTA/sheet — Pass
* Desktop defaults 0 — Pass

**Non-blocking:** locale switcher 36px; New WO CTA sin left/right inset; device smoke Cristian iPhone 15 Pro post-merge.

---

## LTR-31

**UX: clarity journey Readiness Admin (Required → next step)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/101**

#### Problema (Cristian 2026-09-14)

En Admin Truck detail → Readiness, marcar gates como **Required** + Save **no hace nada perceptible**: assessment sigue Under review, Mark Ready to Go queda disabled sin explicación, blockers se apilan (“Required work is unresolved” / “still needs evaluation”) **sin CTA**. Close assessment se confunde con Ready. Journey se siente roto.

Screenshot: Truck 277 — Inspection + Quality Check = Required; 4 gates Not evaluated; Mark Ready inútil.

#### Causa (CURRENT)

Phase 1 = checklist manual 6 gates. `required` **es parking state**, no plan de trabajo:

* No crea/linkea Work Order
* No cambia assessment status (solo Mark Ready → `ready`)
* Bloquea Ready hasta `completed` / `waived` (o `not_required`)
* Create WO vive fuera del Truck detail
* Strings `readyRequirementsIncomplete` / `readyOpenWorkOrder` existen pero **no se renderizan**

TARGET (Master PRD JTBD-M01/M04): inspect → plan Jobs en WO → execute → QC → Mark Ready. CURRENT diverge = checklist paralelo sin next step.

#### Objetivo

Clarity UX en el journey existente (V2.1 mature Truck Detail / Readiness) — **no** rediseño de modelo Phase 1 / nuevas entidades.

#### PD TARGET (firmado)

##### 1. Helper bajo outcome (EN/ES)

* **Required:** “This still has to happen. Ready to Go stays blocked until Completed or Waived.” / ES equivalente (canónicos: Truck, Work Order, Ready to Go).
* **Not required:** “Skip this gate for this review.”
* **Completed:** “This gate is done.” (+ PM/Alignment/Required Repairs: “Link the completed Work Order.”)
* **Not evaluated:** “Decide Required, Not required, Completed, or Waived.”

##### 2. Next step post-Save en Required

| Gate | CTA / copy |
| -- | -- |
| Inspection, Detailing, Quality Check | “When finished, set Outcome to Completed and Save.” (sin WO — API actual) |
| Required Repairs, PM, Alignment | “Required does not create a Work Order. Create/finish the WO, then set Completed.” Link `/admin/work-orders/new` (truck preselected si barato). Prefer picker vs UUID paste si ya hay completed linked WOs. |

##### 3. Banner si quedan Not evaluated

“Ready to Go needs a decision on every gate — including Not required.”

##### 4. Mark Ready disabled → explicación

Renderizar strings existentes:

* `readyRequirementsIncomplete`
* `readyOpenWorkOrder`

Apuntar al primer unresolved. No control muerto.

##### 5. Close ≠ Ready

* Rename **Close assessment** → **End review** (EN) / **Terminar revisión** (ES)
* Helper: “Ends the checklist. Does not mark Ready to Go. Without Ready, Truck leaves Under review.”
* First click **opens** reason form (no toggle-close on same button)

##### 6. Blockers accionables

* “{Gate} is required and not finished — mark Completed or Waived.”
* “{Gate} is not evaluated yet.”
* Ideal: colapsar blockers en las filas de requirement (evitar stack inerte)

#### Out of scope

* Cambiar reglas de derivación phase / markReady (salvo copy)
* Auto-crear WO al poner Required (producto mayor — ticket aparte si PM prioriza)
* Presence / Incoming / Departures

#### Criterios

- [ ] Cristian puede seguir el journey sin “¿por qué no hace nada?”
- [ ] Required muestra next step claro
- [ ] Mark Ready disabled explica por qué
- [ ] End review ≠ Ready en copy
- [ ] EN/ES vía `admin-messages`
- [ ] Desktop/mobile sin regresión layout
- [ ] PD light APPROVE tip/PR

#### Owner

Product Designer (TARGET) → Frontend

#### Priority

High — usabilidad Yard / Manager JTBD bloqueada

#### PD sign-off (2026-09-14)

**APPROVE** [PR #101](<https://github.com/lightningtransport/LTL_Shop/pull/101>) tip `d69beef`.

TARGET 1–6 Pass (helpers, next step Required, banner, Mark Ready why, End review, blockers).

**Non-blocking:** ES Mark Ready legacy "Listo para salir"; unused generic blocker strings.

Smoke Cristian: Truck 277 post-merge.

#### PD sign-off (2026-09-14)

**APPROVE** PR #101 tip `d69beef`. TARGET 1–6 Pass. Residuals no bloqueantes (ES Mark Ready string viejo; unused generic blockers).

---

## LTR-32

**Epic: Truck Work Plan / Ready derived (Yard)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Epic
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-28
- **Adjuntos: —**

#### Objetivo

Reemplazar Phase 1 Readiness (6 gates manuales) por **Truck Work Plan / Ready derivado** de jobs.

#### Decisión (Cristian 2026-09-14)

Priorizar como siguiente producto Yard.

#### TARGET (borrador PD — a firmar en doc)

1. Readiness = derivado, no checklist mantenido a mano.
2. “Readiness Checklist” → **Truck Work Plan / Ready Plan**.
3. Flujo: Arrive → Inspection (Issues → Add work catálogo) → Create Work Plan (Jobs/WO) → Pending/In Progress/Completed → Not Ready — N jobs remaining → QC → Mark Ready.
4. Eliminar gate “Required Work” (redundante).
5. Fases: Inspection → Shop Work → Alignment (si aplica) → Detailing (si yard-fixed) → Final QC → Ready.
6. Mantener: un open WO, Jobs catálogo, Mark Ready final, Close ≠ Ready.
7. Out: no seguir construyendo encima de los 6 dropdowns ([LTR-31](#ltr-31) = puente).

#### Plan de entrega

1. PD: TARGET corto + Linear doc + tickets slice
2. **Slice 1:** Inspection → Add work desde catálogo
3. Eng Lead: feasibility Phase 1 contract / derivation
4. Frontend: slices UI según tickets

#### Owner

PM (control) · PD (TARGET/docs/slices) · Eng Lead (API) · Frontend (UI)

#### Relacionado

[LTR-31](#ltr-31) Done (clarity puente).

#### TARGET corto PD FIRMADO (2026-09-14)

Doc: [Decision: Truck Work Plan / Ready derived](<https://linear.app/ltransl/document/decision-truck-work-plan-ready-derived-post-phase-1-checklist-e6614ddcf96a>)

**Principio:** Show me what this truck still needs before it can leave.

**Modelo:** Truck → Work Plan → Jobs/WO → Ready **derivado**. Eliminar dependencia de gate Required Work. Mark Ready = press manual.

**Defaults firmados Cristian (2026-09-14):** Alignment/Detailing **obligatorios** todo yard truck; Ready **automático** (no Mark Ready como flujo principal; camino corto PM+Alignment+Detailing); board = Shop Work **fase**, jobs en Truck Detail.

##### Slices

1. Inspection → Add work → Work Plan UI + API hooks — **Done** ([LTR-33](#ltr-33)/34/35/11/38)
2. Cutover Phase 1 gates / board derivation — tickets:
   * [LTR-39](<https://linear.app/ltransl/issue/LTR-39/slice-2-api-yard-board-list-phase-from-work-plan-gate-cutover>) Slice 2 API
   * [LTR-40](<https://linear.app/ltransl/issue/LTR-40/slice-2-ui-cutover-admin-yard-truck-detail-off-six-gate-checklist>) Slice 2 UI (blocked by [LTR-39](#ltr-39))
3. (luego) QC + Mark Ready polish sobre plan

**Slice 2 TARGET corto** está en [LTR-39](#ltr-39)/40 — Cristian firma GO para implementar.

---

## LTR-33

**Slice 1 UX: Inspection → Add work → Work Plan (Truck Detail)**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, Feature
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14 · **Padre:** LTR-32
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/104**

#### Parent

[LTR-32](#ltr-32)

#### Objetivo

Primer slice del Work Plan: desde Truck Detail, **Inspection** deja de ser solo un dropdown y pasa a **descubrir trabajo** → Add work (catálogo) → lista **Work Plan** visible.

#### PD TARGET (firmado 2026-09-14)

##### Inspection

* Outcomes de descubrimiento: **No issues found** | **Issues found** (copy EN/ES; canónicos Truck / Work Order / Ready to Go).
* **Issues found** → UI **Add work**: Category (catálogo [LTR-24](#ltr-24)) + Job (chips/search como [LTR-21](#ltr-21)) + Custom opcional + multi-add.
* **Create / update Work Plan** → jobs quedan en el **un** open WO del Truck (crear WO si no hay; link assessment si Phase 1 aún activo).
* **No issues found** → Inspection resuelta sin jobs; no inventar Required Work gate.

##### Work Plan (Truck Detail)

* Lista jobs del plan: displayName + status (Pending / In Progress / Completed — mapear a JobStatus CURRENT).
* Summary: **Not Ready — N jobs remaining**; cuando plan limpio + Alignment + Detailing (obligatorios) → **Ready automático** (sin Mark Ready como flujo principal).
* CTA: Add work (mismo picker); link a WO detail.
* **No** pedir Required/Not required en los 6 gates para este flujo (puede coexistir Phase 1 detrás hasta cutover — Eng decide flag/dual).

##### Defaults firmados Cristian (2026-09-14)

1. Alignment / Detailing: **obligatorios** todo truck yard.
2. Ready: **automático** cuando plan limpio + Alignment + Detailing (+ QC si aplica); Mark Ready no es el flujo principal.
3. Board: Shop Work = **fase**; jobs en Work Plan del detalle.

##### Out slice 1

* Eliminar API de 6 gates (cutover aparte)
* Presence / Incoming / Departures
* Auto Mark Ready legacy button — Ready es **derivado/automático** (Cristian)
* Rediseño completo Kanban (solo no regresar peores)

#### Criterios

- [ ] Manager en Truck Detail: Issues found → añade ≥1 job catálogo sin ir a administrar 6 gates
- [ ] Work Plan lista jobs + estados; N remaining visible
- [ ] Un open WO; jobs en catálogo/custom
- [ ] EN/ES `admin-messages`
- [ ] Mobile usable; desktop OK
- [ ] PD light APPROVE tip/PR

#### Owner

Frontend (UI) · Eng Lead (API/WO link — ver ticket hermana) · PD (sign-off)

#### Priority

High — slice 1 epic [LTR-32](#ltr-32)

#### PD sign-off (2026-09-14)

**APPROVE** [PR #104](<https://github.com/lightningtransport/LTL_Shop/pull/104>) tip `86b8a77`.

Inspection Add work + Work Plan + readyReason/mandatory Pass. Flag off default (`sliceEnabled`).

**Non-blocking:** ES “issues”; copy jobs_remaining when N=0 empty plan; dual-run board vs detail.

Smoke: enable `YARD_WORK_PLAN_SLICE1` then Truck Detail.

#### PD sign-off (2026-09-14)

**APPROVE** PR #104 tip `86b8a77`. TARGET Pass. Residuals no bloqueantes (ES issues; jobs_remaining N=0). Flag off default — coordinar enable.

---

## LTR-34

**Slice 1 API: Work Plan from Truck Detail (feasibility + hooks)**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** API
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-14 · **Padre:** LTR-32
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/103**

#### Parent

[LTR-32](#ltr-32)

#### Objetivo

Feasibility + API mínima para Slice 1: Inspection → Add work crea/actualiza jobs en el open WO desde Truck Detail; Ready/Not Ready derivado de jobs abiertos (sin depender de los 6 gate outcomes).

#### PD TARGET (contrato producto)

Ver doc: [Decision Truck Work Plan](<https://linear.app/ltransl/document/decision-truck-work-plan-ready-derived-post-phase-1-checklist-e6614ddcf96a>) + UX sibling.

##### Debe soportar

1. Desde Truck Detail (capability `yard.operations.manage` / `work_orders.manage` — Eng confirma):
   * Si no hay open WO → crear uno linked al Truck (+ assessment si Phase 1 dual)
   * Add catalog job / custom al WO (reusar paths New WO / job picker)
2. Leer Work Plan: jobs del open WO con status para UI
3. Derivación **slice 1**: Not Ready si hay jobs no completed/cancelled; opcional QC gate después (puede quedar manual Mark Ready)
4. **No** auto-delete Phase 1 assessment aún — dual-run o feature flag hasta cutover

##### Out

* Borrar `updateRequirement` / 6 gates en este ticket
* Presence

#### Criterios

- [ ] Proposal corta: endpoints / reuse vs new; dual-run plan
- [ ] API usable por Frontend Slice 1 UX
- [ ] PD + PM ack del approach antes de merge grande

#### Owner

Engineering Lead

#### Priority

High — blocks / pairs Frontend Slice 1

#### Cristian rules (2026-09-14) — update TARGET

* Alignment + Detailing **mandatory** every yard truck.
* Ready **automatic** when Work Plan clear + mandatory phases done (esp. light path PM+Alignment+Detailing). Mark Ready not primary Manager flow.
* Board: Shop Work = phase; jobs in Truck Detail.

#### PD ACK (2026-09-14)

**ACK** draft [PR #103](<https://github.com/lightningtransport/LTL_Shop/pull/103>) — Pass vs Decision Work Plan / Slice 1.

Open Qs answered:

1. Detailing: custom OK Slice 1; Ops seed follow-up
2. PM-on-Standard: keep CURRENT (PM WO then Standard)
3. QC: only if QC job on plan
4. Shop Work Kanban column: later
5. Heavy repair: 100% auto Ready Slice 1

Eng: draft→ready. FE: [LTR-33](#ltr-33) unblocked.

---

## LTR-35

**Ops: seed Detailing catalog job (Work Plan mandatory)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Improvement
- **Creado:** 2026-09-14 · **Cerrado:** 2026-09-15 · **Padre:** LTR-32
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/105**

#### Problema

[LTR-34](#ltr-34) Ready requiere ≥1 job **Detailing** completed, pero [LTR-24](#ltr-24) seed **no tiene** categoría/job Detailing. Slice 1 usa custom name match — frágil para auto-Ready.

#### Objetivo

Seed categoría/job **Detailing** (EN/ES) en catálogo para la lane obligatoria del Work Plan.

#### Product labels (PO firmado 2026-09-14)

| Campo | EN | ES |
| -- | -- | -- |
| Category | Detailing | Detailing |
| Job displayName | Detailing | Detailing |

Regla Admin ES: no traducir Job/Truck/Work Order en labels Admin — **Detailing** queda igual EN/ES (como Alignment).

#### Relacionado

[LTR-34](#ltr-34) · [LTR-24](#ltr-24) · epic [LTR-32](#ltr-32) · pilot [LTR-11](#ltr-11)

#### Owner

Eng Lead (seed) · PO labels arriba (PD puede afinar microcopy después)

#### Criterios

- [X] Existe categoría + job Detailing en catálogo (prod/seed)
- [X] Visible en Add work / jobs-by-category como [LTR-21](#ltr-21)
- [X] Ready derivado puede matchear por catalog id (no solo custom name)

#### Done (2026-09-15)

Catalog apply + prod API READY. Detailing live. Smoke-ready Truck 277 ([LTR-11](#ltr-11)).

#### Priority

**High** — unblock reliable auto-Ready Detailing en paralelo a [LTR-33](#ltr-33)

#### PD sign-off (2026-09-14)

**APPROVE** [PR #105](<https://github.com/lightningtransport/LTL_Shop/pull/105>) tip `dc5db12`. Detailing category+job; PM intact; 16 cats (Detailing before Other).

---

## LTR-36

**Fix: Admin first-load Unable to load (WO list + Truck Yard)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Bug
- **Creado:** 2026-09-15 · **Cerrado:** 2026-09-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/107**

#### Problema (PD re-audit 2026-09-15)

Prod `ltl-shop-web.vercel.app` (Work Plan flag ON):

* `/admin/work-orders` first load → “Unable to load current administrative data.”
* Truck 277 detail → “Unable to load Yard Operations.”
* **Retry** recovers both — first-load reliability is broken.

Relacionado histórico Done: [LTR-14](#ltr-14) (regresión).

#### Objetivo

First paint de Admin WO list + Truck Detail / Yard carga sin Retry.

#### Criterios

- [ ] Cold open WO list y Truck detail sin LoadFailure
- [ ] Retry sigue existiendo para fallos reales
- [ ] Repro/doc causa (API cold / race / auth)

#### Owner

Engineering Lead (API) · Frontend (client fetch)

#### Priority

Urgent — blocker Admin core

#### PD/code note (2026-09-15)

* UI hides real `ApiError`; static LoadFailure + manual Retry.
* SWR: `errorRetryCount: 0`.
* `apiFetch` GET timeout **8s**.
* Admin cold race: SWR starts without waiting for Bearer/profile; cookie ≠ LS token.
* Truck GET + sequential Work Plan when flag ON increases latency.

#### PD sign-off (2026-09-15)

**APPROVE** [PR #107](<https://github.com/lightningtransport/LTL_Shop/pull/107>). Token gate + soft-retry; WO/Truck/Yard no flash LoadFailure cold open.

**Non-blocking:** other Admin lists may still flash error during auto-retry.

---

## LTR-37

**UI: Yard/Work Plan polish (truncate, ES, ymm dup, empties)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX
- **Creado:** 2026-09-15 · **Cerrado:** 2026-09-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/106**

#### Problema (PD re-audit 2026-09-15 prod)

Post Slice 1 / Yard densify — should-fix UI:

1. Yard filters/chips truncados (“Search Work Order…”, “Upcoming Departures unavaila…”)
2. ES parcial (“Cargar más Trucks” + Work Order/Truck/Jobs mezclado)
3. Yard list make/model duplicado (“PETERBILT PETERBILT 579”)
4. Add Work → Detailing: sin empty-state (solo Custom disabled)
5. Empty column copy incompleto (“No Trucks in this”)

#### Objetivo

Copy + layout polish sin rediseño.

#### Owner

Frontend · PD light review

#### Priority

High

#### PD review (2026-09-15)

**CHANGES** [PR #106](<https://github.com/lightningtransport/LTL_Shop/pull/106>) tip `dd05d9d`.

* Pass: ES, YMM dedupe, Detailing empty, empty column copy
* Fail: Yard truncate @390/@768 (chips + search)

Re-review when tip fixes nowrap/truncation.

#### PD sign-off (2026-09-15)

**APPROVE** [PR #106](<https://github.com/lightningtransport/LTL_Shop/pull/106>) tip `fc097d9`.

Target 1 truncate Pass @390/@768 after fix. Targets 2–5 still Pass.

**Non-blocking:** 1280 search placeholder last letter clip.

#### PD sign-off (2026-09-15)

**APPROVE** PR #106 tip `fc097d9`. Target 1 Pass @390/@768. Nit 1280 placeholder — non-blocking.

---

## LTR-38

**Admin: Complete / mark-done control on Work Plan jobs**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Feature
- **Creado:** 2026-09-16 · **Cerrado:** 2026-09-16 · **Padre:** LTR-32
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/115**

#### Parent

[LTR-32](#ltr-32) / follow-up from [LTR-11](#ltr-11) pilot (2026-09-16)

#### Finding

Shop Manager / Admin can build the Work Plan (Inspection → Add work → remaining jobs / Not Ready) but **cannot complete Jobs from Admin Truck Detail or Admin WO detail**. WO-048 only exposes Assign / Cancel job — no Complete.

So the Manager cannot drive the plan to **Ready** alone; Ready requires Mechanic job completion (or a missing Admin complete path).

#### Evidence

* Truck **277** Work Plan: Not Ready — 2 remaining (Alignment + Detailing Pending)
* WO-048 Admin UI buttons: Add mechanic, Pause, Cancel, Assign, Confirm job cancellation, Add job — **no Complete**
* Copy correctly says Ready is derived automatically

#### Decision (Cristian 2026-09-16)

**TARGET = option 2:** Admin needs a **Complete / mark-done** control on plan jobs so Shop Manager can drive the plan toward Ready without depending only on Mechanic completion.

#### Scope (implementation)

* Admin Truck Detail Work Plan and/or Admin WO detail: Complete (mark-done) for open plan jobs
* Caps: require `work_orders.manage` (same Manager path as Add work)
* After Complete → remaining count / Ready derivation updates (Alignment + Detailing still apply)
* EN/ES copy; mobile-usable control
* Do **not** revive six-gate checklist UX

#### Acceptance

- [ ] Manager can mark a Pending/In Progress Work Plan job Complete from Admin
- [ ] Work Plan remaining / Not Ready → Ready updates without leaving Truck Detail / WO Admin
- [ ] Mechanic path unchanged (still can complete jobs)
- [ ] Audit/activity log records who completed the job

#### Out of scope

Not a Phase 1 six-gate polish ticket. Full Slice 2 gate cutover stays under [LTR-32](#ltr-32).

---

## LTR-39

**Slice 2 API: Yard board / list phase from Work Plan (gate cutover)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** API
- **Creado:** 2026-09-16 · **Cerrado:** 2026-09-16 · **Padre:** LTR-32
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/116**

#### Parent

[LTR-32](<https://linear.app/ltransl/issue/LTR-32/epic-truck-work-plan-ready-derived-yard>) · Decision: [Truck Work Plan / Ready derived](<https://linear.app/ltransl/document/decision-truck-work-plan-ready-derived-post-phase-1-checklist-e6614ddcf96a>)

#### Context

Slice 1 (`YARD_WORK_PLAN_SLICE1`) already derives **Ready / phase / mandatory Alignment+Detailing** on Truck Detail `workPlan`. Yard **board / list** `phase` still follows Phase 1 **six-gate** assessment (`docs/YARD_OPERATIONS_PHASE_1_CONTRACT.md`).

Pilot [LTR-11](<https://linear.app/ltransl/issue/LTR-11/pilot-work-plan-ready-derived-post-slice-1>) + Admin complete [LTR-38](<https://linear.app/ltransl/issue/LTR-38/admin-complete-mark-done-control-on-work-plan-jobs>) closed the Manager path on Detail. Slice 2 = **same truth on the board**.

#### TARGET (corto — firmar)

1. When Work Plan cutover flag is on, Yard board/list truck **phase + readiness** use the **same derivation** as Truck Detail Work Plan (`yard-work-plan-derivation`), not six-gate outcomes.
2. Board columns (opción A firmada): **Inspection → Shop Work → Alignment → Detailing → Ready** (Shop Work = una columna; jobs solo en Truck Detail).
3. Ready = **automático** cuando plan limpio + Alignment + Detailing completos (defaults Cristian 2026-09-14). No Mark Ready como flujo principal.
4. Flag: extend `YARD_WORK_PLAN_SLICE1` **or** introduce `YARD_WORK_PLAN_SLICE2` — Eng Lead elige; default safe until cutover. Document in CURRENT_PRODUCT_STATUS.
5. Phase 1 contract remains CURRENT until this ships; do not delete gate APIs yet (UI hide is sibling ticket).

#### Scope

* API: Yard operations list/board payload phase/readiness from Work Plan when flag on
* Reuse `classifyWorkPlanLane` / mandatory Alignment+Detailing / remaining jobs
* Caps unchanged (`yard.operations` read; manage where already required)
* Tests: derivation parity Detail ↔ board for representative trucks

#### Out of scope

* Presence / Incoming / Departures
* QC mandatory-always decision (still open in decision doc) — keep QC as optional lane if jobs present; no new product rule
* Permissions UI / roster ([LTR-12](<https://linear.app/ltransl/issue/LTR-12/ops-q14-roster-grants-post-ownership-cutover>))
* UX polish pass (post-cutover iterations)

#### Acceptance

- [ ] Flag on: board column for a truck matches Truck Detail Work Plan `phase` / Ready
- [ ] Flag on: completing Alignment+Detailing (+ open shop jobs) moves truck toward Ready on board without editing six gates
- [ ] Flag off: Phase 1 six-gate board behavior unchanged
- [ ] EN/ES not required on API; contract/docs updated

#### Owner

Eng Lead (API) · PD (TARGET) · PM (priority)

---

## LTR-40

**Slice 2 UI: Cutover Admin Yard + Truck Detail off six-gate checklist**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** Feature
- **Creado:** 2026-09-16 · **Cerrado:** 2026-09-16 · **Padre:** LTR-32
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/117**

#### Parent

[LTR-32](<https://linear.app/ltransl/issue/LTR-32/epic-truck-work-plan-ready-derived-yard>) · Decision: [Truck Work Plan / Ready derived](<https://linear.app/ltransl/document/decision-truck-work-plan-ready-derived-post-phase-1-checklist-e6614ddcf96a>)

#### Depends on

Sibling **Slice 2 API** (board/list phase from Work Plan). Ship after or with that flag.

#### TARGET (corto — firmar)

1. When Work Plan cutover flag is on, Admin **does not** present six-gate Readiness checklist as the Manager’s primary work (no Required/Not required journey).
2. Truck Detail primary surface = **Work Plan** (Inspection → Add work → jobs → Marcar completado → Ready derivado) — already Slice 1 + [LTR-38](<https://linear.app/ltransl/issue/LTR-38/admin-complete-mark-done-control-on-work-plan-jobs>).
3. Yard board columns/labels = Work Plan phases (**Inspection → Shop Work → Alignment → Detailing → Ready**), not gate names. Copy EN/ES.
4. Hide or demote Phase 1 assessment UI (Start assessment / gate dropdowns / Mark Ready gate flow) behind cutover — no dead-end Required journey ([LTR-31](<https://linear.app/ltransl/issue/LTR-31/ux-clarity-journey-readiness-admin-required-next-step>) bridge retires).
5. Mobile-usable; do not revive six-gate polish.

#### Scope

* Frontend: Yard Kanban columns + filters/chips aligned to Work Plan phases when flag on
* Frontend: Truck Detail — suppress six-gate section when Work Plan enabled; keep Work Plan as source of truth
* Messages EN/ES for board phases / empty columns
* e2e smoke: board column + Detail Ready after Admin complete jobs

#### Out of scope

* Presence / Incoming / Departures
* Slice 3 QC + Mark Ready polish
* Creating users / roster grants
* Broad design-system consistency pass

#### Acceptance

- [ ] Flag on: Manager can run yard from board + Truck Work Plan **without** touching six gates
- [ ] Flag on: board labels/phases match Work Plan (opción A)
- [ ] Flag on: six-gate checklist not the primary UI path on Truck Detail
- [ ] Flag off: Phase 1 UI unchanged
- [ ] EN/ES for new board copy

#### Owner

Frontend · PD (TARGET) · PM (priority)

---

## LTR-41

**Slice 3: QC catalog + Ready polish on Work Plan**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Feature
- **Creado:** 2026-09-16 · **Cerrado:** 2026-09-17 · **Padre:** LTR-32
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/118**

#### Parent

[LTR-32](<https://linear.app/ltransl/issue/LTR-32/epic-truck-work-plan-ready-derived-yard>) · Decision: [Truck Work Plan / Ready derived](<https://linear.app/ltransl/document/decision-truck-work-plan-ready-derived-post-phase-1-checklist-e6614ddcf96a>)

#### Depends on

Slice 2 Done ([LTR-39](<https://linear.app/ltransl/issue/LTR-39>)/[LTR-40](<https://linear.app/ltransl/issue/LTR-40>)). Flags on in API prod.

#### TARGET corto (firmado por GO de Cristian 2026-09-16)

1. Keep QC **optional unless a QC job is on the plan**; Ready stays **automatic** (no Mark Ready as Manager path).
2. Seed catalog **Quality Check** (category + job) so managers can add QC the same way as Detailing.
3. Truck Detail: next-step CTAs when Alignment / Detailing / QC are pending; remove Mark Ready / six-gate residual copy.
4. When QC is on the plan: show mandatory QC + board QC column; completing it auto-moves to Ready.
5. Out: roster, presence, QC-always-mandatory (needs separate GO), delete `mark-ready` API.

#### Acceptance

- [ ] Catalog has Quality Check category + job ([LTR-35](#ltr-35) pattern)
- [ ] Add work can place a QC-lane job; plan shows QC mandatory + `qc_pending` until complete
- [ ] Completing QC (with Alignment+Detailing done) → Ready auto / board Ready column
- [ ] Work Plan copy no longer pushes Mark Ready / six-gate as the path
- [ ] Pending Alignment/Detailing/QC have a clear next-step CTA into Add work

#### Owner

Frontend + API seed · PD (TARGET)

---

## LTR-42

**BLOCKER: WO create missing from Manager list + finish notes + no refresh**

- **Estado:** Canceled · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Bug
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-20
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/121**

#### Problema (Cristian 2026-09-19 \~22:41 ET)

En prod, tras crear una Work Order y que el mecánico finalizara:

1. La WO **no aparece** en `/admin/work-orders` (lista Manager).
2. El Manager **no ve el comentario** del mecánico al terminar el trabajo.
3. La UI **no se actualiza** (estado/lista stale).

Prod: [https://ltl-shop-web.vercel.app](<https://ltl-shop-web.vercel.app>)

#### FINAL LOCK (this turn)

Canónico = [LTR-42](#ltr-42). [LTR-43](#ltr-43) is Duplicate. One combined API+FE PR: [https://github.com/lightningtransport/LTL_Shop/pull/121](<https://github.com/lightningtransport/LTL_Shop/pull/121>)

#### Root cause

Admin list is unscoped (no default assignee/status filter). The list looked empty because create returned a mechanic DTO and SWR Infinite kept a stale first page. Mechanic JOB FINISHED sent no body; finish notes were never written to Activity Log `newValue.notes`, and Admin Activity UI only rendered label + actor.

#### Fix (PR #121)

* `POST /api/admin/work-orders` returns Admin detail DTO.
* Mechanic/Admin complete Job accept optional `notes` → Activity Log + `completionNotes` on Admin jobs.
* FE prepends created WO, revalidates without wiping cache, polls 15s, renders notes on Jobs + Activity.

#### Local verify

WO-001 `77c9f5f6-68b8-4a68-abab-1523ce661946` — Manager list shows it; Job row and Activity Log show “Replaced the air hose. Ready for Manager review.”

---

## LTR-43

**Fix: WO creada no visible en Manager list + comentario mechanic finish + UI stale**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Bug
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-20
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/121**

#### Problema (Cristian 2026-09-19 \~22:41 ET)

En prod, tras crear una Work Order y que el mecánico finalizara:

1. La WO **no aparece** en `/admin/work-orders` (lista Manager).
2. El Manager **no ve el comentario** del mecánico al terminar el trabajo.
3. La UI **no se actualiza** (estado/lista stale).

Prod: [https://ltl-shop-web.vercel.app](<https://ltl-shop-web.vercel.app>)

#### Split

* **Frontend:** filtros lista, SWR mutate/revalidate, render finish notes
* **Eng Lead:** API list query / caps / notes payload

#### Criterios

- [X] WO nueva visible en Manager list (local: WO-001)
- [X] Finish note mechanic visible en Admin WO detail / Activity
- [X] Tras finish, Manager ve estado actualizado
- [X] Causa raíz documentada

#### Root cause

Admin list is unscoped (no default assignee/status filter). The list looked empty because create returned a mechanic DTO and SWR Infinite kept a stale first page. Mechanic JOB FINISHED sent no body; finish notes were never written to Activity Log `newValue.notes`, and Admin Activity UI only rendered label + actor.

#### PR

Combined API+FE: [https://github.com/lightningtransport/LTL_Shop/pull/121](<https://github.com/lightningtransport/LTL_Shop/pull/121>) (close FE-only #120).

#### Owner

Frontend · Eng Lead

#### Priority

Urgent

#### FINAL LOCK (PM+PO)

Canónico = [LTR-43](#ltr-43) only. [LTR-42](#ltr-42) canceled. NO más flips.

#### PD sign-off (2026-09-19)

**APPROVE** [PR #121](<https://github.com/lightningtransport/LTL_Shop/pull/121>). Fullstack; #120 closed.

Smoke criteria Pass: Manager list + finish note (Job/Activity) + refresh.

**Non-blocking:** note not on WO Notes card; assign mechanic on create for My Assigned Work.

---

## LTR-44

**UX: feedback visible after create WO / finish (no silent no-op)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-20 · **Padre:** LTR-45
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/124, https://github.com/lightningtransport/LTL_Shop/pull/123**

#### Problema (Cristian room 2026-09-20)

Create WO y finish WO “no pasa nada” — falta feedback perceptible (toast, redirect, lista/detail refresh).

Relacionado post [LTR-43](#ltr-43)/#121; puede coexistir con smoke.

#### Objetivo

Tras create/finish, Manager/Mechanic ven resultado claro sin dudar si falló.

#### Scope

apps/web: success toast EN/ES, navigate o mutate SWR, estados loading en CTAs.

#### Criterios

- [X] Create WO → feedback + aparece en lista/detalle
- [X] Finish job/WO → feedback + nota/estado visible
- [X] CTAs disabled mientras submit
- [X] PD light APPROVE

#### Ship

Canónico mergeado: [PR #124](<https://github.com/lightningtransport/LTL_Shop/pull/124>) `33bfd11` (toast path). Web prod READY.

[PR #123](<https://github.com/lightningtransport/LTL_Shop/pull/123>) = draft + conflictos (banner path) — closing as superseded by #124.

#### Owner

Frontend · PD

#### Priority

High

---

## LTR-47

**Producto: lanzar Shop sin Ninox en vivo**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-20 · **Padre:** LTR-45
- **Adjuntos: —**

#### Decisión (Cristian 2026-09-20)

**Sí: el Shop abre sin Ninox en vivo.**

| Tema | Día 1 |
| -- | -- |
| Sync Ninox runtime | No. Cliente sigue stub. `DATA_SOURCE=supabase`. |
| Dual-write | Diferido a propósito. |
| `E.TA` mechanic_status | No se muestra ni se escribe. El Shop usa Returned to Service + fases / Work Plan. |
| Trailers UC | Siguen siendo **categoría de Job**, no flota sincronizada. ID Ninox no se inventa ([LTR-56](<https://linear.app/ltransl/issue/LTR-56>)). |
| Llave | `truckNumber` = Ninox `E.A` solo si comparan listas. Semilla one-shot = [LTR-52](<https://linear.app/ltransl/issue/LTR-52>). |

#### Criterios

- [X] Decisión escrita (sí/no sync día 1)
- [X] `E.TA` no entra en día 1
- [X] Trailers no son flota sincronizada en día 1

Fuente: `docs/GO_LIVE_CHECKLIST_ES.md`.

---

## LTR-48

**Producto: quién da de alta un camión nuevo**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-20 · **Padre:** LTR-45
- **Adjuntos: —**

#### Decisión (Cristian 2026-09-20)

**Día 1: no hay editor Admin de camiones.** Alta = ops/ingeniería, no UI.

| Quién | Cómo |
| -- | -- |
| Flota inicial | [LTR-52](<https://linear.app/ltransl/issue/LTR-52>) semilla one-shot Ninox GET → upsert por VIN + `truckNumber`. |
| Camiones nuevos después | Pedido a Eng Lead: insert/upsert en `trucks`. Sin `db:seed` de demo en prod. |
| Producto | UI de alta de camiones **fuera de día 1**. |

#### Criterios

- [X] Owner de alta: Eng Lead (ops), no Mechanic/Manager self-serve
- [X] Proceso: seed one-shot + upsert puntual; nunca seed demo en prod

Fuente: `docs/GO_LIVE_CHECKLIST_ES.md` + `docs/NINOX_TRUCK_SEED.md`.

---

## LTR-49

**Producto: flags Work Plan encendidos en producción**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Go-live
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-20 · **Padre:** LTR-45
- **Adjuntos: —**

#### Decisión (Cristian 2026-09-20)

**Sí: Work Plan es el patio de día 1.** `YARD_WORK_PLAN_SLICE1` y `YARD_WORK_PLAN_SLICE2` deben estar **on** en producción (API).

Evidencia (sin leer valores secretos): ambas keys existen en Vercel `ltl-shop-api` para **production** y **preview** ([LTR-11](#ltr-11)/39/40 ya operaron con Slice 1–2). El smoke [LTR-51](<https://linear.app/ltransl/issue/LTR-51>) confirma que el Manager ve Work Plan, no el checklist de 6 gates.

Si el patio en prod volviera a 6 gates, es un defecto de env — no un cambio de producto.

#### Criterios

- [X] Decisión: flags ON en prod
- [ ] Smoke Manager del patio ([LTR-51](#ltr-51))

Relacionado: [LTR-32](<https://linear.app/ltransl/issue/LTR-32>).

---

## LTR-50

**Producto: lanzar sin mutación Off Duty**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-20 · **Padre:** LTR-45
- **Adjuntos: —**

#### Decisión (Cristian 2026-09-20)

**Sí: se lanza sin mutación Off Duty.**

No es bloqueo de mapper, ownership V2, ni Work Plan. Implementación queda gated/diferida (no este ticket).

#### Criterios

- [X] Decisión día 1: sin Off Duty write
- [X] No se abre implementación ahora

---

## LTR-51

**Ops: smoke producción del Flujo v3 con cuentas de prueba (Manager + mecánicos)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-28 · **Padre:** LTR-45
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/202**

#### Scope

Smoke en **producción** del flujo Flujo v3 completo con las 6 cuentas de prueba ([LTR-99](#ltr-99)): Crixcrox (admin), Cristian (manager), MG (Standard), MPM (PM), MD (Detailing), MA (Alignment). Los usuarios reales vienen después ([LTR-161](#ltr-161)).

Safari móvil sigue OPERATOR_REQUIRED (`docs/audit/V1_003_RELEASE_SMOKE.md`). Incluirlo aquí.

Usar un truck de prueba sin WO abierta. Truck **612** (millaje inicial 323,771) · **WO-013**

#### 0. Preparación

- [X] Setup → Flujo del taller: PM → MPM, Alignment → MA, Detailing → MD; QC "Manager, sin asignación"
- [X] Login de cada cuenta aterriza donde debe: Cristian → Admin; MG/MD/MA → Mi trabajo (Standard); MPM → PM (Crixcrox no probado en este smoke)

#### 1. Crear la WO (Cristian)

- [X] Nueva WO pide solo truck, prioridad y nota (sin categoría ni jobs)
- [X] La WO nace con PM A Service (MPM), Alignment (MA), Detailing (MD) y Quality Check (sin responsable)
- [X] Truck → Siguiente paso = "Registra la inspección"

#### 2. Inspección (Cristian, en el Truck)

- [X] Hallazgos → agregar un job de Shop Work y asignarlo a MG desde el Work Plan (Brake Inspection; el botón Asignar del Siguiente paso lleva al selector)
- [X] Siguiente paso pasa a "Quedan N Jobs · siguiente: …"
- [X] Yard, Dashboard y lista de trucks muestran el mismo siguiente paso (work · Brake Inspection · 5 en las cuatro)

#### 3. Trabajo por mecánico

- [X] MG solo ve su job (no PM/Alignment/Detailing); Iniciar → completar → "Terminaste tu parte" y su tiempo se detiene (sus otros jobs = In progress, los ajenos = Pending)
- [X] MA: Iniciar → completar Alignment (solo ve Alignment; "Terminaste tu parte" y tiempo detenido tras recargar)
- [X] MD: Iniciar → **Reportar bloqueo** en Detailing (Waiting for Parts) → agregar nota "ya llegó la pieza" → su tiempo se detiene
- [X] No hay "Marcar resuelto" para el mecánico ("Solo el Manager resuelve un bloqueo")

#### 4. Bloqueo (Cristian)

- [X] Dashboard → Needs attention muestra "Blocked · Detailing: Waiting for Parts" (reportado por MD) — **sin la nota** (hallazgo 8)
- [X] Resolver con nota desde el Dashboard → 612 sale de Needs attention; Truck → "3 Jobs left · next: PM A Service"
- [X] MD ve "Resolved · tap Continue" en su Home → Continuar → completa Detailing (3 de 5; "Terminaste tu parte", 1m)

#### 5. PM (MPM)

- [X] MPM aterriza en PM y ve solo el PM de 612 (y 908); arranca, registra millaje 323,771 y 1 parte (2234788 Paccar Oil Filter), Finish Work → sale de su lista, completados 2 → 3
- [X] El millaje del truck queda en 323,771 (Truck details y Repair history)

#### 6. QC y cierre (Cristian, en el Truck)

- [X] Siguiente paso = "Everything else is done. Check Quality Check." → Mark QC complete
- [X] Siguiente paso = "Close Work Order" → cerrar → truck **Ready to Go**; Dashboard Ready to Go 2→3, Completadas hoy 0→1, Abiertas 10→9; Yard muestra 612 en Ready to Go con botón Return to Service (ver hallazgo 12)
- [X] Return to Service desde el Truck con motivo → Siguiente paso "This Truck has no open Work Order · New Work Order"; Dashboard Ready to Go 3→2; Operational status In Service
- [X] Valida [LTR-60](#ltr-60) (Completed ≠ Ready to Go ≠ Return to Service) y [LTR-59](#ltr-59) (Truck detail canónico)
  * Repair history: WO-013 con sus 5 jobs y millaje. Completed ≠ Ready to Go ≠ Return to Service se distingue bien (ver hallazgos 12 y 13)

#### 7. Otros

- [X] ES/EN: Admin (Dashboard y Truck) y mecánico (Standard y PM) en ES sin textos rotos (vuelta 2)
- [X] Safari iOS PWA: **excepción documentada** (28 sep 2026). No probado en iPhone real; queda OPERATOR_REQUIRED para el primer uso en el taller (instalar en pantalla de inicio, login, un flujo corto).

#### Criterios

- [X] Login landings correctos (caps)
- [X] Flujo Manager + Standard + PM PASS (end-to-end en prod, 28 sep 2026; con hallazgos 1–13 de UX/consistencia)
- [X] Siguiente paso coherente en Truck / Yard / Dashboard / WO
- [X] Safari iOS PWA smoke o excepción documentada (excepción)

#### Vuelta 2 (tras [LTR-164](#ltr-164), WO-014 en el truck 612)

- [X] Nueva WO: sin parpadeo de "sin permiso" (esqueleto de carga) — [LTR-164](#ltr-164) #1
- [X] WO nace en "Record the inspection" (no hereda la inspección de WO-013) — #13
- [X] Detalle WO: QC sin selector de mecánico; "Mark complete" primario solo en QC — #2
- [X] Mechanics = MA, MD, MPM (incluye al dueño del PM) — #11
- [X] Mandatory steps en "Pending · 1" antes de empezar — #3
- [X] No issues found → Siguiente paso "4 Jobs left · next: PM A Service"
- [X] MA: Start Work → sin WORK OPTIONS vacía (#5); completar Alignment → "Terminaste tu parte" y tiempo detenido al instante, sin recargar (#7)
- [X] Mecánico en ES sin textos rotos (Home y detalle de WO)
- [X] MD con la WO ya In Progress: ve "Iniciar trabajo" y "Pulsa Iniciar trabajo…", no "Continuar" (#6); completa Detailing (2 de 4, "Terminaste tu parte" al instante)
- [X] MPM: WO-014 sale "En progreso" en la Home (WO-008 sigue "Creado") — #10; PM con millaje 323,771 + 1 parte → Terminar trabajo → sale de su lista (Home PM en ES OK)
- [X] Cristian: Marcar QC completo → Cerrar Work Order → 612 Ready to Go; **Dashboard 1 = Yard 1** (#12) → Return to Service con motivo → "La Inspección todavía no está registrada" y 4 pasos Pendiente, sin limpieza manual (#13)
- [X] Admin en ES en el Truck (sin textos rotos; ver hallazgo 14)

**Resultado vuelta 2: PASS.** Todos los hallazgos de [LTR-164](#ltr-164) verificados en prod.

#### Hallazgos

 1. Setup → Flujo del taller y Nueva WO muestran un instante "no tienes permiso" antes de cargar la sesión (parpadeo).
 2. Detalle de WO: QC muestra selector de mecánico y "Mark complete" sigue primario en todos los jobs (D15 solo se aplicó en el Work Plan del Truck).
 3. Work Plan → Mandatory steps dice "In Progress · 1" en PM/Alignment/Detailing/QC aunque nadie empezó (los jobs dicen Pending).
 4. **Bug:** Dashboard marca "Unassigned Jobs" en toda WO porque QC nunca tiene responsable (D15). Excluir QC del motivo `unassigned`.
 5. WO del mecánico: tras Start Work la sección "WORK OPTIONS" queda vacía (título sin contenido).
 6. Mecánico que aún no empezó en una WO ya In Progress ve el botón "Continue" mientras el texto dice "Press Start Work" (debería decir Start Work).
 7. Tras "Complete job", la pantalla no se refresca: el job sale a la vez en Your Jobs (In progress) y en Completed, el tiempo sigue "running" y no aparece "Terminaste tu parte" hasta recargar.
 8. La nota del mecánico en el bloqueo ("ya llegó la pieza") no se ve en el Dashboard ni en el Truck; solo en el detalle de la WO → Reported blockers.
 9. Detalle WO → Reported blockers: el bloqueo resuelto sigue diciendo "Blocked" y no muestra la nota de resolución del Manager (solo "Resolved by Cristian"). El mecánico tampoco ve la nota de resolución en su WO.
10. Home de MPM: WO-013 aparece como "Created" en Ready to start aunque la WO ya está In Progress.
11. WO-013 → Mechanics = "MA, MD, MG": falta MPM aunque hizo el PM (Truck, Yard, Dashboard).
12. Ready to Go no cuadra: Dashboard decía 3 y el Yard 1 al mismo tiempo (el Yard solo cuenta trucks con WO en su lista).
13. Truck tras Return to Service: el Work Plan sigue mostrando "Not Ready · Issues found · Open Jobs still need to be completed · 0 remaining" sin WO abierta. También tras cerrar la WO la categoría sale como "Inspection".
14. (Menor, ES) En el Truck quedan en inglés la etiqueta "Not Ready" y la palabra "issues" ("No se encontraron issues"). El encabezado del Truck dice "Not Ready" aunque el truck está In Service sin WO. → PR [lightningtransport/LTL_Shop#202](https://linear.app/ltransl/review/truck-readiness-copy-in-spanish-a-truck-back-in-service-reads-in-d155c4489570) ("Aún no está listo", "hallazgos", badge In Service). Verificado en prod (28 sep): el Truck 612 muestra "In Service" en el encabezado; en ES dice "Sin hallazgos" / "Se encontraron hallazgos" / "Aún no está listo".

---

## LTR-53

**Ops: Auth bypass off + env Vercel de producción**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-21 · **Padre:** LTR-45
- **Adjuntos: —**

#### Scope

Producción: `AUTH_DEV_BYPASS` apagado o ausente. Completar env Vercel (web + api):
`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_*`, JWT/JWKS, `CORS_ORIGIN`, `NEXT_PUBLIC_SITE_URL`, `DATA_SOURCE=supabase`.

Nunca `NEXT_PUBLIC_` para service role ni tokens Ninox.

Migraciones Prisma **solo** por Release safety. Un deploy verde no prueba que la base se migró.
Catálogo/partes PM: `prisma:apply-catalog`, no seed demo.

#### Criterios

- [X] Bypass off (`AUTH_DEV_BYPASS=false` en API prod+preview; redeploy `dpl_CnPLqg9` READY)
- [X] Env checklist PASS (web + api) — keys presentes; values no auditados en chat
- [ ] Health/root PASS — confirmar post-redeploy
- [ ] Catálogo aplicado por path de release — pendiente verificación

Docs: `docs/DEPLOY.md`

#### Eng note 2026-09-20

Bypass was present; set false + production redeploy. [LTR-52](#ltr-52) deferred (no NINOX\_\* in API env).

---

## LTR-55

**"In shop" desde el geofence de Samsara (D49)**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** —
- **Creado:** 2026-09-20 · **Cerrado:** 2026-10-19 · **Padre:** LTR-46
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/377, https://github.com/lightningtransport/LTL_Shop/pull/376**

#### Qué (D49, decidido por el dueño 2026-10-19; propuesta, sin construir)

Yard Presence hoy siempre es `UNKNOWN`. En Samsara ya hay geofences ("Addresses"). La app debe mostrar cuándo un camión está en el taller.

1. **Fuente:** el geofence que Samsara manda en cada lectura de GPS (`gps.address` id + nombre, en `/fleet/vehicles/stats`, el mismo llamado que ya hace el sync). Hoy `locationOf()` en `samsara.client.ts` lo descarta. Nunca inferir por el texto de la dirección, por coordenadas a mano ni por Ninox.
2. **Cuál es el shop (P37 cerrada):** el geofence **Home Office**, id `12839282` (6015 US-301, Tampa, FL 33610; tipo Yard; tags Lightning Transport, Countrywide Trucking Corp, TTG Group). Se compara por **id**. Setup → Samsara lo muestra; elegir otro de la lista (`GET /addresses`, requiere Read Addresses en el token) queda para cuando haya un segundo patio.
3. **Estados:** In shop (`IN_YARD`) / Outside (`OUTSIDE_YARD`) / Unknown (sin Samsara o sin lectura). Una lectura vieja no pasa a Unknown: se muestra con su hora, en ámbar pasadas 24 h.
4. **Desde cuándo:** el sync guarda la hora de la primera lectura dentro después de estar fuera. Sin webhook (D42): con el sync de cada hora la llegada se ve hasta 1 h tarde.
5. **Dónde:** Trucks (Location dice "In shop · since…", filtro In shop), panel Truck, Yard.
6. **Solo informa:** no crea WO ni mueve el Kanban. En el shop sin WO abierta → [LTR-256](#ltr-256).

#### Hecho (2026-10-19)

* Verificado con el token de prod: 220 vehículos con GPS, 42 en Home Office.
* PR 377 mergeado (c0913f6), Release safety aplicó `20261029100000_samsara_geofence_in_shop`, API redeployado, sync OK (158 trucks). El dueño confirmó en prod que Trucks → Where: In shop muestra los de Home Office.
* Los que ya estaban adentro muestran "since" desde el primer sync tras el deploy.

#### Docs

DECISIONS D49 + P37, USER_FLOWS J27 + HU-M21, PRD §4.8 — PR 376.

---

## LTR-57

**Bandeja para revisar los Custom Jobs (unir, agregar al catálogo o dejar como único)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Gated
- **Creado:** 2026-09-20 · **Cerrado:** 2026-10-09
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/282, https://github.com/lightningtransport/LTL_Shop/pull/280, https://github.com/lightningtransport/LTL_Shop/pull/243**

El dueño la pidió el 2026-10-09. Es el pendiente de D25 y el defecto #3 de USER_FLOWS (fila A24).

Va en **Job Catalog → Custom Jobs to review**. Los Custom Jobs pendientes aparecen agrupados por categoría y por nombre normalizado (sin importar mayúsculas, tildes ni espacios). Cada grupo muestra cuántas veces se usó, en qué Work Orders, y los Jobs del catálogo que se le parecen.

**Acciones sobre el grupo entero:**

* **Unir** a un Job del catálogo. Usa `mapped_catalog_job_id` y el nombre viejo queda como alias. La historia del Work Order no cambia.
* **Agregar al catálogo**, con el nombre del grupo o uno corregido.
* **Dejar como único.**
* **Deshacer**, para devolver el grupo a la bandeja.

**Pruebas:** test-real A76–A79.

---

## LTR-58

**Diferido: UI general de permisos / capabilities**

- **Estado:** Duplicate · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Gated
- **Creado:** 2026-09-20 · **Cerrado:** 2026-10-15
- **Adjuntos: —**

#### LATER

No hay UI general de permisos. Caps se aplican por ops (Q14 / [LTR-12](#ltr-12)).

No construir permission UI sin contrato. Roster sigue siendo ops.

Relacionado: [LTR-12](<https://linear.app/ltransl/issue/LTR-12>)

---

## LTR-59

**V2.1: validar Truck Detail canónico (overview / work / history)**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-28 · **Padre:** LTR-32
- **Adjuntos: —**

#### V2.1 residual

Truck Detail ya muestra identity, readiness, phase, WO activo, history.

TARGET: vista canónica overview / work / readiness / history. Validar completitud con operación y evitar historial paralelo.

No reabrir el checklist de 6 gates. Work Plan slices Done ([LTR-32](<https://linear.app/ltransl/issue/LTR-32>)).

Gap: CURRENT_VS_TARGET Truck Detail.

---

## LTR-60

**V2.1: validar Ready to Go vs Complete vs Returned to Service**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX
- **Creado:** 2026-09-20 · **Cerrado:** 2026-09-28 · **Padre:** LTR-32
- **Adjuntos: —**

#### V2.1 residual

Ready to Go es aprobación de readiness autorizada, distinta de Complete WO y Returned to Service.

Validar en operación: aprobación, invalidaciones, copy EN/ES.
Slice 3 QC polish ya Done ([LTR-41](<https://linear.app/ltransl/issue/LTR-41>)).

Gap: CURRENT_VS_TARGET Ready to Go.

---

## LTR-61

**Home mecánico: Iniciar trabajo / Start Work debe iniciar labor (Ready to Start)**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/128**

#### Fuente

Prueba local por rol, 20 Sep 2026. Cuentas seed: Alejandro 1 (Standard). Home ES hidratado. Canvas: `role-flow-ux-test-results.canvas.tsx` (MECH02 / Listos para iniciar).

#### Por qué duele (pulgar)

En Home, el CTA **Iniciar trabajo / Start Work** de una WO en Ready to Start **solo navega** a `/work-orders/[id]`. El mecánico debe pulsar Start otra vez en el detalle para abrir labor. Dos toques para el mismo verbo = fricción de piso.

Código actual: `WorkOrderActionLink` en `apps/web/src/app/page.tsx` usa `href={`/work-orders/${[wo.id](<http://wo.id>)}`}` con `action={messages.startWork}` — no dispara start.

#### Roles

* `mechanic.standard` (principal)
* `mechanic.pm` si Home muestra el mismo CTA en Ready to Start (no cambiar create-PM auto-start)
* Manager/Admin: fuera de alcance para este CTA de Home de mecánico

#### Decisión de producto (elegir una, no ambas a medias)

1. **Preferida:** un toque Iniciar trabajo **inicia labor** (mismo contrato que el Start del detalle) y luego aterriza en el detalle de la WO; o
2. Si no se inicia labor desde Home, el copy **no** puede decir Iniciar trabajo / Start Work (usar Ver y empezar / View details).

#### Reglas de producto (no cambiar)

* Standard **no** crea WO, **no** pausa global, **no** Finish WO.
* Complete ≠ Ready to Go ≠ Returned to Service.
* Presence es UNKNOWN.
* No inventar capacidades.

#### Ya en rama `cristian/ux-role-flow-copy` (no rehacer)

Empty de Jobs activos ya no pide crear WO si hay trabajo listo o esperando al Manager. Notas, Truck Information, prioridad del create, títulos PM localizados.

#### Rutas a ejercitar

* `/mechanic/standard` (o `/` Home Standard)
* `/work-orders/[id]` detalle
* Login Standard → Listos para iniciar → CTA

#### Criterios de aceptación (browser, EN+ES, 390 y desktop)

- [ ] WO en Ready to Start: el CTA de Home o bien **abre labor** (estado in_progress / timer visible en detalle) o bien **no** usa el verbo Start/Iniciar.
- [ ] Un solo toque extra no es aceptable si el label sigue siendo Iniciar trabajo / Start Work.
- [ ] Standard sigue sin Create WO, pause global, ni Finish WO.
- [ ] Tras Complete Job, Home muestra espera al Manager; el mecánico no cierra la WO.
- [ ] Copy EN y ES alineados; `aria-label` de `workOrderAction` sigue describiendo WO + unidad.
- [ ] No romper e2e `apps/web/e2e/ux-regressions.spec.ts` que busca el nombre `Iniciar trabajo WO-…`.

#### Archivos probables

* `apps/web/src/app/page.tsx` (`WorkOrderActionLink`, CTA Ready to Start)
* `apps/web/src/app/work-orders/[id]/detail-client.tsx` (Start existente)
* `apps/web/src/lib/locale-context.tsx` (`startWork`)
* Tests: `apps/web/e2e/ux-regressions.spec.ts`, specs de locale si aplica

---

## LTR-62

**Admin: click Work Orders en Dashboard a veces no navega al primer intento**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: —**

#### Fuente

Prueba local Admin, 20 Sep 2026. Click a **Work Orders** en el dashboard a veces **no navegó al primer intento** (prefetch/Link inestable).

#### Por qué duele (espera)

El Manager cree que el control está muerto. Segundo click sí entra. Intermitente — reproducir y estabilizar, no “no lo vi”.

#### Roles

* Manager / Admin en `/admin`
* No aplica a mechanic Home

#### Alcance

Estabilizar `Link`/prefetch del item Work Orders (shell y/o CTA “View all Work Orders” del dashboard). No rediseñar el dashboard ([LTR-22](#ltr-22) Done).

#### Reglas

No cambiar caps ni ownership. Presence UNKNOWN.

#### Rutas

* `/admin` → click Work Orders (nav shell)
* `/admin` → click ver todos los Work Orders (si existe)
* Destino: `/admin/work-orders`

#### Criterios (browser, EN+ES, 390 y desktop)

- [ ] 10 clicks seguidos desde Dashboard al nav Work Orders navegan en el **primer** click (390 y desktop).
- [ ] No hay `#` / preventDefault que trague el primer gesto.
- [ ] Prefetch de Next no deja el link en estado no-navegable.
- [ ] Locale ES e EN.
- [ ] Si no se reproduce en 10 intentos, documentar condición (PWA vs browser, hover prefetch) y aún así endurecer el Link (button+router o prefetch={false} si es la causa).

#### Archivos probables

* `apps/web/src/components/admin-shell.tsx`
* `apps/web/src/components/admin-dashboard.tsx`
* `apps/web/e2e/admin-shell.spec.ts`

---

## LTR-63

**Nav Admin bilingüe: alinear Dashboard / Work Orders con catálogo ES**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: —**

#### Fuente

Prueba local Manager, 20 Sep 2026. Locale ES hidratado. Nav Admin mezclaba **Dashboard / Work Orders** (EN) con **Operaciones del patio / Unidades** (ES).

#### Por qué duele (ojo)

El chrome de Admin no se siente de un solo idioma. El usuario lee mitad inglés, mitad español en la misma barra.

#### Roles

* Manager (`admin.access` + `work_orders.manage`)
* Admin (`admin.access`)
* Mecánicos: no usan este nav (`/admin` denegado)

#### Producto (no inventar)

Alinear catálogos EN/ES del **nav**. Conservar términos de dominio ya canónicos (**Work Order**, y Truck si el PRD los deja en EN). No traducir Work Order a OT/orden si el resto del Shop ya dice Work Order en ES. Si Dashboard queda en EN por ser chrome técnico, **todo** el nav debe seguir la misma política (no dejar patio/unidades en ES y Dashboard en EN sin criterio).

#### Reglas de producto (no cambiar)

* Standard no crea WO, no pausa global, no Finish WO.
* Complete ≠ Ready to Go ≠ Returned to Service.
* Presence UNKNOWN.

#### Ya en rama `cristian/ux-role-flow-copy` (no rehacer)

Copy mechanic/PM (notas, Truck Information, prioridad create, títulos PM). Este ticket es **solo nav/chrome Admin**.

#### Rutas

* `/admin` Dashboard
* `/admin/work-orders`
* `/admin/yard-operations`
* Lista Unidades / trucks del shell
* Viewport 390 (menu) y desktop (barra)

#### Criterios (browser, EN+ES, 390 y desktop)

- [ ] Con locale ES, todos los items del shell Admin siguen **una** política documentada en el PR (dominio canónico vs chrome localizado).
- [ ] Con locale EN, ningún item del nav queda en español.
- [ ] Switcher de idioma actualiza el nav sin recarga inconsistente.
- [ ] No cambiar quién ve Yard vs Work Orders (caps).
- [ ] Tests de `admin-routing.spec.ts` / `admin-shell.spec.ts` actualizados si cambian strings.

#### Archivos probables

* `apps/web/src/lib/admin-messages.ts` (`dashboard`, `workOrders`, `yardOperations`, trucks/unidades)
* `apps/web/src/components/admin-shell.tsx`
* `apps/web/src/lib/admin-routing.spec.ts`
* `apps/web/e2e/admin-shell.spec.ts`

---

## LTR-64

**Login: flash de locale EN→ES al hidratar (cookie ltl_shop_locale)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/129**

#### Fuente

Prueba local 20 Sep 2026. Login parpadea EN→ES al hidratar. Mechanic locale vs cookie Admin.

#### Por qué duele (espera)

First paint en inglés y luego salto a español. Se siente roto y retrasa el primer toque.

#### Roles

* `mechanic.standard` y `mechanic.pm` (login → Home)
* Manager/Admin (login → `/admin`)
  Cookie compartida: `ltl_shop_locale` (`SHOP_LOCALE_COOKIE` / `ADMIN_LOCALE_COOKIE`).

#### Enfoque

Compartir o hidratar locale **antes del first paint** (cookie en server / `lang` / copy SSR) para mechanic login y Admin. No inventar un segundo sistema de locale. No cambiar caps.

#### Reglas

* Standard no crea WO / pause global / Finish WO.
* Complete ≠ Ready to Go ≠ Returned to Service.
* Presence UNKNOWN.

#### Ya en rama `cristian/ux-role-flow-copy`

Copy catalogs; este ticket es **hidratación**, no strings sueltos.

#### Rutas

* Login público → Home mechanic
* Login → `/admin`
* Recarga dura con cookie `es` y con cookie `en`

#### Criterios (browser, EN+ES, 390 y desktop)

- [ ] Con cookie `es`, el primer frame visible de login/Home/Admin no muestra chrome EN que luego salta a ES (sin flash perceptible).
- [ ] Con cookie `en`, no hay flash ES→EN.
- [ ] Mechanic y Admin respetan la **misma** cookie `ltl_shop_locale`.
- [ ] Switcher sigue persistiendo Path=/ ; Max-Age largo.
- [ ] Sin layout shift grosero del switcher.

#### Archivos probables

* `apps/web/src/lib/locale-context.tsx` (`useSyncExternalStore` + cookie)
* `apps/web/src/lib/admin-session.ts`
* `apps/web/src/components/admin-locale-switcher.tsx`
* Login / layout que monta LocaleProvider (buscar provider en `apps/web/src/app`)

---

## LTR-65

**Detalle Admin WO: sticky next action para Confirm completion / Complete WO**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: —**

#### Fuente

Prueba local Manager, 20 Sep 2026, detalle WO-002. Página larga: pausa, cancelar, completar Job, tiempos, Activity a la vez.

#### Por qué duele (ojo)

Cuando los Jobs están hechos, el Manager debe **Confirm completion / completar la WO**. Esa acción se pierde al scrollear entre pausa, cancelar y Activity. No es un callejón (el cierre existe); es densidad.

#### Roles

* Manager (`work_orders.manage`) — siguiente acción de cierre
* Admin con manage: misma UI
* Admin **sin** `work_orders.manage`: no habilitar Complete WO
* `mechanic.standard`: no Complete WO (sigue esperando al Manager)

#### No cambiar ownership

* Quién puede Complete / pause oficial / cancel **no** cambia.
* Standard no Finish WO.
* Complete ≠ Ready to Go ≠ Returned to Service.
* Presence UNKNOWN.

#### Alcance UX

Sticky / barra persistente de **siguiente acción** cuando todos los Jobs están done y el Manager debe confirmar cierre. No rediseñar Activity ni mezclar Ready to Go aquí.

#### Ya en rama `cristian/ux-role-flow-copy`

Copy mechanic Home/PM. Este ticket es Admin WO detail.

#### Rutas

* `/admin/work-orders/[id]` (WO Standard con Jobs 1/1 done, WO aún abierta)
* Opcional: mismo detalle con Jobs pendientes (sticky no debe empujar Complete si aún hay Job abierto)

#### Criterios (browser, EN+ES, 390 y desktop)

- [ ] Con Jobs completos y WO abierta, la acción de **confirmar cierre** (copy existente de Complete WO) permanece visible al hacer scroll (sticky/footer/header).
- [ ] Pausa oficial y cancelar no se promocionan por encima del cierre cuando el siguiente paso es Complete.
- [ ] Mechanic Standard en `/work-orders/[id]` sigue **sin** Complete WO.
- [ ] Usuario sin `work_orders.manage` no gana el CTA.
- [ ] EN+ES; touch 44px en 390.

#### Archivos probables

* `apps/web/src/components/admin-work-order-detail.tsx`
* `apps/web/src/lib/admin-messages.ts` (copy de complete/confirm)
* Specs Admin WO detail si existen

---

## LTR-66

**Home PM: empty de pausados aún dice Jobs (alinear con pmPausedTitle)**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: —**

#### Fuente

Prueba local PM (Daniel), 20 Sep 2026. Título de pausados ya usa `pmPausedTitle` (“Servicios de PM pausados”) pero el **empty** y el **conteo** siguen hablando de Jobs (`noPausedJobs`, `pausedJobs`).

#### Por qué duele (ojo)

PM no opera Jobs genéricos. Empty “No hay Jobs pausados” contradice el título y el PRD.

Código: `apps/web/src/app/page.tsx` sección pausados usa `isPm` solo en el `h2`; el subtítulo y EmptyState no.

#### Roles

* `mechanic.pm` (principal)
* `mechanic.standard`: debe **seguir** diciendo Jobs pausados

#### Ya en rama `cristian/ux-role-flow-copy`

Home PM activo ya dice servicios, no Jobs. Empty de Jobs activos Standard ya no pide crear WO al esperar Manager. **Este empty de pausados PM no está alineado.**

#### Reglas

* Standard no crea WO / pause global / Finish WO.
* PM sí pausa su servicio; no tratar PM como Jobs.
* Complete ≠ Ready to Go ≠ Returned to Service.
* Presence UNKNOWN.

#### Rutas

* `/mechanic/pm` (o `/` Home PM) con cero pausados
* Mismo Home con ≥1 PM pausado (copy de conteo)

#### Criterios (browser, EN+ES, 390 y desktop)

- [ ] PM empty pausados: habla de servicios PM, no de Jobs. Patrón = `pmPausedTitle`.
- [ ] PM conteo 0/1/N: servicios, no jobs.
- [ ] Standard empty/conteo **sigue** Jobs.
- [ ] Claves nuevas en `locale-context.tsx` + spec `locale-context.spec.ts`.

#### Archivos probables

* `apps/web/src/app/page.tsx`
* `apps/web/src/lib/locale-context.tsx`
* `apps/web/src/lib/locale-context.spec.ts`

---

## LTR-67

**QA: e2e Work Plan + pausa oficial vs blocker + reopen (sin rewrite)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: —**

#### Tipo: verificación / QA — no rewrite de producto

#### Fuente

Prueba local 20 Sep 2026 **no cubrió**: Yard Work Plan, pausa oficial vs blocker e2e, Return to Service, reopen, time correction, create WO con admin.access sin `work_orders.manage`.

#### No duplicar epics existentes

* [LTR-32](<https://linear.app/ltransl/issue/LTR-32>) Epic Work Plan (implementación)
* [LTR-60](<https://linear.app/ltransl/issue/LTR-60>) validar Ready to Go vs Complete vs Returned to Service
* [LTR-51](<https://linear.app/ltransl/issue/LTR-51>) smoke **producción** Manager + mecánico reales

Este ticket es un **guion local/staging** de lo que faltó el 20 Sep. Si [LTR-60](#ltr-60)/[LTR-51](#ltr-51) ya evidencian PASS, marcar checks y cerrar. **No** reabrir el Work Plan ni cambiar ownership.

#### Por qué duele (espera / ojo)

Sin este pase, el piso puede confundir blocker de mecánico con pausa oficial del Manager, o Complete con Ready to Go / Returned to Service.

#### Roles a ejercitar

* `mechanic.standard`: Reportar bloqueo (no pause global, no Finish WO, no create WO)
* Manager: pausa oficial, Complete WO, Work Plan en Truck Detail
* Admin: reopen / Returned to Service / time correction **solo** con caps actuales
* Admin `admin.access` **sin** `work_orders.manage`: create WO denegado

#### Guion (browser, EN+ES, 390 y desktop)

- [X] Work Plan: Inspection → Add work → jobs visibles; no checklist de 6 gates.
- [X] Blocker mechanic ≠ pause oficial Manager (estados y copy distintos; Reportar bloqueo sigue disponible cuando Jobs 1/1 espera Manager).
- [X] Complete WO ≠ Ready to Go ≠ Returned to Service (cruzar evidencia con [LTR-60](#ltr-60)).
- [X] Reopen WO/Job solo roles autorizados.
- [X] Presence no se muestra como física (UNKNOWN).
- [X] Documentar PASS/FAIL con rutas. Fallos de producto → issues nuevos; no “arreglar” el PRD en este ticket.

#### Rutas

* `/admin/yard-operations`, `/admin/trucks/[id]` Work Plan
* `/mechanic/standard`, `/work-orders/[id]` blocker
* `/admin/work-orders/[id]` pause oficial, Complete, reopen

#### Archivos

Ninguno de implementación salvo bugs encontrados (abrir hijo). Referencia: `docs/CURRENT_PRODUCT_STATUS.md`, `docs/LIGHTNING_SHOP_MASTER_PRD.md`.

#### Ya en rama `cristian/ux-role-flow-copy`

Copy Home/PM/create; no sustituye este QA.

---

## LTR-68

**Copy EN residual: pause Other / Unable to save notes (detail-client, pm-service-card)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: —**

#### Fuente

Prueba local 20 Sep 2026 + grep en working tree **después** de `cristian/ux-role-flow-copy`.

#### Por qué duele (ojo)

La rama ya localizó notas, Truck Information, prioridad create, títulos PM. **Quedan strings EN hardcodeados** en el detalle mechanic/PM:

* `detail-client.tsx` \~L635: fallback `'Unable to save notes.'`
* `detail-client.tsx` \~L791–802: modal pause PM: `Pause reason`, `Select an option`, placeholder `'Reason required for Other'`, botón `Cancel`
* `pm-service-card.tsx` \~L104: `'Unable to save PM service details.'`

(El pause Standard \~L523 ya ramifica ES/EN inline; mover a catálogo si se toca el archivo.)

#### Roles

* `mechanic.standard` (notas, pause Other)
* `mechanic.pm` (pause modal + save PM details)

#### No rehacer (ya en `cristian/ux-role-flow-copy`)

* Empty Active Jobs / espera al Manager
* Notas UI, Truck Information, priority labels create WO, PM section titles

Si al implementar este ticket esos strings ya están en `messages.*`, **cerrar como Duplicate** y citar el PR — no volver a traducir.

#### Reglas

Standard no crea WO / pause global / Finish WO. Complete ≠ Ready to Go ≠ Returned to Service. Presence UNKNOWN.

#### Rutas

* `/work-orders/[id]` Standard: pause Other + error de notas (forzar fallo de red o validar fallback)
* `/work-orders/[id]` PM: abrir pause; error de save en millaje/partes

#### Criterios (browser, EN+ES, 390 y desktop)

- [ ] Ningún placeholder/label/botón/error listado arriba aparece en inglés con locale ES.
- [ ] Locale EN conserva el inglés.
- [ ] Strings van al catálogo (`locale-context.tsx`), no ternarios sueltos salvo consistencia mínima.
- [ ] Grep: no quedan `'Unable to save notes.'` ni `'Reason required for Other'` ni `'Pause reason'` hardcodeados en esos archivos.

#### Archivos

* `apps/web/src/app/work-orders/[id]/detail-client.tsx`
* `apps/web/src/components/pm-service-card.tsx`
* `apps/web/src/lib/locale-context.tsx`

---

## LTR-69

**Admin: official pause 400 shows assignment copy when Jobs n/n**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21 · **Padre:** LTR-67
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/130**

#### Fuente

[LTR-67](#ltr-67) local QA (21 Sep 2026). Manager `manager@lightning.local` on `/admin/work-orders/712650e5-6a45-47e2-a8cb-88f363aa323c` (WO-001) after Jobs 1/1.

#### Qué pasa

Official **Pause Work Order** is correctly rejected by the API when there are no pending Jobs:

`400 A Work Order without pending jobs cannot be paused`

(`work-orders.service.ts` `pause()`: Standard WO without `to_do` jobs cannot be paused.)

The Admin UI maps that 400 through `assignmentError()`, so the operator sees:

**This assignment change is not allowed.**

That copy is for assignment mutations, not pause.

#### Por qué duele

The Manager thinks pause failed for an assignment/capability reason. The real rule (cannot officially pause a WO that is waiting on Complete) is hidden.

#### Roles

* Manager (`admin.access` + `work_orders.manage`) on `/admin/work-orders/[id]`
* Does not apply to mechanic Report Blocker (that path stays In Progress and is distinct)

#### Alcance (tiny, apps/web)

In `apps/web/src/components/admin-work-order-detail.tsx`, the official pause/resume `runMutation` uses `assignmentError`. Give pause/resume their own 400 mapper (API message or pause-specific copy). Do not change the API rule in this issue unless Product wants pause allowed at Jobs n/n.

#### Repro

1. Open Standard WO In Progress with all Jobs completed (Jobs n/n, waiting Manager).
2. Official Pause reason → Pause Work Order.
3. Alert is assignment copy, not the pending-Jobs rule.

Parent: [LTR-67](#ltr-67).

---

## LTR-70

**API: proxy Yard data boundary → agent-reporting (Incoming/Upcoming/Work location)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** API
- **Creado:** 2026-09-21 · **Cerrado:** 2026-09-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/131**

#### Prioridad Cristian (2026-09-21)

Cablear Phase 1 cards (Incoming Trucks / Upcoming Departures / Work location) para este lanzamiento, en paralelo al smoke 43+44+61.

#### Mapping (Eng audit kit)

| Card | Fuente kit | Report / fuente |
| -- | -- | -- |
| Incoming Trucks | expected returns | `agent-reporting?report=returns` |
| Upcoming Departures | planned outs | `driver_pay` (Out Date) + live Ninox Schedule_Teams (Out Schedule) |
| Work location | yard text | `trucks.yard_location` via `report=trucks` |
| Presence | — | **fuera de scope** (sigue UNKNOWN / [LTR-55](#ltr-55)) |

#### Constraints

* Proxy **solo en Nest API** (`apps/api`). Header `x-agent-key` **nunca** en browser / `NEXT_PUBLIC_*`.
* Env: `AGENT_REPORTING_KEY` (+ URL default `https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting`).
* Si falta key o upstream falla: DTO con `status: unavailable` / empty lists (FE mantiene Phase 1 card).
* Capability: `admin.access` o `yard.operations.manage` (alinear con Yard Admin).

#### Deliverable

1. Endpoint(s) Admin + DTO estable (incl. empty/error shape) documentado para FE.
2. PR en `LTL_Shop`.
3. Key en Vercel API prod+preview (ops).

#### FE follow-up

Cuando endpoints+DTO estén estables, FE cablea las 3 cards y baja Phase 1 UNAVAILABLE.

---

## LTR-71

**UI: destacar Truck # sobre Work Order # en cards y listas**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/135**

#### Fuente

Cristian 2026-09-22 post-smoke PASS.

#### Problema

En cards y listas lo que destaca es el **Work Order number**, pero los usuarios buscan/escanean el **número de Truck**. Fricción de piso.

#### Objetivo

Intercambiar jerarquía visual: **Truck # primario**, **Work Order # secundario** (sin perder el WO).

#### Alcance (apps/web)

* Mechanic Home cards/listas
* Admin WO list / cards relevantes
* Detalle si el header hoy prioriza WO sobre Truck

#### No cambiar

Ownership, caps, copy de dominio canónico (Work Order sigue diciéndose Work Order).

#### Criterios

- [ ] Escaneo visual: Truck # es lo primero que se lee en card/lista
- [ ] WO # sigue visible y asociable
- [ ] EN+ES, 390 + desktop
- [ ] PD light en tip

#### Ship

Merged #135 → main `7cb6da3`. Web BUILDING. Criterios cumplidos en tip + PD APPROVE.

---

## LTR-72

**Docs: alinear CURRENT a Work Plan live (00/01/03/11/12)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Docs
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: —**

#### Problema (gap review PO 2026-09-22)

Docs Linear 00/01/03/11/12 (y CURRENT_PRODUCT_STATUS local stale) aún describen Phase 1 **6 gates / Mark Ready** como CURRENT, pese a Work Plan / Ready derivado **live** (Slices 1–3 Done, flags ON, pilot [LTR-11](#ltr-11) Done).

Riesgo: el equipo abre tickets de polish de gates = dead-end vs Decision [LTR-32](#ltr-32).

#### Objetivo

Hygiene mínima: banners/secciones CURRENT = Work Plan live; Phase 1 gates = histórico / superseded hasta cutover residual.

#### Scope

* Linear docs: 00 Users, 01 Overview, 03 Product Rules (R5), 11 Features, 12 JTBD
* No reescribir Flows enteros; no abrir features nuevas

#### Criterios

- [X] Cada doc marcado CURRENT vs TARGET / superseded Phase 1
- [X] JTBD-5 y Features Yard alineados a Ready derivado
- [X] Freeze explícito: no tickets “mejorar 6 gates”

#### Hygiene done (2026-09-22 ET)

| Doc | Cambio |
| -- | -- |
| **00 Users** | Banner CURRENT; Manager day-in-life → Work Plan cols + engagement; Admin catalog/roster write ([LTR-77](#ltr-77)/78); TARGET→CURRENT live; mapa JTBD-5/Admin |
| **01 Overview** | Banner; Yard/Fleet Readiness = Work Plan live; Admin write + Manager RO |
| **03 Rules** | R3 Work Plan phases + engagement; R5 Ready=derived / Mark Ready=legacy + FREEZE; R9 Admin write / Manager RO / Permissions LATER |
| **11 Features** | Banner live; Catalog+roster Admin write; Yard CURRENT Work Plan; Phase 1 leftover table; NOT list sin Catalog writes |
| **12 JTBD** | JTBD-5 CURRENT=Work Plan derived; Phase 1 superseded + FREEZE |

No new feature tickets. No touch Presence/McLeod/Permissions UI full.

#### Owner

Product Owner · Product Designer (light)

#### Priority

Medium — post [LTR-12](#ltr-12) / [LTR-71](#ltr-71); antes de más tickets Yard

#### Addendum 2026-09-22 (post lock A + Manager caps)

* **Readiness board population:** CURRENT post [LTR-75](#ltr-75) = **engagement only** (vacío sin WO/assessment/Work Plan activo). Pre-75 = flota shop completa (superseded).
* **Admin vs Manager:** Manager no admin users ni catalog writes. `/admin/mechanics` + Catalog = **RO** para Manager. System Admin write = [LTR-77](<https://linear.app/ltransl/issue/LTR-77>) / [LTR-78](<https://linear.app/ltransl/issue/LTR-78>) Done. Permissions UI = LATER. Documentado en 00 + 11.

#### Addendum — Admin write GO (2026-09-22)

Freeze **roto solo para System Admin**:

* [LTR-78](<https://linear.app/ltransl/issue/LTR-78>) roster mecánicos write
* [LTR-77](<https://linear.app/ltransl/issue/LTR-77>) catalog add jobs

Shop Manager = sigue RO. Permissions UI completa = LATER. Actualizar doc 00 + 11: CURRENT TARGET Admin write = estos tickets; no confundir con Manager.

#### Addendum — Yard columns ([LTR-87](#ltr-87) cerrado 2026-09-22)

* Board phases = Work Plan (Inspection → Shop Work → Alignment → Detailing → Ready).
* Blocked badge = open work remaining, no CTA Mark Ready.
* Ready for Approval / 6-gate Pending = Phase 1 superseded; freeze polish.

---

## LTR-74

**FE: cutover Yard Movement cards a data-boundary (LTR-70)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/137**

#### Fuente

Audit 2026-09-22 (cloud bc-3066de19) post Cristian ask.

#### Problema

En `/admin/yard-operations`, la región **Yard movement** renderiza `YardFeedCard` desde `GET /api/admin/yard-operations` (mapper Nest `buildYardMovementFeeds`), no el proxy [LTR-70](#ltr-70) `GET /api/admin/yard/data-boundary`.

`useAdminYardDataBoundary` + `AdminYardDataBoundaryCards` + `YARD_DATA_BOUNDARY_COPY` ya existen en apps/web y **no están montados**.

#### Objetivo (apps/web)

1. Montar `AdminYardDataBoundaryCards` (vía `useAdminYardDataBoundary`) en la región Yard movement.
2. Board / readiness list sigue en `GET /api/admin/yard-operations`.
3. Actualizar e2e Yard: dejar de assert labels viejos y filas fixture `Y-102`/`609`/`614` del feed viejo; cubrir proxy + copy PD.
4. No inventar Presence; empty/UNAVAILABLE según PD catalog.

#### No tocar

Nest/Prisma/auth (Eng alinea o limpia el segundo mapper en yard-operations).

#### Criterios

- [ ] Cards visibles usan data-boundary DTO
- [ ] Copy = YARD_DATA_BOUNDARY_COPY (EN+ES)
- [ ] Board intacto
- [ ] e2e actualizado
- [ ] PD light en tip

---

## LTR-75

**API: Readiness board inclusion — solo engagement patio (opción A)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/138**

#### Lock producto (room 2026-09-22)

PM/PD/PO recomiendan **A**: board vacío hasta engagement patio (Work Plan / workflow activo). Cristian no respondió widget 1:1; FE procede con consenso room.

#### Hecho (audit FE bc-85c488ff + Eng)

`GET /api/admin/yard-operations` carga **todos** los `Truck`. FE solo agrupa por `phase`. Con Slice2 ON y sin WO/jobs → phase default **Inspection** (blocked). Assessments=0 no vacía el board.

#### Objetivo (apps/api — Eng)

Cambiar inclusion del board/list (+ `getWorkPlanBoardCounts`) para **solo** trucks en workflow de patio activo (criterio PD/A: open work y/o Work Plan/engagement — firmar con PD en tip).

#### No

* No inventar Presence
* No filtrar solo en FE (mentiría el total)
* No reabrir 6-gate polish

#### Criterios

- [ ] Post-wipe WOs=0 + sin engagement → board vacío
- [ ] Truck que entra a flujo patio aparece en phase correcta
- [ ] FE sin filtro paralelo inventado
- [ ] Docs PO actualizan CURRENT vs TARGET ([LTR-32](#ltr-32)/39)

---

## LTR-76

**UI: AdminShell header/aside — layout full viewport**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/139**

#### Fuente

Cristian 2026-09-22 room: layout a mitad de camino + PD TARGET shell.

#### Problema

Chrome Admin/Manager (header / nav / top bar / aside) no ocupa bien el viewport — content comprimido \~50%, posible doble header o pelea aside+top bar.

#### TARGET (PD firmado)

1. Un shell `AdminShell`: aside (desktop) + header sticky 1 fila + main flex-1
2. Header: logo/título | hamburger mobile | locale + user — `w-full`, \~56–64px, sin 2ª top bar
3. Desktop: aside \~240px + main full remaining
4. Mobile 390: hamburger → sheet ([LTR-16](#ltr-16)); safe-area ([LTR-30](#ltr-30)); main full width
5. Sin scroll horizontal del shell; scroll en main
6. EN/ES chrome [LTR-63](#ltr-63); Work Order/Jobs EN

#### Criterios

- [ ] Main no queda a mitad por chrome
- [ ] Un solo header sticky
- [ ] 390 + desktop
- [ ] PD light tip

---

## LTR-77

**Admin: catalog write — add jobs (System Admin only)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Feature
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/142, https://github.com/lightningtransport/LTL_Shop/pull/141, https://github.com/lightningtransport/LTL_Shop/pull/140**

#### SMOKE FAIL 2026-09-22 (Tester QA)

System Admin `crixcrox@outlook.com` en `/admin/catalog`: banner **solo lectura**; **sin** CTA Add/Create/Activate job. API #140 puede estar live; UI write no usable en prod (`bfedd63`+).

**Re-test:** Admin ve Add Job en categoría activa; Manager sin CTA.

---

#### Lock producto (room 2026-09-22)

Cristian: System Admin debe **agregar jobs al catálogo**. Shop Manager sigue Catalog **RO**.

PD/PM/PO: **GO YA** — mínimo usable (add job / activate). Catalog governance full + Custom Job review = LATER.

#### Objetivo

Con `admin.access`: create/update Jobs (y Categories si hace falta mínimo) en Admin Catalog. Manager sin write affordances.

#### Out of scope

* Manager catalog write
* Custom Job review/mapping completo
* Ninox dual-write

#### Criterios

- [ ] Admin add job (catálogo) usable en prod
- [ ] Manager RO (FE audit PASS ya)
- [ ] Mechanic active-only reads intactos
- [ ] EN+ES; PD light tip

#### Related

Doc 11 Catalog LATER → CURRENT Admin write; [LTR-72](#ltr-72) hygiene

---

## LTR-78

**Admin: roster mecánicos write (System Admin only)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Feature
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/142, https://github.com/lightningtransport/LTL_Shop/pull/141, https://github.com/lightningtransport/LTL_Shop/pull/140**

#### SMOKE FAIL 2026-09-22 (Tester QA)

System Admin en `/admin/mechanics`: **sin** Create/Invite/Activate; caps Standard/PM visibles no editables. `/admin/users|/roster|/team` → 404.

**Re-test:** Admin crea/activa mechanic + set Standard/PM; Manager sin CTAs.

---

#### Lock producto (room 2026-09-22)

Cristian: System Admin (`crixcrox`) **debe** administrar users mecánicos + agregar jobs al catálogo. Shop Manager sigue **RO**.

PD/PM/PO: **GO YA** — mínimo usable. Permissions UI completa = **LATER**.

#### Objetivo

System Admin con `admin.access` (sin exigir `work_orders.manage`) puede:

1. Ver + **crear/activar** users mecánicos (Standard / PM) y aplicar caps `mechanic.standard` / `mechanic.pm`
2. No self-serve Permissions UI genérica — solo roster mechanics usable

#### Out of scope

* Manager write
* Matrix de caps arbitraria / Permissions UI full
* Impersonation

#### Criterios

- [ ] Admin puede crear/invitar mechanic + set Standard o PM
- [ ] Manager no ve CTAs write
- [ ] Activity/audit razonable
- [ ] EN+ES

#### Related

[LTR-12](#ltr-12) ops grants (sigue válido como bypass); doc 00 Users

---

## LTR-79

**Bug: completion note de job desaparece tras save/reload**

- **Estado:** Duplicate · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: —**

#### Fuente

Smoke QA 2026-09-22 — Tester Mecánico General · WO-001 truck 277.

#### Problema

Completion note del job visible al completar; tras **guardar Notes del WO** o **reload** desaparece. Notes del WO sí persisten.

#### Esperado

Notes de jobs completados persisten y recargan de forma consistente.

#### Severidad

Media — no bloquea finish WO, sí auditoría/piso.

#### Criterios

- [ ] Completion note sobrevive save Notes WO + hard reload
- [ ] EN/ES; Standard path

---

## LTR-80

**UX: deshabilitar Pause en WO Created**

- **Estado:** Duplicate · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: —**

#### Fuente

Smoke QA Manager — WO Created.

#### Problema

Botón Pause clickable en estado Created; al usar: mensaje “Only in-progress…”.

#### Esperado

Pause **disabled** hasta In Progress (o hidden).

#### Severidad

Baja UX

---

## LTR-81

**UX: no forzar Update password sheet tras login**

- **Estado:** Duplicate · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: —**

#### Fuente

Smoke Mecánico PM (MPM) post [LTR-12](#ltr-12).

#### Problema

Sheet “Update password” sigue en menú tras login aunque ya no sea obligatorio.

#### Esperado

No re-prompt / no forzar sheet si password ya cambiada o no es gate.

#### Severidad

Baja

---

## LTR-82

**UX: Yard Work location — no flash UNAVAILABLE al cargar**

- **Estado:** Duplicate · **Proyecto:** Yard · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: —**

#### Fuente

Smoke Yard `/admin/yard-operations`.

#### Problema

Flash “Work location — Data unavailable” al cargar; luego se puebla con datos.

#### Esperado

Skeleton/loading hasta DTO listo; no flash UNAVAILABLE si el fetch termina OK.

#### Severidad

Baja · related [LTR-70](#ltr-70)/74

---

## LTR-83

**UI: MPM — no reabrir Update password sheet si ya no es obligatorio**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-27
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/146**

#### Fuente

Tester QA 2026-09-22 ([LTR-12](#ltr-12)).

#### Problema

Menú MPM reabre sheet Update password aunque el cambio ya no sea obligatorio en la sesión.

#### Criterios

- [ ] Sheet solo si policy requiere password change
- [ ] Tras completar/dismiss válido, no reabre en cada menú
- [ ] EN+ES

---

## LTR-84

**UI: Yard boundary — skeleton/loading sin flash Data unavailable**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-28
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/203**

#### Fuente

Tester QA 2026-09-22.

#### Problema

Flash “Data unavailable” en carga inicial de Yard Movement / data-boundary.

#### TARGET PD

Loading = skeleton (no UNAVAILABLE). UNAVAILABLE solo cuando API status unavailable/error tras settle.

#### Criterios

- [ ] Primer paint: skeleton/loading
- [ ] Sin flash UNAVAILABLE en happy path
- [ ] Empty honesto cuando ok+\[\]
- [ ] EN+ES

---

## LTR-85

**UI: Pause disabled until WO In Progress (no pause on Created)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-27
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/145**

#### Fuente

Tester QA 2026-09-22.

#### Problema

Pause habilitado en WO Created; debería disabled hasta In Progress.

#### Criterios

- [ ] Created: Pause disabled (o hidden) con helper claro
- [ ] In Progress: Pause enabled según caps
- [ ] EN+ES; Admin + mechanic paths si aplica

---

## LTR-86

**Fix: completion note del job desaparece tras save Notes / reload**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/143**

#### Fuente

Tester QA smoke 2026-09-22 (Mecánico General) — priorizar con PD/PO.

#### Problema

Completion note del job desaparece tras save Notes o reload. Inconsistencia de persistencia/UI (relacionado [LTR-43](#ltr-43) finish notes).

#### Criterios

- [ ] Nota de completion del mechanic permanece visible en Job tras save Notes y tras reload
- [ ] Visible en Activity si aplica
- [ ] EN+ES; no rompe Manager list refresh

#### Roles

mechanic.standard (principal); Manager lee

---

## LTR-87

**Product: validar Ready for Approval / Ready to Go con Blocked + Pending gates**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: —**

#### Decisión PO 2026-09-22 — CERRADO como doc (no bug)

Smoke obs: trucks Blocked (601, 277) sin CTA “Ready for Approval”; gates Pending en 277.

##### Reglas de columna (Work Plan live · [LTR-39](#ltr-39)/40)

| Phase | Significado |
| -- | -- |
| Inspection → Shop Work → Alignment → Detailing → Ready | Board = Work Plan phases |
| **Blocked** | Open work / jobs remaining (blocker), **no** es columna “Ready for Approval” |
| **Ready** | Automático cuando plan limpio + Alignment + Detailing |
| Ready for Approval / Mark Ready / 6 gates Pending | **Phase 1 legacy** — no flujo principal; freeze polish gates |

Si UI aún muestra checklist Pending como primaria → bug demote (hijo de [LTR-40](#ltr-40)), no reabrir Mark Ready.

Documentar en [LTR-72](#ltr-72). Related [LTR-60](#ltr-60) (Ready vs Complete vs RTS) sigue Backlog post-smoke.

---

Original:

#### Fuente

Tester QA observación 2026-09-22 — validar con PO/PD (no bug confirmado).

#### Pregunta de producto

Ready for Approval / Ready to Go en Yard con trucks Blocked y gates Pending — ¿day-in-life bien modelado?

#### Pedido

- [X] PO+PD confirman reglas de columna vs readiness/gates
- [X] OK → doc Work Plan / [LTR-72](#ltr-72) (no ticket corrección nueva)
- [ ] EN+ES si hay copy residual Phase 1 → demote aparte

---

## LTR-88

**UI: Work Plan Alignment/Detailing como badges**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-22 · **Cerrado:** 2026-09-22
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/144**

#### Fuente

Cristian room 2026-09-22: en Work Plan, Alignment y Detailing (jobs fijos obligatorios) se ven como **texto plano**, no como badges.

#### Objetivo

Mostrar Alignment + Detailing como **Badge/chips** (estado pending/done), no strings sueltos. Alineado a variantes Job status de [LTR-23](#ltr-23) (`to_do` outline · `completed` success).

#### Scope

* Truck Detail Work Plan (y lista si aplica)
* EN+ES labels Alignment / Detailing

#### Criterios

- [ ] Alignment y Detailing = Badge, no texto suelto
- [ ] Pending vs done visual distinto
- [ ] PD light tip

#### Owner

Frontend · PD light

---

## LTR-89

**Work Plan: jobs de Inspection se clasifican como Shop Work (salta fase Inspection)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/149**

**Auditoría producción 2026-09-24 · L1**

#### Qué pasa

`classifyWorkPlanLane` no tiene lane de Inspection: un job de categoría **Inspection** (p. ej. "General Inspection") cae en `SHOP_WORK`. `deriveInspectionOutcome` ve "shop work" y concluye `ISSUES_FOUND` → el truck salta directo a **Shop Work** aunque la inspección no se haya hecho.

#### Evidencia (prod)

* Truck **906** / WO-003 (Inspection, 0/3 jobs) → Yard muestra **Shop Work**.
* Truck **907** / WO-004 (Inspection, 0/2 jobs) → Yard muestra **Shop Work**.

#### Esperado

Mientras el job de Inspection esté `to_do`, la fase es **Inspection**. Solo trabajo no-inspección cuenta como hallazgo / Shop Work.

#### Código

`apps/api/src/admin/yard-work-plan-derivation.ts` — `classifyWorkPlanLane` (\~L63) y `deriveInspectionOutcome` (\~L135).

Añadir tests de derivación: WO con solo job Inspection pendiente → phase INSPECTION.

#### ⚠️ No romper

`yard-work-plan-derivation.spec.ts:56` espera que `classifyWorkPlanLane('Air & Brake System', 'Brake Inspection')` = `SHOP_WORK` (reparación con nombre "inspection"). El fix debe usar la **categoría** Inspection (no el nombre del job) y mantener ese test verde.

---

## LTR-90

**Work Plan: Ready to Go con WO aún In Progress y blocker activo**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/150**

#### ✅ Decisión D1 (Cristian, 2026-09-25)

**Estado intermedio.** Plan completo + WO abierta = fase **"Listo para cerrar WO"** (no Ready). **Ready to Go solo cuando la WO está Completed.** El Manager ve la acción pendiente (cerrar WO) en Yard, Truck detail y Dashboard.

**Fin de Ready to Go (Cristian, 2026-09-25):** el truck queda Ready to Go tras completar la WO **hasta Returned to Service** (o nueva WO). Solo WOs completadas desde `YARD_READY_TO_GO_SINCE` (env, se fija al release) para no inundar el board con historial.

---

**Auditoría producción 2026-09-24 · L2** — requiere **decisión de producto**

#### Qué pasa

`deriveWorkPlan` calcula Ready solo con jobs (inspection + shop + alignment + detailing + QC). No mira el **status de la WO** ni blockers reportados.

#### Evidencia (prod)

Truck **277** / WO-001: jobs 3/3 completos, WO sigue **IN PROGRESS**, blocker "Waiting for Parts" → Yard y Truck Detail muestran **Ready to Go** (badge verde) al lado de "IN PROGRESS".

#### Riesgo

El Manager puede despachar un truck cuya WO no fue confirmada/cerrada.

#### Decisión necesaria

¿Ready to Go exige WO **Completed**? Opciones: (a) Ready solo si WO completed; (b) nuevo estado intermedio "Plan complete — confirm WO"; (c) mantener y solo advertir.

#### Código

`apps/api/src/admin/yard-work-plan-derivation.ts` — `deriveWorkPlan` (\~L153). Relacionado [LTR-60](#ltr-60).

---

## LTR-91

**Work Plan: WO de PM aparecen en Inspection · Blocked en Yard**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-26
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/170**

#### ✅ Decisión D4 (Cristian, 2026-09-25)

PM es fase obligatoria del flujo: columna **PM** entre Shop Work y Alignment. Se implementa dentro del epic "PM dentro del Work Plan" (ver issue relacionado).

---

**Auditoría producción 2026-09-24 · L3**

#### Qué pasa

PM WOs no tienen Jobs. `deriveWorkPlan` con 0 jobs → inspection `NOT_STARTED` → phase **Inspection**, y la card muestra **Blocked**.

#### Evidencia (prod)

Trucks **922** (WO-005) y **923** (WO-006), PM In Progress por MPM → columna **Inspection**, badge Blocked.

#### Esperado

Definir cómo se ve un truck en PM en el Yard (¿lane "PM / Service"?, ¿Shop Work?), pero no "Inspection pendiente".

#### Código

`apps/api/src/admin/yard-work-plan-derivation.ts` + agregado del board en `yard-operations.service.ts`.

---

## LTR-92

**Yard: badge "Blocked" en todo truck con WO abierta (no hay blocker real)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/159**

**Auditoría producción 2026-09-24 · L4**

#### Qué pasa

En Yard Operations, 922, 923, 906 y 907 muestran **Blocked** sin blocker reportado; solo tienen WO abierta ("Blocked = open work"). En el resto de la app "blocker" = reporte del mecánico (JTBD-7). Mismo término, dos significados.

#### Esperado

Reservar "Blocked" para blocker reportado / pausa oficial; para trabajo abierto usar "In shop" / "Work open" o mostrar la fase.

#### Relacionado

Contador superior "Blocked 4" suma sobre los otros (ver issue de contadores).

---

## LTR-93

**Yard: "Upcoming Departures" muestra salidas pasadas (toda la semana)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/155**

**Auditoría producción 2026-09-24 · L5**

#### Qué pasa

El filtro usa la ventana "this week / next week" completa, incluyendo días ya pasados.

#### Evidencia (prod, 24-sep)

Upcoming Departures lista salidas del **21, 22 y 23 de septiembre** (614, 836, 845, 863…).

#### Esperado

"Upcoming" = fecha ≥ hoy (Eastern). Si se quieren recientes, sección aparte.

#### Código

`apps/api/src/admin/yard-data-boundary.ts` — `classifyMovementWindow` / `inDefaultMovementWindow` (\~L40–55), `mapUpcomingDepartures`.

---

## LTR-94

**Tiempos: "Active labor 0m" en WO In Progress (total no se calcula en vivo)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/154**

**Auditoría producción 2026-09-24 · L6**

#### Qué pasa

El detalle muestra `totalActiveLaborMs` **persistido**, que solo se recalcula al pausar / finalizar / corregir. Con una sesión abierta el valor queda en 0.

#### Evidencia (prod)

* WO-001 (277): In Progress desde 22-sep 10:56 (2d 12h) → **Active labor 0m**.
* WO-005 (922): In Progress 15h → **Active labor 0m**.

#### Esperado

Regla bloqueada del README: "Timers are computed from persisted session / pause timestamps". Mostrar labor = sesiones cerradas + sesión abierta hasta `now` (servidor), igual para waiting.

#### Código

`apps/api/src/work-orders/work-order.mapper.ts:132` (usa el campo guardado); `computeTotals` en `work-order.timing.ts` ya soporta `endedAt = null`.

---

## LTR-95

**PM: un mecánico puede tener varios PM In Progress a la vez (labor en paralelo)**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/156**

#### ✅ Decisión D2 (Cristian, 2026-09-25)

**PM Mechanic: un PM en curso a la vez.** Create PM bloqueado si el mecánico ya tiene un PM In Progress (mensaje + link a ese PM). Un PM pausado no cuenta como en curso.

---

**Auditoría producción 2026-09-24 · L7** — requiere **decisión de producto**

#### Qué pasa

PM = create-start. Nada impide que el mismo mecánico abra otro PM mientras el anterior sigue con sesión abierta → dos sesiones de labor simultáneas para una persona.

#### Evidencia (prod)

MPM tiene **WO-005 (922)** y **WO-006 (923)** In Progress, ambas iniciadas 24-sep 8:30 AM.

#### Decisión

¿Se permite más de un PM activo por mecánico? Si no: bloquear create (o pausar el anterior automáticamente) con mensaje claro.

#### Evidencia adicional (vista MPM, 2026-09-25)

PM Home de MPM: "2 active PM services" (#923 WO-006 y #922 WO-005), ambas In Progress, y el botón **Create PM service** sigue habilitado para abrir una tercera.

---

## LTR-96

**Admin WO detail: dice "closed Work Order" cuando el motivo es falta de work_orders.manage**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/151**

**Auditoría producción 2026-09-24 · L8**

#### Qué pasa

`canManageAssignments` / `canManageJobs` = `canManageWorkOrders && isOpen && !PM`. Si falla por capability, el copy cae al de WO cerrada.

#### Evidencia (prod)

Crixcrox (System Admin, sin `work_orders.manage`) en WO-001 **In Progress**: "Assignments cannot change on a **closed** Work Order." y "Jobs cannot change on a **closed** Work Order."

#### Esperado

Copy por motivo: cerrada vs PM vs "Solo el Shop Manager (work_orders.manage) puede cambiar esto".

#### Código

`apps/web/src/components/admin-work-order-detail.tsx` L90–95, L205, L496; mensajes en `apps/web/src/lib/admin-messages.ts` (EN/ES).

---

## LTR-97

**Dashboard: "Needs attention" no respeta su orden (ready-to-close y critical quedan abajo)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/155**

**Auditoría producción 2026-09-24 · L9**

#### Qué pasa

El copy promete: "Jobs ready to close first, then critical, high, paused, and neglected". Orden real en prod:

1. 923 WO-006 PM (normal, nada pendiente)
2. 922 WO-005 PM (normal)
3. **277 WO-001 — "Jobs are done. Confirm completion"** ← debería ser 1º
4. **906 WO-003 CRITICAL** ← debería ser 2º
5. 907 WO-004

Además los PM 0/0 no tienen nada que "atender" (ver issue UX relacionado).

#### Esperado

Ordenar por: ready-to-close → critical → high → paused → antigüedad.

---

## LTR-98

**Blocker sin ciclo de vida: nunca se resuelve y sigue como "Latest reported blocker"**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/165, https://github.com/lightningtransport/LTL_Shop/pull/160**

#### ✅ Decisión D3 (Cristian, 2026-09-25)

Blocker **activo hasta que se resuelva**: queda "Activo" hasta que el mecánico o el Manager lo marquen "Resuelto" (`resolvedAt` / `resolvedById`, migración pequeña en PR propio). Se ve activo en WO (mecánico y Admin), Dashboard y Yard. **No** pausa la WO ni afecta labor/waiting.

---

**Auditoría producción 2026-09-24 · L10** — requiere **decisión de producto**

#### Qué pasa

El blocker se guarda como PauseEvent cerrado de 0 min (`isOfficialPause=false`). No hay "resuelto"; el detalle y el dashboard siguen mostrándolo como bloqueo actual aunque todos los jobs estén completos.

#### Evidencia (prod)

WO-001: "Latest reported blocker: Waiting for Parts · MG" con 3/3 jobs completos; historial "10:56 AM → 10:56 AM · 0m".

#### Esperado

Definir: ¿blocker activo hasta que el Manager lo resuelva / el mecánico lo cierre? Mostrar activo vs histórico; dejar de mostrar duración 0m.

---

## LTR-99

**Ops: roster prod sin Shop Manager visible, mecánicos @pending y usuarios QA**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-28 · **Padre:** LTR-45
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/196**

**Auditoría producción 2026-09-24 · L11**

#### Estado en `/admin/mechanics` (prod)

* Alejandro 1/2, Anthony, Elliot, John → emails `@pending.lightning.local` (no pueden loguearse).
* Usuarios QA activos: "QA Smoke Mech LTR78" (`qa.smoke.ltr78.retest@example.com`); "QA Multi-Category Smoke" (inactivo).
* MG / MPM = cuentas de prueba de Cristian.
* Ningún usuario listado tiene `work_orders.manage`; el System Admin (Crixcrox) tampoco → nadie visible puede ejecutar JTBD-4 (planificar). Hay un "Cristian" que sí agregó jobs en WO-001 → confirmar quién es.

#### Hacer

1. Lista final email → caps ([LTR-12](#ltr-12)).
2. Reemplazar `@pending` por emails reales + cuentas Supabase Auth.
3. Desactivar usuarios QA.
4. Asignar `work_orders.manage` (+ `yard.operations.manage`) al Shop Manager real.

---

## LTR-100

**UX Yard: contadores superiores no cuadran (Under review + Ready + Blocked > trucks)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/159**

**Auditoría producción 2026-09-24 · U1**

Prod: Under review **2** + Ready to Go **1** + Blocked **4** = 7, pero el board tiene 5 trucks. "Blocked" se solapa con los otros estados.

Esperado: contadores mutuamente excluyentes (o explicitar que Blocked es un subconjunto) y que coincidan con las columnas Inspection / Shop Work / Alignment / Detailing / Ready.

---

## LTR-101

**UX Yard: cards no dicen qué falta ni el siguiente paso (JTBD-5)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/167, https://github.com/lightningtransport/LTL_Shop/pull/164**

**Auditoría producción 2026-09-24 · U2**

Las cards del Readiness list solo muestran truck, modelo, WO y badge. JTBD-5: "ver qué tiene, qué hacerle, quién, qué falta".

Propuesta: en cada card mostrar `readyReason` legible ("Faltan 2 jobs de Shop Work", "Falta Alignment"), mecánico(s), días en el patio / edad de la WO y link directo a la acción.

---

## LTR-102

**UX Yard: estados externos ("Ready To Go", "Heavy Work No ETA") mezclados con el Ready del Shop y dentro de Incoming**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/164**

**Auditoría producción 2026-09-24 · U3**

En "Yard movement", la caja **Incoming Trucks** contiene además una lista de estados del reporte externo (606 Checked In, 608 Ready To Go, 611 Heavy Work No ETA, 740 LUIS PEREZ…). Resultado: dos "Ready To Go" con fuentes distintas en la misma pantalla (Shop derivado vs agent-reporting), y 923 aparece como "Heavy Work No ETA" mientras en Shop está en PM.

Esperado: separar la sección de estado externo con su propio título y fuente ("Reportado por Dispatch / reporting"), o no usar el mismo vocabulario que el Ready derivado.

---

## LTR-103

**UX Yard: "Yard movement" con 3 cajas de scroll anidado de 50+ filas**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/164**

**Auditoría producción 2026-09-24 · U4**

Work location / Incoming / Upcoming son cajas pequeñas con scroll interno dentro de una página con scroll. Difícil de leer y de buscar (sin filtro, sin agrupar).

Propuesta: tabs o secciones colapsables a ancho completo, agrupar Work location por ubicación con conteo, buscador compartido con el Readiness list.

---

## LTR-104

**Copy Yard: subtítulo "readiness view for every Truck" contradice board engagement-only**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/152**

**Auditoría producción 2026-09-24 · U5**

Subtítulo: "Read-only maintenance readiness view for every Truck." Desde [LTR-75](#ltr-75) el board solo incluye trucks con engagement (WO / assessment / Work Plan). Ajustar copy EN/ES (p. ej. "Trucks with open shop work and their readiness").

---

## LTR-105

**UX WO detail: no explica quién debe cerrar la WO ni por qué no puedo actuar**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/167, https://github.com/lightningtransport/LTL_Shop/pull/163**

**Auditoría producción 2026-09-24 · U6**

Dashboard dice "Jobs are done. Confirm completion to close this Work Order", pero al abrir WO-001 como System Admin no hay CTA ni explicación de que la confirmación la hace el Shop Manager.

Esperado: banner de siguiente paso con responsable ("Esperando confirmación del Shop Manager") cuando el usuario no tiene la capability.

---

## LTR-106

**UX WO detail: campo "Reason for this Job change" visible con jobs bloqueados**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/151**

**Auditoría producción 2026-09-24 · U7**

En WO-001 (usuario sin permiso sobre jobs) se renderiza el input "Reason for this Job change — Required for cancel and reopen" bajo la lista de jobs, aunque no hay acciones de cancel/reopen disponibles. Ocultarlo cuando no haya acción que lo use.

Código: `apps/web/src/components/admin-work-order-detail.tsx` (sección Jobs).

---

## LTR-107

**UX WO detail: "Current pause" duplicado (summary + sección propia)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/151**

**Auditoría producción 2026-09-24 · U8**

"This Work Order is not currently paused." aparece en Operational summary y otra vez en la card "Current pause" (junto a Pause history). Dejar uno solo; la card completa solo cuando hay pausa activa.

---

## LTR-108

**UX: blocker muestra rango "10:56 → 10:56 · 0m"**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/151**

**Auditoría producción 2026-09-24 · U9**

Reported blockers muestra inicio → fin → duración aunque el blocker es un evento puntual (0m). Mostrar solo "Reportado 22-sep 10:56 AM por MG" (y estado activo/resuelto si se implementa [LTR-98](#ltr-98)).

---

## LTR-109

**UX WO detail: página muy larga en 1 columna; acción principal no visible**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/163**

**Auditoría producción 2026-09-24 · U10**

Orden actual: Summary → Truck details → Assignments → Blockers → Notes → Jobs → Repair history → Times → Time correction → Current pause → Pause history → Activity log. Jobs (lo operativo) queda en la mitad; Truck details completo empuja todo.

Propuesta: header con estado + siguiente acción; Jobs y Assignments arriba; Truck details colapsado; Times/Correction/Pause history/Activity en tab "Historial / Auditoría"; 2 columnas en desktop.

---

## LTR-110

**UX Truck detail: desde Trucks dice "Back to Yard Operations" y eyebrow YARD OPERATIONS**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/152**

**Auditoría producción 2026-09-24 · U11**

Abrir `/admin/trucks/[id]` desde el menú Trucks → back link "Back to Yard Operations" y eyebrow "YARD OPERATIONS", aunque el nav activo es Trucks. El back debe respetar el origen (Trucks, Yard, WO detail) o ser neutral ("Back").

---

## LTR-111

**UX Trucks: columna "Operational status" = Unknown en todos los trucks**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/152**

**Auditoría producción 2026-09-24 · U12**

Todos los trucks muestran "Unknown — no service-status event recorded" (Off Duty no existe aún; RTS casi no se usa). La columna ocupa espacio sin información. Ocultarla hasta que haya eventos, o mostrar un guion y explicar en tooltip.

---

## LTR-112

**UX Truck detail: sección Inspection muestra "Ready to Go" y badge Ready junto a WO In Progress**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/159**

**Auditoría producción 2026-09-24 · U13**

Truck 277: la sección "Inspection — Record whether this Truck still needs work before it can leave" muestra como resultado "Ready to Go" (en lugar del outcome de inspección: No issues / Issues found). El header lleva badge verde Ready to Go mientras "Current Work" muestra WO-001 IN PROGRESS.

Depende de la decisión de [LTR-90](#ltr-90).

---

## LTR-113

**Datos: Make / Model invertidos o duplicados en trucks (CASCADIA/Freightliner, Mack Anthem)**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/actions/runs/38809266979, https://github.com/lightningtransport/LTL_Shop/pull/345, https://github.com/lightningtransport/LTL_Shop/pull/344, https://github.com/lightningtransport/LTL_Shop/pull/343**

**Auditoría producción 2026-09-24 · U14**

* 277: Make **CASCADIA**, Model **Freightliner** (invertido; debería ser Freightliner / Cascadia). Se ve como "2022 CASCADIA Freightliner".
* 600/601: Make "Mack Anthem" (make+model en un campo).
* Volvo: Make Volvo / Model VNL 860 (correcto) → inconsistente entre filas.

Revisar mapeo de la semilla Ninox ([LTR-52](#ltr-52)) antes de la carga de flota de producción.

**Hecho en local (2026-10-15), rama** `claude/ltr-113-make-model`**, commit 38c474c:**

* Una sola regla `normalizeMakeModel` (`packages/shared/src/vehicle.ts`) en la importación de Ninox, al conectar Samsara y en el formulario del camión (crear y editar): al revés se da vuelta, "Mack Anthem" se separa, la marca se escribe de una sola forma. Lo que no reconoce queda como está.
* Script para los camiones ya guardados: `npm run prisma:normalize-truck-make-model --workspace=@ltl-shop/api` (solo lista; escribe con `--apply`). **Falta correrlo en producción con el OK del dueño** (desde aquí no se puede leer producción).
* Fila de flujo A110.

**2026-10-15:** PR [lightningtransport/LTL_Shop#343](https://linear.app/ltransl/review/ltr-113-one-make-model-rule-for-the-ninox-import-samsara-connect-and-ac42897956dd) abierto (rama al día con main). Pruebas: unitarias de shared 73/73 y de la API 682/682; `test:real` completo 154 PASA, 0 FALLA, 2 NO APLICA, con A110 pasando. **Falta:** mergear [lightningtransport/LTL_Shop#343](https://linear.app/ltransl/review/ltr-113-one-make-model-rule-for-the-ninox-import-samsara-connect-and-ac42897956dd) y correr el script en producción con el OK del dueño (primero sin `--apply`).

---

## LTR-114

**UX mobile: buscador WO sin placeholder y contador "Under revi…" truncado**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/152**

**Auditoría producción 2026-09-24 · U15**

A 375px: `/admin/work-orders` el input de búsqueda queda vacío sin placeholder (en desktop dice "Search Work Order, Truck, category, or Mechanic"); en `/admin/yard-operations` el contador "Under review" se trunca a "Under revi…".

---

## LTR-115

**UX Mechanics: texto suelto "en" al final de /admin/mechanics**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/152**

**Auditoría producción 2026-09-24 · U16**

Al final del main de `/admin/mechanics` se renderiza el texto "en" (probablemente el locale impreso por error). Además el header dice "Create a mechanic…" y debajo repite "System Admin only. Create a mechanic…" — consolidar.

---

## LTR-116

**UX Dashboard: PM con "Jobs 0/0" en Needs attention sin nada que atender**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27
- **Adjuntos: —**

**Auditoría producción 2026-09-24 · U17**

WO-005 y WO-006 (PM, normal, recién creadas) encabezan "Needs attention" con "Jobs progress 0 / 0". Para PM mostrar progreso PM (millas / partes registradas) y solo incluirlas si hay algo accionable (p. ej. >24h abiertas).

---

## LTR-117

**Epic: IA v2 — Truck como hub, taxonomía cerrada y nav por trabajo**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Epic
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-28
- **Adjuntos: —**

**Auditoría producción 2026-09-24 · Arquitectura de información (Admin)**

Problemas estructurales detectados al recorrer prod como Admin. Complementa los issues de lógica ([LTR-89](#ltr-89)…[LTR-99](#ltr-99)) y UX ([LTR-100](#ltr-100)…[LTR-116](#ltr-116)).

#### Hallazgos

1. Docs 09/10 desactualizados (Phase 1).
2. Objeto central = Truck, pero nav gira en torno a WO; Yard / Trucks / Work Orders se solapan.
3. Jobs gestionados en dos lugares (Work Plan en Truck detail vs WO detail).
4. Yard mezcla 3 fuentes (readiness Shop, ubicación externa, schedule Dispatch) sin jerarquía.
5. Tres listas de "atención" con criterios distintos.
6. Taxonomía en conflicto: Blocked, Ready To Go, Inspection, Under review.
7. Nav no separa operación diaria de configuración/auditoría.

#### Propuesta (borrador)

```
Operación                Configuración          Auditoría
├─ Hoy (Dashboard)       ├─ Mecánicos           └─ Historial / Activity
├─ Patio (board Truck)   └─ Catálogo de Jobs
│   └─ Truck detail = hub (Work Plan + WO + historial)
├─ Work Orders (lista)
└─ Flota (registro de trucks)
```

**Gated por plan de mejora** — no empezar código hasta cerrar la fase de revisión (Admin + Mechanic).

---

## LTR-118

**IA: glosario cerrado — Blocked, Ready To Go, Inspection, Under review**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Docs
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25 · **Padre:** LTR-117
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/159**

#### ✅ Decisión D5 (Cristian, 2026-09-25) — aprobada tal cual

* **Blocked** = solo blocker activo reportado (no "WO abierta").
* **Ready To Go** = solo el del Shop; estados externos se etiquetan "Dispatch: …".
* **Inspection** = fase/job de inspección con resultado "Sin hallazgos / Con hallazgos".
* **Under review** se retira.

---

Definir un significado único por término y aplicarlo en UI EN/ES + doc 02 (Glossary):

| Término | Hoy significa | Propuesta |
| -- | -- | -- |
| Blocked | WO abierta (Yard) · reporte del mecánico (WO) | Solo blocker activo / pausa oficial |
| Ready To Go | Ready derivado del Shop · estado externo Dispatch | Solo Shop; externo con etiqueta de fuente |
| Inspection | Categoría · fase Work Plan · sección Truck detail | Categoría = Inspection; fase = "Inspección"; resultado = No issues / Issues found |
| Under review | Estado legacy de assessment (Phase 1) | Retirar de contadores |

Entregable: tabla en doc 02 + lista de strings a cambiar en `admin-messages.ts` / `messages`.

---

## LTR-119

**IA: Truck detail como hub (Work Plan + WO + historial) y fuente canónica de jobs**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27 · **Padre:** LTR-117
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/177**

#### ✅ Decisión D6 (Cristian, 2026-09-25)

**Truck Detail / Work Plan es el lugar canónico** para agregar jobs. WO detail muestra jobs, asignaciones y ejecución, con link "Agregar trabajo" que lleva al Work Plan.

---

Hoy los jobs se agregan desde el Work Plan (Truck detail, `POST /admin/trucks/:id/work-plan/jobs`) y desde WO detail (`POST /admin/work-orders/:id/jobs`). Decidir la superficie canónica para el Shop Manager y que la otra enlace, no duplique.

Propuesta: Truck detail = hub (identidad colapsada, Work Plan, WO actual con jobs/asignaciones, historial). WO detail = ejecución + auditoría de esa WO. Back link / breadcrumb según origen ([LTR-110](#ltr-110)).

---

## LTR-120

**IA: separar Yard en "Readiness del Shop" y "Movimiento (fuente externa)"**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27 · **Padre:** LTR-117
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/179**

Yard Operations hoy mezcla: (1) readiness derivado del Shop, (2) Work location externa, (3) Incoming / Departures + estados de Dispatch. Mismo peso visual, mismo vocabulario.

Propuesta: tab/section 1 = board del Shop (fuente de verdad propia). Tab/section 2 = "Movimiento" con fuente y fecha de actualización visibles; cruzar solo como señal ("también esperado entrar el 28-sep") en la card del truck.

---

## LTR-121

**IA: una sola definición de "atención" (Dashboard, Yard, WO list)**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** UX, API
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-26 · **Padre:** LTR-117
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/168**

Needs attention (Dashboard), Blocked (Yard) y filtros de WO list usan criterios distintos. Definir en `packages/shared` una función/enum única de "attention reason" (ready to close, critical, high, paused, blocker activo, >24h) y usarla en las tres superficies con el mismo orden y copy.

---

## LTR-122

**IA: nav Admin agrupada (Operación / Configuración / Auditoría) y por capability**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25 · **Padre:** LTR-117
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/166**

Nav actual plana: Dashboard, Work Orders, Yard Operations, Trucks, Mechanics, Job Catalog, History. System Admin y Shop Manager ven lo mismo aunque sus JTBD difieren (corregir vs planificar).

Propuesta: grupos Operación (Hoy, Patio, Work Orders, Flota) · Configuración (Mecánicos, Catálogo) · Auditoría (Historial). Orden/énfasis según capability dominante; sin ocultar lecturas permitidas.

---

## LTR-123

**IA: "acción de este usuario ahora" above the fold en detalles (doc 10)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-28 · **Padre:** LTR-117
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/192**

Doc 10 exige "qué acción puede hacer este usuario ahora" arriba. WO detail, Truck detail y cards de Yard no lo cumplen. Patrón común: header con estado + "Siguiente paso" (acción si hay capability, o responsable + motivo si no).

**2026-09-27:** cubierto por la épica Flujo v3 ([LTR-149](#ltr-149)). El Truck lo resuelve [LTR-158](#ltr-158) (PR 8) y la coherencia con Dashboard / Yard / WO, [LTR-159](#ltr-159) (PR 9). Cerrar este issue al mergear [LTR-158](#ltr-158).

---

## LTR-124

**Labor: sesión sigue abierta tras completar todos los jobs (y es por WO, no por mecánico)**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/147**

#### ✅ Decisión D7 (Cristian, 2026-09-25)

Al completar el **último job pendiente** se cierra la sesión de labor automáticamente; la WO queda In Progress "Esperando al Manager" **sin labor corriendo**. Si el Manager agrega un job nuevo, el mecánico vuelve a pulsar Start (nueva sesión). Labor sigue siendo por WO (sin migración, sin `userId`).

---

**Auditoría producción 2026-09-25 · Mechanic · ML1** — requiere **decisión de producto**

#### Qué pasa

* `start()` crea un `WorkSession` **por Work Order** (sin `userId`). La sesión solo se cierra con pausa oficial / complete del Manager.
* Cuando el mecánico completa el último job, la sesión **sigue abierta**. El mecánico no tiene forma de parar el reloj (pausa = solo Manager).

#### Evidencia (prod)

WO-001 (277): MG inició 22-sep 10:56, jobs 3/3 completos el 23-sep; la WO sigue In Progress esperando al Manager → la labor acumula días. Home de MG: "Active jobs 0" mientras la sesión corre.

#### Riesgo

Labor inflada (reportes, costos). Además labor no se atribuye a un mecánico: con varios mecánicos en la WO se cuenta una sola vez; con un mecánico en varias WO se cuenta en paralelo.

#### Decisión

¿Al completar el último job se cierra la sesión automáticamente (WO queda "esperando Manager" sin labor corriendo)? ¿Labor por mecánico (sesión con `userId`)?

#### Código

`apps/api/src/work-orders/work-orders.service.ts` — `start()` L404, `closeOpenSession()` \~L1250, `completeJob()` L914.

#### Implementación (2026-09-25)

Rama `cristian/ltr-124-labor-sesion-sigue-abierta-tras-completar-todos-los-jobs-y`, commit `131b727` (local, sin push).

* `labor-session.ts` cierra la sesión + persiste totales al completar/cancelar el último job (mecánico y Manager).
* `start()` permite reabrir labor en WO In Progress con jobs pendientes; completar job sin sesión → `START_REQUIRED`.
* `laborRunning` en `WorkOrderDetailDto`; UI mecánico muestra Start Work de nuevo.
* Tests: api 392 ✓, web 119 ✓, shared 16 ✓, lint ✓, build ✓. Verificado en local end-to-end.

**Orden de deploy:** web antes (o junto) que API — la web nueva tolera API vieja; la API nueva con web vieja dejaría al mecánico sin botón Start.

**Nota datos legacy:** WOs abiertas hoy con sesión corriendo (WO-001 en prod) registrarán la labor acumulada hasta el momento en que se complete/cancele su próximo job o el Manager cierre la WO; corregible con Time correction.

---

## LTR-125

**Mechanic: puede iniciar varias WO Standard a la vez (sin guard)**

- **Estado:** Canceled · **Proyecto:** Mecánicos · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: —**

#### ✅ Decisión D2 (Cristian, 2026-09-25) — **No se cambia**

El **mecánico general (Standard) SÍ puede tener varias WO en curso**: empieza una, trabaja en otra; obligarlo a pausar/reiniciar sería fricción que no van a seguir. Consecuencia aceptada: la labor es por WO, así que puede solaparse entre WOs del mismo mecánico. Solo PM queda limitado a uno ([LTR-95](#ltr-95)).

---

**Auditoría producción 2026-09-25 · Mechanic · ML2** — requiere **decisión de producto**

#### Qué pasa

`start()` solo valida `status === 'created'` y acceso. No revisa si el mecánico ya tiene otra WO In Progress.

#### Evidencia (prod)

Home de MG: WO-004 (907) y WO-003 (906) ambas con **Start Work** habilitado, mientras WO-001 sigue In Progress con sesión abierta. Con dos taps el mecánico tendría 3 sesiones corriendo.

#### Decisión

Misma que [LTR-95](#ltr-95) (PM): ¿una WO activa por mecánico? Si sí: bloquear Start con mensaje "Tienes WO-001 en curso" o pedir confirmación.

#### Código

`apps/api/src/work-orders/work-orders.service.ts` `start()` L404.

---

## LTR-126

**Notes: campo único compartido con autosave — mecánico sobrescribe notas del Manager; "pedir trabajo" no es estructurado**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/167, https://github.com/lightningtransport/LTL_Shop/pull/161**

#### ✅ Decisión D8 (Cristian, 2026-09-25)

**Notas append-only + pedido de trabajo.** Cada nota = entrada con autor y hora (no se edita ni sobrescribe). "Pedir trabajo adicional" = acción propia del mecánico que el Manager ve en WO detail y Dashboard y puede convertir en Job. Migración en PR propio; migrar el texto actual de `notes` como primera entrada.

---

**Auditoría producción 2026-09-25 · Mechanic · ML3**

#### Qué pasa

* La WO tiene **un solo** texto `notes`. Manager y mecánico editan el mismo campo; el mecánico lo autosalva (600 ms / blur) → last-write-wins, sin autor ni hora por nota.
* El pedido "Need additional work on this Truck? Write it here so your Manager can add the Job" usa ese mismo textarea (placeholder). No hay notificación ni lista de pedidos para el Manager.

#### Evidencia (prod)

WO-001 como MG: textarea precargado con "Standard WO smoke test / MG smoke work-order note" (texto de ambos), editable.

#### Esperado

Notas como entradas append-only (autor + hora), y "Pedir trabajo adicional" como acción propia que el Manager vea en Dashboard / WO detail (y pueda convertir en Job).

#### Código

`apps/web/src/app/work-orders/[id]/detail-client.tsx` L586–745 (`saveNotes`, autosave).

---

## LTR-127

**Mechanic: jobs completados muestran asignación en vez de quién los completó**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/153**

**Auditoría producción 2026-09-25 · Mechanic · ML4**

WO-001 (Home y detalle de MG):

* "General Inspection ✓ — **Unassigned — inherits the Work Order team**" → la completó MG.
* "Detailing ✓ — **Assigned to you**" → la completó Cristian (según Activity Log admin).

En jobs completados mostrar "Completado por X · fecha" (como en Admin). La línea de asignación solo aplica a jobs pendientes.

---

## LTR-128

**Mechanic: no ve los blockers ya reportados en la WO (riesgo de duplicados)**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/165, https://github.com/lightningtransport/LTL_Shop/pull/160**

#### ✅ Decisión D3 aplicada

Mostrar al mecánico los blockers **activos** (modelo de [LTR-98](#ltr-98)) arriba de Work options, con opción de marcarlo Resuelto.

---

**Auditoría producción 2026-09-25 · Mechanic · ML5**

WO-001 tiene blocker "Waiting for Parts" reportado por MG (visible en Admin). En el detalle del mecánico no aparece: solo el botón **Report Blocker**. El mecánico no sabe si su reporte llegó ni si sigue activo, y puede reportarlo otra vez.

Esperado: mostrar blockers activos (y su estado si se implementa [LTR-98](#ltr-98)) arriba de "Work options".

---

## LTR-129

**Mechanic Home: "Ready to start" no ordena por prioridad (Critical debajo de Normal)**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/155**

**Auditoría producción 2026-09-25 · Mechanic · ML6**

Home de MG → Ready to start: 1º **#907 WO-004 Normal**, 2º **#906 WO-003 CRITICAL**. El mecánico debería ver primero lo crítico (JTBD-2 "qué me toca hoy").

Orden esperado: prioridad (critical → high → normal → low) y luego antigüedad. Alinear con [LTR-97](#ltr-97) / [LTR-121](#ltr-121).

---

## LTR-130

**UX Mechanic: cards y detalle sin identidad del truck (solo "#907"); categoría principal engaña**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/167, https://github.com/lightningtransport/LTL_Shop/pull/162**

**Auditoría producción 2026-09-25 · Mechanic · MU1**

* Cards de Home y header del detalle muestran "**#907**": el "#" hace que el número de truck parezca un número de WO. No hay make/model/ubicación en la card; en el detalle "Truck information" está colapsado por defecto.
* La línea "**Inspection** · 0 of 3 jobs done" usa la categoría principal (legacy `primaryCategoryId`) aunque los jobs son DPF/DEF, Flat Repair, etc.

Propuesta: "Truck 907 · 2026 Volvo VNL 860" + ubicación reportada corta; quitar "#"; reemplazar categoría principal por el conteo de jobs (o las categorías de los jobs).

---

## LTR-131

**UX Mechanic: jobs deshabilitados antes de Start sin explicar por qué; sin tiempo visible**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/162**

**Auditoría producción 2026-09-25 · Mechanic · MU2**

* WO en Created: los jobs se ven atenuados/deshabilitados sin texto que diga "Pulsa Start Work para poder completar jobs".
* En WO In Progress el mecánico no ve cuánto tiempo lleva (labor). Depende de [LTR-94](#ltr-94) / [LTR-124](#ltr-124).

---

## LTR-132

**Copy Mechanic Home: subtítulo duplicado ("Work Orders and Jobs the Manager assigned…" + "Managers plan Standard work…")**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/153**

**Auditoría producción 2026-09-25 · Mechanic · MU3**

Home `/mechanic/standard` repite la misma idea en dos párrafos seguidos. Dejar una sola línea. El mismo texto reaparece en `/mechanic/standard/new`.

---

## LTR-133

**IA Mechanic: workspace = solo Home + WO; sin búsqueda de truck, sin "mi trabajo de hoy / completado"**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27 · **Padre:** LTR-117
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/178**

**Auditoría producción 2026-09-25 · Mechanic · MIA1**

* No hay navegación: el menú de perfil solo tiene cambiar contraseña + Sign out.
* Repair history de un truck solo se alcanza desde WO → Truck information (colapsado) → "View truck repair history".
* No hay lista de lo que el mecánico completó hoy / esta semana.

Propuesta (mobile): bottom nav o tabs — **Mi trabajo** · **Buscar truck** (historial) · **Completado**. Perfil separado de acciones.

#### Revisión PM (MPM, 2026-09-25)

Inconsistencia entre workspaces mecánicos: PM Home **sí** tiene "View completed work (1)" y Truck information **expandido** en el detalle; Standard no tiene completados y Truck information está **colapsado**. Unificar patrón para ambos.

---

## LTR-134

**IA Mechanic Home: secciones mezclan nivel WO y nivel Job ("Active jobs 0" con WO en curso)**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27 · **Padre:** LTR-117
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/176**

**Auditoría producción 2026-09-25 · Mechanic · MIA2**

Secciones de Home: Ready to start (WO) · Waiting on Manager (WO) · Active jobs (Job) · Paused jobs (Job). Resultado en prod: WO-001 In Progress con sesión abierta aparece en "Waiting on Manager" y "Active jobs" dice 0.

Propuesta: agrupar por WO con estado del mecánico: **En curso** · **Por empezar** (ordenado por prioridad, [LTR-129](#ltr-129)) · **Esperando al Manager** · **Pausado**. Una sola unidad (WO) en toda la Home.

---

## LTR-135

**PM: observed mileage sin validación — puede bajar el odómetro del truck al finalizar**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** API, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/148**

#### ✅ Decisión D10 (Cristian, 2026-09-25)

**Bloquear** guardar/finalizar si `observedMileage` < millaje actual del truck (API + UI, mensaje claro con el millaje de referencia). Si el salto es anómalo (> +50,000 mi sobre el actual) pedir **confirmación** antes de guardar.

---

**Auditoría producción 2026-09-25 · PM Mechanic · PL1**

#### Qué pasa

* Schema: `observedMileage: z.number().int().nonnegative()` — sin mínimo respecto al millaje actual ni máximo razonable.
* Al finalizar el PM, si `observedMileage !== truck.mileage` se **sobrescribe** `truck.mileage` y se registra `TRUCK_MILEAGE_CORRECTED`. Un typo (menos dígitos) baja el odómetro; uno con más dígitos lo infla.

#### Evidencia (prod)

WO-002 (truck 601, PM completado): **Observed mileage 364,400** vs **Current truck mileage 365,686**. El registro del PM queda por debajo del millaje del truck.

#### Esperado

* Bloquear (o pedir confirmación explícita con motivo) si observed < último millaje conocido.
* Advertir si el salto es anómalo (p. ej. > +50,000 mi desde el último PM/lectura).
* Mostrar el millaje de referencia junto al input.

#### Código

`packages/shared/src/schemas.ts:312` · `apps/api/src/work-orders/work-orders.service.ts` \~L989–1030 (finish PM) y \~L1140–1165 (save PM).

---

## LTR-136

**PM: no se puede hacer PM a un truck con WO Standard abierta (callejón sin salida)**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/173**

#### ✅ Decisión D9 (Cristian, 2026-09-25)

PM = **job obligatorio dentro de la única WO del truck**. Create PM en un truck con WO abierta → abre el job PM de esa WO (no crea otra). Se implementa en el epic "PM dentro del Work Plan".

---

**Auditoría producción 2026-09-25 · PM Mechanic · PL2** — requiere **decisión de producto**

#### Qué pasa

Regla bloqueada: 1 WO abierta por truck. PM es su propia WO y una Standard no puede incluir la categoría PM. Resultado: si el truck entró por inspección/reparación, el PM Mechanic **no puede** registrar su PM hasta que el Manager cierre la Standard.

#### Evidencia (prod)

Create PM → buscar **906** → el resultado no avisa nada; al seleccionarlo: "Truck #906 already has an open Work Order assigned to another mechanic." Sin botón, sin siguiente paso (906 tiene WO-003 Critical de MG).

#### Decisión

(a) Permitir PM como Job dentro de la WO Standard abierta; (b) permitir PM paralelo como excepción a la regla 1-WO; (c) mantener bloqueo pero con siguiente paso claro ("Pide al Shop Manager…", link a la WO) y marcar en la búsqueda los trucks con WO abierta.

#### Código

`apps/web/src/app/work-orders/new/page.tsx` L184–210, L475–483.

---

## LTR-137

**PM completado: "Current mileage" y "Last completed PM" muestran datos de hoy, no del servicio**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/157**

**Auditoría producción 2026-09-25 · PM Mechanic · PL3**

En WO-002 (PM **completado**, truck 601):

* "Current truck mileage 365,686" = millaje actual del truck, no el del momento del servicio.
* "Last completed PM: **No prior PM recorded**" en la propia WO del PM ya completado → confunde (¿este PM no cuenta?).

Esperado en WO completada: "Millaje registrado en este PM", "PM anterior a este" (o ocultar), fecha/hora de finalización y quién lo cerró.

---

## LTR-138

**UX PM Home: botón "Finish Work" solo navega; cards sin tiempo, progreso ni modelo**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/153**

**Auditoría producción 2026-09-25 · PM Mechanic · PU1**

* Las cards de Active PM services tienen CTA **"Finish Work"** que es un link al detalle (no finaliza). Genera expectativa equivocada; renombrar a "Abrir" / "Continuar".
* Card muestra solo "#923 · WO-006 · In Progress · PM Service": sin modelo del truck, sin tiempo transcurrido, sin progreso (millaje registrado ✓/✗, partes ✓/✗) que es justo lo que bloquea Finish.

**Parcial en PR** [lightningtransport/LTL_Shop#153](https://linear.app/ltransl/review/ola-1c-mechanic-and-pm-ui-fixes-ltr-127-ltr-132-ltr-138-ltr-140-c1cb9e144f7c)**:** CTA renombrado a "Continue PM service" + hora de inicio en la card. El progreso (millaje/partes) en la card necesita datos PM en el DTO de lista → queda para [LTR-141](#ltr-141).

---

## LTR-139

**UX PM detalle: completado muestra 9 selects deshabilitados; datos RO con estilo de input; "Saved" en vista cerrada**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-25
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/157**

**Auditoría producción 2026-09-25 · PM Mechanic · PU2**

* PM completado (WO-002): "Parts used" renderiza las 9 categorías como selects deshabilitados, casi todas "No part used". Mostrar solo resumen de partes usadas (código + nombre + cantidad).
* "Current truck mileage" y "Last completed PM" son `<input readOnly>` con estilo de campo editable → parecen editables. Usar texto / definition list.
* Etiquetas "Saved" siguen visibles en una WO cerrada.
* En PM In Progress: "Enter the observed mileage to record parts used" bloquea partes hasta cargar millaje; considerar permitir ambos en cualquier orden.

---

## LTR-140

**UX Create PM: placeholder truncado y resultados no marcan trucks con WO abierta**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/180, https://github.com/lightningtransport/LTL_Shop/pull/173, https://github.com/lightningtransport/LTL_Shop/pull/153**

**Auditoría producción 2026-09-25 · PM Mechanic · PU3**

* Placeholder "Search truck number (for example, #905)" se corta a 375px.
* La lista de resultados ("#906 · Volvo VNL 860") no indica que el truck tiene WO abierta; el mecánico lo descubre recién al seleccionarlo. Mostrar badge "WO abierta · WO-003" en el resultado.

**Parcial en PR** [lightningtransport/LTL_Shop#153](https://linear.app/ltransl/review/ola-1c-mechanic-and-pm-ui-fixes-ltr-127-ltr-132-ltr-138-ltr-140-c1cb9e144f7c)**:** placeholder acortado. El badge "WO abierta" en resultados queda para [LTR-141](#ltr-141) (D9: Create PM se une a la WO abierta).

---

## LTR-141

**Epic: PM dentro del Work Plan — una WO por truck con Inspection → Shop Work → PM → Alignment → Detailing**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API, Epic, Feature
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27
- **Adjuntos: —**

#### ✅ Decisiones D4 + D9 (Cristian, 2026-09-25)

Todo truck que llega al yard recibe **PM (cambio de aceite), Alignment y Detailing**. El PM es una fase del flujo del Shop, no una WO aparte.

##### Flujo canónico

`Inspection → Shop Work (solo si la inspección encuentra algo) → PM (siempre) → Alignment (siempre) → Detailing (siempre) → QC (siempre) → Listo para cerrar WO → Ready to Go (WO Completed, D1)`

> **QC siempre obligatorio** (Cristian, 2026-09-25) — cierra la decisión abierta #2 del doc Decision Work Plan.

##### Reglas

1. **Una sola WO por truck** con todo el Work Plan (se mantiene la regla bloqueada 1 WO abierta).
2. **PM = job obligatorio** dentro de esa WO (catálogo: "PM A Service" / "PM B Service"). Lo ejecuta un usuario con `mechanic.pm`; al completarlo registra **millaje observado + partes** (reglas de [LTR-135](#ltr-135) / D10). Completar el job PM ≠ completar la WO.
3. **Jobs obligatorios automáticos:** al crear la WO del truck se agregan solos **PM, Alignment, Detailing y QC**. El Manager solo agrega Shop Work si la inspección encuentra algo.
4. **Create PM service (PM Mechanic):**
   * truck **con** WO abierta → abre el job PM de esa WO (no crea otra).
   * truck **sin** WO → crea la WO del truck con el Work Plan completo y el job PM ya iniciado.
5. **Un PM en curso por PM Mechanic** (D2 / [LTR-95](#ltr-95)).
6. Yard board: nueva columna **PM** entre Shop Work y Alignment.

##### Reglas que cambian (actualizar docs)

* README "PM exception" y `docs/pm-daniel.md`: "Standard flow never offers or accepts PM as a Job Category" → **superseded**.
* `CURRENT_PRODUCT_STATUS.md:206` "Standard may not add the PM Category" → superseded.
* API: `work-orders.service.ts` L161–168, L687, L701–702, L808, L926; `yard-work-plan.service.ts` L90, L217–220; filtros PM en `job-picker-dialog.tsx:65`, `work-plan-add-work.tsx:49`, `admin-new-work-order.tsx:120`, `work-orders/new/page.tsx:70`.
* `pmService` hoy es 1:1 con WO (`workOrderId`) → pasa a colgar del job PM (o sigue por WO con un solo job PM por WO; decidir en diseño técnico).

##### Compatibilidad / no romper

* PM WOs legacy abiertas (WO-005, WO-006) siguen funcionando con el flujo actual hasta cerrarse; la derivación las muestra en la columna PM.
* Detrás de flag (`WORK_PLAN_PM_PHASE`), activar en prod tras smoke.
* Migración en PR propio.

##### Slices propuestos

1. Diseño técnico (modelo pmService ↔ job, migración, flag) — sin código de producto.
2. Derivación: lane/fase PM + columna Yard (resuelve [LTR-91](#ltr-91)).
3. Auto-jobs PM/Alignment/Detailing/QC al crear WO; QC pasa a obligatorio en la derivación.
4. Ejecución del job PM (millaje + partes) desde WO Standard por `mechanic.pm`.
5. Create PM se une a la WO abierta / crea WO completa (resuelve [LTR-136](#ltr-136), [LTR-140](#ltr-140)).
6. Docs + e2e `pm-workflow`, `yard-work-plan-board-cutover`.

---

## LTR-142

**Release: aplicar migraciones LTR-98 + LTR-126 y re-sincronizar API/web en producción**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Bug
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-26
- **Adjuntos: —**

#### Situación (2026-09-25 \~17:30 ET)

* `main` tiene [lightningtransport/LTL_Shop#159](https://linear.app/ltransl/review/ola-3a-yard-blocked-counters-and-glossary-truck-detail-inspection-ltr-792e2815cdf6), [lightningtransport/LTL_Shop#165](https://linear.app/ltransl/review/re-land-160-blockers-stay-active-until-resolved-ltr-98-ltr-128-1e75bd7e2fa6) (re-land [lightningtransport/LTL_Shop#160](https://linear.app/ltransl/review/ltr-98-ltr-128-blockers-stay-active-until-resolved-a70d899ab650), blockers [LTR-98](#ltr-98)/128), [lightningtransport/LTL_Shop#161](https://linear.app/ltransl/review/append-only-work-order-notes-request-work-ltr-126-48f7ead2b473) (notas [LTR-126](#ltr-126)) y [lightningtransport/LTL_Shop#166](https://linear.app/ltransl/review/admin-nav-grouped-operations-setup-audit-ltr-122-953e8929bce8) (nav [LTR-122](#ltr-122)). [lightningtransport/LTL_Shop#167](https://linear.app/ltransl/review/re-land-ola-4-162-163-164-ltr-130131-ltr-105109-ltr-101102103-47210719e699) (re-land Ola 4: [lightningtransport/LTL_Shop#162](https://linear.app/ltransl/review/mechanic-truck-identity-start-work-hint-labor-time-ltr-130-ltr-131-26568aae0639)–[lightningtransport/LTL_Shop#164](https://linear.app/ltransl/review/yard-cards-say-what-is-missing-dispatch-status-grouped-ltr-101-ltr-102-d1f02d8004bc)) está **abierto, sin fusionar a propósito**.
* **API prod = build de** [lightningtransport/LTL_Shop#159](https://linear.app/ltransl/review/ola-3a-yard-blocked-counters-and-glossary-truck-detail-inspection-ltr-792e2815cdf6) (`ab3a774`). Los deploys del API de [lightningtransport/LTL_Shop#165](https://linear.app/ltransl/review/re-land-160-blockers-stay-active-until-resolved-ltr-98-ltr-128-1e75bd7e2fa6) y [lightningtransport/LTL_Shop#161](https://linear.app/ltransl/review/append-only-work-order-notes-request-work-ltr-126-48f7ead2b473) **fallaron a propósito**: el *release gate* no despliega código con migraciones pendientes:
  * `20260925150000_blocker_resolution_ltr98`
  * `20260925170000_work_order_notes_ltr126`
* **Web prod = build de** [lightningtransport/LTL_Shop#161](https://linear.app/ltransl/review/append-only-work-order-notes-request-work-ltr-126-48f7ead2b473) (`76f7297`). La web nueva habla con el API viejo.
* **Riesgo:** "Agregar nota" o "Pedir trabajo" del mecánico manda `{kind, body}`. El API viejo espera `{notes}` y **deja en blanco las notas de la WO**. El texto anterior queda en el Activity Log (`notes_updated.previousValue`).
* **Vercel (plan Hobby) llegó al límite de builds:** "Deployment rate limited — retry in 24 hours" (desde el merge de [lightningtransport/LTL_Shop#166](https://linear.app/ltransl/review/admin-nav-grouped-operations-setup-audit-ltr-122-953e8929bce8)). No se puede construir nada nuevo hasta que se libere.

#### Qué hace y qué NO hace cada paso

* **Rollback de la web:** no toca la base de datos. Deja la web y el API en [lightningtransport/LTL_Shop#159](https://linear.app/ltransl/review/ola-3a-yard-blocked-counters-and-glossary-truck-detail-inspection-ltr-792e2815cdf6), la pareja que ya funcionaba junta. Mientras dure no se ven las funciones nuevas, pero los datos guardados se conservan. Después de un rollback Vercel **no promueve solo** los deploys nuevos; hay que promover a mano en el paso 5.
* **Migraciones:** solo agregan. Son 2 columnas nulas en `pause_events` (los blockers de WO cerradas quedan como resueltos) y la tabla nueva `work_order_notes`, que **copia** el texto actual de `work_orders.notes` como primera entrada. No borran nada, y el API viejo las ignora.
* **⚠️ El workflow Release safety, al aplicar migraciones, también corre** `prisma:apply-catalog`**.** Esto **reactiva** jobs o categorías oficiales que un Admin haya desactivado en Job Catalog y **devuelve el nombre oficial** a los jobs oficiales renombrados. No borra ni toca WOs.

#### Checklist

##### Ahora (Cristian, en Vercel; el agente no puede hacer deploys a producción)

- [ ] **1. Rollback de la web** a la build de [lightningtransport/LTL_Shop#159](https://linear.app/ltransl/review/ola-3a-yard-blocked-counters-and-glossary-truck-detail-inspection-ltr-792e2815cdf6): Vercel → `ltl-shop-web` → Deployments → `ltl-shop-28f9krl54-ltl8.vercel.app` (commit `ab3a774`) → **Instant Rollback**. O por CLI: `vercel rollback https://ltl-shop-28f9krl54-ltl8.vercel.app --scope ltl8`
- [ ] Verificar: en prod, el detalle de WO del mecánico vuelve al textarea único de notas (sin "Pedir trabajo").

##### En \~24 h, cuando Vercel libere el límite

- [ ] **2. Catálogo:** confirmar si alguien desactivó o renombró jobs en Admin → Job Catalog en prod. Si sí, anotar cuáles para re-aplicarlos después del paso 3.
- [ ] **3. Migraciones:** GitHub → Actions → **Release safety** → Run workflow con `apply_migrations = true` y `verify_api = true`. CLI: `gh workflow run release-safety.yml -f apply_migrations=true -f verify_api=true`. Debe terminar en verde.
- [ ] **4. Redeploy del API** desde el último commit de `main` (Vercel → `ltl-shop-api` → Redeploy). Ahora debe pasar el release gate. Verificar `https://ltl-shop-api.vercel.app/api/health` = 200.
- [ ] **5. Fusionar** [lightningtransport/LTL_Shop#167](https://linear.app/ltransl/review/re-land-ola-4-162-163-164-ltr-130131-ltr-105109-ltr-101102103-47210719e699) (re-land Ola 4, sin migración) y **promover** a producción el deploy de la web de ese commit (Vercel → `ltl-shop-web` → Promote). Esto también quita el modo rollback.
- [ ] **6. Revisión en prod solo lectura:** WO detail muestra "Truck N", notas con autor y hora, "Siguiente paso" en Admin, menú agrupado, y el Yard con "Estado de Dispatch".
- [ ] 7\. Pasar a Done [LTR-98](#ltr-98), 128, 126, 122, 130, 131, 105, 109, 101, 102, 103.

#### Para que no se repita

* Los PRs nuevos van directo contra `main`, sin encadenar.
* Recomendado: GitHub Settings → "Automatically delete head branches".
* Considerar si el plan Hobby de Vercel alcanza para el ritmo de merges, o agrupar merges.

---

## LTR-143

**LTR-141 · Slice 0: migración — WorkOrderJob.startedAt + PmService.workOrderJobId**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-26 · **Padre:** LTR-141
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/169**

PR propio, solo aditivo, directo contra `main`.

* `WorkOrderJob.startedAt DateTime?` guarda el inicio del job PM. El fin ya existe en `completedAt`.
* `PmService.workOrderJobId String? @unique`, FK a `WorkOrderJob` con `onDelete: SetNull`. Se mantiene `workOrderId @unique`: un PM por WO. Las WO de PM viejas quedan con `workOrderJobId` en null.
* Sin backfill.
* Aplicar en prod con **Release safety** (ver [LTR-142](#ltr-142)).

Plan completo: comentario del epic [LTR-141](#ltr-141).

---

## LTR-144

**LTR-141 · Slice 1: derivación + Yard — fase PM, QC obligatorio, "No aplica" (flag WORK_PLAN_PM_PHASE)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Feature
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-26 · **Padre:** LTR-141
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/170**

Todo detrás del flag nuevo `WORK_PLAN_PM_PHASE` (en `yard-work-plan-flag.ts`).

* Helpers compartidos `isPmCategory` / `isPmJob` en `packages/shared`.
* Lane `PM` en `classifyWorkPlanLane`, antes de Shop Work.
* Enums nuevos: `WorkPlanPhase.PM` (entre Shop Work y Alignment), `WorkPlanNotReadyReason.PM_PENDING` y `mandatory.pm`.
* QC siempre obligatorio.
* Si un lane obligatorio tiene todos sus jobs cancelados, cuenta como `NOT_APPLICABLE` (resuelto). El motivo queda en el Activity Log.
* Una WO de PM vieja (categoría PM, sin jobs) cae en la columna **PM**, no en Inspection. Resuelve [LTR-91](#ltr-91).
* Web:
  * `WORK_PLAN_YARD_PHASES` agrega `pm`; QC siempre visible con el flag.
  * Fila PM obligatoria y CTA "Agregar PM" en el Work Plan.
  * `yard-card` muestra "Siguiente: PM".
  * El flag llega como `pmPhaseEnabled`.
* Tests: `yard-work-plan-derivation.spec` (el caso "QC opcional" cambia cuando el flag está encendido), routing y e2e board-cutover.

---

## LTR-145

**LTR-141 · Slice 2: jobs obligatorios automáticos (PM A, Alignment, Detailing, QC) + PM permitido en WO Standard**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Feature
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-26 · **Padre:** LTR-141
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/171**

Con el flag encendido:

* **Jobs automáticos:** `WorkOrdersService.create` (WO Standard, ambos caminos del Manager llegan a `createByManager`) agrega "PM A Service", "Alignment", "Detailing" y "Quality Check". Se buscan por nombre de catálogo y no se duplican si ya vienen en `jobs`.
* **PM en WO Standard:** se quitan los rechazos de la categoría PM en `addJob` (\~:787) y en `assertStandardJobsUseActiveCategories` (\~:894).
* **Pickers web:** `job-picker-dialog`, `work-plan-add-work`, `admin-new-work-order` y `work-orders/new` permiten la categoría PM.
* **Cambiar A↔B:** `PATCH` del job PM entre los jobs de la categoría PM. Lo pueden hacer el Manager o el mecánico PM asignado mientras el job no esté completado.
* Las WO abiertas existentes no reciben backfill.

---

## LTR-146

**LTR-141 · Slice 3: ejecución del job PM por mechanic.pm dentro de la WO Standard**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** Feature
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27 · **Padre:** LTR-141
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/172**

Con el flag encendido:

* **Asignación:** el job PM se asigna a un usuario `mechanic.pm` con `job.assignedMechanicId`. Asignar `mechanic.pm` solo se permite en jobs de lane PM.
* **Acceso:** en `assertMechanicAccess`, un `mechanic.pm` asignado puede **ver** la WO Standard y **operar solo su job PM**. Un mecánico Standard no puede completar el job PM.
* **Empezar:** `POST /work-orders/:id/jobs/:jobId/pm/start` pone `startedAt` y crea o une el `PmService` (`workOrderJobId`). `GET`/`POST /work-orders/:id/pm` se reusan.
* **Completar:** `completeJob` del job PM exige millaje, al menos una parte y el guard [LTR-135](#ltr-135).
* **Terminar el PM:** se extrae `finishPmService(tx, …)` para quitar la duplicación entre mecánico `complete` y admin `completeWorkOrder`. Completar el job PM **no** completa la WO.
* **D2 (un PM en curso por mecánico PM):** cuenta los jobs PM empezados y sin terminar más las WO de PM viejas en curso. Se valida al **empezar y al reanudar**, lo que cierra el hueco actual en `resume`.
* **Web:**
  * Home `/mechanic/pm` lista "PM en WO-xxx · Truck N".
  * El detalle para `mechanic.pm` muestra la vista del job PM (`PmServiceCard`, Empezar/Terminar PM).
  * En el Admin, la fila del job PM muestra estado, mecánico, millaje, partes, inicio y fin.

---

## LTR-147

**LTR-141 · Slice 4: "Create PM service" se une a la WO abierta o crea la WO completa**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Feature
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27 · **Padre:** LTR-141
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/173**

Resuelve [LTR-136](#ltr-136) y [LTR-140](#ltr-140). Con el flag encendido:

* **El truck tiene WO abierta:**
  * Tiene un job PM pendiente y sin asignar → se asigna al mecánico PM y se empieza.
  * No tiene job PM → se agrega "PM A Service" y se empieza.
  * El job PM lo tiene otro mecánico PM → 409 con un mensaje claro y link a la WO.
* **El truck no tiene WO:** se crea la WO Standard con categoría principal Inspection y los jobs obligatorios. El job PM queda asignado al mecánico PM y empezado. El Manager asigna después el equipo Standard.
* **Búsqueda de trucks:** marca los que tienen WO abierta ("Se unirá al PM de WO-xxx"). Sin callejón sin salida.

---

## LTR-148

**LTR-141 · Slice 5: Dashboard PM (LTR-116), docs superseded y e2e**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** Feature
- **Creado:** 2026-09-25 · **Cerrado:** 2026-09-27 · **Padre:** LTR-141
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/175, https://github.com/lightningtransport/LTL_Shop/pull/174**

* **Dashboard (**[LTR-116](#ltr-116)**):**
  * En `packages/shared/src/attention.ts`, las WO de PM viejas solo cuentan para atención si llevan más de 24 h abiertas, están en pausa o tienen blocker; no solo por estar abiertas.
  * La tarjeta muestra el progreso del PM (millaje y partes) en vez de "Jobs 0/0".
* **Docs:** marcar como superseded README "PM exception", `docs/pm-daniel.md` y `CURRENT_PRODUCT_STATUS.md:206`. Documentar el flag `WORK_PLAN_PM_PHASE`.
* **e2e:**
  * `pm-workflow`: job PM dentro de una WO Standard, y "Create PM" que se une a la WO sin callejón sin salida.
  * board-cutover: columna PM y fila PM en el Work Plan.
* **Rollout:** encender el flag en local y hacer la prueba completa; en prod lo enciende Cristian.

---

## LTR-149

**Epic: Flujo v3 — un responsable por job, bloqueo por job, flujo del taller preconfigurado y Truck como lugar de trabajo (D11–D18)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, API, Epic, Feature
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28
- **Adjuntos: —**

#### Fuente de verdad

* Documento: `docs/ux/FLUJOS_Y_MEJORAS_2026-09-27.md` (repo). Decisiones D11–D18 en §4 y §12; revisión contra código/PRD/Linear en §11.
* Runbook de ejecución (prompts por PR para un modelo de menor costo): `docs/agents/FLUJO_V3_RUNBOOK.md`.
* Regla: un issue hijo = una rama = un PR contra `main`. Migraciones en PR propio. Orden estricto, ver dependencias en cada hijo.

#### Decisiones que reemplazan a anteriores (doc 16)

* **D17 reemplaza a D3**: solo el Manager resuelve el bloqueo; el mecánico agrega nota.
* **D18 reemplaza a D7**: labor por mecánico (`work_sessions.user_id`); el tiempo del mecánico se detiene al terminar su parte o al bloquear su último job disponible; vuelve con "Continuar".
* **D11 reemplaza Q10/Q17 del PRD**: desaparece "inherits the Work Order team"; el equipo se deriva de los jobs asignados.
* **D15**: QC no lleva responsable; lo completa el Manager desde el Truck.
* **D17**: el bloqueo es siempre de un job; "Truck Unavailable" sale de los motivos del mecánico.

#### Flujo objetivo (§5 del doc)

Crear WO (solo truck) → Inspección en el Truck (Manager) → trabajo por mecánico (solo sus jobs) → bloqueo por job → QC → Cerrar / Ready to Go desde el Truck → Return to Service desde Truck o Yard.

#### Relación con issues existentes

* [LTR-123](#ltr-123) (Siguiente paso above the fold) queda cubierto por el PR "Truck como lugar de trabajo".
* [LTR-59](#ltr-59) y [LTR-60](#ltr-60) (validaciones V2.1) se validan al cerrar esta épica.
* Continúa a [LTR-117](#ltr-117) (IA v2) y [LTR-141](#ltr-141) (PM dentro del Work Plan).

---

## LTR-150

**Flujo v3 · PR 0: flags Work Plan / PM phase como único modo (retirar código flag-off)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API, Improvement
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-27 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/181**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 0". Pegar el preámbulo común + ese prompt en un chat nuevo.

**Depende de:** nada. Puede correr en paralelo con PR 1 y PR 6.

**Resumen.** `YARD_WORK_PLAN_SLICE1`, `YARD_WORK_PLAN_SLICE2` y `WORK_PLAN_PM_PHASE` dejan de ser flags (`apps/api/src/admin/yard-work-plan-flag.ts`). Se retira la UI de seis gates y "Mark Ready to Go" de `admin-truck-detail.tsx`. `YARD_READY_TO_GO_SINCE` se conserva como configuración.

**Aceptación.** Ninguna rama depende de la variable de entorno; tests/e2e sin flags; `CURRENT_PRODUCT_STATUS.md` describe un solo modo; e2e `admin-truck-work-plan`, `yard-work-plan-board-cutover`, `pm-workflow`, `admin-truck-detail`, `yard-operations` verdes.

---

## LTR-151

**Flujo v3 · PR 1: errores rápidos de la sección 8 (copy, a11y, picker de mecánicos, PM "Saved")**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-27 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/183**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 1".

**Depende de:** nada.

**Alcance.** Puntos 3–11 de §8 del doc UX. Excluye: 8.1 (verificar en prod; no reproducible en `main`), 8.2 (va en PR 4), 8.12 (va en PR 8).

* 8.3 "Current Work" con WO completada
* 8.4 picker de mecánicos: filtrar `role !== 'admin'` + paginar `useAdminMechanics` (hoy solo 25)
* 8.5 "Complete job" ofrecido al Standard sobre PM ajeno
* 8.6 selects sin etiqueta accesible
* 8.7 texto de Return to Service (sí saca de Ready to Go)
* 8.8 "1 Jobs pending"
* 8.9 métricas del Dashboard sin nombre accesible
* 8.10 "Not recorded" vs "No mechanics assigned"
* 8.11 "Saved" en PM antes de escribir

**Aceptación.** Un test por punto; paridad EN/ES; e2e `ui-consistency`, `ux-regressions`, `admin-truck-detail`, `mechanic-flow`, `pm-workflow`.

---

## LTR-152

**Flujo v3 · PR 2: vocabulario común EN/ES (§7) y retiro de "inherits the Work Order team"**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Docs
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/185**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 2".

**Depende de:** PR 1.

**Alcance.** Solo strings y glosario. Aplica la tabla de §7 en `admin-messages.ts` y `locale-context.tsx`; claves nuevas para estados de job (Pendiente / En curso / Bloqueado) que PR 4 empieza a usar; elimina "inherits the Work Order team", "Mandatory for every yard Truck", jerga de operational status y restos de "Under review". Actualiza `docs/design-system/glossary-en-es.md` citando [LTR-118](#ltr-118).

**Aceptación.** `grep -ri inherit apps/web/src` sin resultados en UI; specs de paridad verdes; e2e `ui-consistency`.

---

## LTR-153

**Flujo v3 · PR 3: migración A — work_sessions.user_id, pause_events.job_id, enum blocker_reason**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/186**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 3". **Solo esquema, sin cambio de comportamiento.**

**Depende de:** PR 0.

**Cambios (aditivos).**

1. `work_sessions.user_id` UUID nullable, FK `users`, índice `(work_order_id, user_id)`.
2. `pause_events.job_id` UUID nullable, FK `work_order_jobs`.
3. Enum Postgres `blocker_reason` (`waiting_for_parts`, `waiting_for_approval`, `waiting_for_vendor`, `waiting_for_equipment`, `waiting_for_bay`, `waiting_for_driver`, `other`) + columna `pause_events.blocker_reason` nullable. `PauseReason` no se toca.
4. Enum TS `BlockerReason` en `packages/shared/src/enums.ts` con etiquetas EN/ES.

**Aceptación.** `prisma migrate dev` limpio; `prisma:release-status` OK; ningún contrato de endpoint cambia; tests actuales verdes; nota en `CURRENT_PRODUCT_STATUS.md`.

Sustenta D18 (labor por mecánico, reemplaza a D7) y D17 (bloqueo por job).

---

## LTR-154

**Flujo v3 · PR 4: dueño de cada job (D11) y labor por mecánico (D18) — "Terminaste tu parte"**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/187**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 4".

**Depende de:** PR 2, PR 3.

**Decisiones (doc UX §12).** D11 equipo derivado de los jobs asignados (`mechanic_assignments` queda como cache sincronizado en assign/unassign; desaparece el selector "Assignments"). D18 sesión de labor por mecánico; se cierra al completar **su** último job pendiente; labor de la WO = suma. Estado del job: En curso = su assignee tiene sesión abierta en esa WO; si no, Pendiente (arregla §8.2).

**API.** `start` con `userId`; `labor-session.ts` por mecánico; `assignJob`/`unassignJob` sincronizan el equipo; `mechanicIds` en create se ignora; lista/detalle del mecánico solo con jobs propios (`myJobs` / `otherJobs`); completar job ajeno → 403 (se retira Q10).

**Web.** Sin tarjeta "Assignments"; responsable por job en Truck Work Plan; Home del mecánico solo sus jobs por truck; WO del mecánico con "Tus jobs" + "Otro trabajo en este truck" (solo lectura); banner "Terminaste tu parte en el Truck N".

**Aceptación.** Tests de labor con dos mecánicos; motivo `unassigned` en `attention.ts`; 403 en job ajeno; e2e `mechanic-flow`, `ownership-cutover`, `admin-truck-work-plan`, `blocker-lifecycle`; entrada 2026-09-27 en el Decision Log del PRD (D11 reemplaza Q10/Q17; D18 reemplaza D7); `CURRENT_PRODUCT_STATUS.md`.

---

## LTR-155

**Flujo v3 · PR 5: reglas del bloqueo por job (D12, D17) — solo el Manager resuelve, el tiempo se detiene, "Continuar"**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/189**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 5".

**Depende de:** PR 4.

**Decisiones (doc UX §12).** D17 reemplaza a D3 ([LTR-98](#ltr-98)): solo el Manager resuelve; el mecánico agrega notas append-only. Bloqueo siempre de un job (`jobId` obligatorio). Motivos del mecánico = `BlockerReason` (sin Break, End of Shift, Working on Another WO, Truck Unavailable). D18: si al bloquear no le queda job disponible en la WO, su sesión se cierra; vuelve a correr solo cuando toca "Continuar" (`start`), no al resolver. D12: el Standard no pausa; la sección "Paused" del Home pasa a "Pausada por el Manager" (solo lectura). PM legacy no se toca.

**API.** `POST /work-orders/:id/blockers { jobId, reason, notes? }`; se retira el resolve del mecánico; nuevo `…/blockers/:id/notes`; resolve de Admin con nota opcional; `attention.ts` con `jobName`, `reason`, `reportedBy`, `reportedAt`.

**Web.** "Reportar bloqueo" por job; "Bloqueado · motivo" en Home/WO/Truck/Yard; botón **Resolver** en Dashboard (item de Needs attention), cabecera del Truck y WO, con nota, quién y cuándo.

**Aceptación.** Tests: J1 bloqueado → sesión sigue, J2 bloqueado → sesión se cierra; resolver no arranca labor; `BREAK` → 400; mecánico resolve → 403/404. E2E `blocker-lifecycle` reescrito, `mechanic-flow`, `admin-shell`. `CURRENT_PRODUCT_STATUS.md` y fila en doc 16 de Linear.

---

## LTR-156

**Flujo v3 · PR 6: migración B — tabla shop_workflow_steps (paso → job de catálogo → responsable por defecto)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** API
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-27 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/182**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 6". **Solo esquema.**

**Depende de:** PR 0. Puede correr en paralelo con PR 1–5.

**Cambios.** Tabla `shop_workflow_steps`: `id`, `step_key` (`pm`, `alignment`, `detailing`, `quality_check`; extensible), `catalog_job_id` FK, `default_mechanic_id` UUID nullable FK `users`, `sort_order`, `active`, `updated_by`, `updated_at`. Seed con las 4 filas que hoy define `MANDATORY_WORK_PLAN_JOBS` y `default_mechanic_id = null`.

**Aceptación.** `prisma migrate dev` limpio; `prisma:release-status` OK; sin uso en runtime hasta PR 7; nota en `CURRENT_PRODUCT_STATUS.md`.

Sustenta D15 y D16.

---

## LTR-157

**Flujo v3 · PR 7: pantalla "Flujo del taller" en Setup (D16), responsables por defecto (D15) y crear WO solo con truck (D13)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/190**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 7".

**Depende de:** PR 4, PR 6.

**Decisiones (doc UX §12).** D15: QC **sin** responsable (lo completa el Manager desde el Truck). D16: Admin → Setup → "Flujo del taller" editable por Manager y System Admin. D13: crear WO pide solo truck, prioridad y nota; `jobs` opcional; `primaryCategoryId` se deriva, no se pide ni se elimina (PRD §9). Responsable por defecto inactivo → job "Sin asignar". "Create PM service": el `mechanic.pm` que arranca el PM job se autoasigna (respeta D2).

**API.** `GET/PUT /admin/setup/workflow-steps` con validación por capability y `quality_check` sin responsable; `WorkOrdersService.create` lee `shop_workflow_steps` en lugar de `MANDATORY_WORK_PLAN_JOBS`.

**Web.** Pantalla Setup con tabla y advertencia de inactivo; formulario de creación simplificado; listas muestran "Truck 922 · 5 jobs · Siguiente: PM".

**Aceptación.** Crear WO sin jobs → 4 jobs con responsables; inactivo → `null` + motivo `unassigned`; PUT QC con responsable → 400; e2e `admin-new-work-order`, `admin-system-admin-writes`, `pm-workflow`; `CURRENT_PRODUCT_STATUS.md`.

---

## LTR-158

**Flujo v3 · PR 8: Truck como lugar de trabajo (D14) — Siguiente paso arriba, inspección primero, cerrar y Return to Service en el Truck**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/193, https://github.com/lightningtransport/LTL_Shop/pull/192**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → "Gate — Boceto de pantallas" y sección "PR 8".

**Depende de:** PR 5, PR 7 y **boceto aprobado**.

**Gate previo.** El ejecutor publica en este issue un boceto (markdown/ASCII o imagen) de: Truck del Manager con "Siguiente paso" arriba, Flujo del taller, inicio del mecánico, WO del mecánico. Cristian aprueba aquí antes de escribir código.

**Decisiones (doc UX §12).** D14 inspección arriba y del Manager; D15 "Mark complete" primario solo en QC; WOs viejas: botón "Agregar pasos que faltan" (sin backfill automático, cubre §8.12); cerrar WO y Return to Service desde el Truck; motivo de Return to Service opcional.

**API.** `deriveTruckNextStep` (una sola función, en `yard-work-plan-derivation.ts` o módulo hermano) expuesta en `GET /admin/trucks/:id` como `nextStep { kind, jobId?, blockerId?, label }`; `POST /admin/trucks/:id/work-plan/backfill-mandatory`; schema de Return to Service con motivo opcional.

**Web.** Cabecera con estado + Siguiente paso y su botón (cubre [LTR-123](#ltr-123)); inspección antes de los datos del truck; datos colapsados; responsable editable en el Work Plan; cerrar y RTS en el Truck; WO Admin con acciones raras plegadas; PM del mecánico con PM arriba, una sola tarjeta, sin mensajes de pausa y con "Reportar bloqueo".

**Aceptación.** Tests de `deriveTruckNextStep` por `kind` (incluida WO vieja); cerrar desde el Truck → Ready to Go; RTS desde el Truck → sale; e2e `admin-truck-detail`, `admin-truck-work-plan`, `pm-workflow`, `ux-regressions`; screenshots; cerrar [LTR-123](#ltr-123) y validar [LTR-59](#ltr-59).

---

## LTR-159

**Flujo v3 · PR 9: una sola regla de "siguiente paso" en Dashboard, Yard, Truck y WO; motivos y botones en Needs attention**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, API, Improvement
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/195**

**Runbook:** `docs/agents/FLUJO_V3_RUNBOOK.md` → sección "PR 9".

**Depende de:** PR 8.

**Problema.** Hoy hay cuatro implementaciones de "siguiente paso": `apps/api/src/admin/yard-work-plan-derivation.ts`, `apps/web/src/lib/work-plan.ts`, `apps/web/src/lib/yard-card.ts`, `apps/web/src/lib/admin-next-step.ts`. "Needs attention" ya tiene una sola regla ([LTR-121](#ltr-121)) pero sin botón de acción.

**Qué hacer.** Las tres funciones web consumen `nextStep` del servidor (PR 8). Dashboard: motivo + botón (Resolver / Asignar / Cerrar) por item y métrica de trucks Ready to Go. Yard: mismo `nextStep`, "Bloqueado · motivo", Return to Service desde la tarjeta. Lista de trucks: columna "Siguiente paso"; "In Service" no se muestra con WO abierta.

**Aceptación.** Test de contrato: mismo truck seed → mismo `nextStep.kind` en las cuatro superficies; caso 905 coherente; e2e `yard-operations`, `yard-work-plan-board-cutover`, `admin-shell`; validar y cerrar [LTR-60](#ltr-60); `CURRENT_PRODUCT_STATUS.md` y `docs/audit/CURRENT_VS_TARGET.md`; cerrar la épica [LTR-149](#ltr-149).

---

## LTR-160

**Roster de prueba en prod: dejar 4 usuarios activos y ocultar inactivos**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-27 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/184**

Mientras se termina Flujo v3, en prod solo pueden entrar 4 cuentas de prueba. Las demás se **desactivan**; no se borran porque tienen historial y las FK RESTRICT (activity_logs, mechanic_assignments, work_orders…) no dejan borrarlas.

| Nombre | Email | Rol | Capabilities |
| -- | -- | -- | -- |
| Crixcrox | [crixcrox@outlook.com](<mailto:crixcrox@outlook.com>) | admin | admin.access, work_orders.manage, yard.operations.manage |
| Cristian | [cristian@ltransl.com](<mailto:cristian@ltransl.com>) | manager | admin.access, work_orders.manage, yard.operations.manage |
| MG | [cristian240588@hotmail.com](<mailto:cristian240588@hotmail.com>) | mechanic | mechanic.standard |
| MPM | [cris240588@gmail.com](<mailto:cris240588@gmail.com>) | mechanic | [mechanic.pm](<http://mechanic.pm>) |

**Parte 1: script único** `apps/api/prisma/reset-test-roster.ts`

* Por defecto hace dry-run; los cambios se aplican solo con `--apply`, todo en una transacción.
* Aborta si algún usuario a desactivar tiene WO abierta, un job `to_do` asignado o una asignación activa en una WO abierta.
* A los desactivados les deja las capabilities intactas, para poder reactivarlos.

**Parte 2: ocultar inactivos**

* `GET /api/admin/mechanics?includeInactive=true`; sin ese parámetro, los inactivos no aparecen.
* La lista de Mechanics tiene un toggle "Mostrar inactivos".

**Parte 3: Supabase Auth (Cristian, en el dashboard)**

* Crear o confirmar las 4 cuentas y ponerles contraseña.
* Borrar o banear las cuentas de los usuarios desactivados.

---

## LTR-162

**E2E en verde: arreglar los specs que ya fallan en main y la carrera del Dev Login**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Bug
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-28 · **Padre:** LTR-149
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/197, https://github.com/lightningtransport/LTL_Shop/pull/194, https://github.com/lightningtransport/LTL_Shop/pull/191, https://github.com/lightningtransport/LTL_Shop/pull/188**

En `main`, `ADMIN_E2E_FIXTURE=1 npm run test:e2e` ya falla antes de cualquier cambio. Por eso, en cada PR del Flujo v3 hay que comparar contra `main` para saber si un fallo es nuevo.

**Fallos que se repiten (chromium y webkit):**

* `ui-consistency`: "Admin list pages share the same header hierarchy…" y "Repair History keeps mileage…"
* `ux-regressions`: "Daniel PM flow autosaves…" (espera el heading "Finish PM service", pero el diálogo dice "Finish Work"), "moves Standard Work Orders with no to-do Jobs out of Active Jobs", "resets scroll…" y "keeps Home controls exclusive…"
* `mechanic-flow`: "navigation reuses the fresh work-order cache"
* `pm-workflow`: "auto-starts PM without creating a notes record", "[LTR-133](#ltr-133) tabs…" y "[LTR-140](#ltr-140) Truck search…"
* `admin-system-admin-writes` en webkit: los 3 tests

**Fallos intermitentes:** tras Dev Login, `toHaveURL(/admin$/)` o `page.goto` se interrumpen por la redirección a `/admin`.

**Alcance:** arreglar cada test (o su fixture) para que refleje el comportamiento actual, o corregir el bug si el test tiene razón. Estabilizar el helper de login. No se cambia comportamiento de producto sin reportarlo.

**Aceptación:** la suite completa pasa en chromium y webkit, y 2 corridas seguidas salen en verde.

---

## LTR-163

**E2E contra build de producción en vez de next dev**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-28
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/197, https://github.com/lightningtransport/LTL_Shop/pull/194**

Contexto: [LTR-162](#ltr-162). Con `ADMIN_E2E_FIXTURE=1`, la suite completa (192 tests, chromium + webkit) mantiene un solo `next dev` durante unos 20 minutos. Cerca del final, webkit sufre cargas lentas: `goto` de 60 s y links que no navegan. Esos mismos tests pasan cuando corren solos. Por ahora se usa `retries: 1` en modo fixture.

**Propuesta:** correr los e2e contra `next build` + `next start`. Así no se compila por ruta, el servidor no se degrada, y la corrida es más rápida y determinista.

**Qué hay que decidir (toca código de la app):**

* El botón Dev Login y el email por defecto dependen de `process.env.NODE_ENV !== 'production'` (`apps/web/src/app/login/page.tsx`). En un build de producción no aparecen. Opción: una variable de build solo para e2e, por ejemplo `NEXT_PUBLIC_E2E_DEV_LOGIN=1`. El login real igual depende de que la API tenga `AUTH_DEV_BYPASS`, así que esa variable no abre el login en producción.
* La cookie de sesión Admin usa `secure: NODE_ENV === 'production'` (`apps/web/src/app/api/admin/session/route.ts`). En `http://127.0.0.1`, webkit puede rechazarla.

**Aceptación:** la suite completa sale en verde con `retries: 0`, en 2 corridas seguidas, en menos de 15 min.

---

## LTR-164

**Fix: hallazgos del smoke prod Flujo v3 (LTR-51)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-28
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/201, https://github.com/lightningtransport/LTL_Shop/pull/200, https://github.com/lightningtransport/LTL_Shop/pull/199, https://github.com/lightningtransport/LTL_Shop/pull/198**

Hallazgos del smoke en producción de [LTR-51](#ltr-51) (truck 612, WO-013, 28 sep 2026). Ninguno bloquea el flujo; se agrupan por tema. Los números son los de [LTR-51](#ltr-51).

#### A. Tiempo y refresco del mecánico — PR 1

- [X] **#7** (PR [lightningtransport/LTL_Shop#198](https://linear.app/ltransl/review/complete-job-updates-your-jobs-and-the-time-at-once-qc-is-not-an-d93b5ded30be)) Tras "Complete job" la pantalla no se refresca: el job sale en Your Jobs (In progress) y en Completed a la vez, el tiempo sigue "running" y no aparece "Terminaste tu parte" hasta recargar.

#### B. Conteos y Needs attention — PR 1

- [X] **#4** (PR [Complete job updates Your Jobs and the time at once; QC is not an unassigned Job (LTR-164)](https://linear.app/ltransl/review/complete-job-updates-your-jobs-and-the-time-at-once-qc-is-not-an-d93b5ded30be)) Dashboard marca "Unassigned Jobs" en toda WO porque cuenta Quality Check, que por D15 nunca tiene responsable. Excluir QC de `unassignedJobs` (API) y del motivo `unassigned` (shared `attention`).
- [X] **#12** (PR [One Ready to Go count; the PM owner shows on the Work Order team (LTR-164)](https://linear.app/ltransl/review/one-ready-to-go-count-the-pm-owner-shows-on-the-work-order-team-ltr-23710fa9a9b9): el Dashboard usa el conteo del Yard / Work Plan) Ready to Go no cuadra: Dashboard 3 vs Yard 1 al mismo tiempo.
- [X] **#11** (PR [One Ready to Go count; the PM owner shows on the Work Order team (LTR-164)](https://linear.app/ltransl/review/one-ready-to-go-count-the-pm-owner-shows-on-the-work-order-team-ltr-23710fa9a9b9): equipo = asignaciones + responsables de jobs, D11) WO → Mechanics no incluye a MPM aunque hizo el PM.

#### C. Bloqueos

- [X] **#8** (PR [Blocker notes reach the Dashboard, the Truck and the mechanic (LTR-164)](https://linear.app/ltransl/review/blocker-notes-reach-the-dashboard-the-truck-and-the-mechanic-ltr-164-16588d9a7a3d): los resúmenes traen las notas del bloqueo) La nota del mecánico en el bloqueo no se ve en el Dashboard ni en el Truck (solo en detalle WO → Reported blockers).
- [X] **#9** (PR [Blocker notes reach the Dashboard, the Truck and the mechanic (LTR-164)](https://linear.app/ltransl/review/blocker-notes-reach-the-dashboard-the-truck-and-the-mechanic-ltr-164-16588d9a7a3d): título "Resolved" y aviso al mecánico con la nota; la nota faltante del smoke fue un error de prueba, no se envió) El bloqueo resuelto sigue diciendo "Blocked" y no muestra la nota de resolución; el mecánico tampoco la ve.

#### D. Estados y textos — PR [lightningtransport/LTL_Shop#201](https://linear.app/ltransl/review/smoke-fixes-states-and-copy-on-the-truck-the-work-order-and-mechanic-24d66633dafc)

- [X] **#1** Setup → Flujo del taller y Nueva WO parpadean "no tienes permiso" antes de cargar la sesión.
- [X] **#2** Detalle de WO: QC muestra selector de mecánico y "Mark complete" es primario en todos los jobs (D15). También en el Work Plan del Truck.
- [X] **#3** Mandatory steps dice "In Progress · 1" aunque nadie empezó.
- [X] **#5** WORK OPTIONS vacía tras Start Work.
- [X] **#6** Botón "Continue" para un mecánico que aún no empezó (debería ser Start Work).
- [X] **#10** Home de MPM muestra WO In Progress como "Created".
- [X] **#13** Truck tras Return to Service: Work Plan sigue en "Not Ready · Issues found · Open Jobs still need to be completed" sin WO abierta; categoría de la WO sale "Inspection". → el RTS ahora cierra la evaluación de readiness (la siguiente WO arranca en "Registra la inspección"); la categoría Inspection es por diseño (D13). Hecho tras deploy (28 sep): evaluación 7260d0c2 de WO-013 cerrada vía `POST /api/admin/readiness-assessments/:id/close`; el Truck 612 queda en "Inspection has not been recorded yet" con los 4 pasos en Pending. Verificado en prod: QC sin selector en el Truck 908.

#### Orden

1. PR 1: #7 + #4.
2. Luego B (#12, #11), C, D.

---

## LTR-165

**Épica: revisión de UI mobile (PWA): jerarquía, espaciado y consistencia**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-29
- **Adjuntos: —**

**Contexto.** Los mecánicos y el Manager usan la app instalada en la pantalla de inicio del teléfono (PWA). La UI "se ve mal diseñada", y la auditoría del 2026-09-28 revisó 22 pantallas en iPhone 13 (390×664, light + dark) con el fixture de e2e, como `mechanic@` y `manager@`.

**Qué encontramos en el código.** No hay otra librería de UI. Todo sale de `apps/web/src/components/ui.tsx`: primitivos estilo shadcn (Radix + Tailwind 3 + `cva`) escritos a mano. La disciplina es buena: 5 elementos nativos fuera de `ui.tsx`, 1 `style` inline, pocos valores arbitrarios y ningún overflow horizontal. `apps/web/components.json` quedó configurado para `npx shadcn@2.3.0 add` (Tailwind 3), pero **agregar componentes shadcn no arregla esto**: el problema es de composición, no de librería.

**Problemas vistos (resumen):**

1. El header ocupa mucho y tiene 4 controles con formas distintas; el nombre queda cortado ("Alejan…", "Shop …"); el botón de idioma mide 36px.
2. Mucho texto explicativo y datos repetidos (eyebrow + contador, "HIGH" en badge y en texto, "Not Ready" dos veces).
3. Eyebrows en mayúsculas por todos lados ("SHOP ADMIN" sobre cada título, "WORK OPTIONS" encima de "TRUCK INFORMATION").
4. Cards dentro de cards (Truck detail → Work Plan → Inspection).
5. El detalle de WO del Manager mide \~3.900px, y "Confirm completion" aparece dos veces (card + barra fija de \~110px).
6. La tabla de Mechanics se corta en mobile y muestra `mechanic.standard` / `admin.access`.
7. Patrones inconsistentes: filtros, "Back to…", "NORMAL" vs "High", posición de Save, tamaños de botón.
8. Acciones pequeñas: "Report Blocker" como texto, círculo de selección de job de 10px, texto de 10–11px.
9. Estados disabled inconsistentes y "Request Work" con poco contraste en dark.

**Orden.** Las sub-issues van en orden; la 1 es base de las demás.

**Aceptación de la épica.** Todas las sub-issues cerradas; las capturas mobile de las 22 pantallas se revisan de nuevo con el mismo método (fixture de e2e + Playwright iPhone 13, light y dark).

#### Segunda pasada (2026-09-28)

**Cobertura agregada:**

* Todos los roles del fixture: `mechanic@`, `daniel@` (PM), `manager@`, `admin@`, `system-admin@`.
* Español (`ltl_shop_locale=es`) en **WebKit** con viewport iPhone 13, en vez de solo Chromium.
* Dark mode del Manager.
* Tablet (820px) y desktop (1366px).
* Estados: menú de usuario, drawer admin, sheet de filtros, diálogo Reportar bloqueo, Más acciones, completar WO, búsqueda de Truck en Nueva WO, Agregar trabajo, loading con API lenta, error de carga, toast, y nombres largos (inyectados en las respuestas).
* Medición automática en cada pantalla: contraste de texto (WCAG AA), texto cortado, áreas táctiles < 44px, texto < 12px y campos < 16px.

**Resultado:** los hallazgos nuevos se agregaron a [LTR-166](#ltr-166)…[LTR-169](#ltr-169), más tres tickets nuevos: copy en español, PWA/dispositivo real, y rutas faltantes del fixture.

**Reglas del repo que estos tickets cambian.** `docs/design-system/foundations.md` y `components.md` documentan como CURRENT el eyebrow `.section-label` + `text-3xl` y "Every Admin page uses `AdminPageHeader`". `glossary-en-es.md` define el español mixto (Work Order / Truck / Job en inglés; "unidad" en mecánico) y pide no "arreglarlo" en un pase de UI. Cada PR que cambie una regla actualiza esos documentos en el mismo PR.

**Límites de esta revisión (no cubiertos):**

* **iPhone real / Simulator:** no hay Xcode completo (`xcrun simctl` no existe). Falta validar en Safari standalone: notch/home indicator, teclado tapando campos, rebote de scroll y splash.
* **Historial:** no se pudo ver con datos; el fixture no implementa `/api/admin/history`.
* **Pausar WO:** su diálogo no se capturó (el WO ya estaba completado en esa sesión).
* **Contraste:** se midió sobre el fondo sólido más cercano; puede fallar sobre gradientes.

Evidencia: `docs/audit/ux-theme/README.md` es la auditoría anterior (2026-09-01) y hay que leerla junto con esta.

#### Cierre (2026-09-29)

[LTR-166](#ltr-166) a [LTR-172](#ltr-172) fusionados en `main` (PRs [lightningtransport/LTL_Shop#207](https://linear.app/ltransl/review/keep-who-does-it-on-one-line-in-the-truck-add-work-form-0eb041000d89)–[lightningtransport/LTL_Shop#213](https://linear.app/ltransl/review/installed-app-brand-icon-light-launch-colors-neutral-name-ltr-171-d476992a8e00)). Revisión de código del rango completo: ningún flujo del Manager se perdió al aplanar pantallas; permisos sin cambios. Los pendientes menores (archivo de build en git, botón Clear en teléfono, safe area en iPad, theme-color por tema, textos sin uso, "unidad" en Admin ES) quedaron en `docs/OPEN_ISSUES.md` §1b y en el issue hijo de la épica de cierre. La documentación viva se actualizó en PR [lightningtransport/LTL_Shop#214](https://linear.app/ltransl/review/reorganize-docs-one-source-of-truth-history-archived-b9875b5f7758) (`docs/SYSTEM.md` §6).

---

## LTR-166

**UI mobile 1: escala tipográfica, escala de espaciado y un solo encabezado de página**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-29 · **Padre:** LTR-165
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/208**

**Depende de:** nada. Es la base de [LTR-165](#ltr-165).

**Problema.** Cada pantalla decide sus tamaños de texto, pesos y espacios. Hay 9 tamaños de texto en uso (incluidos `text-[10px]` y `text-[11px]`), 4 pesos, y eyebrows en mayúsculas (`tracking-wide`) para todo: "SHOP ADMIN" sobre cada título admin, "IN PROGRESS" + "1 Work Order in progress", "WORK OPTIONS" encima de "TRUCK INFORMATION", y labels de formulario ("EMAIL", "TRUCK"). Como todo es etiqueta, nada destaca. Los gutters y los paddings de card también varían entre pantallas (mecánico vs admin, Notes vs lista de jobs).

**Qué hacer.**

* En `apps/web/src/components/ui.tsx` y `apps/web/src/app/globals.css`, definir y documentar:
  * **Tipografía:** título de página, título de sección, título de card, cuerpo, secundario y meta. Mínimo 12px; sin `text-[10px]`/`text-[11px]`.
  * **Espaciado:** gutter de página, separación entre secciones, padding de card y gap dentro de card.
* Un solo `PageHeader` (título + descripción opcional de una línea + acción opcional) que reemplace `ScreenHeader` y `AdminPageHeader`. Quitar el eyebrow "SHOP ADMIN".
* `Label` en sentence case, sin mayúsculas ni tracking. Los eyebrows solo quedan donde agrupan una lista.
* Migrar las pantallas al nuevo encabezado y a la escala.

**Aceptación.**

* `grep` sin `text-[10px]`/`text-[11px]` en `apps/web/src`.
* Un solo componente de encabezado de página.
* Capturas iPhone 13 antes/después de: My Work, WO del mecánico, Dashboard, Work Orders y Truck detail.
* e2e `ui-consistency` y `admin-shell` en verde.

#### Segunda pasada (2026-09-28)

**Esto cambia una regla documentada.** `docs/design-system/foundations.md` define hoy la jerarquía admin como `.section-label` (eyebrow) + `text-3xl font-bold` + descripción `text-sm`. `components.md` dice "Every Admin page uses `AdminPageHeader`". Actualizar ambos documentos en el mismo PR, con la nueva escala y el nuevo `PageHeader`.

**Hallazgos nuevos que entran aquí:**

* **Badges a 11px en todas las pantallas** (`ALTA`, `EN PROGRESO`, `CRÍTICA`, `PAUSADO`, `COMPLETADO`, `INACTIVO`), en mayúsculas. También las descripciones de las cards del Dashboard (11px) y los pasos de Truck detail (`Pendiente`, `Alineación`, `Control de calidad` a 11px).
* **Contraste bajo AA (4.5:1)** medido en WebKit:
  * `CRÍTICA`: 3.60:1 (blanco sobre rojo `destructive`).
  * `COMPLETADO`: 3.99:1.
  * `INACTIVO` y los contadores de columna del Yard: 4.34:1.
  * Texto de error (`LoadFailure` / `InlineAlert`): 3.76:1 en light y **1.78:1 en dark** (rojo oscuro sobre fondo oscuro).
* **Dark mode:** el primario cambia de azul LTL a cian claro con texto oscuro ("Aplicar filtros"). Decidir si es intencional; si no, usar el mismo tono de marca.
* **iPad:** `.field` usa `md:text-sm` (14px). En tablet (820px) todos los campos quedan < 16px, y Safari de iPad hace zoom al enfocar. Mantener 16px en dispositivos táctiles (`@media (pointer: coarse)`) o subir el breakpoint.
* **Nombres de Job en mayúsculas** en los chips del historial de reparaciones (`INSPECT BRAKE CHAMBER`): mostrar el nombre tal cual.

**Aceptación adicional:**

* Badges ≥ 12px.
* Todos los pares texto/fondo de `Badge`, `LoadFailure` e `InlineAlert` ≥ 4.5:1 en light y en dark (tokens en `globals.css`).
* Campos a 16px en tablet táctil.

---

## LTR-167

**UI mobile 2: header de la app instalada y áreas táctiles de 44px**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-29 · **Padre:** LTR-165
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/209**

**Depende de:** [LTR-166](#ltr-166).

**Problema.** El header (`HomeTopBar` / `AppHeaderActions` en `apps/web/src/components/ui.tsx` y `admin-shell.tsx`) muestra en cada pantalla: logo + idioma + tema + menú de usuario. Cada control tiene una forma distinta (rectángulo, círculo, caja), el nombre queda cortado ("Alejan…", "Shop …") y el botón de idioma mide 65×36. En el mecánico el header no es sticky; en admin sí (65px). En una PWA instalada, idioma y tema son ajustes, no acciones de cada pantalla.

Otros controles por debajo de 44px en la auditoría: "Report Blocker" (texto, 36px de alto), el círculo de selección de job (10px), "View details" y "Clear"/"Apply filters" (36px), el checkbox "Show inactive" (16px), "New Work Order" en Truck detail (36px), y los links T-xxx / WO-xxxx (17–21px de alto).

**Qué hacer.**

* Header compacto: logo + menú de usuario (avatar o iniciales, sin nombre cortado). Idioma y tema van dentro del menú de usuario, como en una app.
* Mismo comportamiento (sticky o no) y misma altura en mecánico y admin, respetando `--app-safe-top`.
* Todo control táctil ≥ 44×44 (el área táctil puede ser mayor que lo visible). "Report Blocker" pasa a ser un `Button` secundario/outline.
* Los links de identificador en listas: la fila completa o un área de 44px es tocable.

**Aceptación.**

* Script de auditoría (Playwright, iPhone 13) sin controles < 44px en las 22 pantallas, salvo texto inline en párrafos.
* El nombre del usuario completo aparece en el menú.
* e2e `admin-shell`, `mechanic-flow` y `blocker-lifecycle` en verde.

#### Segunda pasada (2026-09-28)

**Menú de usuario (mecánico).** Es un bottom sheet con nombre, email y un botón "Cerrar sesión" rojo a todo el ancho, que es la acción más llamativa de la pantalla. Idioma y tema no están ahí. Al moverlos al menú:

* idioma y tema van como filas del sheet;
* "Cerrar sesión" pasa a `outline`/`ghost` destructivo, al final.

**Nombre cortado en todos los roles.** El trigger del menú mide 56px de ancho para el texto: "Shop Administrator", "System Admin", "Shop Manager", "Alejandro 1" y "Daniel PM" quedan cortados. Con avatar/iniciales el problema desaparece.

**Drawer admin.** El título "Navegación de Shop Admin" ocupa 2 líneas a tamaño de página. No incluye usuario, idioma ni tema. Si el header queda solo con logo + menú, el drawer puede absorber esas opciones en mobile.

**Salto de layout al cargar.** Mientras carga, `PageSkeleton` muestra un header distinto (sin menú de usuario) y otro título: "Inicio / Jobs actuales, Work Orders y trabajo reciente" en vez de "Mi trabajo asignado". Al terminar de cargar, todo salta. El skeleton debe usar el mismo header y el mismo título que la pantalla final.

**Fila de Job en "Mi trabajo".** El círculo y el nombre del Job parecen tocables, pero tocarlos no hace nada; solo funciona "Ver trabajo". Hacer que toda la card abra el WO, o quitar el círculo en esta vista.

**Pestañas de Yard** ("Readiness del Shop" / "Movimiento (Dispatch)"): 40px de alto; llevarlas a 44px.

#### Validación en iOS Simulator (2026-09-28)

En la app instalada (standalone), el header del mecánico y el primer título de cada pantalla quedan pegados a la barra de estado, y iOS los desenfoca: el logo se ve desvanecido y el título del detalle de WO se ve borroso. El nuevo header compacto necesita aire sobre `--app-safe-top` (ver [LTR-171](#ltr-171) punto 3). Criterio: nada de contenido legible dentro de la zona de desenfoque superior en reposo.

---

## LTR-168

**UI mobile 3: aplanar pantallas (sin cards anidadas, menos texto) y acortar el detalle de WO del Manager**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-29 · **Padre:** LTR-165
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/210**

**Depende de:** [LTR-166](#ltr-166).

**Problema.**

* **Cards anidadas.** En Truck detail (`admin-truck-detail.tsx`, `admin-truck-work-plan.tsx`), la card "Work Plan" contiene la card "Inspection" y otra card con los pasos obligatorios: tres bordes, tres paddings y tres fondos en 390px.
* **Texto explicativo en casi todas las cards.** Ejemplos: "Update the priority of an open Work Order. Notes are added below. Status, Jobs, Truck, category, and assignments stay on their own controls."; "This finishes the Work Order as completed. Jobs stay as they are…"; "Mechanic reports that do not pause the Work Order or change waiting time."
* **Datos repetidos.** "HIGH" en badge y también en el texto ("Work Order WO-0106 · High · In Progress"); "Not Ready" en el título y dentro de la card; eyebrow "IN PROGRESS" + "1 Work Order in progress".
* **Detalle de WO del Manager** (`admin-work-order-detail.tsx`, \~1.000 líneas): \~3.900px en iPhone, con \~12 cards seguidas (Complete, Jobs, Blockers, Notes, Priority, Pause, More actions, Operational summary, Truck details, Repair history, History and audit). "Confirm completion" aparece dos veces al inicio: en la card y en la barra fija inferior, que ocupa \~110px de 664 todo el tiempo.

**Qué hacer.**

* Una sola superficie por sección: sin card dentro de card. Las sub-secciones se separan con divisores o espacio, no con otra card.
* Descripciones de card: máximo una línea, o nada si el título ya lo dice. El texto de ayuda largo va a un tooltip o se quita.
* Quitar duplicados (prioridad y estado se muestran una sola vez, como badge).
* Detalle de WO del Manager:
  * Arriba: estado, prioridad, siguiente paso y jobs.
  * Priority y Pause juntos en una sección "Controles".
  * Operational summary, Truck details, Repair history y Audit colapsados por defecto.
  * La barra fija de "Confirm completion" solo aparece cuando la card inline ya no está en pantalla.

**Aceptación.**

* Ninguna card dentro de otra card en Truck detail ni en el detalle de WO.
* Detalle de WO del Manager ≤ \~2.000px en iPhone 13 con el fixture `WO-0102`.
* "Confirm completion" visible una sola vez en cualquier posición de scroll.
* e2e `admin-truck-detail`, `admin-truck-work-plan`, `blocker-lifecycle` y `pause-until-in-progress` en verde.

#### Segunda pasada (2026-09-28)

**Bug: el nombre largo de Job se corta sin ellipsis** en el detalle de WO del mecánico (`detail-client.tsx`, fila de "Tus Jobs"). Con "Inspect and replace front left brake chamber diaphragm and push rod" se ve "…brake chamber diaph" y el resto queda fuera de la card. En "Mi trabajo" sí hace wrap. La fila debe usar `min-w-0` + wrap (regla de `components.md`: columna izquierda `min-w-0 flex-1`).

**Card resumen del WO del mecánico.** Cuando la categoría es larga ("Brakes, Air System & ABS Diagnostics · 0 de 1 Jobs completados"), el texto hace wrap alrededor del badge y queda desalineado. Poner el badge en su propia línea, o el texto en una columna `min-w-0`.

**Feedback duplicado al completar el WO.** "Work Order completado." aparece a la vez como banner inline verde y como toast verde. Usar uno solo: toast para la acción y el estado en el encabezado (badge).

**Card "Siguiente paso" (Truck detail).** El texto de 3 líneas y el botón "Ir a la inspección" van lado a lado en 390px y quedan apretados. En mobile, el botón va debajo y a ancho completo.

**"Ocultar agregar trabajo"** usa un estilo de botón celeste que no está entre las variantes de `Button`. Usar `secondary` u `outline`.

**Tablet (820px).** El detalle de WO sigue en una sola columna de \~3.300px aunque hay espacio. Desde `md`, usar 2 columnas: acciones y Jobs a la izquierda; resumen, Truck e historial a la derecha.

#### Pausar WO (revisado con datos, 2026-09-29)

* **"Pausar Work Order" pausa con un solo toque.** El motivo viene preseleccionado ("En espera de piezas"), y el botón es primario azul a todo el ancho, sin confirmación. Además compite visualmente con "Confirmar finalización" en la misma pantalla: dos acciones primarias. Propuesta: botón secundario, motivo sin preselección, y el botón se habilita al elegir motivo.
* **La barra fija de "Confirmar finalización" es translúcida** (`bg-card/95 backdrop-blur`, `admin-work-order-detail.tsx:890`). En WebKit el texto de las cards de abajo se lee a través de la barra y se superpone con "Los Jobs están hechos…". Usar fondo sólido.

---

## LTR-169

**UI mobile 4: tablas responsive (Trucks, Mechanics, Catalog, Yard board) y patrones unificados (filtros, Back, Save, disabled)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-29 · **Padre:** LTR-165
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/211**

**Depende de:** [LTR-166](#ltr-166).

**Problema.**

* **Mechanics** (`admin-mechanics-list.tsx`): la tabla de 2 columnas se corta en 390px ("admin.access, mech…") y muestra claves internas (`mechanic.standard`, `admin.access`, `mechanic.pm`) en vez de nombres para personas.
* **Filtros distintos por pantalla:** Work Orders y Yard usan búsqueda + botón "Filters"; Trucks, Mechanics e History usan búsqueda + checkbox + "Clear" / "Apply filters". El buscador de Yard no tiene placeholder.
* **"Back to…"** va centrado en New Work Order y alineado a la izquierda en el resto.
* **Prioridad:** el select de New Work Order muestra "NORMAL" (enum en mayúsculas); el del detalle muestra "High".
* **Posición de Save:** arriba en Shop workflow, abajo en el resto de formularios.
* **Tamaños de botón** mezclados en la misma pantalla ("New Work Order" 36px junto a "Add work" 44px en Truck detail).
* **Disabled:** "Add Note" se ve gris y "Request Work" azul lavado, lado a lado. En dark, "Request Work" disabled tiene texto oscuro sobre azul y se lee poco.

**Qué hacer.**

* Mechanics en mobile: lista de cards (nombre, email y capacidades como badges con etiqueta legible). La tabla se queda solo en `md+`.
* Un solo `FilterToolbar` (búsqueda con placeholder + botón "Filters" que abre un sheet) para las 5 listas.
* `AdminBackLink` siempre alineado a la izquierda.
* Prioridad: siempre con la etiqueta traducida ("Normal", "High").
* Acción primaria de formulario siempre al final (o en una barra inferior sticky con safe area).
* Un solo estilo disabled para todas las variantes de `Button`, con contraste AA en light y dark.

**Aceptación.**

* Mechanics sin texto cortado en iPhone 13 y sin claves internas visibles.
* Las 5 listas usan el mismo componente de filtros.
* Capturas light + dark de los botones disabled.
* e2e `admin-shell`, `ux-regressions` y `ui-consistency` en verde.

#### Segunda pasada (2026-09-28)

**Otras tablas cortadas en mobile, además de Mechanics:**

* **Unidades / Trucks** (`admin-trucks-list.tsx`): en 390px se ven Unidad, Marca y Empresa ("Lightning Transport" en todas las filas), pero las columnas que importan (Work Order abierto, estado y Siguiente paso) quedan fuera de pantalla. El scroll horizontal no se nota. Links de 17px de alto.
* **Catálogo de Jobs** (`admin-catalog-list.tsx`): las columnas "Jobs inactivos" y "Aliases" quedan cortadas.
* **Tablero de Yard en desktop (1366px):** 7 columnas en \~1.080px. El número de Truck se corta ("Y-1…"), el badge de fase hace wrap ("Trabajo de / taller") y la última columna ("Listo para WO") queda cortada. Las columnas vacías ocupan lo mismo que las llenas.

`docs/design-system/components.md` lista **Table** como TARGET gap ("Shared Table primitive"). Este ticket puede ser ese primitivo: tabla en `md+` y lista de cards en mobile, con las columnas en orden de importancia.

**Sheet de filtros.** Entre un select y el label del siguiente campo hay \~4px, menos que en el resto de formularios. Usar el gap de la escala ([LTR-166](#ltr-166)).

**Nueva WO.** La búsqueda muestra `#T-101 · Volvo VNL` (con `#`), y el resto de la app muestra `T-101`. Mismo formato en todos lados.

**Disabled sin explicación.** "Reportar bloqueo" en el diálogo queda deshabilitado hasta elegir motivo, pero no dice por qué. Mismo caso con "Crear servicio de PM" (este sí explica debajo). Regla: un botón deshabilitado lleva texto de ayuda visible, o se habilita y valida al enviar.

**Aceptación adicional:**

* Trucks y Catálogo sin columnas fuera de pantalla en iPhone 13.
* Yard board sin texto cortado en 1366px.
* `docs/design-system/components.md` actualizado si se crea el primitivo Table.

#### Historial (revisado con datos, 2026-09-29)

Con la ruta del fixture de [LTR-172](#ltr-172), **Historial** (`/admin/history`) tiene el mismo problema que Trucks: en 390px solo se ven Truck, ID de Work Order y Categoría. **Estado** y **Última actualización** quedan fuera de pantalla, y el ID de WO es un link de 17px de alto. Entra en el mismo primitivo Table → cards en mobile. El filtro de Historial (búsqueda + select + Limpiar / Aplicar) es otro patrón distinto al de Work Orders (búsqueda + Filtros).

---

## LTR-170

**UI mobile 5: copy en español: género de Work Order, términos fuera del glosario y pantalla de error sin traducir**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-29 · **Padre:** LTR-165
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/212**

**Depende de:** nada; se puede hacer en paralelo con [LTR-166](#ltr-166).

**Regla.** `docs/design-system/glossary-en-es.md` manda. El español mixto es intencional (Work Order, Truck, Job y PM en inglés; "unidad" en la app del mecánico), y el glosario pide **no** cambiarlo en un pase de UI. Este ticket solo corrige lo que **contradice** el glosario o es inconsistente consigo mismo.

**Hallazgos (auditoría 2026-09-28,** `ltl_shop_locale=es`**):**

1. **Género de "Work Order" mezclado**, a veces en la misma pantalla:
   * Femenino: "Nueva Work Order", "Work Orders abiertas", "Este Truck no tiene Work Order abierta", "Work Order abierta de este Truck", "Work Orders completadas".
   * Masculino: "Work Order abierto", "Sin Work Order abierto", "Ver todos los Work Orders", "Work Orders completados y cancelados", "Completar Work Order… el Work Order como completado", "1 Work Order en curso".
   * El glosario ([LTR-152](#ltr-152)) registra que el catálogo de estados firmado en [LTR-23](#ltr-23) es masculino (Creado, Completado, Pausado). **Decisión necesaria:** masculino en todo el copy (lo más barato, alinea con los chips) o femenino en todo, cambiando los chips a la vez.
2. **Términos que el glosario ya tradujo pero siguen en inglés:**
   * "Readiness del Shop" (pestaña de Yard): el glosario dice Readiness → *Preparación*.
   * "Solo aplica si el Work Order está In Progress" (card Completar WO): usar el estado del catálogo (*En progreso*).
3. **Sin decidir en el glosario:** "Aliases" (Catálogo), "Category" en el título de columna y en "Buscar Category" (el glosario permite "Category / Categoría"; elegir una), y "Alignment, Detailing y QC" en la descripción de Nueva WO mientras el Truck detail dice "Alineación, Detallado, Control de calidad".
4. **Pantalla de error sin traducir:** `apps/web/src/app/error.tsx` (y `global-error.tsx`) tiene "Something went wrong", "Retry screen" y "Back to Home" fijos en inglés. Con la app en español se ve en inglés.
5. **Pestaña "Completado"** (singular) en la navegación del mecánico, donde las otras son "Mi trabajo" y "Unidades". Probablemente "Completados".
6. **Dos palabras para la misma pantalla:** el título de la pestaña Trucks es "Unidades" y su descripción dice "Trucks del Shop y su Work Order abierta".

**Qué hacer.**

* Decidir el género (punto 1) y registrarlo en `glossary-en-es.md`.
* Corregir las claves en `apps/web/src/lib/admin-messages.ts` y `apps/web/src/lib/locale-context.tsx`.
* Traducir `error.tsx` / `global-error.tsx` con el catálogo (o, si no hay contexto de locale en el error boundary, leer la cookie `ltl_shop_locale`).
* Agregar al glosario las decisiones de Aliases, Category y los pasos obligatorios.

**Aceptación.**

* Un solo género para Work Order en todo el catálogo ES.
* Ninguna ocurrencia de "Readiness del Shop" ni de "In Progress" en texto ES.
* La pantalla de error en español cuando la cookie es `es`.
* Glosario actualizado.
* Tests de catálogo existentes en verde (`locale-context.spec.ts`).

**Otro caso del género (2026-09-29):** al pausar, el toast dice "Work Order **pausada**." y el chip de la lista dice "**PAUSADO**".

---

## LTR-171

**UI mobile 6: PWA instalada: íconos maskable/512, theme-color por tema y validación en iPhone real**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-29 · **Padre:** LTR-165
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/213**

**Depende de:** nada para el manifest. La validación en dispositivo se hace al final de [LTR-166](#ltr-166)…[LTR-169](#ltr-169).

**Problema (manifest** `apps/web/public/manifest.webmanifest`**):**

* **Íconos:** solo `icon.svg`, `icon-192.png` y `apple-touch-icon.png` (180), todos `purpose: "any"`. Falta un PNG de 512×512 (Chrome/Android lo usa para el splash y el prompt de instalación) y un ícono `maskable`. Sin él, Android pone el logo dentro de un círculo blanco o lo recorta.
* **Colores:** `theme_color` y `background_color` son `#0f1720` (casi negro), pero el tema por defecto es claro. La barra de estado y el splash se ven oscuros aunque la app esté en light. Usar `<meta name="theme-color">` con `media="(prefers-color-scheme: …)"` para cada tema, y un `background_color` que coincida con el fondo light.
* **Nombre:** `name` es "Lightning Shop Mechanic" y la `description` es "Mechanic Work Order app", pero el Manager y el Admin instalan la misma app. Revisar si el nombre debe ser neutral ("Lightning Shop").

**Lo que la auditoría no pudo validar** (sin Xcode/Simulator en la máquina):

* La app instalada en iPhone (Safari standalone): notch y home indicator en el header, en la barra fija de "Confirmar finalización", en los bottom sheets y en los toasts. El código usa `--app-safe-*` bien (`globals.css`, `DialogContent`, `action-toast.tsx`), pero falta verlo en el dispositivo.
* El teclado tapando campos: Notas, motivo de bloqueo y búsqueda de Truck en Nueva WO.
* Rebote/pull-to-refresh en el contenedor con `overflow-y-auto overscroll-contain` del admin.
* Splash e ícono en la pantalla de inicio, en iOS y en Android.

**Qué hacer.**

* Generar `icon-512.png` y `icon-maskable-512.png` (con zona segura) desde `icon.svg`; agregarlos al manifest.
* `theme-color` por tema; `background_color` light.
* Decidir `name` / `short_name` / `description`.
* Checklist en iPhone real con la app instalada (y en Android si hay mecánicos con Android), con capturas de: My Work, WO del mecánico con teclado abierto, diálogo Reportar bloqueo, detalle de WO del Manager con la barra fija, y el drawer admin.

**Aceptación.**

* Lighthouse PWA "installable" sin advertencias de íconos.
* Ícono correcto en Android (maskable) y en iOS.
* Checklist en dispositivo adjunto al ticket.

#### Validación en iOS Simulator (2026-09-28)

iPhone 17e, iOS 27.0, Xcode 27. La app se instaló con Safari → Compartir → **Agregar a pantalla de inicio** ("Open as Web App" activado) y se abrió desde el ícono en modo standalone, contra el fixture de e2e.

**Confirmado:**

1. **Ícono genérico.** `apple-touch-icon.png` e `icon-192.png` son una flecha naranja sobre fondo negro, no el logo de Lightning Transport. Es lo que se ve en la pantalla de inicio. El nombre queda "LTL Shop" (`short_name`), pero la hoja de Compartir muestra el `<title>` "Lightning Shop — Mechanic".
2. **Arranque en blanco.** Al abrir desde el ícono se ve una pantalla blanca vacía hasta que carga (varios segundos en dev). `html[data-display='standalone']` pinta `#0f1720` (globals.css), pero el `body` lo cubre con blanco. Hay que decidir un color de arranque (claro, coherente con el tema) y usarlo en `background_color`, `theme-color` y el CSS standalone. Revalidar con build de producción.
3. **Contenido borroso bajo la barra de estado.** iOS aplica un efecto de desenfoque/desvanecido en el borde superior en modo standalone. Como `.app-shell` usa `padding-top: max(1.5rem, var(--app-safe-top))`, el primer elemento queda justo en el borde:
   * el logo del mecánico se ve desvanecido;
   * el título "Truck T-106" del detalle de WO del mecánico se ve **borroso sin hacer scroll**.
     Agregar aire extra arriba: `calc(var(--app-safe-top) + 0.75rem)` o similar.
4. **Admin: banda vacía abajo.** En `admin-shell.tsx:65`, `app-safe-bottom` está en el contenedor exterior con `overflow-hidden`, y el `<main>` con scroll termina encima del home indicator. El contenido se corta en seco contra una franja plana de fondo, y parece que la pantalla termina antes. Mover el padding de safe area **dentro** del contenido que hace scroll, para que las cards pasen por debajo del home indicator.
5. **La barra fija "Confirm completion"** respeta el home indicator. Pero se confirma el duplicado de [LTR-168](#ltr-168): en la misma vista aparecen dos botones "Confirm completion" (card + barra fija).
6. **Bottom sheets** (Reportar bloqueo, menú de usuario, drawer admin): llegan al borde inferior y respetan la safe area. ✅

**Pendiente:**

* **Teclado:** el Simulator tiene el teclado físico conectado y no mostró el teclado en pantalla. Probar en iPhone real, o en el Simulator con I/O → Keyboard → Toggle Software Keyboard: Notas, motivo de bloqueo y búsqueda de Truck en Nueva WO.
* **Android** (ícono maskable) y **producción** (tiempo de arranque real).

#### Teclado en pantalla (Simulator, 2026-09-29)

Con el teclado de software activado, en la app instalada:

* **Notas (mecánico):** al enfocar, la página sube y el campo, "Add Note" y "Request Work" quedan visibles encima del teclado y de la barra de accesorios. ✅ Al enviar, la nota se agrega y aparece el toast.
* **Toast sobre los botones:** "Note added." tapa los botones de Notas mientras está visible. Posicionarlo arriba, o darle menos tiempo en pantalla cuando hay un formulario abajo.
* **Motivo de bloqueo:** es un `<select>` nativo; iOS muestra su menú, que se lee y se toca bien. ✅
* **Pendiente:** la búsqueda de Truck en Nueva WO (Manager) no se probó en el Simulator; sí se probó en iPhone emulado.

---

## LTR-172

**E2E fixture: rutas faltantes (historial admin, notas del mecánico) y script de auditoría visual en el repo**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Improvement
- **Creado:** 2026-09-28 · **Cerrado:** 2026-09-29 · **Padre:** LTR-165
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/commit/1865a75**

**Por qué.** La auditoría de UI ([LTR-165](#ltr-165)) corre sobre el fixture de e2e (`apps/web/e2e/fixtures/admin-api.mjs`), y dos pantallas no se pudieron revisar con datos:

1. **Historial admin:** el fixture no implementa `GET /api/admin/history`. La pantalla siempre muestra "No se pudieron cargar los datos administrativos actuales."
2. **Notas del mecánico:** `POST /api/work-orders/:id/notes` no tiene ruta y cae en el catch-all `/api/work-orders`, que devuelve `{ created, active, paused, completed }`. El cliente espera un `WorkOrderDetailDto` (`work-order-notes-thread.tsx:38`), lo guarda en el cache y `detail-client.tsx:273` rompe en `wo.jobs.filter`: la pantalla cae a "Something went wrong". **No es un bug de producción:** la API real devuelve el detalle (`apps/api/src/work-orders/work-orders.controller.ts:86`). Pero esconde el flujo en e2e.

**Qué hacer.**

* Agregar las dos rutas al fixture con la misma forma que la API real.
* Agregar un e2e: el mecánico agrega una nota y la pantalla sigue en el detalle.
* Mover el script de auditoría visual a `apps/web/e2e/ui-audit/` (fuera del suite normal). Qué hace:
  * recorre las pantallas por rol;
  * toma capturas iPhone 13 (WebKit) en ES/EN y light/dark;
  * mide contraste AA, texto cortado, áreas táctiles < 44px, texto < 12px y campos < 16px;
  * deja un `report.json`.
* Documentar cómo correrlo en `docs/audit/ux-theme/README.md`.

**Aceptación.**

* Historial con datos en el fixture.
* Agregar nota en e2e sin error.
* `npm run ui-audit` (o equivalente) genera capturas y reporte en una carpeta ignorada por git.

#### Avance (2026-09-29), rama `cristian/ltr-172-e2e-fixture-rutas-faltantes-historial-admin-notas-del`

* `admin-api.mjs`: `POST /api/work-orders/:id/notes` (devuelve el detalle del mecánico) y `GET /api/admin/history` (WOs cerrados, con filtros de estado, búsqueda y fecha).
* `e2e/notes-and-history.spec.ts`: el mecánico agrega una nota y sigue en el detalle; Historial lista solo WOs cerrados. Pasó en Chromium y WebKit, junto con `blocker-lifecycle`, `mechanic-flow` y `admin-shell` (52/52).
* `e2e/ui-audit/` (`audit.mjs`, `states.mjs`, README), `npm run ui-audit` / `ui-audit:states`, salida ignorada por git, y enlace desde `docs/audit/ux-theme/README.md`. `states.mjs` resetea el fixture al empezar y reintenta navegaciones interrumpidas por redirects del cliente (15/15 estados).
* Commit `1865a75` directo en `main` (sin PR).

---

## LTR-173

**Epic: Plan de cierre — auditoría única de flujos, defectos B/C, limpieza y salida en vivo**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Epic
- **Creado:** 2026-09-29 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/215**

#### Fuente de verdad

`docs/OPEN_ISSUES.md` §0 (PR [lightningtransport/LTL_Shop#214](https://linear.app/ltransl/review/reorganize-docs-one-source-of-truth-history-archived-b9875b5f7758), fusionado 2026-09-29). Cómo funciona el sistema hoy: `docs/SYSTEM.md`. Decisiones: `docs/DECISIONS.md`. Lo viejo está en `docs/archive/` y no manda.

#### Por qué siguen apareciendo defectos

1. Nunca se revisó el sistema completo de una vez; los defectos que quedan son de flujo (combinaciones entre PM, Manager y mecánico).
2. Las pruebas e2e corren contra una API falsa: "pasa" no significa "funciona".
3. No había una lista cerrada; ahora la hay.

#### Reglas

* Alcance congelado hasta terminar la Fase C.
* Cada defecto se clasifica B (bloqueante), C (confuso) o E (estético). Antes de salir en vivo se arreglan B y C.
* Un flujo está terminado solo cuando su fila de la matriz (28 flujos, `OPEN_ISSUES.md` §0) dice PASA contra la API real.
* Cada PR de arreglo trae su prueba y borra su fila de `OPEN_ISSUES.md`.

#### Fases

* **A** — Auditoría única de los 28 flujos contra la API real (una vez, 2–3 días). Al terminar, la lista es finita.
* **B** — Arreglar B y C, uno por PR. Primero el WO atorado en `created` (WO-009).
* **C** — Limpieza de código heredado e idioma.
* **D** — Salida en vivo ([LTR-45](#ltr-45)).

#### Terminado cuando

Las 28 filas dicen PASA o NO APLICA; §1/§1b sin B ni C; usuarios reales un día completo sin un defecto B.

---

## LTR-174

**Fase A: auditoría única de los 28 flujos contra la API real (matriz de OPEN_ISSUES §0)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Docs
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-29 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/216**

Recorrer **una sola vez** cada fila A1–A28 de la matriz en `docs/OPEN_ISSUES.md` §0 con la API y la base de datos locales reales (no la API falsa de e2e), usando `npm run prisma:reset-demo-work-orders --workspace=@ltl-shop/api -- --local --apply`.

Cada fila termina en PASA, FALLA (defecto nuevo anotado en §1 con clase B/C/E y su issue) o NO APLICA.

**Entregable:** la columna "API real" llena en `OPEN_ISSUES.md` y un issue por cada defecto nuevo, hijo de [LTR-173](#ltr-173). Al cerrar esto, la lista de defectos es finita: lo que aparezca después se anota y se clasifica, pero no cambia el plan.

Estado conocido antes de empezar (por revisión de código): fallan A9, A10, A12, A13 (defecto #1), A15, A16 (#2, #4), A17, A24 (#3); A28 sin probar.

#### Resultado (2026-09-29)

PR [lightningtransport/LTL_Shop#216](https://linear.app/ltransl/review/flow-tests-against-the-real-api-user-stories-task-flows-and-edge-cases-24751c6f3914). Se recorrieron todas las historias contra el sistema real (API real + Postgres local en una base aparte, `ltl_shop_test`).

**56 comprobaciones · 43 funcionan · 11 fallan · 2 no aplican.** Las 11 fallas son 5 defectos:

| Defecto | Filas | Clase | Ticket |
| -- | -- | -- | -- |
| #1 Work Order atorado en `created` (WO-009) | A9b, A12b, A13b, A17b | B | [LTR-175](#ltr-175) |
| #2 Bloqueos que quedan vivos | A15b, A16b, A16c | B | [LTR-176](#ltr-176) |
| #4 Inspección heredada (**confirmado**) | A15c, E14b | B | [LTR-177](#ltr-177) |
| #7 Listas sin "Return to Service" | A19b | C | [LTR-182](#ltr-182) |
| #8 Quality Check acepta dueño | E9b | E | [LTR-183](#ltr-183) |

Además: #9 las sesiones de tiempo no dicen de qué mecánico son ([LTR-184](#ltr-184)).

**Entregables**

* `docs/USER_FLOWS.md`: jobs to be done, historias de usuario, flujos paso a paso y casos límite por rol, con el estado comprobado de cada uno.
* `apps/api/test-real/`: las pruebas. `npm run test:real --workspace=@ltl-shop/api` las corre y escribe la matriz.

**No es un defecto:** un mecánico Standard puede tener trabajo en curso en dos camiones a la vez (decisión del 25-sep, [LTR-125](#ltr-125)). Quedó escrito en `docs/DECISIONS.md` (D2).

**Fila A28:** no aplica. Consulta de solo lectura en producción (Cristian, 2026-09-29): 0 Work Orders de PM del modelo viejo abiertos.

---

## LTR-175

**B: Work Order atorado en `created` — el PM y el Manager no lo pasan a `in_progress` (WO-009, Truck 607)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/218**

**Confirmado en producción** el 2026-09-29 (solo lectura). Defecto #1 de `docs/OPEN_ISSUES.md`. Clase **B**.

#### Qué pasó con WO-009 (Truck 607)

| Hora | Quién | Qué | Estado del WO |
| -- | -- | -- | -- |
| 13:28 | Cristian | Crea el WO | `created` |
| 13:29 | MPM | Inicia el Job "PM A Service" | `created` |
| 17:51 | MPM | Termina el PM (millaje y partes) | `created` |
| 17:52 | Cristian (Admin) | Completa Alignment, Detailing y Quality Check | `created` |

Hoy: 4 Jobs `completed`, `status = created`, `started_at = null`, 0 sesiones de trabajo.

#### Causa

1. `startPmJob` (`apps/api/src/work-orders/work-orders.service.ts` \~l. 1469) y `completePmJobInTx` marcan el Job de PM pero **no** mueven el WO a `in_progress` ni abren sesión de labor.
2. Completar Jobs desde Admin (`AdminService.completeJob`) tampoco cambia el estado del WO.
3. Cerrar exige `in_progress`: `admin.service.ts` \~l. 1042 responde 400 "Work Order must be in progress to finish", y la tarjeta de cierre (`admin-work-order-detail.tsx`, `canCompleteWorkOrder` \~l. 115) ni aparece.
4. `deriveTruckNextStep` (`packages/shared/src/truck-next-step.ts` l. 112) trata `created` como abierto y muestra "Close Work Order"; el botón llama al mismo endpoint y recibe el 400.

Sin salida: no se puede cerrar ni hacer Start (no hay Jobs pendientes). Solo cancelar. Efecto extra: el tiempo de trabajo del PM queda en 0. Mismo problema al reabrir un WO que nunca empezó (`created`).

Ocurre siempre que el único Start fue del mecánico de PM y el resto lo completó el Manager.

#### Arreglo propuesto

* Arrancar el PM pasa el WO a `in_progress` (y `startedAt`) y abre la sesión del mecánico PM; terminar el PM la cierra.
* Completar un Job desde Admin sobre un WO `created` lo pasa a `in_progress` (o el cierre acepta `created` sin Jobs pendientes; decidir una de las dos y documentarla en `SYSTEM.md`).
* El siguiente paso nunca ofrece "Close" cuando la API lo va a rechazar.
* Prueba contra la API real que reproduzca WO-009.
* **Después del arreglo:** ajuste manual en producción para destrabar WO-009 (mostrar el cambio exacto antes de aplicarlo).

#### Reproducido en la auditoría ([LTR-174](#ltr-174), 2026-09-29)

Historias HU-M5, HU-M6 y HU-PM1 de `docs/USER_FLOWS.md`. Cuatro filas fallan hoy y son la definición de terminado de este ticket:

| Fila | Qué comprueba | Hoy |
| -- | -- | -- |
| A9b | Arrancar el PM pone el WO en curso y registra el tiempo del mecánico PM | WO sigue `created`, 0 sesiones |
| A12b | Si el Manager completa un Job, el WO deja de estar `created` | sigue `created` |
| A13b | Close cuando nadie hizo Start (PM + Manager): caso WO-009 | 400 "Work Order must be in progress to finish" |
| A17b | Reabrir un WO que nunca empezó, con todo hecho: se puede cerrar | 400 |

**Terminado cuando:** `npm run test:real --workspace=@ltl-shop/api` muestra esas cuatro filas en PASA y las 43 que ya pasan siguen pasando.

#### Arreglado (PR [lightningtransport/LTL_Shop#218](https://linear.app/ltransl/review/starting-the-pm-or-completing-a-job-as-manager-puts-the-work-order-in-bf0d06979ca2), 2026-09-29)

Regla: **el trabajo pone el WO en curso, lo haga quien lo haga.** Arrancar el PM abre el reloj del mecánico PM y pasa el WO a `in_progress`; completar un Job desde Admin también; y un WO en `created` sin Jobs pendientes se puede cerrar. Filas A9b, A12b, A13b y A17b en PASA (47 / 7 / 2).

**WO-009 en producción:** con este cambio no hace falta tocar la base de datos. El Manager abre el WO y lo cierra.

---

## LTR-176

**B: bloqueos huérfanos — cancelar WO/Job o completar un Job bloqueado deja el bloqueo activo**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/219**

Defecto #2 de `docs/OPEN_ISSUES.md`. Clase **B**.

* `AdminService.cancelWorkOrder` y `cancelJob` solo cierran pausas oficiales y sesiones; el bloqueo (`pause_events` con `is_official_pause = false`) del Job queda activo.
* `AdminService.completeJob` permite completar un Job bloqueado y deja el bloqueo activo. El siguiente paso se queda en "Resolve" hasta que alguien lo resuelve a mano.

**Arreglo:** cancelar WO o Job resuelve sus bloqueos (con nota automática "cancelado"); completar desde Admin un Job bloqueado o bien lo rechaza (como hace el mecánico, `JOB_BLOCKED`) o bien resuelve el bloqueo. Decidir y anotar en `SYSTEM.md` §3. Prueba contra la API real.

#### Confirmado en la auditoría ([LTR-174](#ltr-174), 2026-09-29)

Historia HU-M4 de `docs/USER_FLOWS.md`. Tres filas fallan hoy:

| Fila | Qué comprueba |
| -- | -- |
| A15b | Cancelar un WO con un Job bloqueado resuelve el bloqueo |
| A16b | Completar desde Admin un Job bloqueado no deja el bloqueo vivo (o se rechaza con `JOB_BLOCKED`) |
| A16c | Cancelar un Job bloqueado resuelve su bloqueo |

**Terminado cuando:** esas tres filas dicen PASA en `npm run test:real`.

#### Arreglado (PR [lightningtransport/LTL_Shop#219](https://linear.app/ltransl/review/cancelling-a-work-order-or-a-job-or-completing-a-blocked-job-as-0c6c65de802e), 2026-09-29)

Regla: **cuando un Job deja de ser trabajo pendiente, su bloqueo se resuelve solo y el motivo queda en el historial** ("Work Order cancelado", "Job cancelado", "Job completado por el Manager"). Completar desde Admin un Job bloqueado se permite a propósito: el Manager está diciendo que el trabajo está hecho. Filas A15b, A16b y A16c en PASA (50 / 4 / 2).

---

## LTR-177

**B: el Work Order nuevo hereda la inspección de la visita anterior (al cancelar, o al abrir otro sin Return to Service)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/220**

Defecto #4 de `docs/OPEN_ISSUES.md`. Clase **B** si se confirma; se verifica en la Fase A (fila A15).

La inspección se guarda en el requisito `inspection` del `truck_readiness_assessment`. Solo Return to Service cierra esa evaluación (`yard-operations.service.ts`). Cancelar el WO no la cierra, así que el siguiente WO del mismo Truck podría nacer con la inspección ya "hecha".

**Arreglo:** cancelar el WO cierra la evaluación. A mediano plazo, mover la inspección al WO y retirar las evaluaciones (ver limpieza en §3).

#### CONFIRMADO en la auditoría ([LTR-174](#ltr-174), 2026-09-29)

Ya no es "por verificar". Historias HU-M1 y HU-M2 de `docs/USER_FLOWS.md`. Pasa en dos casos:

| Fila | Caso | Hoy |
| -- | -- | -- |
| A15c | Se cancela el WO y se abre otro para el mismo Truck | El WO nuevo nace con inspección `no_issues_found` y el siguiente paso es `work`, no `inspect` |
| E14b | Se cierra el WO (Ready to Go) y se abre otro sin Return to Service | Igual: se salta la inspección |

Consecuencia: el Manager no inspecciona el camión en la visita nueva porque la app le dice que ya está hecho.

**Terminado cuando:** A15c y E14b dicen PASA en `npm run test:real`.

#### Más probable de lo que parecía (cuestionario de operación, 2026-09-29)

* Return to Service se hace cuando el camión sale del patio, no al cerrar. Los camiones pasan horas o días en Ready to Go.
* Si un camión vuelve por algo que quedó mal, **se abre un trabajo nuevo**.

Las dos cosas juntas son exactamente el caso E14b: camión en Ready to Go + trabajo nuevo = se salta la inspección.

#### Arreglado (PR [lightningtransport/LTL_Shop#220](https://linear.app/ltransl/review/the-inspection-belongs-to-the-visit-a-new-work-order-starts-with-it-7c1e58932147), 2026-09-29)

Regla: **la inspección pertenece a la visita.** Abrir un Work Order nuevo cierra la inspección de la visita anterior (el WO nuevo empieza con la inspección pendiente); cancelar el WO la cierra; reabrirlo la devuelve; Return to Service ya la cerraba. Filas A15c y E14b en PASA (52 / 2 / 2).

---

## LTR-178

**C: textos de QC dicen que Quality Check es opcional (contradice D15) y usan "Quality Check" en español**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** UX
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/224**

Defecto #6 de `docs/OPEN_ISSUES.md`. Clase **C**.

`workPlanQcHint` y `workPlanReadyAutomatic` en `apps/web/src/lib/admin-messages.ts` (EN \~l. 712/731, ES \~l. 1449/1468) dicen que Quality Check es opcional "unless you add it". Desde D15 QC siempre es obligatorio y lo completa el Manager. En ES además dice "Quality Check" en vez de "Control de calidad" (regla de [LTR-170](#ltr-170)); igual `truckNextStepQc` (\~l. 761).

**Arreglo:** reescribir los tres textos en ambos catálogos según `SYSTEM.md` §5 y el glosario; ajustar los specs que los comprueban.

#### Arreglado (PR [lightningtransport/LTL_Shop#224](https://linear.app/ltransl/review/quality-check-copy-always-required-done-by-safety-spanish-says-control-48929a158bcd), 2026-09-29)

Los textos ya dicen que el Quality Check siempre es obligatorio y lo hace Safety ("Mark complete" del Manager solo como respaldo), y en español dicen "Control de calidad".

---

## LTR-179

**C/E: pendientes menores de la revisión de UI móvil (LTR-165): U1–U10**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/234**

Hallazgos de la revisión de código de [LTR-166](#ltr-166) a [LTR-171](#ltr-171) (2026-09-29). Lista completa con archivos en `docs/OPEN_ISSUES.md` §1b.

| \# | Clase | Qué |
| -- | -- | -- |
| U1 | C | `apps/web/.next-d14/trace` (artefacto de build) quedó en git; `.gitignore` no cubre `.next-d14`. |
| U2 | E | `next-env.d.ts` apunta a `./.next-e2e/types/routes.d.ts`. |
| U3 | C | En teléfono, las listas con solo búsqueda (Trucks) no tienen botón Clear (`ui.tsx` \~l. 862). |
| U4 | C | iPad instalada: nombre/rol del menú lateral bajo el indicador de inicio (`admin-shell.tsx:62`). |
| U5 | C | `theme-color` sigue al sistema y no al tema elegido en la app (`layout.tsx:50`). |
| U6 | C | Con cambio de contraseña pendiente, el botón de perfil abre primero esa hoja; hay que cerrarla para cambiar idioma (`ui.tsx` \~l. 414). |
| U7 | E | `moreActionsHelp` menciona corrección de tiempos, que ahora está en "History and audit". |
| U8 | E | Nueve claves del catálogo Admin sin uso tras quitar descripciones. |
| U9 | E | Admin ES aún dice "unidad(es)" en varios textos y en el selector de Truck de Nuevo Work Order. |
| U10 | C | `POST …/work-plan/jobs`: fallo a mitad deja Jobs sin registro de idempotencia → reintento recibe `VERSION_CONFLICT`; dos reintentos simultáneos chocan en el índice único (`yard-work-plan.service.ts` \~l. 255–290). |

Los 5 textos ES/EN escritos directo en el menú de perfil ([LTR-167](#ltr-167)) van en el issue de idioma.

---

## LTR-180

**Fase C: borrar código heredado (readiness de 6 requisitos, equipo por WO, pausa del mecánico, formulario Standard muerto, supabase/migrations)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/235**

`docs/OPEN_ISSUES.md` §3 y `docs/SYSTEM.md` §10. Va después de la Fase B.

* Endpoints de readiness sin pantalla (`readiness-assessments`, `requirements`, `mark-ready`, `close`), `deriveReadiness` sin llamar, textos `markReady*` sin usar. Antes: mover la inspección fuera de la evaluación (depende del issue de inspección heredada).
* `POST/DELETE /admin/work-orders/:id/mechanics` (`@deprecated`); `POST /admin/work-orders/:id/jobs`; `POST /work-orders/:id/jobs` del mecánico (siempre 403).
* Pausa/reanudar/terminar del mecánico (solo WOs de PM legacy). Decidir qué pasa con los que sigan abiertos en producción y retirar el código.
* Formulario Standard muerto en `apps/web/src/app/work-orders/new/page.tsx`.
* Columna `pmAuthorized`. Comentarios viejos en `schema.prisma` (`ShopWorkflowStep`) y migración `20260928030000`.
* `supabase/migrations/20260825140000_init_domain.sql`: borrar o dejar README que diga que es copia congelada.

Cada retiro actualiza `SYSTEM.md` §10 en el mismo PR.

#### Dato de producción (2026-09-29)

Consulta de solo lectura: **0** Work Orders de PM del modelo viejo abiertos (`primary_category = PM` en `created` / `in_progress` / `waiting_paused`). La pausa / reanudar / terminar del mecánico PM y la vista `PmWorkOrderDetail` se pueden borrar sin cerrar nada antes. Los WOs de PM viejos ya cerrados siguen leyéndose en el historial.

---

## LTR-181

**Fase C: idioma — 62 textos fuera de catálogo, inglés fijo en pantallas PM/nuevo WO, 29 errores de API mostrados en inglés**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/236**

`docs/OPEN_ISSUES.md` §4. Va después de la Fase B.

* 62 textos `locale === 'es' ? … : …` escritos directo en 13 archivos (más en `reset-password`, `trucks/[id]/history`, `ui.tsx`; [LTR-167](#ltr-167) agregó 5 en el menú de perfil aunque `language` ya existe en el catálogo). Moverlos a `admin-messages.ts` / `locale-context.tsx`.
* Inglés fijo en pantallas de PM legacy y nuevo WO ("Resume Work", "Change Pause Reason", "Jobs To Do", "Create failed", "Action failed").
* 29 lugares muestran `e.message` de la API (siempre en inglés) al usuario. Mapear códigos de error a textos del catálogo; la API devuelve `code`, la web traduce.
* Admin ES: "unidad(es)" → "Truck(s)" (regla [LTR-170](#ltr-170)).

Regla para PRs nuevos (ya en la plantilla): ningún texto nuevo fuera de los catálogos.

---

## LTR-182

**C: las listas de Trucks y de Work Orders no dicen "Return to Service" para un camión Ready to Go**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/221**

Defecto #7 de `docs/OPEN_ISSUES.md`. Clase **C**. Encontrado en la auditoría [LTR-174](#ltr-174) (fila **A19b**).

#### Historia

HU-M5 / HU-M7 en `docs/USER_FLOWS.md`: el Manager mira el taller y quiere ver, para cada camión, el mismo siguiente paso en todas las pantallas ([LTR-159](#ltr-159)).

#### Qué pasa

Con un camión **Ready to Go** (Work Order cerrado, sin Return to Service):

| Pantalla | Siguiente paso |
| -- | -- |
| Truck (detalle) | `return_to_service` ✅ |
| Work Order (detalle) | `return_to_service` ✅ |
| Yard (tarjeta) | `return_to_service` ✅ |
| **Lista de Trucks** | `create_work_order` ❌ |
| **Lista de Work Orders** | sin siguiente paso ❌ |

En todas las demás etapas (inspect, work, assign, resolve_blocker, resume, qc, close) las cinco pantallas coinciden (fila A19 pasa).

#### Arreglo

La lista de Trucks y el resumen de Work Orders deben usar el mismo cálculo que el detalle para el Work Order completado que mantiene al camión Ready to Go (`workOrderNextStep` / `deriveTruckNextStep`).

#### Terminado cuando

`npm run test:real --workspace=@ltl-shop/api` → fila A19b PASA.

#### Sube de prioridad (cuestionario de operación, 2026-09-29)

Return to Service se hace **cuando el camión sale del patio**, horas o días después de cerrar. Los camiones pasan ese tiempo en Ready to Go, y el Manager usa las listas (en el teléfono y en la computadora) para ver cuáles esperan salir. Hoy las listas no se lo dicen.

#### Arreglado (PR [lightningtransport/LTL_Shop#221](https://linear.app/ltransl/review/truck-and-work-order-lists-say-return-to-service-for-a-truck-ready-to-7fc4e5897337), 2026-09-29)

La lista de Trucks y los resúmenes de Work Order (Dashboard, lista, History) usan la misma regla que el Truck y el Yard: un Work Order completado dentro de la ventana `YARD_READY_TO_GO_SINCE` y sin Return to Service dice "Return to Service"; después, nada. Fila A19b en PASA (53 / 1 / 2).

---

## LTR-183

**Solo una persona de Safety puede ser dueño del Quality Check (antes: QC no acepta dueño)**

- **Estado:** Duplicate · **Proyecto:** Safety / QC · **Etiquetas:** API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: —**

> **Absorbido por** [LTR-185](#ltr-185) **(D19, 2026-09-29).** El Quality Check sí tiene dueño: la persona de Safety que lo toma. La validación de `assignJob` pasa a ser "solo un usuario de Safety", y se hace dentro de [LTR-185](#ltr-185).

> **EN PAUSA (2026-09-29).** En el taller el Quality Check lo hace personal de Safety. Si Safety va a ser dueño de QC, esta regla cambia al revés. Espera la decisión D19 ([LTR-185](#ltr-185)).

Defecto #8 de `docs/OPEN_ISSUES.md`. Clase **E**. Encontrado en la auditoría [LTR-174](#ltr-174) (fila **E9b**).

#### Historia

HU-M3 en `docs/USER_FLOWS.md`. D15: Quality Check no lleva responsable; lo completa el Manager.

#### Qué pasa

`POST /admin/work-orders/:id/jobs/:jobId/assign` sobre el Job de Quality Check responde 201 y lo asigna. La pantalla no ofrece el selector, y Setup → Shop workflow sí lo rechaza (`STEP_HAS_NO_OWNER`), pero la asignación directa no valida.

#### Arreglo

`AdminService.assignJob` rechaza el paso Quality Check con el mismo código `STEP_HAS_NO_OWNER`.

#### Terminado cuando

`npm run test:real --workspace=@ltl-shop/api` → fila E9b PASA.

---

## LTR-184

**C: el detalle Admin del Work Order no dice de qué mecánico es cada sesión de tiempo**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/223**

Defecto #9 de `docs/OPEN_ISSUES.md`. Clase **C**. Encontrado en la auditoría [LTR-174](#ltr-174).

#### Historia

HU-A1 en `docs/USER_FLOWS.md`: el Admin corrige un tiempo dejando rastro. Desde D18 el tiempo es **por mecánico** (`work_sessions.user_id`).

#### Qué pasa

`GET /admin/work-orders/:id` devuelve `laborSessions` solo con `id`, `startedAt`, `endedAt`, `durationMs` (`apps/api/src/admin/admin.service.ts` \~l. 2193). No trae el mecánico. Con dos mecánicos en el mismo Work Order, en "History and audit" no se sabe de quién es cada sesión ni cuál corregir.

#### Arreglo

Incluir `mechanic: { id, name }` en cada sesión (null en sesiones anteriores a [LTR-154](#ltr-154)) y mostrarlo en "History and audit" y en el diálogo de corrección.

#### Terminado cuando

Nueva fila en `apps/api/test-real/` que comprueba el mecánico de cada sesión, y `docs/USER_FLOWS.md` HU-A1 en ✅.

#### Arreglado (PR [lightningtransport/LTL_Shop#223](https://linear.app/ltransl/review/each-labor-session-says-whose-it-is-the-work-order-shows-labor-by-91665792038b), 2026-09-29)

Cada sesión de tiempo trae su mecánico. En "History and audit" aparece **Tiempo por mecánico** y el selector de corrección dice de quién es cada sesión. Fila A23 lo comprueba (59 / 0 / 2).

---

## LTR-185

**Quality Check de Safety: cuenta propia, lista de camiones por revisar, aprobar o devolver con nota (D19)**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** UX, API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/222**

Encontrado en el cuestionario de operación (Cristian, 2026-09-29). Hueco G1 en `docs/OPEN_ISSUES.md` §1c. Historia HU-QC1 en `docs/USER_FLOWS.md`.

#### Cómo trabaja el taller

El Quality Check final lo hace **personal de Safety** (pueden ser 2 personas, "los que hacen QC"). No lo hace el Manager.

#### Qué hace la app hoy

D15: Quality Check no lleva responsable y lo completa el Manager desde el Truck ("Mark QC complete"). Solo una cuenta con `admin.access` + `work_orders.manage` puede marcarlo. La gente de Safety no tiene cuenta ni pantalla.

#### Qué hay que decidir (D19)

1. ¿Safety tiene su propia cuenta y su propia pantalla (lista de camiones esperando QC → aprobar)?
2. ¿QC se asigna a una persona de Safety en particular, o lo toma cualquiera de los dos?
3. Si Safety encuentra algo mal, ¿qué pasa? (rechazar con nota → el Manager agrega el trabajo)
4. ¿Safety también hace la inspección de llegada, o solo el QC final?
5. Mientras tanto: ¿el Manager marca QC cuando Safety le avisa?

#### Efecto en el plan

* [LTR-183](#ltr-183) **queda en pausa.** Ese ticket quería impedir que QC tenga dueño; si Safety va a ser dueño de QC, la regla cambia al revés.
* D15 pasa a "en revisión" en `docs/DECISIONS.md`.
* No frena los arreglos de [LTR-175](#ltr-175), 176 y 177.

#### Terminado cuando

D19 escrita en `DECISIONS.md`, historia HU-QC1 con su flujo y casos límite en `USER_FLOWS.md`, y sus filas en `apps/api/test-real/` en PASA.

#### Decidido (Cristian, 2026-09-29) — D19

1. Safety tiene **cuenta propia** y una pantalla con **los camiones que esperan Quality Check**.
2. **Cualquiera de los dos** lo toma; no se asigna de antemano.
3. Si encuentra algo mal, **devuelve el camión con una nota** y el Manager agrega el trabajo.
4. Safety **no** interviene en la llegada; solo al final.
5. Mientras se construye, el Manager marca QC cuando Safety le avisa.

#### Qué se construye

* Capability nueva para Safety (p. ej. `quality_check.perform`) y dos cuentas en el roster.
* Pantalla de Safety: camiones listos para QC (todo lo demás hecho) → **Tomar** → **Aprobar** o **Devolver con nota**.
* Aprobar completa el Job de QC (dueño = quien lo tomó) y deja el WO en "listo para cerrar".
* Devolver deja el QC pendiente, registra quién y por qué, y aparece en "Needs attention" del Manager.
* El Manager conserva "Mark QC complete" como respaldo.
* Absorbe [LTR-183](#ltr-183): la regla pasa a ser "solo Safety puede ser dueño de QC".

Historia y casos límite: `docs/USER_FLOWS.md` HU-QC1. Filas nuevas en `apps/api/test-real/`.

#### Construido (PR [lightningtransport/LTL_Shop#222](https://linear.app/ltransl/review/safety-does-the-quality-check-own-account-and-screen-take-approve-or-7f9df0bdf5bf), 2026-09-29)

* Permiso `quality_check.perform` y cuentas de prueba Safety 1 y Safety 2.
* Pantalla `/qc`: camiones por revisar (todo lo demás hecho) → Tomar → Aprobar o Devolver con nota. Devueltos esperan al Manager.
* Devolver = bloqueo del Job de QC con motivo "Devuelto por Safety": el Manager lo ve en Dashboard, Truck y WO con la nota, agrega el trabajo y resuelve; el camión vuelve a Safety cuando ese trabajo está hecho.
* Solo Safety puede ser dueño del QC (cierra [LTR-183](#ltr-183)). El Manager conserva "Mark QC complete" como respaldo.
* Comprobado: filas QC1–QC5 y E9b en PASA (61 comprobaciones, 59 PASA, 0 FALLA, 2 no aplican) y recorrido en pantalla en teléfono, EN y ES.

**Después de fusionar:** aplicar la migración por el workflow de Release safety y crear las dos cuentas reales de Safety en producción (P6).

---

## LTR-186

**D20 cierre del día a las 5:00 p.m. + D21 un reloj por mecánico**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-10-05 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/240**

Encontrado en el cuestionario de operación (Cristian, 2026-09-29). Hueco G2 en `docs/OPEN_ISSUES.md` §1c. Historia HU-ME5 en `docs/USER_FLOWS.md`.

#### Cómo trabaja el taller

* El tiempo registrado se usa para **medir cuánto tarda cada trabajo** y para **cobrar o costear**. Tiene que ser confiable.
* Si un mecánico se va y olvida detener su tiempo, quieren que **se detenga solo a cierta hora**.
* En almuerzo y descansos no hace falta detenerlo.

#### Qué hace la app hoy

El reloj de un mecánico solo se detiene cuando termina o bloquea su último Job, cuando el Manager pausa o cancela, o cuando le quitan el Job. Si se va con un Job a medias, su tiempo corre toda la noche. Después solo se puede corregir a mano (corrección de tiempos, y no sobre una sesión abierta).

#### Qué hay que decidir

1. ¿A qué hora se detiene? (una hora fija del taller, configurable en Setup)
2. ¿Al otro día el mecánico toca Continue y sigue, como después de un bloqueo?
3. ¿Queda marcado en el historial que se detuvo solo?

#### Relacionado

* Defecto #1 ([LTR-175](#ltr-175)): hoy el tiempo del PM no se registra.
* Defecto #9 ([LTR-184](#ltr-184)): las sesiones no dicen de qué mecánico son.
* D2 ([LTR-125](#ltr-125)): se aceptó que el tiempo de un mecánico se solape entre dos camiones. Si el tiempo se usa para costear, ese solape infla el costo. Ver LTR-188.

#### Terminado cuando

Decisión escrita en `DECISIONS.md`, historia HU-ME5 en `USER_FLOWS.md` en ✅ y su fila en `apps/api/test-real/` en PASA.

#### Decidido (2026-10-05)

**D20 — cierre del día.** El taller trabaja lunes a viernes 8:00–5:00 (Este). A las 5:00 p.m. de cada día hábil la app cierra los relojes que sigan corriendo; el tiempo cuenta **hasta las 5:00**. Es el cierre normal de cada jornada en Work Orders de varios días (el mecánico no pausa, D12), no una alerta: se ve como "cierre del día" y el Manager lo ajusta solo si alguien se fue antes. Al día siguiente el mecánico toca Continue (su inicio se lo recuerda). Reloj que arranca después de las 5:00 o un día no hábil: se cierra a las 11:59 p.m. de ese día. Hora y días editables por el Manager en Setup.

**D21 — un reloj por mecánico** (se construye aquí, sale de [LTR-188](#ltr-188) P9): Start/Continue en otro camión cierra su reloj en el anterior ("cambio de camión"); al volver, Continue.

Historias: HU-ME5, HU-ME6 y fila E7 de HU-ME2 en `docs/USER_FLOWS.md`. Filas del harness: A32, A33, E7.

---

## LTR-187

**Hueco de operación: el Manager da de alta camiones y mecánicos desde la app (hoy no hay pantalla)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** UX, API
- **Creado:** 2026-09-29 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/237**

Encontrado en el cuestionario de operación (Cristian, 2026-09-29). Hueco G5 en `docs/OPEN_ISSUES.md` §1c. Historia HU-M9 en `docs/USER_FLOWS.md`. **Cierra la pregunta P1** de `docs/DECISIONS.md`.

#### Cómo trabaja el taller

Quien da de alta un camión nuevo y un mecánico nuevo es **el Manager, desde la app**.

#### Qué hace la app hoy

* **Camiones:** no hay pantalla ni función. Solo entran por la carga de Ninox o a mano en la base de datos.
* **Mecánicos:** la función existe, pero solo para la cuenta System Admin, y sin pantalla. El Manager recibe "no autorizado" (fila A26).
* La cuenta para iniciar sesión se crea aparte, en Supabase.

#### Qué hay que decidir

1. Camión: ¿qué datos mínimos pide? (número, marca, modelo, año, millaje, VIN)
2. Mecánico: ¿el Manager crea también su acceso (correo y contraseña inicial), o solo el registro?
3. ¿El Manager puede desactivar a un mecánico? ¿Qué pasa con sus Jobs pendientes y su tiempo abierto?
4. ¿Hace falta para el día 1 (go-live), o puede esperar y lo hago yo a mano mientras tanto?

#### Terminado cuando

Decisión escrita en `DECISIONS.md`, historia HU-M9 con flujo y casos límite en `USER_FLOWS.md` en ✅, filas en `apps/api/test-real/` en PASA.

#### Decidido (D22, 2026-09-30)

1. Camión: **fuera por ahora** (siguen llegando de Ninox); se decide después.
2. Mecánico / Safety: el Manager crea también el acceso; la app genera una **contraseña temporal** que se muestra una vez y obliga a cambiarla al primer inicio.
3. Desactivar: sí, **solo sin Jobs pendientes ni tiempo corriendo**; la app dice qué reasignar. Reactivar sin regla.
4. Va **antes de salir en vivo**: las cuentas reales de Safety, PM y mecánicos las crea el Manager desde la app.

Construido en PR [lightningtransport/LTL_Shop#237](https://linear.app/ltransl/review/manager-onboards-staff-standard-pm-and-safety-with-a-temporary-67be6add0d39). Producción necesita `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL` en la API.

---

## LTR-188

**Decisiones de operación pendientes: dos mecánicos en una tarea, taller externo, tiempo solapado, PM sin partes, trailers**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** Docs
- **Creado:** 2026-09-29 · **Cerrado:** 2026-10-05 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/241**

Salen del cuestionario de operación (Cristian, 2026-09-29). Son decisiones de producto, no defectos. Preguntas P7–P11 en `docs/DECISIONS.md`. Nada de esto se construye hasta decidirlo.

| \# | Cómo trabaja el taller | Qué hace la app hoy | Qué hay que decidir |
| -- | -- | -- | -- |
| P7 | **A veces dos mecánicos trabajan juntos en la misma tarea** | Un solo dueño por Job (D11). El ayudante no ve el Job y su tiempo no se registra | ¿Se agrega "ayudante" a un Job? ¿O el Manager crea un Job aparte para el segundo? |
| P8 | **A veces se manda trabajo a un taller externo** | No existe. Hoy el Manager tendría que dejar el Job sin dueño (la app lo marca como problema) y completarlo él | ¿Un Job puede marcarse "externo", sin dueño y sin aviso? ¿Se anota proveedor y costo? |
| P9 | **El tiempo se usa para costear** | D2 ([LTR-125](#ltr-125)) aceptó que el tiempo de un mecánico corra en dos camiones a la vez. Eso cuenta la misma hora dos veces | ¿Se mantiene el solape, o al hacer Start en un camión se detiene el reloj en el otro? |
| P10 | **PM sin cambiar partes** (pregunta 16, sin responder) | El PM exige al menos una parte para terminar | ¿Pasa alguna vez? Si pasa, hay que permitir "sin partes" |
| P11 | **El taller también trabaja trailers** (cierra P3: sí hacen falta) | Solo camiones. "Trailer" es una categoría de Job ([LTR-56](#ltr-56), diferido) | ¿Hace falta para el día 1, o después de salir en vivo? |

**Cerradas por el cuestionario:** P1 (el Manager da de alta camiones y mecánicos, [LTR-187](#ltr-187)) · P2 (se lanza sin Off Duty: no se pidió) · P3 (trailers sí hacen falta; falta el cuándo, P11).

#### Cerradas (Cristian, 2026-09-29)

* **P9 → D21:** el reloj de un mecánico corre en **un solo camión a la vez**. Al hacer Start en otro camión se detiene el del anterior; al volver toca Continue. Reemplaza la parte de [LTR-125](#ltr-125) que aceptaba el solape. **Por construir** (fila E7 del harness pasa a afirmar D21).
* **P10:** nunca hay PM sin partes. La app está bien como está.

Quedan abiertas P7 (ayudante en un Job), P8 (taller externo) y P11 (trailers: cuándo).

**2026-10-05:** P9 (tiempo solapado) se decidió como D21 y se construye en [LTR-186](#ltr-186) (PR [lightningtransport/LTL_Shop#240](https://linear.app/ltransl/review/clock-day-close-at-500-pm-d20-and-one-clock-per-mechanic-d21-ltr-186-62f6c9d44a45)). Quedan P7 (ayudante), P8 (taller externo) y P11 (trailers).

#### Decididas (Cristian, 2026-10-05)

* **P7 → D23:** Job aparte para el ayudante. En el `…` del Job, el Manager toca "Agregar ayudante" y la app crea "<Job> · ayudante" con ese dueño. Historia HU-M10, fila A34.
* **P8 → D24:** "Enviar a taller externo" en el `…` del Job; el Manager elige si sale **la pieza** o **el camión** y deja una nota. El Job queda sin dueño ni reloj ni alerta; el camión no puede quedar Ready to Go; si sale el camión, el Yard lo muestra "Fuera del taller". Al volver: "Regresó" → completar o asignar. Sin costos. Historia HU-M11, fila A35.

Queda abierta solo **P11** (trailers: cuándo).

**P11 (2026-10-05):** trailers después de salir en vivo, cuando Cristian lo indique ([LTR-56](#ltr-56)). D23 y D24 construidos en PR #241.

---

## LTR-189

**Recorrido de pantallas: 17 hallazgos C/E (W1–W17), empezar por la tarjeta Jobs**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Bug
- **Creado:** 2026-09-30 · **Cerrado:** 2026-09-30 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/233, https://github.com/lightningtransport/LTL_Shop/pull/232, https://github.com/lightningtransport/LTL_Shop/pull/231, https://github.com/lightningtransport/LTL_Shop/pull/230, https://github.com/lightningtransport/LTL_Shop/pull/229, https://github.com/lightningtransport/LTL_Shop/pull/228, https://github.com/lightningtransport/LTL_Shop/pull/227, https://github.com/lightningtransport/LTL_Shop/pull/226, https://github.com/lightningtransport/LTL_Shop/pull/225**

Recorrido completo del 2026-09-29 (teléfono 375 px, español + muestreo en inglés, API real, 9 escenarios de demo) de todas las historias de `docs/USER_FLOWS.md`, con Manager, mecánico Standard, PM y Safety.

**Resultado:** ninguna historia se atora. 17 hallazgos, todos **C (confuso)** o **E (estético)**; uno (W4) lanza un error real de hidratación en consola. Detalle con archivo y línea en `docs/OPEN_ISSUES.md` §1d.

**Orden de arreglo (uno o dos por PR):**

1. ~~W1 — tarjeta "Jobs" del Work Order sin jerarquía~~ **hecho** en PR [Admin Jobs card with hierarchy: cancel/reopen in a dialog (LTR-189 W1)](https://linear.app/ltransl/review/admin-jobs-card-with-hierarchy-cancelreopen-in-a-dialog-ltr-189-w1-04b87dfb3273) (2026-09-30).
2. ~~W2 — "Completar Work Order" visible con error antes de tiempo~~ **hecho** en PR [Admin WO detail: Complete card only when ready to close (LTR-189 W2)](https://linear.app/ltransl/review/admin-wo-detail-complete-card-only-when-ready-to-close-ltr-189-w2-04cb2a57ca22) (2026-09-30).
3. \~\~W4 — badge \~\~`~~~~<div>~~~~` dentro de `~~~~<p>~~~~` en la lista de Trucks **hecho** en PR [Trucks list: fix hydration error from badge inside &lt;p&gt; (LTR-189 W4)](https://linear.app/ltransl/review/trucks-list-fix-hydration-error-from-badge-inside-p-ltr-189-w4-ba384d81a157) (2026-09-30).
4. ~~W11 — pestaña "Completados" del mecánico no muestra los Jobs que terminó~~ **hecho** en PR [Mechanic Completed tab: the Jobs I completed, not only closed Work Orders (LTR-189 W11)](https://linear.app/ltransl/review/mechanic-completed-tab-the-jobs-i-completed-not-only-closed-work-ae12c1848486) (2026-09-30).
5. ~~W12 — sin botón "Completar" visible en el detalle del mecánico~~ **hecho** en PR [Mechanic WO detail: visible Complete job button (LTR-189 W12)](https://linear.app/ltransl/review/mechanic-wo-detail-visible-complete-job-button-ltr-189-w12-ebdf22546789) (2026-09-30).
6. ~~W14, W15 — PM: "Iniciar" primario con otro PM activo; sin pausa; "Guardado" escondido~~ **hecho** en PR [PM workspace: no false Start buttons, notes thread, visible autosave (LTR-189 W14, W15)](https://linear.app/ltransl/review/pm-workspace-no-false-start-buttons-notes-thread-visible-autosave-ltr-4036588d4a88) (2026-09-30).
7. ~~W17, W9, W5 (y W16) — idioma/copys~~ **hecho** en PR [Copy fixes: Safety says Unidad, QC owner in Setup, operational status, Take primary (LTR-189 W17, W9, W5, W16)](https://linear.app/ltransl/review/copy-fixes-safety-says-unidad-qc-owner-in-setup-operational-status-6b3b61713ef5) (2026-09-30).
8. ~~W3, W7, W8, W10, W6, W13 — resto~~ **hecho** en PR #233 (2026-09-30). **17/17 arreglados**; se cierra al fusionar #233.

Cerrado de paso: defecto #5 ("Mechanic note: undefined") no se reproduce.

Cada PR: arreglo + `USER_FLOWS.md` §8 y `OPEN_ISSUES.md` §1d actualizados (fila borrada).

---

## LTR-190

**Rediseño UI Admin: Work Order, Truck, Dashboard y Yard (Etapas 1–8)**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** UX, Feature
- **Creado:** 2026-10-06 · **Cerrado:** 2026-10-06 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/244, https://github.com/lightningtransport/LTL_Shop/tree/claude/exciting-lehmann-09883c**

#### Qué es

Mejoras de las pantallas Admin, salidas de las auditorías UX (`docs/ux-audit/admin-truck-wo/`, `docs/ux-audit/admin-dashboard-yard/`) y de las propuestas con maqueta (`docs/proposals/{wo,truck}-detail-redesign/`, `docs/proposals/dashboard-yard-redesign/`). **Publicado en producción** con el PR [lightningtransport/LTL_Shop#244](https://linear.app/ltransl/review/admin-ui-redesign-dashboard-yard-truck-and-work-order-match-the-bdd3e0d5613c), fusionado el 2026-10-06. El detalle de cada defecto está en `docs/OPEN_ISSUES.md` §1e (WO), §1f (Truck), §1g (Dashboard/Yard) y §1h (fidelidad a las maquetas).

Reparto confirmado por el dueño:

* El **Truck** responde "¿puede salir?" y la **Work Order** ejecuta.
* El **Dashboard** responde "¿qué hago ahora?" y el **Yard** responde "¿dónde está cada camión?".
* El siguiente paso actúa donde estás (D26). Cerrar una WO pide confirmación (D27), salvo en el Dashboard: ver la Etapa 8.8.

#### Etapas 1–7: el comportamiento

1. **Arreglos rápidos:** Return to Service con diálogo; volver al Yard conserva los filtros; el Yard se refresca cada 30 s.
2. **El siguiente paso actúa ahí mismo** en el Dashboard, la lista de Work Orders y la WO. Selector de mecánico con búsqueda.
3. **Dashboard como cola "Needs you":** 4 contadores que filtran, "Leaving soon" con datos de Dispatch y pedidos de trabajo.
4. **Truck:** un solo estado, stepper de pasos, Work Plan por paso, Add work en un panel lateral y New Work Order en un diálogo.
5. **Work Order:** los "…" son menús; el blocker va en el siguiente paso; Jobs ordenados; historial con pestañas y "Corregir…".
6. **Yard:** filtros rápidos con conteo, carriles por paso y Dispatch cruzado con el taller. Defecto D11 corregido.
7. **Colores:** transparencias (R9), tokens del tema oscuro (R6) y contraste AA. Además, R10: un diálogo le quitaba el foco a quien ya estaba escribiendo.

#### Etapa 8: igual a las maquetas (hecha)

Plan en `docs/proposals/ETAPA8_PLAN.md`. Un commit por paso:

* **8.1** Base común: botones, chips, menús como hoja en el teléfono, toasts y avatares; menú lateral a todo lo alto con migas de pan.
* **8.6** Campos de API que faltaban, todos opcionales y sin migración.
* **8.2** Work Order, **8.3** Truck, **8.4** Dashboard y **8.5** Yard, iguales a sus maquetas. El Yard tiene "Leaving soon" como filtro rápido y ya no tiene "More filters".
* **8.7** Verificación final y documentación.
* **8.8** Respuestas del dueño a las preguntas pendientes:
  * P1: los datos de Dispatch se usan.
  * P2: Return to Service sigue siendo de a uno.
  * P3: la inspección se registra con dos botones en la fila del Dashboard.
  * P4: Workspaces pasa al menú lateral.
  * P5: cerrar una WO es de un toque **solo en el Dashboard**; D27 se cambió en `DECISIONS.md`.
  * P6: el stepper se muestra solo en el Truck.

Las diferencias menores con las maquetas están en `docs/proposals/PENDIENTES_UI.md`.

#### Pruebas al publicar (2026-10-06)

* e2e: 230 de 230 en Chromium y WebKit.
* Web: 218 pruebas unitarias.
* API: 535 pruebas.
* `test:real` contra la base local: 67 de 67.
* `ui-audit` con Manager y Admin, EN/ES, claro/oscuro, iPhone/escritorio: sin scroll lateral y sin contraste bajo.

#### Después del merge

La revisión de producción, sus arreglos (G1–G10), el loader del login y los datos demo locales siguen en **LTR-191**.

---

## LTR-191

**Revisión de producción tras el rediseño (G1–G10), loader de login y datos demo**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Go-live, Bug
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-07 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/260, https://github.com/lightningtransport/LTL_Shop/pull/252, https://github.com/lightningtransport/LTL_Shop/pull/248, https://github.com/lightningtransport/LTL_Shop/pull/253, https://github.com/lightningtransport/LTL_Shop/pull/254, https://github.com/lightningtransport/LTL_Shop/pull/245, https://github.com/lightningtransport/LTL_Shop/pull/251, https://github.com/lightningtransport/LTL_Shop/pull/247, https://github.com/lightningtransport/LTL_Shop/pull/246, https://github.com/lightningtransport/LTL_Shop/pull/249, https://github.com/lightningtransport/LTL_Shop/pull/250**

#### Qué es

Después del merge del rediseño ([LTR-190](#ltr-190), PR [lightningtransport/LTL_Shop#244](https://linear.app/ltransl/review/admin-ui-redesign-dashboard-yard-truck-and-work-order-match-the-bdd3e0d5613c)) se revisó producción con cada rol: Manager, mecánico General, mecánico de PM y QC/Safety. Lo encontrado se anotó en `docs/OPEN_ISSUES.md` §1i (G1–G10) antes de arreglarlo, y cada arreglo trae su prueba. **Todo está cerrado y verificado en producción** (2026-10-07, web y API en `0e73dea`).

#### Defectos encontrados y arreglados (§1i)

* **G1.** La API de producción no se publicaba desde el 30-09: había 4 migraciones pendientes y el release gate frenaba el build. Se aplicaron con `release-safety.yml` y se volvió a publicar.
* **G2.** Un Job pendiente muestra "Mark complete" con borde; Quality Check mantiene el estilo principal. ([lightningtransport/LTL_Shop#245](https://linear.app/ltransl/review/fix-mark-complete-button-truck-chip-and-labels-local-demo-data-for-175cd980aaaa))
* **G3.** El paso actual del Truck es el primero que falta o, si no hay, el primero sin hacer. ([lightningtransport/LTL_Shop#245](https://linear.app/ltransl/review/fix-mark-complete-button-truck-chip-and-labels-local-demo-data-for-175cd980aaaa))
* **G4.** El Work Plan muestra "Job to do". ([lightningtransport/LTL_Shop#245](https://linear.app/ltransl/review/fix-mark-complete-button-truck-chip-and-labels-local-demo-data-for-175cd980aaaa))
* **G5.** La WO titula la sección "Repair history". ([lightningtransport/LTL_Shop#245](https://linear.app/ltransl/review/fix-mark-complete-button-truck-chip-and-labels-local-demo-data-for-175cd980aaaa))
* **G6.** Datos de prueba limpiados en producción (aprobado por el dueño): una nota de un registro de actividad, y una nota de pedido de trabajo con su registro.
* **G7.** Textos del mecánico cuando espera al Manager: "Your Jobs are done…" y "…closes it when every step is done" (EN/ES). ([lightningtransport/LTL_Shop#247](https://linear.app/ltransl/review/fix-mechanic-waiting-on-manager-copy-record-production-review-findings-fcaec95e91d2))
* **G8.** El cierre del día (Vercel Cron) no corría porque faltaba `CRON_SECRET`. El dueño lo cargó en Vercel; ahora la ruta responde 401 sin el secreto. Se corrigió una sesión de 38 h del mecánico General: termina el 29-09 a las 5:00 PM ET y la labor de WO-004 queda en 7 h 45 min, con el tramo marcado "Corrected".
* **G9.** El detalle de una persona de Safety abre desde Mechanics: antes decía "This mechanic could not be found". ([lightningtransport/LTL_Shop#249](https://linear.app/ltransl/review/fix-a-safety-persons-detail-opens-from-the-mechanics-roster-g9-07842e360b1d))
* **G10.** "Reset password" crea la cuenta de acceso si falta. Antes decía "This person has no access account yet". Además, la página Admin bloqueada ofrece "Return to your Home" / "Volver a tu inicio", sin nombrar un rol. ([lightningtransport/LTL_Shop#251](https://linear.app/ltransl/review/fix-reset-password-creates-a-missing-access-account-g10-35dfb8d29119), [lightningtransport/LTL_Shop#254](https://linear.app/ltransl/review/fix-the-blocked-admin-pages-way-back-names-no-role-83f634c28673))

#### Agregado a pedido del dueño

* **Loader animado antes del login** ([lightningtransport/LTL_Shop#246](https://linear.app/ltransl/review/login-animated-lightning-loader-on-navy-before-the-sign-in-screen-c50773b810cb)): la versión con fondo azul. Se ve una vez por sesión y la animación completa se reproduce (3,4 s) antes de mostrar el formulario. No aparece en las pruebas automáticas, y `?loader=1/0` lo fuerza o lo quita.
* **Datos demo locales** ([lightningtransport/LTL_Shop#245](https://linear.app/ltransl/review/fix-mark-complete-button-truck-chip-and-labels-local-demo-data-for-175cd980aaaa)): `prisma:demo-local` llena la base local `ltl_shop_demo` con todos los escenarios (camiones 601–610). Nunca toca producción.

#### Acciones en producción

* Migraciones aplicadas con `release-safety.yml`.
* `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` (Legacy `service_role`) cargados por el dueño en Vercel, y los redeploys correspondientes.
* Cuenta de QC (`cris240588+qc@gmail.com`) creada y con acceso: entra a `/qc`, y Admin y las pantallas de mecánico le quedan bloqueadas.
* Limpieza de datos de prueba y corrección de la sesión de 38 h, ambas aprobadas por el dueño.

#### Verificación por rol

* **Manager:** Dashboard (Dispatch: "leaves Oct 7" para el Truck 282), Yard, Truck 601 y WO-004.
* **Mecánico General:** inicio, detalle de WO, Completed y Trucks.
* **Mecánico de PM:** inicio, Completed y Trucks.
* **QC:** `/qc` vacío pero correcto; Admin y las pantallas de mecánico bloqueadas.

Pruebas: e2e 234 de 234 (Chromium y WebKit), web 222 pruebas unitarias y API 536.

#### PRs

[lightningtransport/LTL_Shop#245](https://linear.app/ltransl/review/fix-mark-complete-button-truck-chip-and-labels-local-demo-data-for-175cd980aaaa), [lightningtransport/LTL_Shop#246](https://linear.app/ltransl/review/login-animated-lightning-loader-on-navy-before-the-sign-in-screen-c50773b810cb), [lightningtransport/LTL_Shop#247](https://linear.app/ltransl/review/fix-mechanic-waiting-on-manager-copy-record-production-review-findings-fcaec95e91d2), [lightningtransport/LTL_Shop#248](https://linear.app/ltransl/review/docs-cron-secret-is-set-on-the-production-api-g8-e9a41099363d) y [lightningtransport/LTL_Shop#252](https://linear.app/ltransl/review/docs-g9-and-g10-done-and-verified-in-production-37c6756805c6)/#253 (docs), [lightningtransport/LTL_Shop#249](https://linear.app/ltransl/review/fix-a-safety-persons-detail-opens-from-the-mechanics-roster-g9-07842e360b1d), [lightningtransport/LTL_Shop#250](https://linear.app/ltransl/review/fix-safetys-takeapprovereturn-show-the-change-right-away-q1-433ef00a0ccd) (Q1: Take, Approve y Return de Safety responden con la cola), [lightningtransport/LTL_Shop#251](https://linear.app/ltransl/review/fix-reset-password-creates-a-missing-access-account-g10-35dfb8d29119) y [lightningtransport/LTL_Shop#254](https://linear.app/ltransl/review/fix-the-blocked-admin-pages-way-back-names-no-role-83f634c28673).

---

## LTR-192

**Roles de campo: auditoría UX (Safety, mecánico General, PM) y bloque A de arreglos**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** UX, Bug
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-07 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/255, https://github.com/lightningtransport/LTL_Shop/pull/256, https://github.com/lightningtransport/LTL_Shop/pull/257**

#### Qué es

Auditoría con las skills `audit-ux` de las pantallas de los tres roles de campo, en la base demo local (teléfono de 375 px y computadora, claro y oscuro). Producción no se tocó. Después vino el **bloque A**: arreglos que no cambian el diseño, cada uno con su prueba.

* **Safety:** 18 hallazgos (`docs/ux-audit/safety-qc/`, `OPEN_ISSUES.md` §1j).
* **Mecánico General:** 34 hallazgos (`docs/ux-audit/mecanico-general/`, §1k).
* **Mecánico de PM:** 26 hallazgos (`docs/ux-audit/mecanico-pm/`, §1l).
* Resumen para el dueño: `docs/ux-audit/RESUMEN-roles-de-campo.md`. El dueño aprobó todo como la recomendación (2026-10-07).

Las correcciones se reparten en tres bloques:

* **A:** arreglos sin rediseño. Es este issue.
* **B:** rediseño con maqueta. Safety está en LTR-193; el mecánico General y el PM, en LTR-194.
* **C:** lo común a los tres roles, en LTR-195.

#### Bloque A (hecho)

**Mecánico de PM (**[lightningtransport/LTL_Shop#256](https://linear.app/ltransl/review/block-a-pm-parts-wait-for-the-mileage-unsent-pm-entries-stay-on-the-0d5bbaac2153)**)**

* **PM2:** con un salto de millaje sin confirmar, las piezas quedan desactivadas.
* **PM3:** borrar el millaje no lo guarda vacío.
* **PM1:** sin conexión sale "Not saved". Lo anotado queda en el teléfono y se envía al volver la red.
* **PM5:** con un PM en curso, la app dice dónde está antes de ofrecer otro.
* Los errores salen en el idioma de la app.
* **MG6/A12:** un Work Order que ya no existe, o sin Jobs propios, lo dice y ofrece "Back to My work".

**Mecánico General y Safety (**[lightningtransport/LTL_Shop#257](https://linear.app/ltransl/review/block-a-general-mechanic-safety-honest-clock-line-continue-on-the-card-37f7f22beb43)**)**

* **MG3/MG4:** "Your clock is stopped · tap Continue", con el botón Continue.
* **MG2:** al empezar en otro camión, avisa que el reloj se movió (`clockMovedFrom` en la API).
* **MG7:** los errores salen en español.
* **MG8:** Report Blocker siempre ofrece la nota y explica qué falta.
* **MG9/PM6/Q9:** las notas quedan en el teléfono hasta enviarlas.
* **Q11:** los Jobs de Safety salen siempre en el mismo orden.

#### Pruebas

* e2e del mecánico, del PM y de `ux-regressions` en Chrome y WebKit.
* El spec nuevo `field-fixes-block-a.spec.ts`.
* `test:real` E7 y QC1.
* Unitarias: web 222 y API 536.

#### PRs

[lightningtransport/LTL_Shop#255](https://linear.app/ltransl/review/docs-safety-screen-proposal-and-ux-audits-of-the-field-roles-safety-cff93839ea96) (auditorías y propuesta de Safety), [lightningtransport/LTL_Shop#256](https://linear.app/ltransl/review/block-a-pm-parts-wait-for-the-mileage-unsent-pm-entries-stay-on-the-0d5bbaac2153) y [lightningtransport/LTL_Shop#257](https://linear.app/ltransl/review/block-a-general-mechanic-safety-honest-clock-line-continue-on-the-card-37f7f22beb43).

---

## LTR-193

**Rediseño de la pantalla de Safety (Quality Check), bloque B**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** UX, Feature
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-07 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/259, https://github.com/lightningtransport/LTL_Shop/pull/250**

#### Qué es

La pantalla `/qc` construida igual a la maqueta aprobada: `docs/proposals/qc-screen-redesign/`, decisiones D-QC1 a D-QC7 (2026-10-07). Cierra Q2, Q4 y Q5 de `OPEN_ISSUES.md` §1j. Antes, el [lightningtransport/LTL_Shop#250](https://linear.app/ltransl/review/fix-safetys-takeapprovereturn-show-the-change-right-away-q1-433ef00a0ccd) arregló Q1: Take, Approve y Return responden con la cola ya actualizada.

#### Qué ve Safety

* Pestañas **To review · Returned · Done**. Lo más urgente va primero: sale pronto según Dispatch, después Critical/High y después el que lleva más tiempo listo (D-QC5).
* Tarjetas con prioridad, salida y ubicación (de Dispatch), Jobs y avatares. El camión que tomó otra persona sale atenuado y sin Take.
* **Revisión del camión:** qué se hizo, quién, cuándo y la nota de cierre; el PM con millaje y piezas; la inspección; los bloqueos y las devoluciones anteriores. Return y Approve quedan fijos abajo.
* **Approve** pide confirmar (D-QC1). **Let go** suelta un camión tomado (D-QC2).
* **Return** marca qué Job falló (D-QC3). La nota es obligatoria y el borrador se conserva.
* **Done:** lo aprobado o devuelto en los últimos 7 días (D-QC6).

#### API (todo aditivo)

* `GET /qc/:workOrderId`: la revisión.
* `POST /qc/:workOrderId/release`: Let go.
* `jobId` opcional al devolver.
* `GET /qc/history?days=7`.
* La lista suma `priority`, `leavesOn`, `location` (Dispatch, en caché 60 s; si Dispatch no responde, la lista sigue sin esos datos) y `doneBy`.

#### Pruebas

* `test:real` QC3 y QC6–QC10.
* e2e `qc-redesign.spec.ts` en Chrome y WebKit.
* Suite e2e completa: 262 pasan.
* Unitarias: web 222 y API 536.
* Corrigió una prueba del reloj que fallaba en `main` desde el [lightningtransport/LTL_Shop#257](https://linear.app/ltransl/review/block-a-general-mechanic-safety-honest-clock-line-continue-on-the-card-37f7f22beb43) (buscaba "View Work" donde ahora dice Continue).

#### Sigue abierto

Q10, el aviso único de sin conexión, va en el bloque C (LTR-195).

#### PRs

[lightningtransport/LTL_Shop#250](https://linear.app/ltransl/review/fix-safetys-takeapprovereturn-show-the-change-right-away-q1-433ef00a0ccd) (Q1) y [lightningtransport/LTL_Shop#259](https://linear.app/ltransl/review/block-b-safety-the-quality-check-screen-as-approved-review-approve-35dd78aa5f46).

---

## LTR-195

**Roles de campo, bloque C: aviso único de sin conexión y primitivas de la Etapa 8**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-07 · **Padre:** LTR-173
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/260**

#### Qué es

Lo común a Safety, el mecánico General y el mecánico de PM, de la auditoría de los roles de campo (`docs/ux-audit/RESUMEN-roles-de-campo.md`, sección 4, bloque C).

* **Aviso único de sin conexión:** "Offline · your changes are not sent". Se quita cuando vuelve la red y reemplaza los avisos rojos de hoy. Cierra **Q10** (§1j).
* **Primitivas de la Etapa 8** en las tres pantallas: `SectionCard`, `CountChip`, `MechanicAvatar` y `PriorityBadge`.

#### Cómo se cruza con el bloque B

El rediseño del mecánico General ([LTR-194](#ltr-194), etapa 2) construye la franja del reloj y el aviso de sin conexión como un componente común. Safety ya usa las primitivas desde el [lightningtransport/LTL_Shop#259](https://linear.app/ltransl/review/block-b-safety-the-quality-check-screen-as-approved-review-approve-35dd78aa5f46). Lo que quede al terminar [LTR-194](#ltr-194) se cierra aquí: el aviso en Safety y en el PM si no entró con su rediseño, y lo que falte de primitivas.

---

## LTR-196

**Setup del Admin, etapa 0: arreglos sin rediseño (SW1–SW4, JC3–JC6, ME1–ME4)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Bug
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/264**

Revisión de Setup pedida por el dueño el 2026-10-07. Defectos en `docs/OPEN_ISSUES.md` §1m; auditoría en `docs/ux-audit/admin-setup/`.

Arregla:

* Shop workflow ya no se traba cuando el dueño de un paso cambia de tipo (SW1).
* Se marcan los pasos que no se crean (SW2).
* Avisos antes de cambiar el tipo de una persona o desactivarla (SW3, ME2).
* La cifra real de trabajo abierto (ME1, ME4).
* Aviso al salir con cambios sin guardar (SW4).
* "Add person" ya no pierde lo escrito (ME3).
* Enlace de categoría y textos (JC4, JC6).

PRs: [lightningtransport/LTL_Shop#263](https://linear.app/ltransl/review/docs-admin-setup-review-audit-open-issues-1m-d28-d32-setup-and-parts-7a9d3e222da1) (docs) y [lightningtransport/LTL_Shop#264](https://linear.app/ltransl/review/setup-fixes-stage-0-shop-workflow-saves-only-what-changed-real-open-d44ff327b5b7) (arreglos). Prueba real: A37–A40.

---

## LTR-197

**Setup S1: equipo y cola por paso, QC del Manager, paso "PM" (D28, D29)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Feature
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/265, https://github.com/lightningtransport/LTL_Shop/pull/263**

Decisiones D28 y D29 (2026-10-07).

**D28: equipo y cola por paso**

* Cada paso obligatorio tiene un equipo de una o varias personas.
* Con una sola persona, el Job nace asignado a ella.
* Con varias, nace en la cola del equipo: el primero que lo toma queda como dueño, y puede soltarlo.
* El paso de PM se llama "PM"; el mecánico sigue eligiendo PM A o PM B.

**D29: QC del Manager**

* El Manager o el System Admin pueden usar `/qc` como respaldo de Safety.

Propuesta y maqueta: `docs/proposals/admin-setup-redesign/` (§4.2 y §4.7; decisiones abiertas D-SET1, D-SET6 y D-SET7). Empieza después de la etapa 0 y de que el dueño apruebe la maqueta.

---

## LTR-198

**Setup S2: catálogo con categorías, aliases y Jobs del sistema (D30)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Feature
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/267, https://github.com/lightningtransport/LTL_Shop/pull/263**

Decisión D30 (2026-10-07).

**Qué puede hacer el Manager**

* Crear, renombrar, activar y desactivar categorías.
* Agregar y quitar aliases.
* Borrar un Job solo si nunca se usó; si ya se usó, se desactiva.

**Protecciones**

* `system_key` para PM, Alignment, Detailing y Quality Check: los carriles y los pasos dejan de reconocerse por nombre.
* La recarga del catálogo en cada publicación ya no pisa los cambios del Manager.

**Cierra:** JC1, JC2, JC3, JC5 y SW5 de §1m.

Propuesta: `docs/proposals/admin-setup-redesign/` (§4.3 y §4.4; decisiones abiertas D-SET4, D-SET8 y D-SET9).

---

## LTR-199

**Setup S3: People, "Quitar del Shop" y detalle de la persona (D31)**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** Feature
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/268, https://github.com/lightningtransport/LTL_Shop/pull/263**

Decisión D31 (2026-10-07).

**Quitar del Shop**

* La persona deja de entrar y de aparecer en listas y equipos.
* Su historial se conserva.
* El bloqueo por trabajo abierto se muestra antes de confirmar, y ahí mismo se puede reasignar o mandar a la cola.
* El borrado real solo existe para quien nunca hizo nada.

**Detalle de la persona:** cabecera con su estado, los equipos de los que forma parte y sus Jobs.

**Otro cambio:** la sección pasa a llamarse "People / Personas" (ME5).

Propuesta: `docs/proposals/admin-setup-redesign/` (§4.5 y §4.6; decisiones abiertas D-SET2 y D-SET3).

---

## LTR-200

**Partes y costos por camión, etapa 1 (D32)**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** Feature
- **Creado:** 2026-10-07 · **Cerrado:** 2026-10-09
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/272, https://github.com/lightningtransport/LTL_Shop/pull/271, https://github.com/lightningtransport/LTL_Shop/pull/270, https://github.com/lightningtransport/LTL_Shop/pull/269, https://github.com/lightningtransport/LTL_Shop/pull/263**

Decisión D32 (2026-10-07).

**Qué incluye la etapa 1**

* Catálogo de partes: el mismo que usa el PM, que hoy se carga solo por código.
* Proveedores.
* Compras con su factura.
* Reparaciones externas con su factura, ligadas al Job enviado a taller externo (D24).
* Pestaña "Costs" en el Truck.

**Fuera de la etapa 1:** el stock.

**Diseñado, no se construye:** el costo de mano de obra (tarifa × horas) y la factura interna a Finanzas.

**Plan:** etapas PC-1 a PC-4.

Propuesta y maqueta: `docs/proposals/parts-costs/` (decisiones abiertas D-PC1 a D-PC10). Va después de S1–S3.

---

## LTR-201

**Mano de obra y factura interna a Finanzas (D34)**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** Feature
- **Creado:** 2026-10-09 · **Cerrado:** 2026-10-09
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/277, https://github.com/lightningtransport/LTL_Shop/pull/276**

Decisión D34 (2026-10-09). Es la etapa 2 de Partes y costos (D32, [LTR-200](#ltr-200)).

**Lo que decidió el dueño**

* La mano de obra usa una tarifa por hora para todo el taller, con fecha desde la que vale.
* Las partes se cobran al costo, sin recargo.
* La factura interna es por camión y mes, con número `SHOP-AAAA-NNNN`.
* Finanzas no entra a la app: el Manager descarga el PDF, se lo manda y después la marca como aceptada.

**Bloques**

* **LB-1:** en Setup → Labor rate se carga la tarifa. Al completar un Work Order se escriben horas × tarifa en el costo del camión. Reabrir, cancelar o corregir el tiempo escribe reversas. Truck → Costs muestra el monto. Pruebas: test-real A69–A71.
* **LB-2:** en Internal invoices, el Manager arma la factura (borrador con los movimientos no cobrados del camión en el mes) y puede sacar líneas. Al enviarla queda congelada con su número y se descarga en PDF. Después se marca como aceptada o se anula. Pruebas: test-real A72–A75.

Historia HU-M13 (J14) en `docs/USER_FLOWS.md`. Propuesta: `docs/proposals/parts-costs/` §8.

---

## LTR-202

**Samsara: millaje de referencia, ubicación, luces y fallas en la ficha; fallas → Jobs recomendados (D35, D42)**

- **Estado:** Done · **Proyecto:** Samsara · **Etiquetas:** Feature
- **Creado:** 2026-10-09 · **Cerrado:** 2026-10-14 · **Padre:** LTR-46
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/329, https://github.com/lightningtransport/LTL_Shop/pull/333**

**Construido y en producción (2026-10-14).** Decisiones D35 y D42 (precisada el 2026-10-14). Detalle en `docs/OPEN_ISSUES.md` §1w–§1x, propuesta `docs/proposals/samsara-trucks/README.md`, historias HU-M14 y HU-M15.

**Qué hace**

* **S-1 · Setup → Samsara:** empareja los vehículos de Samsara con nuestros camiones (por id de Samsara, después VIN, después número) y lista los que no casan. Muestra dueño, millas y los dos VIN cuando no coinciden.
* **S-2/S-3 · Sincronización:** cada hora de 7 a.m. a 7 p.m. (hora del Este) de lunes a viernes, más una a las 3 a.m. todos los días, por GitHub Actions. Guarda en cada camión las millas de Samsara (referencia), la ubicación, las luces del tablero (STOP, advertencia, protección, emisiones) y las fallas. **Nunca toca las millas del PM.** Botón "Sync now".
* **Trucks:** 4 columnas (Camión · Trabajo · Fallas · Ubicación). Fallas: STOP / Warning / Check engine según las luces y los códigos. Ubicación en ámbar si pasaron más de 24 h.
* **Ficha:** pestaña Faults con las luces del tablero, las activas y el historial.
* **S-4 · PM:** las millas de Samsara como referencia bajo el campo, con aviso si la diferencia pasa de 50 mi (no bloquea).
* **S-6 · Add work:** "Recommended from Samsara faults". Recomienda los códigos de check engine y, con STOP o advertencia encendida, también los demás. El Job aprendido por código viene marcado; "Pick the Job" para un código nuevo; "Add to that Job"; "Not now" con razón. El mecánico ve la falla en su Job. Faults dice In / Fixed in / Came back after WO-x.

**PRs:** [lightningtransport/LTL_Shop#322](https://linear.app/ltransl/review/docs-d42-samsara-faults-become-recommended-jobs-extends-d35-hu-m14-hu-540534174f9e) (docs D42), [lightningtransport/LTL_Shop#326](https://linear.app/ltransl/review/samsara-s-1-d35-setup-samsara-which-samsara-vehicles-are-our-trucks-f5036f2576c8) (S-1), [lightningtransport/LTL_Shop#328](https://linear.app/ltransl/review/samsara-s1-5s1-6-setup-samsara-shows-both-vins-owner-and-mileage-2eae84f00344) (VIN, dueño, millas), [lightningtransport/LTL_Shop#329](https://linear.app/ltransl/review/samsara-s-2-s-3-d35-d42-mileage-location-and-faults-synced-every-15-5ed49124418b) (S-2/S-3), [lightningtransport/LTL_Shop#330](https://linear.app/ltransl/review/samsara-s3-4-s2-5-stop-and-warning-lights-per-truck-hourly-sync-ea0b153682c8) (luces y horario), [lightningtransport/LTL_Shop#331](https://linear.app/ltransl/review/trucks-list-truck-work-faults-location-tl-1tl-8-ux-hierarchy-audit-52ee60361dae) (lista de Trucks), [lightningtransport/LTL_Shop#332](https://linear.app/ltransl/review/samsara-s-4-d35-p12-samsara-odometer-as-a-reference-on-the-pm-screen-d1a431ce10d4) (S-4), [lightningtransport/LTL_Shop#333](https://linear.app/ltransl/review/samsara-s-6-d42-faults-become-recommended-jobs-in-add-work-migration-fb707fbf79f4) (S-6).

**Configuración:** token "LTL Shop" de solo lectura en `SAMSARA_API_TOKEN` (Vercel, `ltl-shop-api`); `CRON_SECRET` igual en Vercel y en el ambiente Production de GitHub.

**Fuera de este issue:** corregir datos de camiones (VIN de 740, 743, 876 y 877; 741 sin Samsara; 9050, 9220 y 9680 por confirmar) espera la pantalla de camiones ([LTR-203](#ltr-203), P13).

---

## LTR-204

**Modo demo local: cambio de usuario y historias guiadas (D36)**

- **Estado:** Done · **Proyecto:** Demo & Landing · **Etiquetas:** Feature
- **Creado:** 2026-10-09 · **Cerrado:** 2026-10-09
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/307, https://github.com/lightningtransport/LTL_Shop/pull/291, https://github.com/lightningtransport/LTL_Shop/pull/290, https://github.com/lightningtransport/LTL_Shop/pull/289, https://github.com/lightningtransport/LTL_Shop/pull/288, https://github.com/lightningtransport/LTL_Shop/pull/287, https://github.com/lightningtransport/LTL_Shop/pull/286, https://github.com/lightningtransport/LTL_Shop/pull/285, https://github.com/lightningtransport/LTL_Shop/pull/284, https://github.com/lightningtransport/LTL_Shop/pull/283**

Para presentar la app a los usuarios desde la laptop del dueño contra `ltl_shop_demo` sin cerrar sesión y volver a entrar con cada cuenta.

**Decisión:** D36 en `docs/DECISIONS.md`. Propuesta y detalle: `docs/proposals/demo-mode/README.md`. Guía del presentador: `docs/reference/DEMO.md`.

**PR 1 — Modo demo y cambio de usuario** (PR 283)

* Botón **Demo** (matraz) en el encabezado de los dos shells, copia del "Panel de demo" de las maquetas.
* Panel con las 10 cuentas demo: tocar una cambia de usuario (cookie de Admin + token `dev:` + recarga) y abre su pantalla de inicio.
* Se enciende desde `/login` ("Enter demo mode"), se apaga desde el panel. Estado en `localStorage`.
* API: `GET /api/dev/demo/users`, 404 sin `AUTH_DEV_BYPASS=true`. Nada de esto existe en producción.
* `npm run start:demo` (API :3141, web :3042).

**PR 2 — Historias guiadas** (PR apilada sobre la 283; 23 historias, 99 pasos)

* Sección Story: elegir una HU de `USER_FLOWS.md` (agrupadas por J1–J14) y recorrerla paso a paso: usuario, pantalla, qué tocar, qué explicar. El presentador toca; la app no ejecuta nada sola. Textos en inglés.

Fuera de v1: resaltado del elemento (driver.js), reconstruir la base desde el panel, ejecutar acciones automáticamente.

---

## LTR-205

**Add work: tarjeta dentro de tarjeta en CategoryJobList**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** E · cosmético, UX
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: —**

Resto de T10 (historial `docs/archive/OPEN_ISSUES_HISTORIAL_2026-10.md` §1f). En Add work, la lista de Jobs por categoría se ve como una tarjeta dentro de otra tarjeta.

Archivo: `apps/web/src/components/category-job-list.tsx`.

---

## LTR-206

**Yard: textos 'UNAVAILABLE' y 'Unable to load current administrative data.'**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** E · cosmético, UX
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/339**

Resto de DB10 (historial `docs/archive/OPEN_ISSUES_HISTORIAL_2026-10.md` §1g). El Yard todavía muestra "UNAVAILABLE" y "Unable to load current administrative data." con tono técnico.

Archivos: `apps/web/src/lib/admin-messages.ts`, `yard-data-boundary-copy.ts`.

---

## LTR-207

**Yard: la pestaña Dispatch se llama `movement` en la URL**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** E · cosmético, UX
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/339**

Hallazgo UX-3-009 (auditoría UX). La pestaña se llama Dispatch en pantalla, pero en la URL aparece como `movement`.

---

## LTR-208

**Mecánico: la pestaña Trucks es solo un buscador; mostrar 'Trucks with your Jobs'**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** C · confunde, UX
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/337**

Hallazgo UX-1-011 (auditoría UX). En la pestaña Trucks el mecánico solo ve un buscador vacío. Propuesta: mostrar primero "Trucks with your Jobs" y dejar el buscador debajo.

---

## LTR-209

**Mecánico: 'Loading work order' en texto plano; usar PageSkeleton**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** E · cosmético, UX
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: —**

Hallazgo UX-6-007 (auditoría UX). Mientras carga el detalle del Work Order, el mecánico ve "Loading work order" en texto plano en vez del esqueleto de carga.

Archivo: `apps/web/src/app/work-orders/[id]/detail-client.tsx`. Usar `PageSkeleton`.

---

## LTR-210

**Shop workflow: 'Add to team' no guarda hasta 'Save steps'**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** C · confunde, UX
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/337**

Hallazgo UX-7-005 (auditoría UX). En Setup → Shop workflow, "Add to team" parece guardar al momento, pero el cambio no se guarda hasta tocar "Save steps". Si el Manager sale antes, lo pierde.

Archivo: `apps/web/src/components/admin-shop-workflow.tsx`.

---

## LTR-211

**Demo: avisar que una historia ya se ejecutó en esta base**

- **Estado:** Done · **Proyecto:** Demo & Landing · **Etiquetas:** C · confunde, UX
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/339**

Hallazgo UX-6-006 (auditoría UX). Si una historia del modo demo ya se recorrió en esta base, los datos ya cambiaron y los pasos no coinciden con la pantalla. El panel debería avisarlo (y sugerir reiniciar la base demo).

---

## LTR-212

**Rendimiento: polling superpuesto (Dashboard, Yard, WO, mecánico)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** E · cosmético, Improvement
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/341**

PF14 (revisión de velocidad 2026-10). Dashboard, Yard, detalle de WO y pantallas del mecánico refrescan por polling con intervalos que se superponen; varias pestañas o pantallas piden lo mismo a la vez.

Nota PF13: `optimizePackageImports` de radix-ui no dio ganancia medible; el logo de Admin es de 1536×894 y se muestra a 28 px.

**Hecho en local (2026-10-15), rama** `claude/ltr-212-polling`**, commit 7e72177:**

* Un solo lugar con los ritmos de actualización (`apps/web/src/lib/live-refresh.ts`): pantallas que se trabajan 15 s, listas y tableros 30 s, badge de Dispatch 60 s. Los feeds de una misma pantalla se actualizan juntos (team queue y cola de Safety pasan de 20 a 30 s; la lista de WOs del Admin de 15 a 30 s).
* Volver a la pestaña actualiza como mucho cada 15 s.
* Logos con el tamaño al que se muestran: el del Admin baja de \~87 KB a \~4 KB.

---

## LTR-213

**CI: correr vitest de la web y test:real en GitHub Actions**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** C · confunde, Improvement
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/340**

Hoy CI no corre los 58 specs vitest de la web, ni Playwright, ni `test:real`. `test:real` necesita Postgres + seed en el runner.

---

## LTR-214

**Trucks 876 y 877: corregir VIN (espera alta/edición de camiones)**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** C · confunde, Bug
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: —**

S1-7 (Setup → Samsara). Los camiones 876 y 877 tienen un VIN distinto al de Samsara. Se corrige desde la pantalla de alta/edición de camiones ([LTR-203](#ltr-203), P13); no tocar la base a mano.

---

## LTR-215

**Crear, editar y desactivar camiones desde el Shop; conectar Samsara desde la ficha**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/336**

Decisión **D44** (cierra P13) · Historia **HU-M18** en `docs/USER_FLOWS.md` · Principio D43 (nuestra base es la fuente).

**Para el Manager y el System Admin:**

1. **Trucks → Add truck:** número (obligatorio, único) + VIN, marca, modelo, año, placas, dueño, compañía, dispatcher, aseguradora (opcionales). Editar todo desde la ficha.
2. **Desactivar, no borrar:** sale de listas y de New Work Order, conserva historial; no con una WO abierta. Borrar solo si nunca tuvo trabajo.
3. **Connect Samsara** en la ficha: vehículos de Samsara sin camión, sugerido por VIN o número; el Manager confirma. La sincronización solo **propone** cuando el VIN coincide exacto, no conecta sola. Se puede desconectar.
4. **Al conectar:** lo vacío se llena con Samsara (VIN, marca, modelo, año, placas); lo distinto se muestra "Yours · Samsara" y el Manager elige. Nada se pisa sin verlo.
5. Los 158 camiones ya conectados no cambian.

Desbloquea [LTR-214](#ltr-214) (VIN de 876 y 877). La API para terceros sigue en [LTR-203](#ltr-203) (P14).

---

## LTR-216

**El Manager puede completar con un toque el QC que Safety devolvió, sin ver el motivo**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** B · bloquea, UX, Bug
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/339**

Hallazgo **UX-1-001** (severidad 4) de la evaluación heurística: `docs/ux-audit/responsive-color-a11y/01-usabilidad.md`.

En una Work Order con el QC devuelto por Safety ("Alignment: sigue jalando a la derecha"), tocar **Mark complete** en la fila del QC lo completa sin diálogo. El bloqueo se resuelve solo y la WO queda lista para cerrar sin que nadie arregle la alineación.

**Propuesta:** si hay una devolución de Safety abierta, "Mark complete" (en la WO, el Dashboard y el Truck) abre un diálogo con el motivo de Safety. La acción principal es "Add work" y completar de todos modos pide una nota obligatoria. En el historial queda "QC completed by Manager over a Safety return".

Código: `apps/web/src/components/admin-job-table.tsx:281`. Decisiones: D19, D29.

---

## LTR-217

**Un camión devuelto por Safety: "Resolve" debería llevar a agregar o reabrir el trabajo**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** C · confunde, UX, Improvement
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/339**

Hallazgo **UX-1-002** (severidad 3), más UX-1-003 (la nota de Safety se muestra como "Mechanic: …"), en `docs/ux-audit/responsive-color-a11y/01-usabilidad.md`.

Hoy "Resolve" solo pide una nota ("Note for the mechanic") y confirma. No ofrece arreglar lo que Safety encontró, y el camión vuelve a Safety igual que estaba.

**Propuesta:**

* La acción principal es **"Add work"**, con el Job que Safety marcó ya elegido (D-QC3), o "Reopen Alignment". El bloqueo se resuelve solo cuando ese trabajo se completa.
* "Resolve without work" queda como acción secundaria, con nota obligatoria.
* La etiqueta de la nota dice "Note for Safety".
* La nota de Safety lleva el prefijo "Safety: …", no "Mechanic: …".

Código: `admin-blocker-resolve.tsx`, `admin-messages-catalog.ts:857` y `:1367`.

---

## LTR-218

**Acciones de un toque que no dicen qué hicieron: Mark handled, Assign, costo de mano de obra en $0**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** E · cosmético, UX, Improvement
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/339**

Hallazgos UX-1-004 a UX-1-009 de `docs/ux-audit/responsive-color-a11y/01-usabilidad.md`:

* **UX-1-006:** "Mark handled" en un pedido de trabajo no tiene Undo, y el aviso tapa la fila siguiente.
* **UX-1-007:** al asignar, el aviso "Job assigned." no dice a quién ni qué Job, y la fila salta de lugar.
* **UX-1-004:** la WO dice "Costs so far: $0.00 labor" con 1 h 3 min trabajados. La mano de obra se cobra al completar (D34), pero la pantalla no lo dice.
* **UX-1-005:** el historial dice "Mechanic added" cuando Safety toma el QC.
* **UX-1-008:** "Missing required steps" todavía habla del "default owner" (de antes de D28).
* **UX-1-009:** la franja del reloj del mecánico corta la hora a 375 px.

---

## LTR-219

**"Add work" abre en la categoría PM y el error dice "open PM Work Order" aunque no la haya**

- **Estado:** Done · **Proyecto:** Work Orders & Jobs · **Etiquetas:** C · confunde, UX, Bug
- **Creado:** 2026-10-15 · **Cerrado:** 2026-10-15
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/339**

Encontrado al probar [LTR-217](#ltr-217) (2026-10-15, base local de demo).

En la ficha del camión, el panel "Add work" abre con la categoría **PM** seleccionada. Si se elige un Job de PM (por ejemplo, Fluid Top-Off) y se toca "Add to Work Plan", aparece el error "This Truck has an open PM Work Order. Finish or cancel it before adding Standard Work Plan Jobs.", aunque la WO abierta del camión es de Inspection.

El usuario no sabe qué hizo mal: el problema es que los Jobs de PM no se agregan desde el Work Plan (D4+D9), no que haya una WO de PM abierta.

**Propuesta:** que el panel no abra en PM (que abra en la primera categoría Standard, o sin ninguna elegida) y que los Jobs de PM se muestren desactivados con la explicación "PM Jobs are done from the PM service". Revisar el mensaje de la API en `yard-work-plan.service.ts` (`addJobsToOpenWorkOrder`).

---

## LTR-220

**Repuestos, stock y llantas en Parts & costs (D45)**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** Epic, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16
- **Adjuntos: —**

Pedido de Randy (2026-10-16). Respuestas del dueño:

* el stock incluye llantas y repuestos;
* cada línea de compra puede atarse, si se quiere, a un Job de su camión (cambia P16);
* llantas delanteras siempre nuevas; traseras recap por defecto, y el Manager puede cambiarlas a nuevas;
* trailers fuera de alcance.

Propuesta completa (caso de uso, JTBD J22–J26, historias, reglas y etapas): `docs/proposals/parts-stock-tires/README.md` · PR [lightningtransport/LTL_Shop#346](https://linear.app/ltransl/review/docs-d45-proposal-spare-parts-stock-and-tires-in-parts-and-costs-bdb78c67d4d1)

Etapas, cada una en su propia issue:

* ST-1 · La compra se ata al Job
* ST-2 · Catálogo de repuestos y llantas
* ST-3 · Stock
* ST-4 · Llantas desde la inspección
* ST-5 · El PM descuenta del stock
* ST-6 · Leer facturas de proveedores

Preguntas abiertas para Randy: P24–P31, en `docs/DECISIONS.md`.

**Demo:** no se actualiza con estas etapas hasta que el dueño avise que terminó (decisión del 2026-10-16).

---

## LTR-221

**ST-1 · Al cargar una compra, cada línea se puede atar al Job de su camión**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-220
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/348**

HU-C1 (sin stock) y HU-C2. Ver `docs/proposals/parts-stock-tires/README.md` §4 B.

* En New purchase, cada línea con camión puede elegir, si se quiere, un Job abierto de ese camión. Es la misma lista que Outside repairs (`GET external-jobs`).
* El Job muestra "Parts · N · $" al Manager y al System Admin, y al mecánico "Parts: X ×2", sin precio.
* Truck → Costs muestra el Job de cada movimiento.
* Las compras viejas no cambian. Cambiar el camión quita el Job y escribe reversas, como en A61.
* Recomendada como primera etapa: no necesita stock.
* No tocar la demo.

---

## LTR-222

**ST-2 · El catálogo de partes tiene repuestos y llantas, no solo el PM**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-220
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/349**

HU-R1 y HU-R2. Ver `docs/proposals/parts-stock-tires/README.md` §4 A.

* Parts gana un filtro PM · Repair · Tires.
* Una llanta lleva medida y tipo (New o Recap).
* Un mínimo de stock opcional por parte.
* "Add to catalog" desde una línea "Other" de una compra.
* El selector del PM sigue mostrando solo las partes del PM (D-PM1, D-PM2).
* No tocar la demo.

---

## LTR-223

**ST-3 · Stock del taller: entra con la compra y sale a un Job**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-220
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/350**

HU-S1 a HU-S4. Ver `docs/proposals/parts-stock-tires/README.md` §4 C y §5.

* Cada línea elige To stock o Shop supplies.
* Pantalla Stock: cantidad, costo promedio y "Low".
* "Add part from stock" en el Job cobra al camión (`stock_issue`).
* Return to stock y Adjust, siempre con motivo y reversa. Nunca se borra.
* Un costo cuenta una sola vez.

**Gated:** espera P25 (conteo inicial) y P27 (costo promedio o FIFO). Depende de ST-1 y ST-2. La migración va por Release safety. No tocar la demo.

---

## LTR-224

**ST-4 · La inspección deja en el Job qué llanta poner (delantera nueva, trasera recap)**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-220
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/351**

HU-T1 a HU-T4. Ver `docs/proposals/parts-stock-tires/README.md` §4 D.

* El Job Tires que crea la inspección (D41) trae una llanta a poner por posición: steer siempre New, drive Recap propuesto.
* El Manager confirma y puede cambiar recap ↔ nueva en drive. Al confirmar, la llanta sale del stock.
* Si no hay, queda "Not in stock · buy N" y el Job no se bloquea.
* La tarjeta Tires del camión muestra qué llanta tiene cada posición.
* Trailers fuera (P24).

**Gated:** depende de ST-3 y de P26 (medidas de llanta). Relacionada con el proyecto Trucks & Inspección. No tocar la demo.

---

## LTR-225

**ST-5 · Las partes que se eligen en el PM salen del stock**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-220
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/352**

HU-S5. Cambia D-PC4 (hoy el PM no descuenta nada y no cuesta al camión).

**Gated:** espera la decisión P29: ¿cantidad o una por categoría?, ¿el costo del PM va al camión?

No tocar el teléfono del PM hasta que el dueño lo decida. Depende de ST-3.

---

## LTR-226

**ST-6 · Subir la factura del proveedor y que la app proponga las líneas**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-220
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/353**

HU-F2. Ver `docs/proposals/parts-stock-tires/README.md` §4 E.

* El Manager sube el PDF o la foto.
* La app propone el proveedor, el número, la fecha y las líneas, y busca cada línea en el catálogo por número de parte.
* El Manager revisa, elige "Goes to" en cada línea y guarda. Nada se guarda sin su confirmación.

**Gated:** espera P30 (qué proveedores mandan factura y en qué formato; entrada por correo o portal). Depende de ST-2.

---

## LTR-227

**Con mouse no se puede mover el tablero del Yard de lado**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** B · bloquea, UX, Bug
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/347**

En Yard Operations → Shop (computadora), el tablero Kanban (D33) solo se mueve de lado con el trackpad (dos dedos). Con un mouse la rueda mueve arriba/abajo y no hay forma visible de llegar a las columnas de la derecha (Alignment, Detailing, Quality Check, Ready to Go).

Arreglo (como Trello, la referencia de D33): barra de desplazamiento horizontal siempre visible abajo del tablero + arrastrar el fondo vacío del tablero con el mouse lo mueve de lado. Arrastrar desde una tarjeta no mueve el tablero. Teléfono sin cambios.

Archivos: `apps/web/src/components/kanban.tsx`.

---

## LTR-228

**Full screen del Yard debe abrir el tablero en otra pestaña**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** C · confunde, UX, Improvement
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/347**

Hoy "Full screen" tapa la misma pestaña (capa fija + pantalla completa del navegador), así el manager pierde la app mientras mira el tablero. Los managers tienen varios monitores: quieren dejar el tablero en una pantalla y seguir usando la app en otra.

Arreglo: el botón abre una pestaña nueva con solo el tablero (`/admin/yard-operations?display=board` + los mismos filtros). La pestaña original sigue igual. En la pestaña del tablero, el botón "Full screen (TV)" pone el navegador en pantalla completa (el navegador pide un clic); Esc sale.

Archivos: `admin-yard-operations.tsx`, `kanban.tsx`, mensajes del admin; D33 y SYSTEM.md.

---

## LTR-229

**Ajustes de Safety que pidió el equipo: nombre oculto, ver la inspección, hallazgos → Jobs (D46)**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** Epic, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/354**

Pedido del equipo (2026-10-16). Respuestas del dueño:

* el Manager ve solo "Safety", nunca el nombre de quien hizo el QC; los de Safety sí se ven entre ellos;
* los hallazgos se registran al devolver (frenan la salida) y al aprobar (no la frenan);
* se quita que el Manager asigne el QC a una persona de Safety;
* fotos y videos: declarados, se hacen más adelante.

Propuesta: `docs/proposals/safety-qc-findings/README.md` · D46 en `docs/DECISIONS.md`.

Etapas:

* SQ-1 · El Manager no ve quién de Safety hizo el QC y no asigna el QC
* SQ-2 · Safety ve la inspección de la Work Order
* SQ-3 · Hallazgos de Safety que el Manager convierte en Jobs
* SQ-4 · Fotos y videos (Gated, más adelante)

**Demo:** no se toca hasta que el dueño avise.

---

## LTR-230

**SQ-1 · El Manager ve "Safety" en vez del nombre de quien hizo el QC, y ya no asigna el QC**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** API, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-229
- **Adjuntos: —**

* El API reemplaza a toda persona de Safety por "Safety" cuando quien mira no es de Safety:
  * en la Work Order: el Job de QC, la devolución y el historial;
  * en el work plan, el Dashboard y la vista del mecánico.
* Los de Safety siguen viendo los nombres en /qc.
* Asignar el Job de QC desde el Admin queda rechazado; el QC solo se toma desde la cola de Safety. El Manager sigue pudiendo hacer el QC él mismo como respaldo (D29).
* Cambia D29 y la fila E9b de USER_FLOWS.

---

## LTR-231

**SQ-2 · Safety ve la inspección (hoja D41) del camión que revisa**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-229
- **Adjuntos: —**

* `GET /qc/:workOrderId/inspection`, solo de lectura: la hoja guardada de esa WO, con defectos y notas, llantas y los Jobs que creó.
* En /qc, la línea "Inspection: Issues found" pasa a ser una sección que se abre.
* Safety no gana permiso para inspeccionar (D41 sigue igual).

---

## LTR-232

**SQ-3 · Safety deja hallazgos y el Manager los agrega como Job o los suma a uno**

- **Estado:** Done · **Proyecto:** Safety / QC · **Etiquetas:** UX, API, Feature
- **Creado:** 2026-10-16 · **Cerrado:** 2026-10-16 · **Padre:** LTR-229
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/354**

* **Safety:** al devolver deja uno o más hallazgos (texto y Job sugerido del catálogo), que frenan la salida. Al aprobar puede dejar hallazgos que no la frenan.
* **Manager:** en la WO, la tarjeta "Safety findings" ofrece **Add as Job**, **Add to <Job>** o **Not now** (con motivo), igual que las fallas de Samsara. Queda ligado con `WorkOrderJobSource` kind `qc_finding`.
* **Mecánico:** ve "From Safety QC: …" en su Job, sin nombre.
* Lleva migración: Release safety después del merge.

---

## LTR-234

**En el teléfono, el teclado tapa los campos y botones de las hojas (inspección de llantas, Asignar, diálogos)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** B · bloquea, UX, Bug
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-18
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/355**

Visto por el dueño en un iPhone 15 Pro el 2026-10-17:

* **Inspección:** en "LF · Dirección", el teclado numérico tapa PSI, tread y los botones Next/Done.
* **Asignar en un Job:** la hoja con el buscador queda debajo del teclado.
* Pasa también en otros campos.

**Causa:**

* Todas las hojas que suben desde abajo (Modal, SideSheet, ResponsiveMenu, mechanic-picker) están pegadas al borde de abajo de la pantalla (`fixed bottom-0`). iOS dibuja el teclado encima sin achicar la pantalla.
* No hay código que mida el teclado (`visualViewport`).
* Las barras fijas de abajo flotan encima del teclado.
* La hoja de llanta se cierra y se vuelve a abrir en cada "Next tire".

**Arreglo:**

* Medir el teclado una vez para toda la app (`--keyboard-inset`).
* Que las hojas se paren encima del teclado.
* Llevar a la vista el campo que se está usando.
* Esconder las barras fijas de abajo mientras se escribe.
* Dejar abierta la hoja de llanta entre una llanta y la siguiente.
* Android: `interactive-widget=resizes-content`.

---

## LTR-235

**"Desconectar" de Samsara arriba de todo en la ficha del camión: un toque sin querer corta el camión**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** C · confunde, UX, Bug
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-18
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/355**

Lo vio el dueño en el teléfono el 2026-10-17. La primera tarjeta de la ficha del camión era "Samsara: 608 · Desconectar", así que el botón quedaba justo donde se toca al abrir la página.

**Arreglo:**

* Con el camión ya conectado, esa tarjeta no se muestra.
* **Disconnect Samsara** pasa al menú "…" del camión, junto con Edit, Deactivate y Delete, y sigue pidiendo confirmación.
* Con el camión sin conectar, siguen arriba **Connect Samsara** y la propuesta por VIN, porque no hacen daño y sirven.

---

## LTR-236

**Pruebas de teléfono que ya fallaban en main: filtros de Work Orders y arrastrar el tablero del Yard**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** C · confunde, UX, Bug
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-19
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/370**

Encontradas el 2026-10-17 al correr la batería completa de Playwright (fixture) para el PR 355. Ya fallan sobre `main` limpio (`3cf7298` / `66ab98a`), no por ese PR.

* `admin-shell.spec.ts:422`: en 768–1440 px, el botón "Filters" de Work Orders sigue visible cuando debería verse la barra de filtros.
* `ui-consistency.spec.ts:73`: la hoja de Filtros en el teléfono no muestra "Apply filters".
* `yard-operations.spec.ts:193` (solo WebKit): arrastrar el tablero vacío con el mouse no lo mueve hacia los lados ([LTR-227](#ltr-227)).

Falta averiguar si es la pantalla o la prueba la que quedó vieja. Antes de cambiar la pantalla, revisar en un teléfono y en la computadora.

**2026-10-19 (PR 370):**

* **Filtros de Work Orders:** la prueba estaba vieja. Desde el PR 338 la barra se pone en línea a partir de 68rem de tarjeta, unos 1440 px con la barra lateral.
* **ui-consistency:** era la pantalla. Trucks decía "Search" teniendo un filtro y ahora dice "Apply filters".
* **Queda abierto:** el arrastre del Yard en WebKit; aquí no hay WebKit para probarlo.

---

## LTR-237

**Epic: Rendimiento ronda 2026-10 — over-fetching en API, bundle web y limpieza (PF15–PF26)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Epic, Improvement
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-18
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/359**

Segunda ronda de velocidad (la primera fue PF1–PF14, [LTR-196](#ltr-196)..200 y [LTR-212](#ltr-212)). Revisión del código de producto **sin tocar nada de la demo** (demo congelada desde 2026-10-16).

**Qué se encontró**

* La home del mecánico pide cada 30 s el detalle completo de cada Work Order (partes, stock, llantas, actividad) solo para mostrar un resumen.
* El Dashboard carga el tablero del Yard entero para contar los camiones Ready to Go, y espera los hallazgos de QC después de todo lo demás.
* El detalle de WO del Admin trae toda la actividad sin límite.
* Cola de equipo, servicio PM y stock hacen consultas de más o filtran en memoria.
* La consulta de hallazgos de QC del Dashboard no tiene índice para su filtro.
* La web importa `lucide-react` entero; `class-validator` y `class-transformer` están en el API sin usarse.

**Cómo se trabaja**

* Tres PRs acotados, cada uno con su issue hijo: PR-A (API, PF15–PF21), PR-B (índice QC, PF22), PR-C (web y limpieza, PF23–PF26). PR-B y PR-C se abren cuando el CI de PR-A está verde.
* Cada cambio es un commit con medición antes/después; si no mejora, se revierte y se anota.
* `getAttention` (6 consultas pesadas) solo se mide en esta ronda; queda en Backlog con los números.
* Nada se mergea sin revisión de Cristian.

**Documentación**: línea base y ficha de cada cambio en `docs/reference/PERFORMANCE.md`, sección "Ronda 2026-10". `docs/OPEN_ISSUES.md` apunta a este Epic mientras haya PRs abiertos.

**Issues hijos**: PR-A [LTR-238](#ltr-238) · PR-B [LTR-239](#ltr-239) · PR-C [LTR-240](#ltr-240) · medición de getAttention [LTR-241](#ltr-241).

**Rama base local**: `perf/optimizacion-sin-demo` desde `main` 66ab98a (2026-10-17). Las ramas de cada PR toman el nombre que Linear da a su issue.

**Línea base (Fase 0)**: en curso, se completa aquí cuando el medidor termine.

---

#### Resumen de la ronda (2026-10-17) — 3 PRs abiertos, ninguno mergeado

| PR | Issue | Rama (base) | Qué | Resultado medido |
| -- | -- | -- | -- | -- |
| [lightningtransport/LTL_Shop#356](https://linear.app/ltransl/review/rendimiento-pr-a-ltr-238-la-api-deja-de-cargar-de-mas-pf15-pf16-pf17-e236d89e963b) PR-A | [LTR-238](#ltr-238) | `ltr-238` (main) | PF15 include ligero home mecánico · PF16 conteos Ready-to-Go sin cargar el tablero · PF17 QC findings dentro del `Promise.all` · PF19 team-queue en paralelo · PF20 PM service con `select` | `GET /api/work-orders` 23 → 17 queries; dashboard 141 → 113 queries, 0.069 → 0.045 s; JSON idéntico (`jq -S`) |
| [lightningtransport/LTL_Shop#357](https://linear.app/ltransl/review/rendimiento-pr-b-ltr-239-indice-para-los-hallazgos-de-qc-del-dashboard-7cab8d5a6cf6) PR-B | [LTR-239](#ltr-239) | `ltr-239` (sobre PR-A) | PF22 índice `[resolvedAt, createdAt]` en `qc_findings` (migración `20261027140000`) | EXPLAIN con 20k filas sintéticas: 1.89 → 0.49 ms, 331 → 78 buffers; revisor-riesgo: SEGURO |
| [lightningtransport/LTL_Shop#358](https://linear.app/ltransl/review/rendimiento-pr-c-ltr-240-limpieza-de-dependencias-y-exports-sin-uso-8f76a2b64632) PR-C | [LTR-240](#ltr-240) | `ltr-240` (sobre PR-B) | PF26 fuera `class-validator`/`class-transformer` y 14 exports muertos de la web | −2 deps API, −100 líneas; First Load JS sin cambio (esperado) |

**Orden de merge:** [lightningtransport/LTL_Shop#356](https://linear.app/ltransl/review/rendimiento-pr-a-ltr-238-la-api-deja-de-cargar-de-mas-pf15-pf16-pf17-e236d89e963b) → [lightningtransport/LTL_Shop#357](https://linear.app/ltransl/review/rendimiento-pr-b-ltr-239-indice-para-los-hallazgos-de-qc-del-dashboard-7cab8d5a6cf6) → [lightningtransport/LTL_Shop#358](https://linear.app/ltransl/review/rendimiento-pr-c-ltr-240-limpieza-de-dependencias-y-exports-sin-uso-8f76a2b64632) (GitHub reapunta la base al mergear el anterior). Al mergear cada uno, pasar su issue a Done.

**Descartados con razón documentada en** `docs/reference/PERFORMANCE.md`**:** PF18 (la web muestra el Activity Log completo), PF21 (`normalizeCatalogText` no se reproduce en Prisma), PF23 (`lucide-react` en `optimizePackageImports`: build byte a byte idéntico), PF13 (ya hecho en [LTR-212](#ltr-212)), PF24 (no había duplicación), PF25 (sin profiler). `getAttention` solo medido: 60 de las 141 queries del dashboard → [LTR-241](#ltr-241).

**Verificación:** unit api 682 / web 270 / shared 79, `tsc` limpio, `test:real` 32/176 en DB de prueba, Bugbot sin hallazgos en A y C, CI `test` y `flows` verdes en PR-A.

**Avisos:** (1) las 10 pruebas e2e de Chromium que fallan ya fallan en `main` (specs desactualizados), WebKit no instalado en local; (2) los checks de Vercel de la demo salen bloqueados en PRs por el Ignored Build Step, igual que en [lightningtransport/LTL_Shop#354](https://linear.app/ltransl/review/d46-ltr-229-safety-asks-the-shop-sees-safety-the-qc-is-not-assigned-b20ab49e20e9); (3) durante la medición se aplicó `prisma migrate deploy` a la DB local de desarrollo `ltl_shop` (26 migraciones que faltaban).

**Cerrado 2026-10-18.** [lightningtransport/LTL_Shop#356](https://linear.app/ltransl/review/rendimiento-pr-a-ltr-238-la-api-deja-de-cargar-de-mas-pf15-pf16-pf17-e236d89e963b), [lightningtransport/LTL_Shop#357](https://linear.app/ltransl/review/rendimiento-pr-b-ltr-239-indice-para-los-hallazgos-de-qc-del-dashboard-7cab8d5a6cf6) y [lightningtransport/LTL_Shop#358](https://linear.app/ltransl/review/rendimiento-pr-c-ltr-240-limpieza-de-dependencias-y-exports-sin-uso-8f76a2b64632) mergeados en `main` (CI verde en 2fc5c43). Migración `20261027140000_qc_findings_open_created_idx` aplicada en producción con Release safety ([run 39099373869](<https://github.com/lightningtransport/LTL_Shop/actions/runs/39099373869>)); API health 200. Queda [LTR-241](#ltr-241) (`getAttention`) en Backlog para otra ronda.

---

## LTR-238

**Rendimiento PR-A: la API deja de cargar de más (home del mecánico, Dashboard, detalle de WO, cola de equipo, PM, stock) — PF15–PF21**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** E · cosmético, Improvement
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-18 · **Padre:** LTR-237
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/356**

Parte del Epic [LTR-237](#ltr-237). Solo `apps/api/src/**`, sin cambios de esquema, misma forma de JSON en cada respuesta.

**Puntos (uno por commit, cada uno con medición antes/después):**

* **PF15** `work-orders.service.ts` `listForMechanic`: hoy usa `workOrderDetailInclude` completo para devolver resúmenes; pasa a un include de resumen. Se pollea cada 30 s en la home del mecánico.
* **PF16** `admin.service.ts` Dashboard Ready to Go: hoy carga el tablero del Yard entero para contar; pasa a una consulta de conteo.
* **PF17** `admin.service.ts` Dashboard: `openQcFindings` entra al `Promise.all` en vez de esperar después.
* **PF18** `admin.service.ts` detalle de WO: `activityLogs` acotado como ya hace el mapper del mecánico.
* **PF19** `team-queue.service.ts`: la tercera consulta secuencial pasa al lote paralelo.
* **PF20** `work-orders.service.ts` servicio PM: solo categorías PM y `select` de lo que se usa.
* **PF21** `stock.service.ts`: filtros `q` y `low` en la base, no en memoria.

Ficha de cada punto (qué, por qué, cómo se midió, antes → después, cómo revertir) en `docs/reference/PERFORMANCE.md` y como comentario aquí.

**Hecho en local (2026-10-17), rama** `cristian/ltr-238-rendimiento-pr-a-la-api-deja-de-cargar-de-mas-home-del`**, commits e491529 · 3ffa919 · 359fb9a · 65dd9a8 · e56f479 · docs e8249ae. PR** [lightningtransport/LTL_Shop#356](https://linear.app/ltransl/review/rendimiento-pr-a-ltr-238-la-api-deja-de-cargar-de-mas-pf15-pf16-pf17-e236d89e963b) **abierto, sin mergear.**

* La home del mecánico (`GET /api/work-orders`, cada 30 s) baja de 23 a 17 consultas: ya no trae notas, repuestos, stock ni llantas de cada Job para pintar un resumen (PF15).
* El Dashboard baja de 141 a 113 consultas y de 0.069 a 0.045 s: el conteo Ready to Go lee solo lo que la regla del Work Plan necesita (41 → 13 consultas, PF16) y los hallazgos de QC se piden junto con lo demás (PF17). La regla Ready to Go no cambia.
* Cola de equipo: una ida secuencial menos (PF19). Servicio PM: solo las columnas que muestra la hoja (PF20).
* Descartados con razón: PF18 (la web muestra toda la actividad) y PF21 (la búsqueda del stock normaliza acentos y puntuación; Prisma no lo reproduce).
* Verificación: 682 unit, `tsc` limpio, `test:real` 32 archivos / 176 pruebas, JSON idéntico a las respuestas doradas en cada endpoint. Bugbot sin hallazgos.
* Ficha de cada punto en `docs/reference/PERFORMANCE.md`, sección "Ronda 2026-10 (segunda)".

---

## LTR-239

**Rendimiento PR-B: índice para los hallazgos de QC del Dashboard — PF22**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** E · cosmético, API, Improvement
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-18 · **Padre:** LTR-237
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/357**

Parte del Epic [LTR-237](#ltr-237). Único cambio de esquema de la ronda; va solo para poder revertirse sin tocar código.

**PF22** `qc-findings.service.ts` filtra `QcFinding` por `resolvedAt` + `createdAt` para el Dashboard; el índice actual es `[workOrderId, resolvedAt]`. Se añade `@@index([resolvedAt, createdAt])` en `schema.prisma` con su migración Prisma, validado con `EXPLAIN` en local antes y después.

En producción se aplica solo por *Release safety*, no por el deploy de Vercel. Se abre cuando el CI de PR-A ([LTR-238](#ltr-238)) esté verde.

**Hecho en local (2026-10-17), rama** `cristian/ltr-239-rendimiento-pr-b-indice-para-los-hallazgos-de-qc-del`**, commit 03fb206 (docs 04f7f77). PR** [lightningtransport/LTL_Shop#357](https://linear.app/ltransl/review/rendimiento-pr-b-ltr-239-indice-para-los-hallazgos-de-qc-del-dashboard-7cab8d5a6cf6) **abierto sobre PR-A (**[lightningtransport/LTL_Shop#356](https://linear.app/ltransl/review/rendimiento-pr-a-ltr-238-la-api-deja-de-cargar-de-mas-pf15-pf16-pf17-e236d89e963b)**), sin mergear.**

* Nuevo `@@index([resolvedAt, createdAt])` en `QcFinding` y migración `20261027140000_qc_findings_open_created_idx`; se conserva el índice por Work Order.
* Probado con 20 000 hallazgos sintéticos en una base desechable: la consulta del Dashboard pasa de Seq Scan 1.89 ms / 331 buffers a Bitmap Index Scan 0.49 ms / 78 buffers. Con la tabla de hoy la diferencia es mínima; evita que crezca con ella.
* Revisión de riesgo: SEGURO. `CREATE INDEX` plano (como todas las migraciones del repo), bloqueo de escritura de milisegundos; sin drift; `prisma:release-status` en local al día. En producción se aplica solo por Release safety.
* Revertir: `git revert 03fb206`; en una base migrada, migración nueva con `DROP INDEX`.
* Ficha PF22 en `docs/reference/PERFORMANCE.md`.

---

## LTR-240

**Rendimiento PR-C: bundle de la web y limpieza de dependencias — PF23–PF26**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** E · cosmético, Improvement
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-18 · **Padre:** LTR-237
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/358**

Parte del Epic [LTR-237](#ltr-237). `apps/web/**`, `apps/api/package.json` y exports sin uso. Se abre cuando el CI de PR-A ([LTR-238](#ltr-238)) esté verde.

* **PF23** `next.config.js`: `lucide-react` en `optimizePackageImports` (hoy solo `radix-ui`); se compara First Load JS por ruta.
* **PF13 (pendiente de la ronda anterior)** logo del Admin servido al tamaño que se muestra, si aún no lo está.
* **PF24** Dashboard del Admin: `/admin/dashboard` y `useAdminYardDataBoundary` no duplican el trabajo del Yard en la misma pantalla.
* **PF25** `React.memo` en filas de listas grandes (tabla de Jobs, Kanban, filas del Yard) solo donde el profiler muestre re-renders por polling.
* **PF26** quitar `class-validator` y `class-transformer` del API (sin uso, el API valida con Zod) y exports muertos comprobados con grep.

Sin tocar nada de la demo (`demo-*`, `lib/demo/**`, `apps/landing`).

**Hecho en local (2026-10-17), rama** `cristian/ltr-240-rendimiento-pr-c-bundle-de-la-web-y-limpieza-de-dependencias`**, commits 98b1a4a · b67274f (docs 688dc56). PR** [lightningtransport/LTL_Shop#358](https://linear.app/ltransl/review/rendimiento-pr-c-ltr-240-limpieza-de-dependencias-y-exports-sin-uso-8f76a2b64632) **abierto sobre PR-B (**[lightningtransport/LTL_Shop#357](https://linear.app/ltransl/review/rendimiento-pr-b-ltr-239-indice-para-los-hallazgos-de-qc-del-dashboard-7cab8d5a6cf6)**), sin mergear.**

* PF26a: fuera `class-validator` y `class-transformer` del API; nada los importaba y el API valida con Zod.
* PF26b: fuera 14 exports de la web que nadie importaba (`yard-operations-routing`, `status-chips`, `job-catalog`), 100 líneas menos; comprobado símbolo a símbolo con `rg`. Tests web 271 → 270 (el caso que solo probaba uno de ellos).
* Evaluado y descartado con números: PF23 `lucide-react` en `optimizePackageImports` deja el `next build` idéntico ruta por ruta (shared 187 kB); PF13 ya estaba hecho desde [LTR-212](#ltr-212) (los tres logos declaran su tamaño); PF24 no existía (el Dashboard lee Dispatch, no el tablero del Yard); PF25 no se hace sin profiler.
* Verificación: api 682, web 270, shared 79, `tsc` limpio, Bugbot sin hallazgos. E2E con fixture: las 10 pruebas de Chromium que fallan **fallan igual en main** (specs desactualizados: admin-parts-costs ×4, admin-shell ×2, demo-mode ×2, qc-redesign, ui-consistency); WebKit no está instalado en esta máquina. `perf-feel`: PF2 2.1 s, PF4 1.6 s, PF5 2.5 s.
* Fichas en `docs/reference/PERFORMANCE.md`.

---

## LTR-242

**Completar una WO con PM cobra dos veces una parte que ya se cargó al camión (filas A133, A134)**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** B · bloquea, API, Bug
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-18
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/362, https://github.com/lightningtransport/LTL_Shop/pull/360**

**Historia:** Como Manager, cuando compro un filtro de aceite directo para un camión y el mecánico lo usa en el PM, quiero que al completar la WO el costo del camión muestre ese filtro una sola vez, para que el costo por camión y la factura interna a Finanzas (D34) sean correctos.

Regla (P29, `docs/DECISIONS.md`): las partes del PM salen del estante al completar la WO *si no se cargaron ya al camión al comprarlas*.

**Pasos (fila A133,** `apps/api/test-real/rows/parts-pm-stock.real.spec.ts`**):**

1. El PM del camión 931 está terminado; el mecánico eligió el filtro de aceite.
2. El Manager compra 2 de ese filtro **To stock** a $24.
3. El Manager compra 1 de ese filtro **directo al camión 931**, atado al Job de PM, a $30. La WO ya cuenta $30 en partes.
4. El Manager completa la WO.

**Esperado:** la WO cuenta el filtro una sola vez ($30). El estante sigue en 2.

**Actual:** la WO cuenta **$54** ($30 de la compra + $24 que sacó del estante). El estante baja a 1. El camión recibe un `stock_issue` por una parte que ya pagó.

##### Caso B: "Parts from stock" en el Job de PM (fila A134)

**Historia:** Como Manager, si ya saqué un filtro del estante al Job de PM con **Parts from stock** y el mecánico eligió el mismo filtro en el PM, quiero que al completar la WO el camión lo pague una vez y el estante baje una sola.

**Pasos:**

1. El PM del camión 931 está terminado; el mecánico eligió el filtro de aceite.
2. El Manager cuenta 3 en el estante a $24.
3. El Manager hace **Parts from stock** en el Job de PM con 1 filtro. La WO ya cuenta $24.
4. El Manager completa la WO.

**Esperado:** la WO cuenta $24 y el estante queda en 2.

**Actual:** la WO cuenta **$48** (sale otra vez del estante; el estante queda en 1).

**Causa probable:** `apps/api/src/parts-costs/pm-charges.ts` → `syncWorkOrderPmCharges` saca 1 unidad de cada parte del PM siempre que haya en el estante. No mira si esa misma parte ya se compró con destino camión para ese camión o para un Job de esa WO (caso A). Solo salta las salidas que él mismo escribió (`stock_movements` con `pmServiceId`), no una salida manual al mismo Job de PM (caso B).

**Comprobado:** `npm run test:real --workspace=@ltl-shop/api -- test-real/rows/parts-pm-stock.real.spec.ts` contra `ltl_shop_test`: A125–A127 pasan; A133 **FALLA** ("se esperaba 3000, llegó 5400"); A134 **FALLA** ("se esperaba 2400, llegó 4800"). PR: [lightningtransport/LTL_Shop#360](https://linear.app/ltransl/review/docstest-a133-pm-double-charge-ltr-242-b09922dde10f)

**Arreglo (PR 362):** al completar la WO se salta una parte del PM que el camión ya paga en el Job de PM: una línea de compra viva al camión atada a ese Job (A133) o un "Parts from stock" a ese Job (A134). Una compra al camión sin Job **no cuenta**: nada dice que fue para este PM; el Manager la ata al Job de PM cuando lo fue. Reabrir o cancelar solo deshace lo que sacó el PM. test:real completo: PASA 178 · FALLA 0.

---

## LTR-243

**Epic: Parts & costs IA v2 — Parts como inventario, cuidar el stock, un solo "Parts…" en el Job y retoques del menú (P32–P36)**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** UX, Epic
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-18
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/363, https://github.com/lightningtransport/LTL_Shop/pull/361**

#### Por qué

El dueño ve Parts & costs confuso y redundante: el Manager tiene "Count" pero no puede gestionar el stock, y las "partes del PM" parecen una cosa y Stock otra. También pidió revisar la IA de todo el panel, que cambió mucho.

La auditoría del 2026-10-18 lo confirma:

* La app guarda **una sola cosa**, la parte con su saldo en el estante.
* Pero la muestra en tres lugares ("las partes del PM", Parts, Stock), y cada uno edita la mitad.
* Count hace tres trabajos: cargar el primer día, corregir y destrabar una compra.
* No existe la historia "cuidar el stock".

#### Documentos

* Auditoría: `docs/ux-audit/admin-ia-2026-10/`. El informe es `09-informe-final.md`; el detalle está en `10-jtbd-parts-costs.md`, `05-navegacion-ia.md` y `03-contenido.md`.
* Propuesta y maqueta: `docs/proposals/parts-stock-ia-v2/` (README + `mockup.html`).
* Historia nueva: **HU-M20 · Cuidar el stock** (USER_FLOWS, propuesta). Preguntas **P32–P36** en DECISIONS.

#### Orden

1. [LTR-242](#ltr-242) (B, aparte): el PM cobra dos veces una parte.
2. Quick wins de textos y de "volver" (no esperan decisiones).
3. P32 + P33: la pantalla Parts única y las acciones de stock (HU-M20).
4. P35: un solo "Parts…" en el Job.
5. P34 + P36: retoques del menú (History → Work Orders "Closed"; "Jobs"; "Shop rates").

Lo que depende de P32–P36 **no se programa** hasta que el dueño responda. La demo sigue congelada.

---

## LTR-244

**Textos de Parts & costs que dicen lo contrario de lo que hace la app ("las partes del PM", "shop stock", "Parts → Tires", "1 parts")**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** C · confunde, UX, Improvement
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-19 · **Padre:** LTR-243
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/364**

**Como Manager**, quiero que los textos de Parts & costs digan lo que la app hace con el dinero y el stock, para no comprar ni cargar mal.

Quick win: solo cambian textos en `admin-messages-catalog.ts`, sin decisión pendiente. Detalle y textos propuestos en `docs/ux-audit/admin-ia-2026-10/03-contenido.md`:

* **UX-3-001.** Las líneas :128 y :129 presentan Parts como "The parts the PM uses…" y "These are the PM parts…". Desde ST-2 la pantalla tiene también Repair y Tires.
* **UX-3-003.** Las líneas :232, :312 y :340 dicen "No truck · shop stock", y "shop stock" mezcla To stock con Shop supplies. Propuesta: "No truck", y en la línea "Goes to: Stock · Shop supplies (not counted)".
* **UX-3-005.** La línea :42 dice "Add them in Parts → Tires", pero esa pestaña no existe.
* **UX-3-006.** "1 parts" en el total de Stock (mismo patrón que DM3).

Las líneas :194 y :366 ("PM parts are not charged on their own") **no van aquí**: van en el PR de [LTR-242](#ltr-242), porque la frase nueva tiene que ser cierta después del arreglo.

---

## LTR-245

**Volver desde un camión o una WO pierde los filtros; el breadcrumb del camión dice "Yard Operations" sin venir del Yard**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** C · confunde, UX, Bug
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-19 · **Padre:** LTR-243
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/365**

**Como Manager**, quiero que al volver de un camión o de una WO la lista siga con los filtros que tenía y el breadcrumb diga de dónde vine, para no rehacer la búsqueda varias veces al día.

Detalle en `docs/ux-audit/admin-ia-2026-10/05-navegacion-ia.md`:

* **UX-5-008 (sev. 3, observado).** En `/admin/trucks?q=9`, el enlace al camión es `?from=%2Fadmin%2Ftrucks`, sin la consulta.
  * Pasa en `admin-trucks-list.tsx:106` y en `admin-work-orders-list.tsx:151`.
  * El breadcrumb de la WO siempre apunta a la lista sin filtrar (`admin-work-order-detail.tsx:151-156`).
  * Copiar el patrón del Yard (`admin-yard-operations.tsx:82`).
* **UX-5-006.**
  * Samsara (`admin-samsara-pairing.tsx:69,142`) y QC findings (`admin-qc-findings-card.tsx:86`) no pasan `from`.
  * Dispatch (`admin-yard-data-boundary-cards.tsx:219`) sigue emitiendo `?tab=movement`.
  * Con esos tres, un origen desconocido cae en "Yard Operations" (`lib/admin-truck-origin.ts`). Debería caer en "Trucks".
* **UX-5-007.** Agregar breadcrumb a la categoría del catálogo de Jobs, a Custom Jobs to review y al perfil de People.

Las filas de prueba van en e2e (navegación), no en test:real.

---

## LTR-246

**HU-M20 · Cuidar el stock: Parts como inventario único, Count stock en lote, Add to stock y Remove from stock (D47)**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** UX, Feature
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-19 · **Padre:** LTR-243
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/367, https://github.com/lightningtransport/LTL_Shop/pull/366**

**Como Manager**, quiero cargar lo que hay en el estante el primer día, recibir partes sin factura, contar y ajustar con motivo, sacar lo dañado o perdido y fijar mínimos, todo en una sola pantalla, para que el número del estante sea el real y saber qué comprar.

**Aprobada (D47, 2026-10-18):** el dueño aceptó P32 y P33 como se recomendaban.

**Hoy:**

* Parts y Stock son el mismo objeto en dos menús, y cada uno edita la mitad (UX-10-002, UX-5-001).
* "Count" es lo único que hay, y hace tres trabajos (UX-10-001).

**Propuesta** (`docs/proposals/parts-stock-ia-v2/` §2.1–2.2, pantallas 1–6 de la maqueta). Ajustada el 2026-10-18 tras la revisión de UX/UI, que aceptó el dueño:

* **Parts** = el inventario: Type, Fits, In stock, Minimum, **una sola columna Cost** y Usual vendor.
  * Cost muestra el promedio si hay stock; si no, el de referencia en gris con "ref".
  * Los badges de Type son neutros.
  * Primero sale lo que hay en stock y lo que está Low.
* Stock sale del menú y `/admin/parts/stock` redirige. Una parte nueva sale enseguida, con 0.
* Un clic en la fila abre el **panel de la parte**: In stock, promedio y referencia explicados, **Minimum editable**, Movements con su motivo, y las acciones Add to stock, Remove from stock, Edit part y Deactivate.
* **Count stock** en lote (el botón principal):
  * una lista filtrable con un campo Counted por parte;
  * pide costo solo a lo que sube sin promedio ni referencia;
  * muestra un resumen y se guarda una sola vez;
  * en el teléfono se ve como tarjetas con − / + y objetivos de 44 px.
* **Add to stock**: llegó sin factura; pide Qty y costo de cada una.
* **Remove from stock**: pide cuántas salen y el motivo (Damaged · Lost · Other), con vista previa; ningún camión paga.
* "Adjust" se descartó: un mismo campo significaba "cuántas hay" o "cuántas salen" según el motivo.
* El modelo de datos no cambia (`Part` + `StockMovement` `adjust`, más el motivo).

**Filas de prueba:** la tabla de HU-M20 en `docs/USER_FLOWS.md`. Se escriben primero en test:real.

También entra **UX-5-011**: el selector de partes con búsqueda por nombre y número, en lugar de un select de más de 91 opciones.

---

## LTR-247

**Un solo "Parts…" en el menú del Job, con las llantas adentro (Tires from the inspection, lo que tiene, From stock, Buy for this Job) (D47)**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** UX, Feature
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-19 · **Padre:** LTR-243
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/368**

**Como Manager**, quiero ponerle partes a un Job desde una sola hoja, sin tener que saber antes si salen del estante o de una factura nueva, para no equivocarme de puerta ni cobrar dos veces.

**Aprobada (D47, 2026-10-18):** el dueño aceptó P35 y agregó que las llantas también entran ("tires es una parte").

**Hoy:** el menú del Job tiene dos puertas, Add parts invoice y Parts from stock, además de Tires to put (UX-10-004, UX-5-010). El Job del PM ofrece "Parts from stock" aunque el PM ya saca sus partes al completar la WO, que es el caso A134 de [LTR-242](#ltr-242).

**Propuesta** (`docs/proposals/parts-stock-ia-v2/` §2.3, pantallas 7–9 de la maqueta). Ajustada el 2026-10-18 tras la revisión de UX/UI:

* **On this Job:** cada parte con su origen y su costo.
  * **Return to stock** pide cuántas (puede ser 1 de 2) y por qué.
  * Una compra muestra Open purchase.
* **From stock:** Part y Qty (con etiqueta) → "2 in stock · $64.00 each" → **Take from stock**.
* **Buy for this Job:** abre New purchase con el camión y el Job ya puestos, y **al guardar vuelve a la WO**.
* **Total de la hoja:** "Parts on this Job · $X".
* **Job del PM:** muestra qué va a pasar con **cada** parte elegida antes de completar:
  * "Leaves stock · $X";
  * "Bought for this Job · not charged again";
  * "Not in stock · not charged";
  * "Oil change · flat price".

  Si una compra al camión **sin Job** tiene esa parte, avisa y ofrece **Tie it to this PM** (el caso que no cubre el arreglo de [LTR-242](#ltr-242)). From stock no lista las partes del PM ya elegidas.
* **Las llantas van dentro de la hoja, solo en el Job de llantas** (donde ST-4 deja la propuesta). Arriba sale **Tires from the inspection**: lo que propuso la inspección por posición (RF · New 11R22.5) con **Confirm**, que saca la llanta del stock como hoy. **"Tires to put" sale del menú del Job.**

---

## LTR-248

**Retoques del menú del panel: History → filtro "Closed" de Work Orders, "Jobs", "Shop rates", Internal invoices al final (P34, P36)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Improvement
- **Creado:** 2026-10-18 · **Cerrado:** 2026-10-19 · **Padre:** LTR-243
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/369**

**Como Manager**, quiero un menú donde cada nombre diga qué hay adentro y cada cosa tenga un solo lugar, para no buscar lo mismo en dos sitios.

**Aprobada (D47, 2026-10-18):** el dueño aceptó P34 (filtro Closed) y P36 ("Jobs", "Shop rates", "Stock" como única palabra).

Detalle en `docs/ux-audit/admin-ia-2026-10/05-navegacion-ia.md`, sección "Estructura propuesta". Se pasa de 21 entradas en 4 grupos a 19 en 3.

* **UX-5-004 (P34).** History lista Work Orders cerrados, y Work Orders ya filtra por estado.
  * Se propone el filtro "Closed" en Work Orders, con `/admin/history` redirigiendo.
  * Se retira el grupo Audit, que tiene un solo ítem.
  * Si el dueño quiere una bitácora de actividad, eso es otra pantalla.
* **UX-5-002 (P36).** "Job Catalog" pasa a "Jobs", porque se cruza con Parts en `/admin/parts/catalog`.
* **UX-5-003 (P36).** "Labor rate" pasa a "Shop rates", porque guarda también el precio del aceite del PM.
* **Parts & costs.** Internal invoices va al final del grupo (es mensual).
* **UX-5-005.** En español: "Panel" y "Patio" en lugar de "Operaciones" y "Operaciones del patio".
* **UX-5-009 (va con** [LTR-161](#ltr-161)).
  * Un Shop Admin de solo lectura aparece como "Shop Manager" (`admin-shell.tsx:178`).
  * El Dashboard le ofrece "Open Quality Check", que lo rebota en silencio.

---

## LTR-249

**test:real: las filas de tarifa de mano de obra (A67, A70, A71, A77) fallan según la hora del día**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** E · cosmético, Bug
- **Creado:** 2026-10-19 · **Cerrado:** 2026-10-19
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/370**

**Qué pasa:** el domingo 2026-10-18 a las 21:18 EDT (ya lunes en UTC), `labor-rate.real.spec.ts` (A70, A71, A77) y `parts-truck-costs.real.spec.ts` (A67) fallan, tanto en `origin/main` como en la rama de PR 366. La CI de main del mismo día las pasó.

**Por qué parece de fecha:** las filas usan "la tarifa de hoy" y fechas "desde". Cerca del cambio de día en UTC, "hoy" del test y "hoy" del API no coinciden.

**Fallos vistos:**

* A70: "reversa + fila nueva con la tarifa de hoy: se esperaba \[3,24000\], llegó \[3,19000\]".
* A71: "Costs dice que falta la tarifa…".
* A77: "la tarifa equivocada recalculó el WO".
* A67: "incluye la hora y media cargada".

**Arreglo esperado:** fijar el reloj o la fecha en esas filas, o usar la misma zona horaria que el API. La app no cambia.

**2026-10-19:** la misma corrida completa a otra hora (PR 368) pasó 188/0, lo que confirma que depende de la hora.

---

## LTR-250

**En el navegador del iPhone el panel se ve cortado y el menú se va de la pantalla (la PWA se ve bien)**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** B · bloquea, UX, Bug
- **Creado:** 2026-10-19 · **Cerrado:** 2026-10-19
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/371**

**Como Manager**, en el navegador del iPhone (Chrome) quiero ver el panel entero y abrir el menú, igual que en la app instalada.

**Qué pasa** (el dueño, 2026-10-19): en el navegador se ve cortado y no sale el menú; en la PWA instalada se ve mejor.

**Causa medida** (recorrido `mobile-walk` en WebKit iPhone 13, ver `docs/ux-audit/admin-mobile-2026-10/`):

* Las etiquetas `sr-only` de dentro de `main` se ubicaban contra el `body`, porque `main` no era `relative`.
* El documento medía más que la pantalla: Yard 772 px, Truck 1153 px y detalle de compra 735 px, en una pantalla de 664 px.
* En el navegador del teléfono eso hace que se desplace la página entera. El encabezado con el botón del menú se va para arriba y abajo se ve cortado.
* Además, el `body` usaba `min-h-screen` (100vh) en el navegador y 100dvh en la PWA.

**Otros hallazgos del mismo recorrido:**

* En Parts, el botón "Count stock" quedaba cortado a la derecha: las acciones de `PageHeader` no bajaban de renglón.
* Plurales: "1 Jobs", "1 jobs", "1 purchases" y "Tied 1 Jobs".
* Objetivos táctiles de menos de 44 px: pestañas del camión, prioridad de la WO, "Open", botones "…", copiar VIN y enlaces WO-xxxx.
* En People, la frase "Manager or System Admin. Open a person…" quedaba suelta.
* En Count stock, el campo vacío mostraba "—" junto al botón "−".

**Pendiente:** que el dueño lo confirme en el iPhone real, con el preview de Vercel del PR. La emulación no tiene las barras del navegador.

---

## LTR-251

**Mobile UI de mecánicos (General y PM) y Safety: toques chicos y detalles inconsistentes**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX, Bug
- **Creado:** 2026-10-19 · **Cerrado:** 2026-10-19
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/372**

Recorrido medido (skill `mobile-ui-check`, `MOBILE_WALK=field`) en WebKit iPhone 13 y Chromium móvil, con datos de `ltl_shop_test`: General (alejandro-2), Alignment (mechanic), PM (daniel) y Safety (safety-1). Detalle y capturas en `docs/ux-audit/field-mobile-2026-10/08-tecnico.md`.

**Clase C (corrige lo que se ve mal; nada se bloquea).**

Historias: el mecánico marca las partes del PM con guantes; el mecánico abre su WO desde Trucks; Safety y los mecánicos ven la misma información con el mismo formato.

* UX-F-001 · Sev 3 · PM: los 9 interruptores de "Parts used" miden 28 px y solo el interruptor se toca (`pm-service-card.tsx`).
* UX-F-002 · Sev 2 · Trucks (General y PM): "Open WO-xxx" mide 36 px (`mechanic-trucks-page.tsx`).
* UX-F-003 · Sev 2 · Report Blocker: el mismo diálogo tiene botones lado a lado en General y apilados en PM (`detail-client.tsx` vs `pm-job-detail.tsx`, que usa `DialogActions`).
* UX-F-004 · Sev 1 · PM: "Truck Information" usa el triángulo nativo de `<details>`; el WO General usa el botón con chevron.
* UX-F-005 · Sev 1 · Repair history: "Volvo | VNL 760 | 2022" con barras y el chip "ALL"/"TODOS" en mayúsculas; el resto de la app dice "2022 Volvo VNL 760" con "·" y "All".

**Sin problema (revisado):** documento vs pantalla en las apps de campo (desplazan la ventana a propósito; encabezado sticky y pestañas fijas visibles en todas), Safety (cola, devueltos, hechos, hoja de revisión), plurales, cortes a la derecha.

**Para decidir el dueño (no se toca):** mayúsculas en los botones mezcladas ("Add note" / "Add Note", "Complete job" / "Report Blocker").

---

## LTR-252

**Botones de mecánicos y Safety: solo la primera palabra con mayúscula**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** UX
- **Creado:** 2026-10-19 · **Cerrado:** 2026-10-19
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/373**

Decisión del dueño (2026-10-19), pendiente de [LTR-251](#ltr-251): los textos en inglés de las apps de campo mezclaban "Add note" / "Add Note", "Complete job" / "Report Blocker".

**Clase C.** Regla: solo la primera palabra con mayúscula, como el panel del Manager. No cambian los términos del producto (Work Order, Job, Truck, PM, Manager, Shop) ni los nombres de estado ("In Progress").

Cambios: Save notes, Work options, Start work, Report blocker, Add note, Request work, PM mechanic, My assigned work, Ready to start, View details, Resume work, View work, Finish work, PM service; también el texto que los nombra ("Use Request work in Notes", "Press Start work…", el error de la API "Start work before completing jobs."). El español no cambia. La demo está congelada y no se toca.

---

## LTR-253

**People muestra a Managers y System Admins; alta y desactivación desde la app según quién eres**

- **Estado:** Done · **Proyecto:** Setup, People & Permisos · **Etiquetas:** C · confunde, Go-live, Improvement
- **Creado:** 2026-10-19 · **Cerrado:** 2026-10-19
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/374**

**Pedido del dueño (2026-10-19), al dar de alta al grupo piloto.**

#### Qué pasa hoy

* **People solo lista al personal del taller** (Standard, PM, Safety). Los Managers y los System Admins no aparecen, así que no se pueden ver, desactivar ni quitar desde la app (decisión D31: "la lista no suma a los Shop Managers", quedó para cuando hiciera falta. Ya hace falta).
* **Dar de alta un Manager o un Admin exige SQL.** Hay que crear la cuenta en Supabase Auth, insertar la fila en `users` y **además** insertar sus permisos (`admin.access`, `yard.operations.manage`, `work_orders.manage`). Si falta este último paso, la persona entra pero no ve el Admin ni maneja Work Orders. Pasó el 2026-10-19 con Jessica, Randy, Armando y Carlos: hubo que agregarles los permisos con un segundo SQL.

#### Qué quiere el dueño

Historias:

1. Como **Manager**, en People veo también a los Managers y a los System Admins, con su tipo, para saber quién tiene acceso.
2. Como **System Admin**, puedo desactivar o quitar a un Manager desde People, igual que a un mecánico (D22/D31). **Un Manager no puede desactivar ni quitar a otro Manager** (respuesta del dueño, 2026-10-19): ve a los Managers en la lista, pero sin esas acciones.
3. Como **System Admin**, puedo crear, desactivar y quitar a otro System Admin. **Un Manager no puede tocar a un System Admin**: no ve las acciones sobre esa persona, y la API lo rechaza.
4. Al dar de alta un Manager o un Admin desde **Add person**, la app crea la cuenta con contraseña temporal (como con Safety) y le pone el paquete de permisos completo de su tipo. Nadie vuelve a usar SQL para esto.

#### Regla decidida (dueño, 2026-10-19)

* **Solo un System Admin** desactiva, quita o crea Managers y System Admins.
* **Un Manager** solo maneja al personal del taller (Standard, PM, Safety), como hoy. Ve a Managers y Admins en People, sin acciones sobre ellos; la API rechaza el intento.
* Esto reemplaza la respuesta 5 de [LTR-161](#ltr-161) ("solo crixcrox borra Managers"): ahora es cualquier System Admin.

#### Relación

* Es un primer corte de [LTR-161](#ltr-161) (modelo de roles con paquetes fijos). Este issue no cambia el modelo de permisos: solo usa los paquetes que hoy tienen las cuentas que funcionan.
* Código hoy: `apps/api/src/admin/system-admin-writes.service.ts` (solo `role: mechanic`); `apps/api/src/auth/manager-writes.guard.ts`.

---

## LTR-254

**Yard Dispatch: "Incoming Trucks" no coincide con Ninox "Truck returning" ni con el correo de Dispatch**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** Bug
- **Creado:** 2026-10-19 · **Cerrado:** 2026-10-19
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/375**

#### Qué ve el Manager

El 19 oct 2026 el Manager abrió Yard Operations → Dispatch → Incoming Trucks para saber qué camiones llegan hoy. Dispatch le mandó un correo con los camiones que llegan, y ese correo coincide con la vista **Truck returning** de Ninox. Incoming Trucks en la app **no** coincide: muestra muchos más camiones y algunas fechas distintas. El Manager no sabe en cuál confiar.

#### Comparación (producción, 19 oct 2026 \~1:55 PM)

**Ninox "Truck returning" / correo: 16 camiones**
608, 823, 836, 838, 842, 845, 866, 883, 887, 898, 903, 909, 917, 943, 967 (todos Oct 19) y 921 (Oct 25).

**App Incoming Trucks: 95 camiones**

* 30 con fecha Oct 19.
* 22 con fechas Oct 22–30.
* \~43 **sin fecha** (se muestran con "—").

Lo que coincide: 13 de los 16 aparecen en la app con Oct 19 (823, 836, 838, 842, 845, 866, 883, 887, 898, 903, 909, 917, 967).

Lo que no coincide:

1. **Camiones de más con Oct 19** (no están en Ninox ni en el correo): 614, 817, 819, 861, 863, 865, 876, 877, 881, 888, 910, 924, 927, 942, 974, 975.
2. **Camiones sin fecha**: la app los incluye en Incoming (p. ej. 277, 605, 607, 609, 611, 615, 740, 741, 743, 812…). Muchos están en el shop o Ready to Go.
3. **Fechas distintas**:
   * 608: Ninox Oct 19, app Oct 22 (está en el shop, Shop Work).
   * 943: Ninox Oct 19, app Oct 26 (está en el shop, Shop Work).
   * 921: Ninox Oct 25, app Oct 19.
4. **Orden**: 974, 975 (Oct 19) y 972 (Oct 26) salen al final de la lista, después de los que no tienen fecha.

#### De dónde sale el dato hoy

Incoming Trucks no lee Ninox. Lee el reporte `returns` de Lightning agent-reporting (`apps/api/src/admin/yard-data-boundary.ts`, `mapIncomingTrucks`):

* toma las filas de esta semana y la próxima del shop, **y también las filas sin fecha**;
* junta varias filas del mismo camión y se queda con la **fecha más temprana** (eso puede explicar 921: una fila vieja de Oct 19 le gana a la de Oct 25);
* no aplica el filtro que usa la vista "Truck returning" de Ninox.

#### Análisis con la base de Lightning (Supabase `aaqquwhdglueqlnbifvn`, 19 oct 2026 \~2:10 PM)

Leído con la llave nueva `AGENT_API_KEY_11` (solo GET). La app ya consulta esta base, no Ninox. Supabase es una **copia** de Ninox y no dice cuándo se copió por última vez.

`returns` **(lo que usa la app hoy):** 326 filas = 163 camiones (casi toda la flota, 2 filas por camión de equipo), 73 filas sin fecha. La app muestra exactamente esto. Por eso salen 30 camiones el 19 oct y los \~43 sin fecha.

* 608: Oct 22 (Ninox Oct 19) · 943: Oct 26 (Ninox Oct 19) · 921: Oct 19 (Ninox Oct 25).
* 16 camiones con Oct 19 que Ninox no tiene (614, 817, 819, 861, 863, 865, 876, 877, 881, 888, 910, 924, 927, 942, 974, 975).

`driver_pay` **(Return Date de la asignación más reciente de cada camión):** se parece más a Ninox.

* 608 Oct 19 ✓, 921 Oct 25 ✓, 614 Nov 16 y 817 Nov 2 (ya no salen hoy) ✓.
* 23 camiones con Oct 19: 14 de los 15 de Ninox + 9 de más (822, 861, 863, 876, 881, 911, 927, 942, 975).
* 943 sigue distinto: Oct 26 (Ninox Oct 19).
* No tiene filas sin fecha.

`trucks`**:** `mechanic_status` y `yard_location` (p. ej. 608, 836, 838, 943 "301 Yard · Checked In") sirven para saber si el camión ya llegó, no para la fecha de llegada.

**Conclusión:** ninguna tabla de Supabase da hoy la misma lista que la vista "Truck returning" de Ninox. `driver_pay` es la más cercana. Lo que queda distinto puede ser (a) un filtro de la vista de Ninox o (b) cambios en Ninox que todavía no llegaron a Supabase.

#### Pendiente antes de arreglar

- [ ] El owner pasa el filtro de la vista "Truck returning" de Ninox (qué filas muestra y cuáles oculta).
- [X] Leer las filas crudas de `returns`, `driver_pay` y `trucks` (hecho con `AGENT_API_KEY_11`, guardada en `apps/api/.env.production.local`).
- [ ] Saber cada cuánto se copia Ninox → Supabase y quién lo corre (¿por qué 943 dice Oct 26 en las dos tablas?).
- [ ] Proponer el arreglo (filtro igual a Ninox, no mostrar filas sin fecha, usar la fecha más reciente o la vigente) y acordarlo con el owner.

#### Cómo sabremos que funciona

Con los mismos datos del día, Incoming Trucks muestra los mismos camiones y fechas que la vista "Truck returning" de Ninox y el correo de Dispatch.

---

## LTR-257

**D49 ajuste: "In yard" por los geofences de nuestra yard; "In shop" solo con Work Order abierta**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** —
- **Creado:** 2026-10-20 · **Cerrado:** 2026-10-20
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/378**

El dueño revisó D49 en prod (2026-10-19): estar dentro del geofence no es estar en el shop.

* **Nuestra yard** = geofences Home Office (`12839282`), Lightning Transport and Logistics (`32418339`) y Lightning Transport and Logistics LLC (`39543599`).
* Dentro de la yard sin WO abierta → **In yard · since …**
* Dentro de la yard con WO abierta (created / in progress / paused) → **In shop**
* Fuera de la yard, aunque tenga WO abierta → su ubicación, como siempre.
* Trucks: filtro **Where: Anywhere / In yard / In shop**. Ficha y tarjeta del Yard con la misma etiqueta.

Sin migración (el campo `samsara_in_shop_since` pasa a significar "en la yard desde").

---

## LTR-258

**D51: Dispatch para planear la semana (por día, primero lo que pide acción); contadores de Samsara en el tablero Shop**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** —
- **Creado:** 2026-10-20 · **Cerrado:** 2026-10-20
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/379**

El dueño preguntó si la pestaña Dispatch (D50) tenía lógica y buena UX. Se hizo una maqueta con los datos reales del 2026-10-19 (`docs/proposals/yard-dispatch-plan/mockup.html`) y pidió construirla.

* Incoming Trucks y Upcoming Departures **agrupados por día**.
* Incoming: primero **Arrived · Needs a Work Order** con el botón Create WO; luego los que faltan por llegar; al final los que ya están en el shop.
* Departures: primero **Not ready · N Jobs left**; luego los listos; al final **Left**.
* El card "Where trucks are · Samsara" sale de Dispatch y pasa a **contadores en el tablero Shop** (In shop, In yard without a Work Order), que abren Trucks filtrado.
* Trucks: filtro nuevo Where: In yard without a Work Order.

---

## LTR-259

**Admin en iPad Pro 11": huecos laterales, filtros solapados y textos de maqueta**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** Bug
- **Creado:** 2026-10-20 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/380**

El owner revisa el panel Admin en un iPad Pro 11" (834×1194 vertical, 1194×834 horizontal) y aún ve:

**B — Huecos a los lados del contenido**

* Kanban del Yard con columnas fijas `lg:w-72` → espacio vacío a la derecha.
* Nuevo Work Order limitado a `max-w-2xl`.
* Detalle de Truck / Work Order / inspección: columna lateral fija de 340–360px desde `lg`; con el sidebar visible la columna principal queda en \~600px.
* Filtros con ancho fijo (`w-48/w-56/w-60`) en History, Parts catalog, Internal invoices, Labor rate, Count stock.

**C — Filtros e inputs que se montan**

* `AdminFilterToolbar` (ui.tsx) en una fila sin wrap; el buscador fija min-width; el wrapper de `Select` siempre `w-full`.
* Barras propias sin wrap: Trucks (labels `whitespace-nowrap shrink-0`), Purchases (2 selects + 2 fechas + checkbox + 2 botones en una fila), Work Orders (inline desde 68rem), Yard.

**E — Textos que suenan a maqueta**

* Subtítulos de 2–3 líneas que explican cómo funciona la pantalla; párrafos extra (`AdminWriteTip`) en Catalog y People.
* Citas a decisiones de diseño en pantalla (“(D34)” en Internal invoices).
* Lenguaje técnico: SAMSARA_API_TOKEN, Vercel, GitHub Actions, Activity Log, npm en login.

**Alcance**: solo Admin (apps de mecánico/PM/QC quedan como columna de teléfono). Textos: un subtítulo corto o ninguno, EN + ES.

**Hecho cuando**: un walk de tablet (Playwright WebKit, ambas orientaciones) en \~25 rutas Admin da 0 overflow, 0 solapes, 0 huecos >48px y 0 párrafos >120 caracteres o palabras técnicas; e2e afectados en verde.

---

## LTR-260

**Un camión en Ready to Go que ya salió de la yard sigue en el tablero, y al volver no pide Work Order**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** C · confunde, Bug
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/381**

#### Qué ve el Manager

El taller cierra la Work Order y el camión queda en **Ready to Go**. Return to Service se hace a mano cuando el camión sale (HU-M5). Si nadie lo marca:

1. Samsara ve el camión fuera de la yard y Dispatch › Upcoming Departures dice **"Left · ciudad"**, pero el tablero Shop del Yard, Trucks y el Dashboard lo siguen mostrando en **Ready to Go** con el botón Return to Service.
2. Cuando ese camión vuelve a la yard en otra visita, Dispatch › Incoming **no** lo pone en "Arrived · Needs a Work Order", y el contador "In yard without a Work Order" tampoco lo cuenta. La app cree que sigue listo para salir de la visita anterior. El camión puede esperar en la yard sin que nadie le abra trabajo.

#### Por qué pasa (código en main, e2f41a2)

`apps/web/src/lib/yard-card.ts`, `dispatchRowPlace`:

* Incoming: `needsWorkOrder = yard === 'in_yard' && !truck.readyToGo`. Un camión en Ready to Go nunca pide Work Order.
* Departures: "Left" se calcula con Samsara (fuera de la yard y su día ya llegó), pero no cambia nada del camión.
* D49 (6): la presencia de Samsara "solo informa"; no crea ni cierra Work Orders ni mueve el Kanban.

#### Qué decidir con el owner (antes de construir)

* ¿Al salir de la yard un camión en Ready to Go, la app lo pasa sola a Return to Service, o solo lo marca ("Left the yard · Return to Service") para que el Manager confirme?
* Un camión en Ready to Go que vuelve a entrar a la yard: ¿se trata como llegada nueva ("Arrived · Needs a Work Order")?

#### Cómo sabremos que funciona

* Un camión Ready to Go que Samsara ve fuera de la yard deja de verse como "listo en el taller", o pide Return to Service de forma visible en el Dashboard.
* Si vuelve a entrar a la yard sin Return to Service, aparece en "Arrived · Needs a Work Order" y en el contador "In yard without a Work Order".
* Fila nueva de test:real y unit en `yard-card.spec.ts`.

Encontrado al dibujar el recorrido completo del camión (tablero tldraw, 2026-10-21).

#### Decisión (2026-10-21, dueño) → D52

Marcar y pedir confirmar, no hacer Return to Service sola. Si vuelve a entrar, llegada nueva. Construido en PR 381 (fila test:real A152).

#### En producción (2026-10-21)

PR 381 mergeado (36c7ba0). Deploys de producción de ltl-shop-api y ltl-shop-web Ready con ese commit; /api/health responde ok. Sin migración. Sync de Samsara corrido el mismo día a las 14:01 UTC (317 vehículos, 159 camiones).

---

## LTR-261

**El Dashboard no avisa que llegó a la yard un camión sin Work Order**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** C · confunde, UX, Improvement
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/385, https://github.com/lightningtransport/LTL_Shop/pull/381**

#### Qué ve el Manager

El Dashboard es la pantalla donde el Manager ve todo lo que espera por él (D26). Cuando Samsara ve que un camión entró a la yard y el camión no tiene Work Order abierta (D49), eso solo aparece en Yard Operations: el contador "In yard without a Work Order" del tablero Shop y "Arrived · Needs a Work Order" en la pestaña Dispatch (D51).

En el Dashboard no aparece. Si el Manager trabaja desde el Dashboard y no abre Yard, el camión espera en la yard sin que nadie le abra trabajo.

#### Por qué pasa

`apps/web/src/lib/dashboard-queue.ts` cruza las salidas de Dispatch con las Work Orders abiertas ("Sale pronto y no está listo"), pero no tiene un grupo para llegadas: no mira la presencia de Samsara.

#### Propuesta (a acordar con el owner)

Un grupo nuevo en la cola del Dashboard: **"Arrived · Needs a Work Order"**, con los camiones In yard sin Work Order abierta, cuánto llevan ("in yard since 9:00 AM") y **Create WO** ahí mismo, igual que en Dispatch. Depende de cómo se cierre [LTR-256](#ltr-256) (qué hacer con los camiones que Dispatch tiene en "301 Yard").

#### Cómo sabremos que funciona

* Un camión que entra a la yard sin Work Order aparece en el Dashboard en el siguiente sync (hasta 1 h).
* Al tocar Create WO, la Work Order se crea y el camión sale del grupo.
* Unit en `dashboard-queue.spec.ts` y e2e del Dashboard.

Encontrado al dibujar el recorrido completo del camión (tablero tldraw, 2026-10-21).

---

## LTR-263

**Mecánicos en iPad se ven como teléfono y ven el tiempo que llevan**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** C · confunde, UX, Improvement
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/383**

Reportado por el dueño en iPad Pro 11" (2026-10-21).

1. Las apps de mecánico (General y PM) en iPad se ven en una columna de teléfono (576px). Debe usar el ancho: listas en 2 columnas desde 768px; en la página del camión, Jobs a la izquierda y Notas / Otro trabajo / Información del camión a la derecha. Teléfonos sin cambio. Reemplaza UX-4-008.
2. Los mecánicos no deben ver cuánto tiempo llevan: "since 9:03 AM", "Clock running", "Your time 0m running", "Started 9:03 AM". Solo qué trabajo está activo ("Working on Truck 609", "Active"). El reloj sigue midiendo por detrás para el labor (D34). "waiting 7 d" del PM se queda (es lo que espera el camión).

Decisión D54 (PR 383).

---

## LTR-264

**En iPad las fechas se montan sobre el campo de al lado y el checkbox se ve distinto**

- **Estado:** Done · **Proyecto:** Parts, Costs & Finance · **Etiquetas:** C · confunde, UX, Bug
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/383**

Reportado por el dueño en iPad Pro 11" (2026-10-21), después de [LTR-259](#ltr-259).

* Outside repairs y Purchases: en los filtros, From y To quedan pegados; "Without invoice file" sale como un cuadrado negro distinto al resto.
* New outside repair y New purchase: Invoice date se monta sobre Invoice #.

Causa: Safari en iOS le da al campo de fecha un ancho mínimo propio y la celda no lo deja encoger. Mismo riesgo en History (datetime-local), Internal invoices (mes) y Labor rate.

---

## LTR-265

**Los Jobs de llantas de la inspección no dicen qué llanta ni por qué, y deben ir al mecánico de Alignment**

- **Estado:** Done · **Proyecto:** Trucks & Inspección · **Etiquetas:** C · confunde, API, Feature
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/383**

Reportado por el dueño (2026-10-21).

1. Cuando la inspección encuentra llantas malas, el mecánico que recibe Tires o Flat Repair no ve qué posición ni por qué (presión o tread). La API guarda la lectura pero no se la manda al mecánico. Debe ver por ejemplo "RF · 72 PSI (should be 110) · low pressure" y "LRO · tread 3/32 (min 4) · worn".
2. El cambio de llantas lo hace el mecánico de Alignment (en su área está la máquina de llantas y alinea de paso). Tires y Flat Repair de una inspección vienen ya puestos al equipo de Alignment (una persona: a él; varias: a la cola de Alignment). El Manager lo puede cambiar al guardar. Si inspecciona un mecánico, también van a Alignment en vez de quedar sin dueño (cambia D41 punto 4 solo para llantas).

Decisión D54 (PR 383).

---

## LTR-266

**En la TV del taller el tablero del Yard no se ve completo: pide scroll de lado y hacia abajo**

- **Estado:** Done · **Proyecto:** Yard · **Etiquetas:** B · bloquea, UX, Improvement
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/382**

**Qué pasa:** el Manager abre el Yard → **Full screen** (la pestaña con solo el tablero) → **Full screen (TV)** para dejarlo en la TV del taller y que todos lo vean. En una TV de 1920 px las 8 columnas (Inspection … Ready to Go) miden 288 px cada una: necesitan 2,388 px y solo caben 1,872. Ready to Go y parte de Quality Check quedan fuera, y en la TV no hay cómo hacer scroll. Si una columna tiene más camiones que su alto, los de abajo tampoco se ven.

**Qué debe pasar (dueño, 2026-10-21):** solo en la pestaña Full screen (`?display=board`):

* Las 8 columnas se reparten el ancho de la pantalla. Nada de scroll de lado.
* Si una columna se llena, sus tarjetas se hacen compactas para que entren sin scroll hacia abajo.
* El Yard normal dentro de la app no cambia (columnas tipo Trello de 288 px con scroll lateral, D33).

**Decisión:** D53 en `docs/DECISIONS.md` (era D52; ese número quedó para [LTR-260](#ltr-260), que entró antes a main).

---

## LTR-271

**Mecánicos en iPad: franjas vacías a los lados y una tarjeta sola ocupa media fila**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** C · confunde, UX, Bug
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/386**

**Qué ve el dueño (iPad, 2026-10-21 11:30, después de PR 383 en prod):** en My work del mecánico quedan franjas vacías a la izquierda y derecha del encabezado, de las pestañas y de la lista "Waiting on Manager", y la única tarjeta de In Progress (Truck 609) ocupa media fila con la otra mitad vacía. Se ve roto.

**Por qué:**

* Safari en el iPad dibuja la página a \~980 px de ancho (modo "sitio de escritorio", el que trae por defecto), no a 834. El recorrido de iPad solo probaba 834×1194 y 1194×834.
* A 980 px aplica `md` y `.app-shell-wide` limita la página a 48rem (768 px): \~105 px vacíos a cada lado. `lg` (72rem) empieza recién en 1024 px.
* Las tarjetas van siempre de a dos desde `md` (`md:grid-cols-2`), así que una sola queda en media fila.

**Qué debe pasar (D54, agregado):** en cualquier iPad, vertical u horizontal y en cualquier modo de Safari, todas las pantallas de mecánico (General y PM: inicio, Trucks, Completed, Request work, Inspection, Work Order, Truck) usan el ancho con márgenes normales, y una tarjeta sola en su fila ocupa la fila entera.

**Cómo se comprueba:** el recorrido de iPad suma el modo escritorio (980 px), todas las pantallas de mecánico y una medida nueva "tarjeta sola en media fila".

---

## LTR-272

**Safety (Quality Check) en iPad se ve como teléfono: columna angosta con franjas vacías**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** C · confunde, UX, Improvement
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/387**

**Qué ve el dueño (iPad, 2026-10-21 12:15):** entra como Safety (QC) y Quality Check sale en la columna de teléfono (36rem) con franjas vacías a los lados, como estaban los mecánicos antes de [LTR-271](#ltr-271).

**Por qué:** D54 dejó a Safety (`/qc`) en columna de teléfono a propósito ("login, reset y Safety quedan en columna de teléfono"). El dueño ahora lo quiere igual que los mecánicos: es otra cosa decidida, no un error del código.

**Qué debe pasar (D54, agregado):** en iPad, Quality Check (To review, Returned, Done) usa el ancho como las pantallas de mecánico: sin tope, márgenes normales, tarjetas de a dos (una sola ocupa la fila) y botones de tamaño normal a la derecha. La hoja de revisión sigue como panel lateral. En el teléfono, igual que hoy. Login y reset siguen angostos.

**Cómo se comprueba:** el recorrido de iPad suma `/qc` (To review, Returned, Done) en 834, 980 (modo escritorio de Safari) y 1194 px.

---

## LTR-273

**Docs desalineados tras D49–D54: PRD, sistema de diseño, nombres de menú, IA y recorrido del camión**

- **Estado:** Done · **Proyecto:** LTL Shop · **Etiquetas:** C · confunde, Docs
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/388**

Clase **C** (confunde). Revisión 2026-10-21 contra origin/main 875781c.

* PRD.md llega hasta D51: faltan D52, D53, D54, [LTR-261](#ltr-261); §4.4 dice mecánicos "en el teléfono" (son teléfono o tablet, PWA); §7 tiene la geocerca en "Después".
* SYSTEM.md fila Dashboard sin el grupo "Arrived · Needs a Work Order" ([LTR-261](#ltr-261)); USER_FLOWS sin Full screen / TV (D53).
* Nombres de menú viejos: Mecánicos → People, Job Catalog → Jobs, Labor rate → Shop rates.
* OPEN_ISSUES todavía lista [LTR-266](#ltr-266) (hecho).
* docs/design-system no se tocó en PRs 377–386: componentes nuevos, glosario (In shop, In yard, Dispatch…), regla "nunca decir in yard", tamaños de títulos, shells de mecánicos en tablet/PWA.
* Falta mapa de IA vigente y README del recorrido del camión y de yard-dispatch-plan.
* Propuestas con estado viejo (samsara-trucks P13, safety-qc-findings), GO_LIVE_CHECKLIST del 10-14, D45 dice "propuesta".
* Matriz test-real: A152 repetido (fila D52 debe ser A150).

Se arregla en un solo PR de docs.

---

## LTR-274

**Textos de UI de menos de 12px y colores fijos fuera de tokens**

- **Estado:** Done · **Proyecto:** Plataforma y Go-live · **Etiquetas:** E · cosmético, UX
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/390**

Clase **E** (cosmético). El sistema de diseño dice "nada bajo 12px" y colores solo por token.

* `text-[11px]`/`text-[10px]` en `apps/web/src/components/admin-stock-actions.tsx:112,117` y `inspection-sheet.tsx:764` (demo-panel queda fuera: demo congelada).
* `bg-[#0f1a33]` en `login-loader.tsx:61`.
* \~42 valores `[Npx]` arbitrarios (inspection-sheet, admin-work-order-detail, admin-truck-work-plan, admin-truck-detail).

Importa en teléfono, donde los mecánicos usan la PWA.

**Ampliado 2026-10-21 (reporte del dueño en iPad, modo oscuro):** botones de las tarjetas de mecánico, PM y Safety que no ocupan el ancho (224 px a la derecha, [LTR-271](#ltr-271)) y "View" en ghost que se lee como texto; bordes de outline/secondary con --border (1.2:1 en oscuro). Se arregla en el mismo PR.

---

## LTR-275

**En la tablet la app dice "Kept on this phone" / "este teléfono"**

- **Estado:** Done · **Proyecto:** Mecánicos · **Etiquetas:** E · cosmético, UX
- **Creado:** 2026-10-21 · **Cerrado:** 2026-10-21
- **Adjuntos: https://github.com/lightningtransport/LTL_Shop/pull/389**

Clase **E**. Los mecánicos usan la app (PWA) en teléfono **o tablet**, pero 10 textos dicen "phone"/"teléfono": `apps/web/src/lib/locale-context.tsx` (notesKeptHint, pmOnPhone, offlineKeptOnPhone, pmKeptOnPhone… 8) y `inspection-copy.ts` (2, "se guarda en este teléfono"). Visto en el recorrido de tablet de [LTR-273](#ltr-273) (Work Order del mecánico, iPad modo escritorio).

Propuesta: "this device" / "este equipo" (o "aquí"), EN y ES.

