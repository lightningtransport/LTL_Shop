# Plan de desarrollo incremental y backward-compatible

> ⚠️ HISTORICAL DOCUMENT
> This document is preserved for historical/reference purposes and is not current product authority.
> See `docs/LIGHTNING_SHOP_MASTER_PRD.md`.

## Principios de entrega

- Un PR por capacidad coherente; migraciones y UI expansivas no se mezclan sin necesidad.
- Cambios aditivos antes de retirar campos/validaciones legacy.
- API y base de datos son autoridad; no mover reglas al navegador.
- Prisma en `apps/api/prisma/migrations` es la única fuente de migraciones.
- No tocar PM como efecto colateral de Standard multicategoría.
- No publicar métricas sin procedencia o tiempos por Job inventados.
- Toda fase debe tener rollback, tests Standard/PM/Admin y verificación móvil.

## Fase 0 — Auditoría y ADR

Objetivo: verificar el checkout, no asumir que los adjuntos siguen actuales.

Entregables:

- inventario de schema, enums/DTOs, servicios, rutas, validaciones y tests;
- matriz “documentado vs implementado”;
- ubicación exacta de la restricción single-category (web, shared, API, DB);
- inventario PM y capability checks;
- ADR que aprueba el modelo Work Order -> Jobs multicategoría;
- baseline de tests, CI, Preview y producción sin escribir datos reales.

Estado: completada documentalmente en
[`../audits/WORK_ORDER_MULTICATEGORY_AUDIT_2026-09-09.md`](../audits/WORK_ORDER_MULTICATEGORY_AUDIT_2026-09-09.md).
No existe constraint DB que obligue la igualdad de Categories; la restricción
CURRENT está en API y web.

Gate: cumplido para planificar contratos; cualquier verificación de datos
reales pendiente debe ejecutarse antes de una migración destructiva.

## Fase 1 — Contrato multicategoría, sin cambiar UX

Estado: **CURRENT**. Los lectores y contratos exponen Category por Job sin
retirar `primaryCategoryId`; los lectores legacy siguen siendo compatibles.

Objetivo: hacer explícita la Category de cada Job en contratos y lecturas preservando clientes existentes.

- Confirmar/reusar `WorkOrderJob.categoryId`.
- Mantener `WorkOrder.primaryCategoryId` requerido mientras existan consumidores legacy.
- Incluir `category` por Job en DTOs sin remover campos actuales.
- Mantener respuestas y rutas existentes.
- Añadir fixtures/tests con una WO legacy de una Category y una target multicategoría.

Gate: mismos flujos visibles; Standard y PM continúan pasando.

## Fase 2 — API autoriza Jobs de otras Categories

Estado: **CURRENT**. Standard valida Category/Catalog Job activos y su relación
en servidor; Add Job conserva versión, idempotencia, deduplicación, transacción
y Activity Log. PM continúa excluido del flujo Standard.

Objetivo: remover solo la validación de igualdad entre Job Category y primaryCategory.

- Validar que cada Category y Catalog Job existan/estén activos.
- Validar que el Catalog Job pertenezca a la Category declarada.
- Mantener deduplicación a nivel Work Order por Catalog Job y Custom name normalizado.
- Mantener version/idempotency y transacción.
- Registrar `JOB_ADDED` con Category y actor.
- No cambiar Start/Pause/Resume/Complete.
- Feature flag o despliegue compatible si clientes antiguos pueden coexistir.

Gate: API tests de autorización, duplicados, concurrencia, Activity Log y finalización pendiente.

## Fase 3 — UX Standard multicategoría

Estado: **CURRENT**. Standard permite crear y agregar Jobs de Categories no-PM
distintas. Cambiar la Category primaria no elimina Jobs. E2E cubre creación a
390×844 y preservación a 320×568 en Chromium y WebKit; la suite PM sigue
separada. El smoke con una sesión de producción sigue pendiente porque los
aliases están protegidos por Vercel SSO.

Objetivo: crear/agregar Jobs por Category de manera clara.

- Creación: primary Category sigue siendo el primer filtro; Jobs seleccionados se agrupan por Category.
- `Add Job`: primero elegir/buscar Category, luego Catalog Job; Custom Job requiere Category.
- Cambiar primary Category no debe borrar Jobs silenciosamente; pedir confirmación solo si la operación realmente los eliminará.
- Mostrar progreso total y grupos por Category.
- Preservar 44 px targets, estados localizados, foco, errores cercanos y el Design System vigente.
- Cache: reutilizar categorías/catálogo acotados, evitar waterfalls e invalidar solo recursos relacionados.

Gate: E2E en 390×844 y 320×568; creación, add, duplicate, pause, resume, complete y error rollback.

## Fase 4 — Read-only Truck Detail

Estado: **CURRENT** en el alcance de Yard Operations Phase 1. No repetir esta
implementación dentro del trabajo multicategoría; solo adaptar sus lectores para
mostrar Category por Job.

Objetivo: consolidar el Truck sin agregar mutaciones de readiness.

- Ruta Admin `/admin/trucks/[id]` y contrato Admin separado.
- Identidad del Truck, WO abierta, Jobs agrupados por Category e historial paginado.
- Mostrar únicamente Presence/Operational/Readiness cuando la fuente sea real y etiquetada; en otro caso `Unknown`/Unavailable.
- No mostrar Job labor, Average Downtime ni falsas predicciones.

Gate: paginación estable, RBAC, empty/error/retry, performance dentro de presupuesto.

## Fase 5 — Yard Operations read-only

Estado: **CURRENT** en Phase 1, con Presence `UNKNOWN` y feeds de movimientos
externos explícitamente unavailable.

Objetivo: board/table accionable con datos demostrables.

- Lista/table primero; Kanban como vista alterna si aporta movimiento entre fases.
- Fase derivada con explicación y source/freshness.
- Blockers derivados de Jobs/pausas/WO.
- Filtros por Presence, phase, readiness, priority y blocker.
- Sin drag-and-drop mutante hasta definir permisos y concurrencia.

Gate: cada card/fila explica de qué datos sale su estado; no hay valores inventados.

## Fase 6 — Readiness y eventos operacionales

Estado: **CURRENT** para assessments, requirements, aprobación Ready,
concurrencia, idempotencia y auditoría de Phase 1. `Returned to Service` y un
Operational Status canónico siguen DEFERRED.

Objetivo: separar cierre de WO de disponibilidad del Truck.

- Diseñar eventos canónicos y append-only para cambios operacionales/readiness.
- Readiness inicial con checks explícitos y override autorizado, razón obligatoria y Activity Log.
- Mantener `Return to Service` como acción separada y auditable.
- Conflictos de versión devuelven 409; retry idempotente no duplica eventos.

Gate: reglas aprobadas por operación con ejemplos reales y rollback.

## Fase 7 — Integraciones, solo con contrato aprobado

- Samsara: geofence para Presence con timestamp/frescura; no inferir departures.
- Dispatch/McLeod/manual planning: fuente potencial para Incoming/Outgoing.
- Ninox: inventario y reconciliación antes de import/retirement; no dual-write improvisado.

## Validación por cada PR

1. Construir shared antes de typecheck/build de consumidores.
2. Lint y tests de shared/API/web.
3. Tests E2E relevantes, incluyendo PM.
4. `git diff --check` y revisión de migración.
5. Staging con Prisma migrate deploy y `AUTH_DEV_BYPASS=false`.
6. Smoke: login -> create Standard -> Start -> add/complete -> pause/resume -> finish.
7. Smoke PM: autorización, create/start atómico, mileage, parts, pause/finish.
8. CI y ambos Vercel deployments verdes antes de merge.
9. Producción: smoke acotado y plan de rollback a deployment anterior.

[Fuentes: `CURRENT_PRODUCT_STATUS.md`, “Verification baseline”; `ENGINEERING_PRACTICES.md`, “Required verification”; `DEPLOY.md`; `README.md`, “Tests/Deploy”.]

## Performance y seguridad

Targets P75: app usable <2 s, navegación autenticada <1 s, API warm <500 ms. Medir antes de añadir índices o cambiar arquitectura. No usar escrituras de producción para performance testing; no registrar JWTs, secretos, bodies sensibles ni URLs con credenciales. [Fuentes: `ENGINEERING_PRACTICES.md`, §§Performance budgets, Measure, API; `PERFORMANCE.md`, “Targets (P75)”.]

## Definition of Done global

La evolución termina solo cuando documentos canónicos, schema, contratos, UI y tests expresen el mismo modelo; los registros legacy sigan legibles; Standard y PM no tengan regresiones; no haya data loss; y Readiness permanezca separado de Work Order completion.
