# Lightning Shop — paquete de dirección de producto y evolución

Estado: dirección aprobada; implementación multicategoría pendiente
Fecha: 2026-09-09
Idioma normativo: los términos `Truck`, `Work Order` y `Job` se mantienen canónicos.

## Propósito

Este paquete estabiliza la dirección de producto antes de modificar código. Reconciliamos dos hechos:

1. El producto actual implementa una Work Order estándar limitada a una sola Category.
2. El modelo de negocio objetivo define una Work Order como la intervención completa de un Truck y permite Jobs de distintas Categories dentro de esa intervención.

Los documentos originales usados como evidencia no se modifican. Este paquete no afirma que la dirección objetivo ya esté implementada.

La auditoría del checkout `2d18680` está en
[`../audits/WORK_ORDER_MULTICATEGORY_AUDIT_2026-09-09.md`](../audits/WORK_ORDER_MULTICATEGORY_AUDIT_2026-09-09.md).
Después de actualizar desde `origin/main`, Yard Operations/Readiness Phase 1 es
CURRENT; la evolución Standard multi-Category permanece TARGET.

## Orden de lectura

1. [01_PRODUCT_DIRECTION_AND_DOMAIN_MODEL.md](./01_PRODUCT_DIRECTION_AND_DOMAIN_MODEL.md) — decisión maestra y lenguaje del dominio.
2. [02_DEVELOPMENT_PLAN.md](./02_DEVELOPMENT_PLAN.md) — entrega incremental, dependencias y gates.
3. [03_WORK_ORDER_EVOLUTION_PLAN.md](./03_WORK_ORDER_EVOLUTION_PLAN.md) — migración segura a Jobs multicategoría.
4. [04_YARD_OPERATIONS_READINESS_TRUCK_DETAIL.md](./04_YARD_OPERATIONS_READINESS_TRUCK_DETAIL.md) — alcance funcional y UX de Yard Operations.
5. [05_CODEX_PROMPTS.md](./05_CODEX_PROMPTS.md) — tres prompts listos para Codex.
6. [06_FLEETIO_BENCHMARK_AND_SCOPE_FILTER.md](./06_FLEETIO_BENCHMARK_AND_SCOPE_FILTER.md) — patrones confirmados en Fleetio y límites para no ampliar el Shop.

## Clasificación de afirmaciones

- **CURRENT**: comportamiento documentado como implementado; debe volver a verificarse en el checkout real.
- **LOCKED**: invariante vigente que no puede romperse durante esta evolución.
- **TARGET**: decisión de producto aprobada por este paquete, aún no necesariamente implementada.
- **DEFERRED**: dirección posible que requiere evidencia o una decisión posterior.

## Fuentes y precedencia

Si hay conflicto, Codex debe verificar el código y aplicar esta precedencia:

1. Comportamiento probado del checkout actual.
2. `README.md` y `CURRENT_PRODUCT_STATUS.md` para el estado implementado más reciente.
3. Este paquete para la dirección objetivo nueva.
4. `PRD_Lightning_Shop_Mechanic_P0.md` y `SHOP_ADMIN_INTEGRATION_BLUEPRINT.md` para intención, reglas no reemplazadas y arquitectura.
5. `ENGINEERING_PRACTICES.md`, `PERFORMANCE.md`, `DEPLOY.md` y `pm-daniel.md` para prácticas, operación, release y PM.

Una diferencia entre código y documentación no se “corrige” silenciosamente: se registra con evidencia y se resuelve antes de una migración irreversible.

## Fuentes consultadas

| Fuente | Uso principal |
| --- | --- |
| `README.md` | stack, reglas bloqueadas, rutas, pruebas y despliegue |
| `CURRENT_PRODUCT_STATUS.md` | estado realmente implementado, Admin, Standard y PM |
| `SHOP_ADMIN_INTEGRATION_BLUEPRINT.md` | autoridad, RBAC, auditoría, contratos Admin, brechas y fases |
| `PRD_Lightning_Shop_Mechanic_P0.md` | modelo conceptual, Jobs multicategoría, timers y casos borde |
| `ENGINEERING_PRACTICES.md` | data flow, caché, mutaciones, seguridad y validación |
| `PERFORMANCE.md` | targets P75 y baseline operacional |
| `DEPLOY.md` | checklist staging/production y rollback |
| `pm-daniel.md` | `mechanic.pm`, compatibilidad temporal y auditoría de millaje |

## Decisiones maestras

- **TARGET:** una Work Order representa una visita/intervención de servicio completa, no una Category, una fase o el trabajo de una sola persona.
- **TARGET:** cada Job posee su Category real; una Work Order puede contener Jobs de múltiples Categories.
- **LOCKED:** máximo una Work Order abierta por Truck, hasta que la operación demuestre y apruebe otra necesidad.
- **LOCKED:** Standard `Create Work Order` no inicia labor; PM es una excepción separada.
- **LOCKED:** completar un Job no pausa ni completa la Work Order.
- **LOCKED:** Work Order `Completed` no equivale a Truck `Ready to Go`/`Returned to Service`.
- **CURRENT/LOCKED:** Yard Phase, Readiness, Work Order Status y Job Category
  son dimensiones distintas; Yard Phase no crea Work Orders adicionales.
- **TARGET/DEFERRED:** Yard Presence, Service Location y Operational Status se
  incorporan como dimensiones separadas solo cuando tengan una fuente aprobada.
- **TARGET:** distinguir el problema reportado de la acción ejecutable: “air leak” puede ser el problema; “diagnose leak” y “replace hose” son Jobs.
- **DEFERRED:** timers/asignaciones por Job, motor configurable de reglas, integración Samsara/Dispatch y múltiples Work Orders abiertas.

## Decisiones aprobadas para implementación

- `primaryCategoryId` permanece requerido como Initial/Primary Category.
- Repair History filtra una Category cuando cualquier Job de la Work Order
  pertenece a ella; no solo por `primaryCategoryId`.
- Standard no puede agregar PM como Category; PM se ejecuta por el flujo
  especializado y la capability `mechanic.pm`.
- Dos Catalog Jobs con IDs distintos pueden coexistir aunque compartan display
  name normalizado. Los duplicados se detectan por `catalogJobId`; Custom Jobs,
  por nombre Custom normalizado.
- Add Job exige `expectedVersion` e `idempotencyKey` y deja Category/actor en el
  Activity Log.
- La garantía de una abierta por Truck conserva la serialización transaccional
  por Truck implementada; una constraint adicional queda sujeta a auditoría de
  datos y viabilidad del índice, no bloquea el contrato.
- Categories/Jobs inactivos permanecen visibles en historia, pero no se pueden
  seleccionar para trabajo nuevo.

## Benchmark Fleetio

La revisión del Help Center oficial de Fleetio se usa como benchmark de conceptos, no como especificación para copiar. Solo se incorporan patrones que simplifican y fortalecen el Shop actual. Partes, costos, vendors, warranties, Service Entries, Service Reminders configurables, workflows y statuses configurables permanecen fuera de alcance salvo aprobación futura.

## Cómo usar el paquete

Primero ejecutar el prompt de auditoría. Después actualizar documentación canónica mediante un PR exclusivo. Solo entonces implementar una fase pequeña, con migración aditiva, tests de regresión Standard/PM, Preview y rollback. No entregar todas las fases en un único PR.
