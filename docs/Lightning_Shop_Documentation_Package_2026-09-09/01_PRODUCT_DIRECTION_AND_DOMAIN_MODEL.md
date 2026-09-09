# Dirección de producto y modelo de dominio

## 1. Resultado de la reconciliación

Lightning Shop evoluciona de una aplicación de ejecución mecánica hacia tres capacidades conectadas:

- **Shop Operations:** ejecutar y administrar Work Orders y Jobs.
- **Yard Operations:** comprender y coordinar el progreso físico/operacional de Trucks.
- **Fleet Readiness:** explicar si un Truck puede volver a operar y qué lo bloquea.

La definición normativa es:

> A Work Order represents the complete maintenance/service intervention for a Truck. It may contain multiple Jobs across different Job Categories. Jobs describe the work. Yard Phases describe operational progression and do not create separate Work Orders. Work discovered during the same intervention is normally added to the existing open Work Order. A new Work Order is created for a new service event.

Esta decisión recupera una capacidad ya prevista en el PRD: `WorkOrderJob` conserva su propia Category y el caso BC07 permite agregar trabajo descubierto de otra Category. A la vez reconoce que el release actual implementa un picker bloqueado por Category y no permite mezclar Categories. [Fuentes: `PRD_Lightning_Shop_Mechanic_P0.md`, §§10, 13, 29, 32; `CURRENT_PRODUCT_STATUS.md`, “Standard mechanic work orders”.]

## 2. Qué permanece bloqueado

Estas reglas no cambian con Jobs multicategoría:

1. Solo una Work Order abierta por Truck.
2. Una Work Order Standard necesita al menos un Job.
3. Los duplicados canónicos y Custom Jobs normalizados siguen rechazándose.
4. Standard: crear no inicia labor; `Start Work` abre la primera sesión.
5. PM: la creación sí inicia en una transacción atómica y conserva su workflow especializado.
6. Completar un Job no pausa ni completa la Work Order.
7. No se puede completar normalmente con Jobs requeridos pendientes.
8. Timers se derivan de timestamps persistidos a nivel Work Order.
9. Work Order `Completed` y Truck `Returned to Service`/`Ready to Go` son acciones separadas.
10. Mutaciones sensibles conservan actor y Activity Log; no se borra historia operacional.
11. Standard nunca trata PM como una Category agregable; PM conserva su entrada y completion especializados bajo `mechanic.pm`.
12. Registros históricos de Categories/Jobs inactivos siguen legibles, pero los inactivos no se ofrecen para trabajo nuevo.

[Fuentes: `README.md`, “Locked product rules”; `SHOP_ADMIN_INTEGRATION_BLUEPRINT.md`, §4; `PRD_Lightning_Shop_Mechanic_P0.md`, §§19, 26–29.]

## 3. Entidades y responsabilidad

### Truck

Activo físico. Es el eje del historial y puede tener muchas Work Orders históricas, pero inicialmente no más de una abierta.

### Service Event / Intervention

Concepto de negocio representado inicialmente por la Work Order; no crear otra tabla solo para renombrarlo. Comienza cuando se abre la intervención y termina cuando se cierra. Si el Truck regresa después por un evento distinto, se crea otra Work Order.

### Work Order

Contenedor transaccional y auditable de la intervención: Truck, motivo/Category primaria compatible, prioridad, Jobs, participantes, sesiones, pausas, notas y Activity Log.

`primaryCategoryId` se mantiene requerido durante esta iniciativa como Initial/Primary Category para compatibilidad. No debe seguir siendo la validación que obliga a todos los Jobs a compartir Category.

### Job

Unidad concreta de trabajo. Cada `WorkOrderJob` conserva:

- Category propia;
- referencia estable al Catalog Job o descripción Custom original;
- snapshot de display name;
- status y auditoría de alta/finalización/cancelación.

Un cambio de Category no cambia el Work Order ni reinicia su timer.

### Reported Problem / Service Need

Describe lo observado o solicitado, no necesariamente la acción que lo corrige. Ejemplo:

```text
Reported Problem: Air leak near rear axle
Jobs:
- Diagnose air leak
- Replace damaged air hose
- Verify system pressure
```

Esta separación evita usar un síntoma como si fuera una tarea completada. Fleetio aplica una distinción equivalente entre `Issue` (problema inesperado) y `Service Task` (mantenimiento o reparación ejecutable), y permite resolver varios problemas dentro de una Work Order. Lightning adopta la lógica conceptual, pero **no añade ahora una entidad o módulo Issue**. En el alcance actual, el problema puede mantenerse en reason/notes o en el dato estructurado existente más cercano, hasta que evidencia real justifique modelarlo.

### Job Category

Taxonomía de la naturaleza del trabajo: Electrical, Brakes, Suspension, etc. No es fase, ubicación ni status.

### Work Session / Pause Event

Miden Active Labor y Waiting a nivel Work Order. No atribuir ese tiempo a Jobs ni Mechanics individuales. Los tiempos por Job son un cambio separado y diferido.

### Yard Phase

Representación operacional de dónde está el Truck en el proceso: por ejemplo Inspection, Repair, PM, Alignment, Detailing, Quality Check y Ready. Una fase puede ser omitida o repetida. No es la Category de un Job ni el Work Order Status.

La primera implementación debe preferir una fase derivada y explicable a partir del trabajo/requisitos actuales o una selección explícita auditada. No introducir una state machine rígida sin validar el flujo real.

### Yard Presence

Hecho de ubicación con fuente y frescura: `IN_YARD`, `OUTSIDE_YARD` o `UNKNOWN`. `EXTERNAL_SHOP` y `ROADSIDE` describen mejor Service Location; no deben confundirse con una geofence.

### Service Location

Dónde se ejecuta la intervención: `INTERNAL_SHOP`, `EXTERNAL_SHOP`, `ROADSIDE` o `UNKNOWN`. Una Work Order abierta no prueba presencia en la yard.

### Operational Status

Estado de disponibilidad operacional del Truck. Debe reutilizar primero cualquier estado/evento canónico existente; no inferirlo de texto libre.

### Readiness

Evaluación separada que responde “¿puede salir?” y “¿por qué no?”. Valores de presentación iniciales: `READY`, `NOT_READY`, `UNKNOWN`. Ready nunca se deduce solo de Work Order `Completed`.

### Blocker

Explicación accionable, inicialmente derivada de datos existentes: Work Order pausada, Pause Reason, Job requerido pendiente, Quality Check pendiente, aprobación/vendor/parts. No crear una tabla genérica de blockers hasta demostrar que las fuentes existentes no bastan.

## 4. Relaciones

```text
Truck
├── Work Orders (0..n historical; max 1 open initially)
│   ├── Jobs (1..n Standard; each Job -> one Category)
│   ├── Work Sessions
│   ├── Pause Events
│   ├── Mechanic Assignments (WO-level today)
│   ├── PM Service (specialized path when applicable)
│   └── Activity Log
├── Yard Presence observations
├── Operational/Service status events
└── Readiness assessment
    ├── requirements/checks
    ├── blockers
    └── authorized override, if later approved
```

## 5. Reglas de creación y continuidad

Agregar a la Work Order abierta cuando el trabajo:

- se descubre durante la inspección o reparación;
- pertenece a la misma visita/intervención;
- no requiere separar legal, financiera u operacionalmente el evento.

Crear una nueva Work Order cuando:

- el Truck regresa en otra fecha por un evento nuevo;
- es un Road Service o evento externo separado;
- la Work Order anterior ya cerró y reabrirla no corresponde;
- una futura regla aprobada exige separación por vendor/factura/garantía.

Mientras exista el límite de una abierta por Truck, un intento de crear otra debe dirigir a la existente y permitir agregar Jobs autorizados.

Fleetio respalda este patrón de agregación: una Work Order reúne múltiples Service Tasks y puede incluir varios Issues abiertos del mismo vehículo. Esto confirma que la unidad de trabajo no debe ser “una Work Order por Category”. No se adopta, sin embargo, ninguna regla comercial de Fleetio sobre número de órdenes abiertas; Lightning conserva su propia invariante de una WO abierta por Truck.

## 6. Semántica de completion

Completar la Work Order es un límite de dominio explícito:

- confirma que los Jobs requeridos de esa intervención quedaron resueltos o cancelados mediante una acción autorizada;
- congela la intervención para operación normal y deja historia auditable;
- habilita la actualización de historial/última ejecución de tareas cuando Lightning tenga ese dato;
- no significa por sí mismo que el Truck esté Ready to Go.

Fleetio también concentra efectos de mantenimiento al pasar una Work Order a un estado de tipo completed, conserva historial de cambios de status y maneja el estado del vehículo por separado. Lightning adopta esos principios, pero no copiará Service Entries ni statuses configurables en esta fase.

## 7. PM como workflow protegido

PM no debe convertirse automáticamente en un Job Standard durante esta migración.

- La autoridad actual es la capability `mechanic.pm`, no nombre/email y no el campo legacy `pmAuthorized`.
- PM inicia al crear, tiene un único PM mechanic asignado, una Work Session abierta, mileage observado, parts/fitment y criterios propios de finalización.
- `pmAuthorized` permanece solo por compatibilidad hasta estabilidad y una migración posterior.
- Un Admin sin `mechanic.pm` puede revisar PM, no ejecutarlo.

[Fuentes: `CURRENT_PRODUCT_STATUS.md`, “PM workflow”; `pm-daniel.md`; `README.md`, regla PM. Nota: referencias anteriores del Blueprint a `pmAuthorized` como autoridad son superadas por el estado vigente documentado.]

## 8. Separación de estados

| Dimensión | Pregunta | Ejemplo |
| --- | --- | --- |
| Work Order Status | ¿En qué estado está la intervención? | In Progress, Waiting, Completed |
| Job Status | ¿Se terminó la tarea? | To Do, Completed, Cancelled |
| Job Category | ¿Qué tipo de trabajo es? | Electrical |
| Yard Phase | ¿Dónde está en el proceso? | Alignment |
| Yard Presence | ¿Está físicamente en la yard? | In Yard |
| Service Location | ¿Dónde se hace el trabajo? | External Shop |
| Operational Status | ¿Está disponible operacionalmente? | Off Duty / In Service |
| Readiness | ¿Cumple para salir y por qué? | Not Ready: QC pending |

Ningún campo `status` debe intentar representar todas estas dimensiones.

## 9. Decisiones diferidas

- múltiples Work Orders abiertas por Truck;
- assignment y timers a nivel Job;
- reglas configurables mediante un rules engine;
- obligatoriedad universal de PM, Alignment o Detailing en cada visita;
- inferencia de Incoming/Outgoing desde Samsara;
- integración Samsara, Dispatch o McLeod sin contratos y datos reales;
- dual-write permanente con Ninox.
- módulo separado de Issues/Reported Problems y automatización Inspection -> Issue;
- Service Entries, Service Reminders, Parts/Labor/Costing, invoices, warranties y vendors al estilo Fleetio;
- statuses configurables por administradores.

## 10. Evidencia externa y límites

La evidencia Fleetio utilizada proviene de su Help Center oficial:

- [Service Tasks vs. Issues, Service Entries vs. Work Orders](https://help.fleetio.com/maintenance/service-tasks-vs-issues-service-entries-vs-work-orders)
- [Work Order Line Items](https://help.fleetio.com/en_US/work-order-line-items-service-tasks-labor-parts)
- [Work Order Statuses](https://help.fleetio.com/en_US/work-orders/work-order-statuses)
- [Vehicle Statuses](https://help.fleetio.com/en_US/vehicle-statuses)
- [Issues Overview](https://help.fleetio.com/maintenance/issues-overview)

Estas fuentes validan patrones; no prueban que sus decisiones sean correctas para todas las operaciones de Lightning.

## 11. Criterios para evitar otro loop

Un cambio de dominio futuro debe traer: problema real, ejemplos, decisión, alternativas rechazadas, impacto en reglas actuales, estrategia backward-compatible, migración/rollback y evidencia operativa. No convertir una simplificación existente en “verdad del negocio”, ni una idea de UI en una regla del backend.
