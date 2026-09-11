# Yard Operations, Readiness y Truck Detail

> ⚠️ HISTORICAL DOCUMENT
> This document is preserved for historical/reference purposes and is not current product authority.
> See `docs/LIGHTNING_SHOP_MASTER_PRD.md`.

Estado al 2026-09-09: **CURRENT** para Yard Operations/Readiness Phase 1. El
contrato implementado está en
[`../YARD_OPERATIONS_PHASE_1_CONTRACT.md`](../YARD_OPERATIONS_PHASE_1_CONTRACT.md).
Los feeds de Presence/Incoming/Departures, `Returned to Service`, rules engine e
integraciones externas permanecen **DEFERRED**. La futura UI multicategoría debe
agrupar Jobs por Category sin alterar las reglas de readiness.

## 1. Objetivo

Yard Operations debe responder “¿qué necesita atención ahora?”. El Dashboard responde “¿qué está pasando?”. Truck Detail responde “¿cuál es la historia y condición de esta unidad?”. No convertir el Dashboard en el centro completo de operación.

## 2. Modelo de información

Para cada Truck mostrar dimensiones independientes y su procedencia:

- **Presence:** In Yard / Outside Yard / Unknown.
- **Service Location:** Internal Shop / External Shop / Roadside / Unknown.
- **Operational Status:** reutilizar estado canónico/eventos aprobados.
- **Active Intervention:** Work Order abierta y progreso.
- **Yard Phase:** etapa actual explicable.
- **Readiness:** Ready / Not Ready / Unknown, con requisitos y blockers.
- **Movement Plan:** Incoming/Outgoing solo si existe fuente Dispatch/plan manual confiable.

Samsara puede aportar ubicación/presencia mediante geofence y timestamp. No demuestra que un Truck vaya a salir mañana. Una WO interna puede ser señal contextual, pero no prueba universal de Presence.

## 3. Yard Phase

Flujo de presentación sugerido:

```text
Arrival -> Inspection -> Required Work -> PM -> Alignment -> Detailing -> Quality Check -> Ready
```

No imponerlo como secuencia universal. Heavy Repair es condicional; PM, Alignment y Detailing deben convertirse en requisitos obligatorios solo después de validar las reglas reales. Un Truck puede saltar, repetir o recibir override autorizado.

Prioridad de implementación:

1. fase derivada read-only con explicación;
2. selección/corrección manual auditada si hace falta;
3. automatización solo cuando existan reglas estables.

## 4. Readiness MVP

Evitar un rules engine configurable en la primera versión. Comenzar con checks explícitos aprobados:

```text
Ready = required checks resolved
        AND no blocking open internal work
        AND final authorization/QC satisfied
```

La UI debe explicar:

```text
Not Ready
✓ Inspection complete
✓ Required repairs complete
○ Alignment pending
✕ Quality Check blocked
```

`Mark Ready to Go`/`Return to Service`:

- permiso server-side específico;
- razón/confirmación según riesgo;
- actor, timestamp, before/after y fuente;
- optimistic concurrency e idempotencia;
- no modifica retroactivamente la Work Order.

Un override no borra requisitos fallidos; registra quién aceptó la excepción y por qué.

## 5. Blockers

Primero derivar de:

- WO Waiting/Paused y current Pause Reason;
- Jobs requeridos pendientes;
- parts/approval/vendor/bay cuando existan como datos estructurados;
- QC/readiness checks pendientes.

Cada blocker necesita label, source record, age y acción/navegación. Texto libre no debe alimentar métricas sin mapping.

## 6. Yard Operations Board

Ofrecer Table/List como vista primaria por accesibilidad, densidad, filtros y mobile. Kanban puede coexistir si el equipo realmente mueve Trucks entre fases.

Cada card/fila debe mostrar como máximo:

- Truck number;
- current phase y tiempo desde el evento verificable;
- priority;
- WO/progreso de Jobs;
- blocker principal;
- readiness indicator;
- service location/presence cuando importe.

Filtros: phase, readiness, presence, service location, priority, blocker y búsqueda de Truck. No implementar drag-and-drop hasta definir si cambia fase, qué permiso requiere, cómo se audita y cómo se resuelven conflictos.

## 7. Truck Detail

### Encabezado

Truck number, make/model/year, VIN si existe y está autorizado, mileage con timestamp/source, company/owner, driver/team solo si existe fuente real.

### Estado operacional

Presence + freshness/source, Service Location, Operational Status, Readiness y lista de blockers/checks.

### Intervención activa

WO ID/status/priority/age, Mechanics a nivel WO, Jobs agrupados por Category, progreso, pausa vigente y acciones según RBAC. No mostrar tiempos por Job.

### Historial

Work Orders paginadas, PM records, Jobs, repairs/external work y eventos readiness/service. Reutilizar las entidades actuales; no crear un segundo `truck_history` duplicado.

Fleetio conserva un historial de cambios del status del vehículo con estado anterior, nuevo estado, fecha y usuario. Para Lightning, este es un buen patrón mínimo para Operational Status y Ready/Return to Service: eventos auditables append-only y estado actual derivado, sin convertir Work Order completion en Truck availability.

### Estados UX obligatorios

Loading local por sección, empty útil, unavailable por falta de fuente, stale data, error con Retry, permiso denegado, conflicto 409 y confirmación de acciones críticas. EN/ES deben usar el mismo árbol de componentes; `Truck`, `Work Order`, `Job` y `Off Duty` permanecen canónicos.

## 8. Contratos sugeridos

Lecturas Admin separadas, sin cambiar silenciosamente la semántica mechanic:

- `GET /api/admin/trucks`
- `GET /api/admin/trucks/:id`
- `GET /api/admin/yard-operations`
- `GET /api/admin/trucks/:id/readiness`

Mutaciones CURRENT de readiness Phase 1:

- `POST /api/admin/trucks/:id/readiness-assessments`
- `PATCH /api/admin/readiness-assessments/:id/requirements/:type`
- `POST /api/admin/readiness-assessments/:id/mark-ready`
- `POST /api/admin/readiness-assessments/:id/close`

`Return to Service` y eventos de Operational Status permanecen DEFERRED.

## 9. Métricas permitidas y diferidas

Permitidas cuando hay fuentes reconciliadas: Trucks In Yard, Ready, Not Ready, por fase, con blocker, aging desde un evento real.

Diferidas: departures futuras sin Dispatch, average downtime sin evento de inicio/fin canónico, Job labor, productividad individual y cualquier KPI que mezcle Ninox/Supabase sin deduplicación.

## 10. Aceptación

- Un Truck con WO Completed puede seguir Not Ready.
- Un Truck External Shop no aparece como In Yard por tener WO abierta.
- Cada readiness/blocker/fase explica su fuente.
- Unknown no se convierte en cero ni “Ready”.
- La vista funciona en 390×844, 834×1194 y desktop sin overflow.
- RBAC protege datos y mutaciones en servidor.
- Lecturas grandes usan paginación/filtros server-side y no generan waterfalls.

[Fuentes: `SHOP_ADMIN_INTEGRATION_BLUEPRINT.md`, §§7–14; `CURRENT_PRODUCT_STATUS.md`, Admin y next steps; `ENGINEERING_PRACTICES.md`; `PRD_Lightning_Shop_Mechanic_P0.md`, §27 y arquitectura Manager.]

Benchmark externo: [Fleetio Vehicle Statuses](https://help.fleetio.com/en_US/vehicle-statuses) y [Fleetio Work Order Statuses](https://help.fleetio.com/en_US/work-orders/work-order-statuses).
