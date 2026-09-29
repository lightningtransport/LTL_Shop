> **ARCHIVADO (2026-09-29).** Documento histórico: no describe el sistema actual y no manda sobre el código. La fuente vigente es [`docs/README.md`](../README.md).

# PRD V1 — Lightning Shop (corte de alcance)

> ⚠️ DEPRECATED
> Do not use this document for new implementation decisions.
> See `docs/LIGHTNING_SHOP_MASTER_PRD.md`.
>
> Statements below about precedence, incomplete Manager work, or deferred Job
> assignment are preserved exactly as a draft snapshot and are not current.
> `docs/CURRENT_PRODUCT_STATUS.md` records the audited implementation.

**Estado:** borrador para revisión de producto
**Fecha:** 2026-09-11
**Idioma de revisión:** español
**Términos canónicos (no traducir):** Truck, Work Order, Job, Off Duty, Ready to Go

Este documento **no reemplaza** el PRD histórico del mecánico ni el paquete de
dirección. Es el corte que falta: qué significa *terminado* para poder usarlo
en el Shop, y qué queda explícitamente fuera hasta una versión posterior.

Si hay conflicto con documentos anteriores, este PRD manda para el alcance de
V1. El código y `CURRENT_PRODUCT_STATUS.md` mandan para lo que ya existe.

---

## 1. Por qué no terminamos

Hay al menos cuatro definiciones de “el producto” conviviendo:

| Fuente | Qué promete | Problema |
| --- | --- | --- |
| `PRD_Lightning_Shop_Mechanic_P0.md` | El mecánico crea la Work Order; Ninox es la fuente de verdad | Histórico. El código ya usa Supabase/Prisma. El ownership TARGET lo contradice. |
| Paquete 2026-09-09 | Shop Operations + Yard + Readiness | Amplió el P0 a tres productos. Yard Phase 1 ya está; Presence/Dispatch no. |
| `WORK_ORDER_OWNERSHIP_MIGRATION.md` | El Manager planifica; el mecánico solo ejecuta | Es un cambio de producto, no un cierre de P0. Siete slices. Soft cutover + retiro legacy. |
| `CURRENT_PRODUCT_STATUS.md` | Lo que el código hace hoy | El mecánico **sigue** creando y pausando. Admin ya corrige, cancela, reabre y asigna a nivel Work Order. |

Mientras el P0, el Admin, Yard y la migración de ownership se traten como un
solo backlog, cada semana abre un frente nuevo antes de cerrar el anterior.

**Decisión que este PRD pide:** congelar V1 como el producto que ya opera, más
el corte de producción. Todo lo demás es V2+ y requiere aprobación explícita.

---

## 2. Qué es Lightning Shop

Lightning Shop es el sistema de piso del taller de Lightning para registrar y
controlar el trabajo sobre Trucks.

Tres capacidades de producto (solo la primera es V1 completa):

1. **Shop Operations (V1):** crear, ejecutar, pausar, completar y auditar
   Work Orders y Jobs. Admin observa y corrige.
2. **Yard Operations (V1 parcial):** ver el progreso operacional del Truck.
   Mutar readiness solo con `yard.operations.manage`. Presence y movimientos
   de patio **no** están en V1.
3. **Fleet Readiness (V1 mínima):** Ready to Go es una aprobación explícita,
   distinta de Work Order Completed. No hay telemática ni Off Duty.

### Usuarios

| Usuario | Capacidades | Qué hace en V1 |
| --- | --- | --- |
| Mechanic Standard | `mechanic.standard` | Crea y ejecuta Work Orders Standard. Start, Jobs, pause/resume, finish. |
| Mechanic PM | `mechanic.pm` | Flujo PM especializado: create=start, mileage, parts, finish. |
| Manager / Admin | `admin.access` (+ `work_orders.manage` donde ya exista) | Dashboard, listas, detalle, correcciones auditadas, catálogo de solo lectura. |
| Yard | `yard.operations.manage` | Assessments y Ready explícito. No Presence. |

Un rol clasifica al usuario. Las mutaciones las autorizan **capabilities**
persistidas, no el JWT ni metadata editable.

---

## 3. Resultado de V1 (criterio de éxito)

Un día de taller se puede operar **sin Ninox** para el tracking de Shop:

1. El mecánico entra, encuentra el Truck, crea o abre la Work Order existente.
2. Selecciona Jobs del catálogo (varias Categories no-PM en Standard).
3. Inicia labor con Start Work (Standard) o create-start atómico (PM).
4. Completa Jobs, agrega trabajo descubierto, pausa con motivo, reanuda, finaliza.
5. El Manager ve el estado, corrige tiempo/prioridad/notas, cancela o reabre,
   asigna mecánicos a la Work Order, y puede marcar Returned to Service.
6. El sistema reconstruye quién, Truck, Work Order, Jobs, Active Labor,
   Waiting y Activity Log.

**V1 no exige** que el Manager sea quien crea la Work Order. Eso es V2.

---

## 4. Reglas bloqueadas (no se discuten en V1)

1. Una sola Work Order abierta por Truck.
2. Standard: Create ≠ Start. PM: create sí inicia.
3. Completar un Job no pausa ni completa la Work Order.
4. Work Order Completed ≠ Ready to Go / Returned to Service.
5. Timers desde timestamps persistidos, nunca un contador solo en el cliente.
6. Standard no trata PM como Category agregable.
7. Yard Phase no es Category, no es Work Order Status, y no crea Work Orders.
8. Prisma es la única autoridad de migraciones. Ninox live está diferido.

---

## 5. Alcance V1 — ya implementado (congelar)

Tratar esto como **hecho**. No reabrir el modelo salvo bug de producción.

### Mechanic Standard

- Login compartido; destino inicial según clasificación.
- Home: activas, pausadas, crear.
- Truck search, Truck info, repair history, una abierta por Truck.
- Categories + Job Catalog + aliases + Custom Job (“Job not listed”).
- Multi-Category en la misma Work Order; `primaryCategoryId` sigue como
  Initial/Primary; cada Job guarda su Category.
- Working With, priority al crear, notes.
- Start / pause (motivo) / change pause reason / resume / complete.
- Activity Log. EN/ES en un solo árbol de componentes.

### Mechanic PM

- Autorizado solo por `mechanic.pm`.
- Create-start atómico, un PM mechanic, mileage observado, parts/fitment,
  pause/finish con reglas propias.

### Admin

- Shell `/admin` protegido; 403 sin `admin.access`.
- Dashboard operativo (conteos y atención; sin downtime promedio ni Off Duty).
- Lista y detalle de Work Orders; filtros, paginación, asignación a nivel WO,
  cancel/complete/reopen, PATCH priority/notes, corrección de tiempo, cancelar
  o reabrir Jobs to-do, Returned to Service.
- Catálogo, Trucks, Mechanics, History: **solo lectura**.
- Yard Operations Phase 1 + Truck Detail: Presence `UNKNOWN`; no Incoming/
  Departures. Readiness mutable con `yard.operations.manage`.

### Plataforma

- Next.js + NestJS + Prisma + Supabase Postgres/Auth.
- Web y API en Vercel.
- Capabilities: `admin.access`, `mechanic.standard`, `mechanic.pm`,
  `yard.operations.manage`, y `work_orders.manage` (ya en schema; uso Manager
  create en progreso, no es el criterio de V1).

---

## 6. Huecos de V1 — lo único que falta para llamar “ship”

Estos ítems **sí** están en V1. No son features nuevas de dominio.

| ID | Hueco | Done when |
| --- | --- | --- |
| V1-01 | Usuarios reales de producción en Supabase Auth, ligados a `users` | Cada mecánico/manager operativo puede entrar sin Dev Login |
| V1-02 | Smoke de producción: reset de contraseña + Safari móvil | Flujo login → Standard → Start → Job → pause/resume → finish, y PM, en dispositivo real |
| V1-03 | Estabilizar lo que está abierto en el working tree (catálogo, login, create Admin, E2E) | CI verde; no mezclar ownership incompleto con bugs de V1 |
| V1-04 | Declarar este PRD como alcance vigente | El equipo deja de implementar slices de ownership / Fleetio / Ninox como si fueran P0 |
| V1-05 | Quitar `pmAuthorized` **después** de estabilidad en producción | Columna legacy fuera; no bloquea el ship inicial |

**Fuera de esta lista no hay V1.** Un bug que impide el día de taller sí entra.
Una idea nueva no.

---

## 7. Fuera de V1 (V2 o más tarde, aprobación explícita)

No implementar, no “aprovechar el PR”, no dejar a medias.

### Cambio de ownership (el mayor distractor)

El plan de 7 slices convierte al Manager en quien crea, prioriza, asigna por
Job, pausa y gestiona blockers, y al mecánico en ejecutor de trabajo asignado.

Eso **invalida** el P0 original y gran parte de los E2E del mecánico. Es un
producto distinto.

- **V2 candidato:** Manager *también* puede crear (aditivo). El mecánico sigue
  pudiendo crear. Soft cutover sin retirar el flujo actual.
- **V3 candidato:** retirar Create/priority/pause global del mecánico.
  Assignment por Job, report blocker vs pause oficial.

Hasta que V1 esté en uso real en el Shop, no hay evidencia para V3.

### Diferido de verdad

- Escritura de Job Catalog, mapeo de Custom Jobs, Job Performance.
- Timers o assignment por Job (salvo que se apruebe V2/V3).
- Múltiples Work Orders abiertas por Truck.
- Ninox live / dual-write.
- Samsara, McLeod, Dispatch, Incoming/Outgoing, Presence real.
- Off Duty, downtime averages, rankings de mecánicos.
- Módulo Issue, Service Entries, parts costing, vendors, purchasing.
- Motor de reglas, statuses configurables, PWA avanzada, realtime.
- UI general de administración de permisos.

---

## 8. Decisiones para revisar (marcar una)

### D1 — Definición de “terminado”

- **A (recomendado):** V1 = producto actual + usuarios de producción + smoke.
  Ownership queda fuera.
- **B:** V1 incluye Manager create **aditivo** (el mecánico sigue creando).
  Parar ahí. No quitar CTAs del mecánico.
- **C:** V1 incluye la migración completa de ownership (slices 1–6).
  Aceptar que “terminar” son semanas más y E2E rotos a propósito.

### D2 — Quién usa el Shop primero

- Pilot solo mecánicos Standard + un Manager en lectura/corrección.
- Pilot incluye PM (Daniel) el mismo día.
- No hay pilot hasta que exista create de Manager.

### D3 — Yard en V1

- Dejar Phase 1 como está (Presence UNKNOWN). No más Yard hasta fuente real.
- Sacar Yard del piloto y tratarlo como demo interna.

---

## 9. Qué deja de ser autoridad

Usar como **historia / intención**, no como backlog activo:

- Secciones Ninox / hosting no-Vercel del PRD P0.
- “El mecánico crea la Work Order” como verdad permanente (sigue siendo
  **CURRENT**; deja de ser TARGET).
- Fases 7 del plan de desarrollo (integraciones) como trabajo inmediato.
- Slice 5–7 de ownership hasta D1 = C.
- Benchmark Fleetio como lista de features a copiar.

Precedencia mientras V1 no esté shippeada:

1. Este PRD (alcance).
2. Código + `CURRENT_PRODUCT_STATUS.md` (qué existe).
3. Paquete 2026-09-09 (modelo de dominio y reglas LOCKED).
4. PRD P0 (flujos del mecánico que siguen CURRENT).
5. Blueprint Admin (pantallas Admin ya cubiertas; no abrir catálogo write).

---

## 10. Definition of Done de V1

V1 está cerrada cuando:

- [ ] D1/D2/D3 están marcadas por producto.
- [ ] Un día Standard + PM se puede ejecutar en producción con usuarios reales.
- [ ] Admin puede observar y corregir esa intervención.
- [ ] No hay slices de ownership, Ninox, Samsara ni catálogo write en vuelo.
- [ ] `CURRENT_PRODUCT_STATUS.md` y este PRD coinciden.
- [ ] El PRD P0 queda etiquetado como histórico para Ninox y como CURRENT
      solo donde el código del mecánico aún lo cumple.

Cualquier PR posterior debe responder: **¿esto es un hueco de V1 (tabla §6)
o una petición de V2?** Si es V2, no entra sin una línea en este documento.
