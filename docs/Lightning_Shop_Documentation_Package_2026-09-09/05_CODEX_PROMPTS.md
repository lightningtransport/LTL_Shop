# Prompts listos para Codex

> ⚠️ DEPRECATED
> Do not use this document for new implementation decisions.
> See `docs/LIGHTNING_SHOP_MASTER_PRD.md`.

Usar en orden. Reemplazar solo los valores entre corchetes. No combinar auditoría e implementación en una sola ejecución.

## Prompt 1 — Auditoría previa sin cambios

```text
Trabaja en el repositorio Lightning Shop ubicado en [RUTA]. Esta tarea es únicamente de auditoría read-only: no edites archivos, no crees migraciones, no hagas commits, push, deploy ni mutaciones externas.

Lee primero:
- README.md
- docs/CURRENT_PRODUCT_STATUS.md
- docs/SHOP_ADMIN_INTEGRATION_BLUEPRINT.md
- docs/PRD_Lightning_Shop_Mechanic_P0.md (o el nombre equivalente)
- docs/ENGINEERING_PRACTICES.md
- docs/PERFORMANCE.md
- DEPLOY.md
- docs/pm-daniel.md
- el paquete nuevo 00_INDEX.md a 06_FLEETIO_BENCHMARK_AND_SCOPE_FILTER.md

Después inspecciona el código real: schema y migraciones Prisma, shared enums/types/Zod, servicios/controllers Work Orders y Trucks, auth/capabilities, UI Standard y PM, Admin, tests y configuración de deploy.

Objetivo: verificar si el checkout actual puede evolucionar de una Category bloqueada por Work Order a Categories por Job, preservando todas las reglas Standard y PM.

Entrega un informe con:
1. branch, git status y alcance inspeccionado;
2. matriz documento -> implementación con archivo/línea/prueba;
3. ubicación exacta de cada restricción single-category (DB/API/shared/web/tests);
4. estado real de WorkOrder.primaryCategoryId y WorkOrderJob.categoryId;
5. reglas y código PM que deben aislarse;
6. contratos/consumidores afectados, incluidos Admin, history y reports;
7. riesgos de data migration, concurrencia, idempotencia, ActivityLog y rollback;
8. propuesta de fases/PRs mínimos;
9. preguntas que requieran decisión humana.

No inventes estados, integraciones ni datos. Distingue CURRENT, LOCKED, TARGET y DEFERRED. Si el código contradice los documentos nuevos, reporta la contradicción; no la resuelvas silenciosamente. Ejecuta checks read-only razonables y declara cualquier validación que no pudiste realizar.
```

## Prompt 2 — Actualización de documentación

```text
Trabaja en [RUTA] después de que la auditoría previa haya sido revisada. Actualiza únicamente documentación; no cambies schema, API, UI, tests funcionales ni configuración de deploy.

Fuentes obligatorias: README.md, CURRENT_PRODUCT_STATUS.md, SHOP_ADMIN_INTEGRATION_BLUEPRINT.md, PRD_Lightning_Shop_Mechanic_P0.md, ENGINEERING_PRACTICES.md, PERFORMANCE.md, DEPLOY.md, pm-daniel.md, el paquete 00_INDEX.md–06_FLEETIO_BENCHMARK_AND_SCOPE_FILTER.md y el informe de auditoría [RUTA_INFORME].

Objetivo: integrar de forma coherente la dirección aprobada:
- Work Order = intervención completa de un Truck;
- cada Job posee su Category y una WO puede mezclar Categories;
- Yard Phase no es Category ni crea otra WO;
- una nueva WO corresponde a un nuevo evento de servicio;
- una WO abierta por Truck continúa vigente inicialmente;
- Standard Create != Start; PM sigue siendo excepción especializada bajo mechanic.pm;
- completar Job != completar WO;
- WO Completed != Ready to Go/Returned to Service;
- timers/asignaciones por Job, rules engine e integraciones no confirmadas permanecen diferidos.

Antes de editar, enumera archivos y secciones propuestas. Conserva historia útil: marca el single-category actual como CURRENT/legacy y el modelo nuevo como TARGET hasta implementarlo. No declares implementado lo que solo está planeado. Resuelve referencias obsoletas a pmAuthorized como autoridad: mechanic.pm es la capability vigente y pmAuthorized es compatibilidad temporal.

Entrega un PR documental pequeño y revisable. Ejecuta validación de links/Markdown disponible y git diff --check. En el resumen indica archivos cambiados, contradicciones resueltas, decisiones aún abiertas y checks ejecutados. No hagas merge.
```

## Prompt 3 — Implementación por fases

```text
Implementa solamente la fase [NOMBRE/NUMERO] del plan aprobado en [RUTA_PLAN]. No adelantes Yard Operations, Readiness, timers por Job, assignments por Job, múltiples WOs abiertas ni eliminación de primaryCategoryId si no pertenecen explícitamente a esta fase.

Antes de editar:
1. confirma Git root, branch, status y cambios ajenos;
2. lee la documentación canónica y el informe de auditoría;
3. resume las invariantes que preservarás;
4. identifica archivos, migración aditiva si aplica, tests y rollback;
5. detente si falta una decisión que pueda alterar datos o el dominio.

Invariantes obligatorias:
- una WO abierta por Truck;
- Standard requiere >=1 Job, Create != Start y duplicate protection;
- completar Job no pausa/completa WO;
- finalizar exige Jobs requeridos resueltos;
- WorkSession/PauseEvent/MechanicAssignment siguen a nivel WO;
- PM no recibe el formulario o validaciones Standard y mantiene mechanic.pm, create/start atómico, mileage, parts/fitment y finalización propia;
- Category del Catalog Job se valida en servidor;
- ActivityLog, version, idempotency y 409 se preservan;
- Prisma es la única autoridad de migraciones;
- no data loss ni DELETE de historia.

Implementa de forma backward-compatible: contratos aditivos, lectores compatibles con legacy y despliegue de backend antes del cliente cuando corresponda. Si deshabilitas creación multicategoría en rollback, los lectores deben seguir mostrando datos multicategoría existentes.

Verifica según riesgo: shared, API, web, E2E Standard y PM, mobile 390x844 y 320x568, build y git diff --check. Respeta los budgets P75 y las reglas de caché/invalidation. No uses producción para escrituras o performance tests.

Al terminar, entrega: resultado, archivos/migraciones, tests con resultados, limitaciones, rollback, y evidencia de que PM y legacy siguen funcionando. Crea un commit y PR scoped solo si esa es la política/autorización de esta tarea; nunca hagas merge automáticamente.
```

## Regla para fases siguientes

No reutilizar el Prompt 3 diciendo “implementa todo”. Ejecutarlo una vez por fase/PR, adjuntando el resultado de la anterior y exigiendo que Codex vuelva a verificar el checkout porque el estado puede haber cambiado.
