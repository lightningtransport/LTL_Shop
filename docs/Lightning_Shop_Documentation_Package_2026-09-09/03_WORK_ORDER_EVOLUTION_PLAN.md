# Migración: una Category por Work Order → Categories por Job

## Estado inicial, destino y estado implementado

```text
AUDIT / LEGACY (histórico)
Work Order(primaryCategory)
└── Jobs restringidos a primaryCategory

TARGET IMPLEMENTADO / CURRENT
Work Order(primaryCategory compatible/legacy)
├── Job(category A)
├── Job(category B)
└── Job(category C)
```

No se requiere crear otra Work Order cuando se descubre trabajo de otra Category durante la misma intervención.

Standard permite Categories no-PM distintas por Job en Create y Add Job.
`primaryCategoryId` permanece requerido como Initial/Primary Category; no se
elimina ni se convierte a nullable en esta iniciativa. La evidencia de UI cubre
creación a 390×844 y preservación de Jobs a 320×568 en Chromium y WebKit. Un
smoke con sesión de producción sigue pendiente detrás de Vercel SSO.

## Invariantes a preservar

- una WO abierta por Truck;
- Standard requiere Jobs y no inicia hasta `Start Work`;
- PM conserva su flujo y requisitos propios;
- duplicate protection;
- timers, Pause Events y Mechanic Assignments permanecen a nivel WO;
- todos los Jobs requeridos deben resolverse antes de completar;
- Activity Log, version e idempotency;
- historial inmutable y soft state en vez de borrado físico.

## Paso 1 — Descubrimiento técnico

Codex debe localizar con referencias exactas:

- `primaryCategoryId` y `categoryId` en Prisma;
- índices/constraints/checks/triggers;
- Zod/DTOs y enums compartidos;
- validación de create y add-job en servicio/API;
- filtros/pickers y agrupación en web;
- tests que afirman single-category;
- serialización/historial/reportes que solo leen primary Category;
- código PM compartido accidentalmente con Standard.

Resultado: mapa de impacto antes de editar.

## Paso 2 — Migración de datos aditiva

Si `WorkOrderJob.categoryId` ya es obligatorio y correcto, no inventar un backfill. Verificar consistencia con consultas read-only.

Si faltan Categories en Jobs legacy:

1. añadir columna nullable;
2. backfill desde Catalog Job cuando exista;
3. solo como fallback documentado, usar `WorkOrder.primaryCategoryId`;
4. reportar Custom/unknown sin mapping;
5. reconciliar conteos y muestras;
6. hacer NOT NULL únicamente cuando cero filas inválidas sea demostrable.

Nunca sobrescribir silenciosamente una Category contradictoria. Conservar evidencia y generar reporte.

## Paso 3 — Compatibilidad de contratos

- Mantener `primaryCategory` en requests/responses actuales.
- Añadir Category a cada Job de manera aditiva.
- Clientes legacy que envían solo Jobs de primary Category continúan funcionando.
- Para Catalog Job, el servidor deriva/verifica Category contra catálogo; no confiar en combinaciones arbitrarias del cliente.
- Para Custom Job, Category es obligatoria.
- `primaryCategoryId` permanece requerido como Initial/Primary Category.
- Repair History filtra por cualquier Job Category y conserva el primary field
  como compatibilidad de presentación mientras los consumidores migran.
- No reutilizar `primaryCategory` como Category implícita en nuevos clientes salvo compatibilidad declarada.

## Paso 4 — Cambio de validación (CURRENT)

Se retiró exclusivamente la regla:

```text
job.categoryId MUST equal workOrder.primaryCategoryId
```

Conservar:

```text
job.categoryId exists and is active
catalogJob.categoryId equals submitted/resolved job.categoryId
catalogJobId is not duplicated in this Work Order
normalized Custom Job name is not duplicated in this Work Order
Work Order is open and mutation is authorized
expected version and idempotency rules pass
```

Catalog Jobs distintos pueden compartir display name normalizado; el nombre no
debe colapsar IDs canónicos diferentes. Un Category/Catalog Job inactivo puede
aparecer en historia, pero no se acepta en Create/Add Job. Standard rechaza PM
como Category incluso para usuarios multi-workspace; PM usa su flujo propio.

Agregar Job no reinicia timer, no reanuda una WO pausada y no cambia automáticamente la Yard Phase.

## Paso 5 — UI gradual

1. Renderizar Jobs agrupados por Category sin cambiar mutaciones.
2. Habilitar multicategoría al agregar Job en WO existente.
3. Habilitar selección multicategoría durante creación.
4. Revisar labels de primary Category para evitar comunicar que limita la orden; puede mostrarse como “Primary Category”/“Initial Category”.

No retirar `primaryCategoryId` en esta iniciativa. Su eliminación o conversión a nullable requiere auditoría de todos los filtros, reportes e integraciones.

## PM: aislamiento obligatorio

PM actualmente crea una WO ya iniciada sin Category, Jobs, collaborators, priority o creation-notes form; finaliza con mileage observado y al menos una part seleccionada. Por tanto:

- excluir el endpoint/servicio PM de la nueva obligación de Jobs Standard;
- no añadir Category picker Standard al workspace PM;
- no convertir parts a Jobs;
- no cambiar capability `mechanic.pm`;
- probar un usuario PM-only y uno multi-workspace;
- conservar la auditoría de mileage y records PM completados read-only.

## Matriz mínima de pruebas

| Caso | Resultado |
| --- | --- |
| WO legacy una Category | se lee y opera igual |
| Create Standard con Jobs misma Category | éxito |
| Create Standard con Jobs A+B | éxito target |
| Add Job B a WO primary A | éxito target, Activity Log |
| Catalog Job con Category falsa | 4xx, sin escritura |
| Catalog Job duplicado entre grupos | rechazado |
| Custom Job normalizado duplicado | rechazado |
| Complete WO con Job B pendiente | bloqueado |
| Complete Job | WO sigue abierta |
| Add Job con versión stale | 409 |
| Retry misma idempotency key | no duplica |
| PM create/finish | sin cambio |
| Admin read/history | muestra Category por Job |

## Observabilidad, rollout y rollback

- Medir errores 4xx/409/5xx y latencia del endpoint add/create sin datos sensibles.
- Desplegar contratos/lecturas antes que el nuevo cliente.
- Si se usa flag, el rollback deshabilita creación multicategoría pero sigue leyendo datos ya creados.
- Nunca hacer rollback destruyendo Jobs de otras Categories.
- Preservar el advisory lock transaccional por Truck y la validación de
  actor/payload en Create. Add Job conserva `expectedVersion` e
  `idempotencyKey`.
- Antes de retirar compatibilidad, confirmar que todos los clientes y reportes consumen Category por Job.

## No incluido

Timers por Job, múltiples Mechanics por Job, nuevas fases, Readiness, múltiples WOs abiertas, eliminación de primary Category y un módulo separado de Issues/Reported Problems. Cada tema requiere su propia decisión y PR. La separación conceptual problema -> Jobs puede expresarse primero con los campos actuales; no debe bloquear la migración multicategoría ni provocar nuevas tablas.
